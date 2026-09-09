import 'server-only'
import { clienteAdmin } from '@/lib/supabase/admin'
import { referenciaValida } from '@/lib/seguridad'
import { adaptadorDe, type ComentarioEntrante, type CredencialCuenta } from '@/lib/redes'
import { almacenReal } from './almacen'
import { procesarComentarios, type Automatizacion, type ResumenMotor } from './motor'

/**
 * Módulo 5 · Escucha de comentarios.
 *
 * El webhook manda y el sondeo respalda: la latencia del webhook llega a 30
 * segundos en hora pico, y una entrega puede perderse. Los dos caminos entran
 * por la misma puerta, y la idempotencia decide.
 */

type Contexto = {
  automatizacion: Automatizacion
  credencial: CredencialCuenta
  keywordId: string
}

async function contextoDePublicacion(publicationId: string): Promise<Contexto | null> {
  const supabase = clienteAdmin()

  const { data: publicacion } = await supabase
    .from('publications')
    .select('*')
    .eq('id', publicationId)
    .single()
  if (!publicacion?.external_post_id) return null

  const { data: cuenta } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('id', publicacion.social_account_id)
    .single()
  if (!cuenta) return null

  // La referencia viene de la base y aquí se usa para leer una variable de
  // entorno. Sin esta comprobación, una referencia mal puesta en Ajustes haría
  // que el sistema enviara un secreto del sistema a la plataforma.
  if (!referenciaValida(cuenta.credential_ref)) return null

  const token = process.env[cuenta.credential_ref]
  if (!token) return null

  const { data: clave } = await supabase
    .from('keywords')
    .select('*')
    .eq('piece_id', publicacion.piece_id)
    .single()
  if (!clave) return null

  const { data: plantilla } = await supabase
    .from('dm_templates')
    .select('*')
    .eq('piece_id', publicacion.piece_id)
    .single()
  if (!plantilla) return null

  const { data: enlace } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('piece_id', publicacion.piece_id)
    .single()

  const base = process.env.APP_URL ?? 'http://localhost:3000'
  const pageId = process.env[`${cuenta.credential_ref}_PAGE_ID`]

  return {
    keywordId: clave.id,
    credencial: {
      cuentaId: cuenta.id,
      red: cuenta.red,
      externalAccountId: cuenta.external_account_id,
      token,
      ...(pageId ? { pageId } : {}),
    },
    automatizacion: {
      publicationId: publicacion.id,
      externalPostId: publicacion.external_post_id,
      red: cuenta.red,
      palabra: clave.palabra,
      variantes: clave.variantes,
      mensaje: plantilla.mensaje,
      enlace: enlace ? `${base}/r/${enlace.slug}` : plantilla.destino_url,
      claveActivaDesde: clave.activa_desde ? new Date(clave.activa_desde) : null,
      claveActivaHasta: clave.activa_hasta ? new Date(clave.activa_hasta) : null,
    },
  }
}

/** Entrada del webhook: comentarios que ya llegaron con su contenido. */
export async function atenderComentarios(
  publicationId: string,
  entrantes: ComentarioEntrante[],
): Promise<ResumenMotor | null> {
  const contexto = await contextoDePublicacion(publicationId)
  if (!contexto) return null

  return procesarComentarios(
    entrantes,
    contexto.automatizacion,
    adaptadorDe(contexto.automatizacion.red),
    contexto.credencial,
    almacenReal(contexto.keywordId),
  )
}

/**
 * Respaldo del webhook. Recorre las publicaciones con palabra clave vigente y
 * relee sus comentarios recientes. Lo que el webhook ya atendió sale gratis:
 * queda descartado por duplicado.
 */
export async function sondearComentarios(ahora: Date = new Date()): Promise<ResumenMotor[]> {
  const supabase = clienteAdmin()
  const salida: ResumenMotor[] = []

  const { data: publicaciones } = await supabase
    .from('publications')
    .select('id, piece_id, external_post_id')
    .eq('estado', 'publicado')
    .not('external_post_id', 'is', null)
    .order('publicado_at', { ascending: false })
    .limit(60)

  /**
   * Las palabras clave, de una sola vez.
   *
   * Armar el contexto de cada publicación cuesta cinco consultas, y este
   * trabajo corre cada cinco minutos sobre sesenta publicaciones: eran
   * trescientos viajes a la base por corrida, casi todos para descubrir que la
   * palabra clave ya venció y no había nada que hacer. Ese descarte ahora sale
   * de una sola consulta, y el contexto completo solo se arma para las que
   * siguen vivas.
   */
  const piezas = [...new Set((publicaciones ?? []).map((p) => p.piece_id))]
  const { data: claves } = piezas.length
    ? await supabase.from('keywords').select('piece_id, activa_hasta').in('piece_id', piezas)
    : { data: [] }

  const vigentes = new Set(
    (claves ?? []).filter((k) => !k.activa_hasta || new Date(k.activa_hasta) > ahora).map((k) => k.piece_id),
  )

  for (const publicacion of publicaciones ?? []) {
    if (!vigentes.has(publicacion.piece_id)) continue

    const contexto = await contextoDePublicacion(publicacion.id)
    if (!contexto) continue

    const adaptador = adaptadorDe(contexto.automatizacion.red)
    if (!adaptador.leerComentarios) continue

    // Solo los últimos siete días: más atrás, la ventana de respuesta ya cerró.
    const desde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)

    try {
      const entrantes = await adaptador.leerComentarios(
        contexto.credencial,
        contexto.automatizacion.externalPostId,
        desde,
      )
      if (entrantes.length === 0) continue

      salida.push(
        await procesarComentarios(
          entrantes,
          contexto.automatizacion,
          adaptador,
          contexto.credencial,
          almacenReal(contexto.keywordId),
          { ahora },
        ),
      )
    } catch {
      // Una publicación que falla deja seguir a las demás.
      continue
    }
  }

  return salida
}

/**
 * Reintento de los mensajes que fallaron.
 *
 * Un límite de tasa se resuelve solo en minutos: el comentario espera su turno
 * con la espera creciente de la cola y se vuelve a intentar. A los tres intentos
 * pasa a la bandeja manual con su motivo, que es lo que pide el caso especial de
 * la sección 7 de la especificación.
 */
export async function reintentarMensajes(ahora: Date = new Date()): Promise<ResumenMotor[]> {
  const supabase = clienteAdmin()
  const salida: ResumenMotor[] = []

  /**
   * Toma los pendientes y los reabre en el mismo paso.
   *
   * Leer primero y marcar después dejaba una ventana: dos corridas del trabajo
   * veían el mismo lote y esa persona recibía dos mensajes. Aquí el update es
   * quien selecciona, así que la corrida que llega segunda no encuentra nada.
   */
  const { data: pendientes } = await supabase
    .from('comments')
    .update({ estado: 'detectado' })
    .eq('estado', 'fallido')
    .lte('proximo_intento_at', ahora.toISOString())
    .select('*')

  // Se agrupan por publicación: el contexto se arma una vez para todo el grupo.
  const porPublicacion = new Map<string, typeof pendientes>()
  for (const comentario of pendientes ?? []) {
    const grupo = porPublicacion.get(comentario.publication_id) ?? []
    grupo.push(comentario)
    porPublicacion.set(comentario.publication_id, grupo)
  }

  for (const [publicationId, comentarios] of porPublicacion) {
    const contexto = await contextoDePublicacion(publicationId)
    if (!contexto) continue

    // Vuelven a entrar por la misma puerta, con las mismas barreras: la ventana
    // de siete días puede haber cerrado mientras esperaban.
    const entrantes: ComentarioEntrante[] = (comentarios ?? []).map((c) => ({
      externalCommentId: c.external_comment_id,
      externalPostId: contexto.automatizacion.externalPostId,
      autorUsername: c.autor_username,
      autorExternalId: c.autor_external_id,
      texto: c.texto,
      creadoEn: new Date(c.detectado_at),
    }))

    // El estado ya se reabrió al tomarlos. El almacén recibe la lista para no
    // descartarlos por duplicado: el registro existe desde el primer intento.
    salida.push(
      await procesarComentarios(
        entrantes,
        contexto.automatizacion,
        adaptadorDe(contexto.automatizacion.red),
        contexto.credencial,
        almacenReal(contexto.keywordId, new Set(entrantes.map((c) => c.externalCommentId))),
        { ahora },
      ),
    )
  }

  return salida
}
