import 'server-only'
import { clienteAdmin } from '@/lib/supabase/admin'
import { referenciaValida } from '@/lib/seguridad'
import { adaptadorDe } from '@/lib/redes'
import type { CredencialCuenta } from '@/lib/redes'
import { INTENTOS_MAXIMOS, proximoIntentoAt } from '@/lib/dominio/cola'
import { avisar } from './avisos'
import { prepararVideoDePieza } from './video'
import type { CuentaSocial } from '@/lib/database.types'

/**
 * Módulo 4 · Publicación.
 *
 * Recorre lo que ya tiene hora y lo suelta en su red. Cada red lleva su propio
 * estado, así que un fallo en Instagram deja intacto lo que sí salió en YouTube.
 * La escucha de comentarios se activa sola: el trigger de la base lo hace en
 * cuanto la publicación devuelve su identificador externo.
 */

export type ResumenPublicacion = {
  intentadas: number
  publicadas: number
  borradores: number
  fallidas: number
  pausadas: number
  detalle: Array<{ publicacion: string; estado: string; nota?: string }>
}

/**
 * La credencial se guarda por referencia, y el valor vive en el entorno. Así el
 * token nunca queda en la base ni viaja al navegador.
 */
function credencialDe(cuenta: CuentaSocial): CredencialCuenta | null {
  // La referencia viene de la base y aquí se usa para leer una variable de
  // entorno. Sin esta comprobación, una referencia mal puesta en Ajustes haría
  // que el sistema enviara un secreto del sistema a la plataforma.
  if (!referenciaValida(cuenta.credential_ref)) return null

  const token = process.env[cuenta.credential_ref]
  if (!token) return null
  const pageId = process.env[`${cuenta.credential_ref}_PAGE_ID`]
  return {
    cuentaId: cuenta.id,
    red: cuenta.red,
    externalAccountId: cuenta.external_account_id,
    token,
    publicacionDirecta: cuenta.publicacion_directa,
    cupoRespuestasDia: cuenta.cupo_respuestas_dia,
    ...(pageId ? { pageId } : {}),
  }
}

export async function publicarPendientes(ahora: Date = new Date()): Promise<ResumenPublicacion> {
  const supabase = clienteAdmin()
  const resumen: ResumenPublicacion = {
    intentadas: 0,
    publicadas: 0,
    borradores: 0,
    fallidas: 0,
    pausadas: 0,
    detalle: [],
  }

  const { data: pendientes } = await supabase
    .from('publications')
    .select('*')
    .in('estado', ['pendiente', 'fallido'])
    .lte('programado_at', ahora.toISOString())
    .order('programado_at', { ascending: true })
    .limit(50)

  for (const publicacion of pendientes ?? []) {
    if (publicacion.proximo_intento_at && new Date(publicacion.proximo_intento_at) > ahora) continue
    if (publicacion.intentos >= INTENTOS_MAXIMOS) continue

    const { data: cuenta } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', publicacion.social_account_id)
      .single()

    if (!cuenta || !cuenta.activa) {
      resumen.pausadas++
      resumen.detalle.push({ publicacion: publicacion.id, estado: 'pausada', nota: 'la cuenta está en pausa' })
      continue
    }

    // El token vencido pausa la cuenta en lugar de gastar intentos.
    if (cuenta.token_expira_at && new Date(cuenta.token_expira_at) <= ahora) {
      await supabase.from('social_accounts').update({ activa: false }).eq('id', cuenta.id)
      await supabase
        .from('publications')
        .update({ ultimo_error: 'El token de la cuenta venció. Renuévalo en Ajustes.' })
        .eq('id', publicacion.id)
      await avisar({
        tipo: 'token_por_vencer',
        clave: `token-vencido:${cuenta.id}:${cuenta.token_expira_at}`,
        titulo: `El acceso de ${cuenta.handle} venció`,
        detalle: 'La cuenta quedó en pausa. Renueva el token y vuelve a activarla en Ajustes.',
        brandId: cuenta.brand_id,
      })
      resumen.pausadas++
      resumen.detalle.push({ publicacion: publicacion.id, estado: 'pausada', nota: 'token vencido' })
      continue
    }

    const credencial = credencialDe(cuenta)
    if (!credencial) {
      resumen.pausadas++
      resumen.detalle.push({
        publicacion: publicacion.id,
        estado: 'pausada',
        nota: `falta la variable ${cuenta.credential_ref}`,
      })
      continue
    }

    const { data: pieza } = await supabase
      .from('pieces')
      .select('*')
      .eq('id', publicacion.piece_id)
      .single()

    if (!pieza) {
      resumen.fallidas++
      resumen.detalle.push({ publicacion: publicacion.id, estado: 'fallida', nota: 'la pieza ya no existe' })
      continue
    }

    // La plataforma descarga el video por su cuenta, así que necesita una URL
    // pública. El enlace de Drive pide sesión y devuelve una página, no el
    // archivo: la copia en Storage es lo único que sirve aquí.
    const copia = await prepararVideoDePieza(pieza.id)
    if (!copia.ok) {
      const intentos = publicacion.intentos + 1
      const siguiente = proximoIntentoAt(intentos, ahora)
      await supabase
        .from('publications')
        .update({
          estado: 'fallido',
          intentos,
          proximo_intento_at: siguiente ? siguiente.toISOString() : null,
          ultimo_error: `El video no quedó listo: ${copia.error}`,
        })
        .eq('id', publicacion.id)

      resumen.fallidas++
      resumen.detalle.push({ publicacion: publicacion.id, estado: 'fallida', nota: copia.error })
      continue
    }
    const videoUrl = copia.url

    /**
     * Toma la publicación de forma atómica.
     *
     * Los trabajos corren cada cinco minutos, y publicar un reel puede tardar
     * más que eso: el contenedor, el procesado de hasta dos minutos y la
     * publicación. Cuando una corrida se pasa de su intervalo, la plataforma
     * lanza la siguiente encima, y las dos leían el mismo lote.
     *
     * Este update solo toca la fila si sigue en el estado en que se leyó. La
     * corrida que llega segunda toca cero filas y sigue de largo, en lugar de
     * publicar la misma pieza otra vez.
     */
    const { data: tomadas } = await supabase
      .from('publications')
      .update({ estado: 'publicando' })
      .eq('id', publicacion.id)
      .eq('estado', publicacion.estado)
      .select('id')

    resumen.intentadas++

    if ((tomadas ?? []).length === 0) {
      resumen.detalle.push({
        publicacion: publicacion.id,
        estado: 'omitida',
        nota: 'otra corrida la tomó primero',
      })
      continue
    }

    const salida = await adaptadorDe(cuenta.red).publicar(
      credencial,
      {
        videoUrl,
        caption: publicacion.caption_final ?? pieza.caption_base ?? '',
        titulo: pieza.tema,
      },
      // El contenedor de un intento anterior se retoma: subir el video otra vez
      // gasta cuota y deja huérfano el anterior.
      publicacion.container_id,
    )

    if (salida.estado === 'publicado') {
      // El trigger de la base activa la palabra clave con este identificador.
      await supabase
        .from('publications')
        .update({
          estado: 'publicado',
          external_post_id: salida.externalPostId,
          permalink: salida.permalink,
          publicado_at: new Date().toISOString(),
          container_id: null,
          ultimo_error: null,
        })
        .eq('id', publicacion.id)
      // La copia cumplió. Se marca para borrarla en 24 horas, con margen por si
      // la plataforma vuelve a pedir el archivo mientras procesa.
      await supabase
        .from('pieces')
        .update({ storage_expira_at: new Date(ahora.getTime() + 86_400_000).toISOString() })
        .eq('id', pieza.id)

      resumen.publicadas++
      resumen.detalle.push({ publicacion: publicacion.id, estado: 'publicada' })
      continue
    }

    if (salida.estado === 'borrador') {
      await supabase
        .from('publications')
        .update({
          estado: 'pendiente',
          ultimo_error: salida.nota,
          external_post_id: salida.referencia,
        })
        .eq('id', publicacion.id)
      await avisar({
        tipo: 'borrador_tiktok',
        clave: `borrador:${publicacion.id}`,
        titulo: `"${pieza.tema}" espera en el buzón de TikTok`,
        detalle: salida.nota,
        brandId: cuenta.brand_id,
        pieceId: pieza.id,
      })
      resumen.borradores++
      resumen.detalle.push({ publicacion: publicacion.id, estado: 'borrador', nota: salida.nota })
      continue
    }

    const intentos = publicacion.intentos + 1

    // Hay tres esperas y tres intentos, así que en el tercero la espera todavía
    // existe aunque ese intento ya sea el último: la cola lo descarta después
    // por el tope. Mirar solo la espera dejaba el aviso sin dispararse nunca.
    const quedanIntentos = salida.reintentable && intentos < INTENTOS_MAXIMOS
    const siguiente = quedanIntentos ? proximoIntentoAt(intentos, ahora) : null

    await supabase
      .from('publications')
      .update({
        estado: 'fallido',
        intentos,
        proximo_intento_at: siguiente ? siguiente.toISOString() : null,
        ultimo_error: salida.error,
        // Se guarda para retomarlo, y se limpia cuando el contenedor quedó
        // inservible: ahí el reintento tiene que partir de cero.
        container_id: salida.contenedorId ?? null,
      })
      .eq('id', publicacion.id)

    // Solo avisa cuando ya no hay reintento: un fallo pasajero se resuelve solo.
    if (!quedanIntentos) {
      await avisar({
        tipo: 'publicacion_fallida',
        clave: `fallida:${publicacion.id}:${intentos}`,
        titulo: `"${pieza.tema}" no salió en ${cuenta.red}`,
        detalle: salida.error,
        brandId: cuenta.brand_id,
        pieceId: pieza.id,
      })
    }

    resumen.fallidas++
    resumen.detalle.push({
      publicacion: publicacion.id,
      estado: 'fallida',
      nota: siguiente ? `${salida.error} · reintento a las ${siguiente.toISOString()}` : salida.error,
    })
  }

  return resumen
}
