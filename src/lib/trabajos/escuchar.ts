import 'server-only'
import { clienteAdmin } from '@/lib/supabase/admin'
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

  for (const publicacion of publicaciones ?? []) {
    const contexto = await contextoDePublicacion(publicacion.id)
    if (!contexto) continue

    const adaptador = adaptadorDe(contexto.automatizacion.red)
    if (!adaptador.leerComentarios) continue

    const { claveActivaHasta } = contexto.automatizacion
    if (claveActivaHasta && claveActivaHasta <= ahora) continue

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
