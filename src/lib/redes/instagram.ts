import type {
  AdaptadorRed,
  ComentarioEntrante,
  CredencialCuenta,
  PeticionPublicar,
  ResultadoPublicar,
  ResultadoRespuesta,
} from './tipos'

/**
 * Instagram Graph API.
 *
 * Publicación: contenedor con POST /<IG_ID>/media, espera de procesamiento y
 * POST /<IG_ID>/media_publish. Techo de 100 publicaciones por API cada 24 horas.
 * Respuesta privada: POST /<PAGE_ID>/messages con recipient.comment_id, dentro
 * de los 7 días siguientes al comentario y una sola vez por comentario.
 *
 * Fuentes en docs/00-verificacion-tecnica.md.
 */

const VERSION = 'v21.0'
const BASE = `https://graph.facebook.com/${VERSION}`

/** 2 llamadas por segundo por cuenta profesional en endpoints de mensajería. */
export const ENVIOS_POR_SEGUNDO_IG = 2

const ESPERA_CONTENEDOR_MS = 5000
const INTENTOS_CONTENEDOR = 24 // hasta dos minutos de procesamiento

type RespuestaMeta = { id?: string; permalink?: string; status_code?: string; error?: { message?: string; code?: number } }

async function llamar(url: string, init?: RequestInit): Promise<RespuestaMeta> {
  const respuesta = await fetch(url, init)
  const cuerpo = (await respuesta.json().catch(() => ({}))) as RespuestaMeta
  if (!respuesta.ok) {
    const mensaje = cuerpo.error?.message ?? `HTTP ${respuesta.status}`
    const error = new Error(mensaje) as Error & { codigo?: number; http?: number }
    error.codigo = cuerpo.error?.code
    error.http = respuesta.status
    throw error
  }
  return cuerpo
}

/** Los códigos que se resuelven solos con una espera. El resto necesita a una persona. */
function esReintentable(error: unknown): boolean {
  const codigo = (error as { codigo?: number }).codigo
  const http = (error as { http?: number }).http
  if (codigo === 4 || codigo === 17 || codigo === 32 || codigo === 613) return true // límites de tasa
  if (codigo === 2) return true // fallo temporal de la plataforma
  if (http && http >= 500) return true
  return false
}

async function esperar(ms: number) {
  await new Promise((listo) => setTimeout(listo, ms))
}

/**
 * Publica un reel.
 *
 * `contenedorPrevio` retoma un intento que se cortó a mitad. Sin él, el reintento
 * subía el video otra vez y dejaba el contenedor anterior huérfano; y si la
 * publicación había llegado a Meta con la respuesta perdida en el camino, la
 * pieza salía dos veces.
 *
 * Devuelve el contenedor en el fallo para que quien reintente pueda retomarlo.
 */
export async function publicarEnInstagram(
  credencial: CredencialCuenta,
  peticion: PeticionPublicar,
  contenedorPrevio?: string | null,
): Promise<ResultadoPublicar> {
  let contenedorId: string | undefined = contenedorPrevio ?? undefined

  try {
    if (!contenedorId) {
      const contenedor = await llamar(`${BASE}/${credencial.externalAccountId}/media`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: peticion.videoUrl,
          caption: peticion.caption,
          access_token: credencial.token,
        }),
      })
      contenedorId = contenedor.id
    }

    if (!contenedorId) return { estado: 'fallido', error: 'Meta devolvió el contenedor sin id', reintentable: true }

    // El video pasa por un procesado que puede tardar. Publicar antes de tiempo
    // devuelve un error que parece de permisos y no lo es.
    for (let intento = 0; intento < INTENTOS_CONTENEDOR; intento++) {
      await esperar(ESPERA_CONTENEDOR_MS)
      const estado = await llamar(
        `${BASE}/${contenedorId}?fields=status_code&access_token=${encodeURIComponent(credencial.token)}`,
      )
      if (estado.status_code === 'FINISHED') break
      if (estado.status_code === 'ERROR') {
        // El contenedor quedó inservible: el reintento parte de cero.
        return { estado: 'fallido', error: 'Meta rechazó el video al procesarlo', reintentable: false }
      }
      if (intento === INTENTOS_CONTENEDOR - 1) {
        return {
          estado: 'fallido',
          error: 'El video sigue en proceso después de dos minutos',
          reintentable: true,
          contenedorId,
        }
      }
    }

    const publicado = await llamar(`${BASE}/${credencial.externalAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creation_id: contenedorId, access_token: credencial.token }),
    })

    if (!publicado.id) return { estado: 'fallido', error: 'Meta publicó sin devolver id', reintentable: true }

    const detalle = await llamar(
      `${BASE}/${publicado.id}?fields=permalink&access_token=${encodeURIComponent(credencial.token)}`,
    ).catch(() => ({}) as RespuestaMeta)

    return { estado: 'publicado', externalPostId: publicado.id, permalink: detalle.permalink ?? null }
  } catch (error) {
    return {
      estado: 'fallido',
      error: error instanceof Error ? error.message : String(error),
      reintentable: esReintentable(error),
      ...(contenedorId ? { contenedorId } : {}),
    }
  }
}

type ComentarioMeta = {
  id: string
  text?: string
  timestamp?: string
  username?: string
  from?: { id?: string; username?: string }
}

export async function leerComentariosInstagram(
  credencial: CredencialCuenta,
  externalPostId: string,
  desde: Date,
): Promise<ComentarioEntrante[]> {
  const url =
    `${BASE}/${externalPostId}/comments` +
    `?fields=id,text,timestamp,username,from&limit=100&access_token=${encodeURIComponent(credencial.token)}`

  const respuesta = await fetch(url)
  const cuerpo = (await respuesta.json().catch(() => ({}))) as { data?: ComentarioMeta[]; error?: { message?: string } }
  if (!respuesta.ok) throw new Error(cuerpo.error?.message ?? `HTTP ${respuesta.status}`)

  return (cuerpo.data ?? [])
    .map((c) => ({
      externalCommentId: c.id,
      externalPostId,
      autorUsername: c.from?.username ?? c.username ?? null,
      autorExternalId: c.from?.id ?? null,
      texto: c.text ?? '',
      creadoEn: c.timestamp ? new Date(c.timestamp) : new Date(),
    }))
    .filter((c) => c.creadoEn >= desde)
}

export async function responderPrivadoInstagram(
  credencial: CredencialCuenta,
  comentario: ComentarioEntrante,
  mensaje: string,
): Promise<ResultadoRespuesta> {
  const pageId = credencial.pageId ?? credencial.externalAccountId
  try {
    const enviado = await llamar(`${BASE}/${pageId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: comentario.externalCommentId },
        message: { text: mensaje },
        access_token: credencial.token,
      }),
    })
    return { estado: 'enviado', referencia: enviado.id ?? null }
  } catch (error) {
    return {
      estado: 'fallido',
      error: error instanceof Error ? error.message : String(error),
      reintentable: esReintentable(error),
    }
  }
}

export const instagram: AdaptadorRed = {
  red: 'instagram',
  publicar: (credencial, peticion, contenedorPrevio) =>
    publicarEnInstagram(credencial, peticion, contenedorPrevio),
  leerComentarios: leerComentariosInstagram,
  responder: responderPrivadoInstagram,
  enviosPorSegundo: ENVIOS_POR_SEGUNDO_IG,
  cupoDiarioRespuestas: null,
}
