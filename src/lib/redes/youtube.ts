import type {
  AdaptadorRed,
  ComentarioEntrante,
  CredencialCuenta,
  PeticionPublicar,
  ResultadoPublicar,
  ResultadoRespuesta,
} from './tipos'

/**
 * YouTube Data API v3.
 *
 * Subida: videos.insert vive en un bucket propio de 100 llamadas diarias, así
 * que la cuota general queda libre para lo demás.
 * Respuesta: comments.insert cuesta 50 unidades sobre las 10.000 diarias, con
 * lo que caben 200 respuestas al día. El motor respeta ese cupo y manda el
 * desborde a la bandeja manual.
 *
 * Fuentes en docs/00-verificacion-tecnica.md.
 */

const BASE = 'https://www.googleapis.com/youtube/v3'
const SUBIDA = 'https://www.googleapis.com/upload/youtube/v3/videos'

export const COSTO_RESPUESTA = 50
export const CUOTA_DIARIA = 10_000
/** Deja margen para la lectura de hilos, que consume aparte. */
export const CUPO_DIARIO_RESPUESTAS = 150

type ErrorGoogle = { error?: { message?: string; code?: number } }

function esReintentable(codigo: number | undefined, mensaje: string): boolean {
  if (codigo && codigo >= 500) return true
  if (codigo === 429) return true
  // La cuota agotada se resuelve mañana, así que reintentar hoy sobra.
  if (mensaje.includes('quotaExceeded')) return false
  if (mensaje.includes('rateLimitExceeded')) return true
  return false
}

export async function publicarEnYoutube(
  credencial: CredencialCuenta,
  peticion: PeticionPublicar,
): Promise<ResultadoPublicar> {
  try {
    const video = await fetch(peticion.videoUrl)
    if (!video.ok) {
      return { estado: 'fallido', error: `El video fuente respondió ${video.status}`, reintentable: true }
    }

    const metadatos = {
      snippet: {
        title: (peticion.titulo ?? peticion.caption).slice(0, 100),
        description: peticion.caption,
        categoryId: '22',
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    }

    const frontera = `motor${Date.now()}`
    const cuerpoVideo = new Uint8Array(await video.arrayBuffer())
    const encabezado = new TextEncoder().encode(
      `--${frontera}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadatos)}\r\n--${frontera}\r\ncontent-type: video/mp4\r\n\r\n`,
    )
    const cierre = new TextEncoder().encode(`\r\n--${frontera}--\r\n`)
    const cuerpo = new Uint8Array(encabezado.length + cuerpoVideo.length + cierre.length)
    cuerpo.set(encabezado, 0)
    cuerpo.set(cuerpoVideo, encabezado.length)
    cuerpo.set(cierre, encabezado.length + cuerpoVideo.length)

    const respuesta = await fetch(`${SUBIDA}?uploadType=multipart&part=snippet,status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credencial.token}`,
        'content-type': `multipart/related; boundary=${frontera}`,
      },
      body: cuerpo,
    })

    const datos = (await respuesta.json().catch(() => ({}))) as { id?: string } & ErrorGoogle
    if (!respuesta.ok || !datos.id) {
      const mensaje = datos.error?.message ?? `HTTP ${respuesta.status}`
      return { estado: 'fallido', error: mensaje, reintentable: esReintentable(respuesta.status, mensaje) }
    }

    return {
      estado: 'publicado',
      externalPostId: datos.id,
      permalink: `https://www.youtube.com/shorts/${datos.id}`,
    }
  } catch (error) {
    return { estado: 'fallido', error: error instanceof Error ? error.message : String(error), reintentable: true }
  }
}

type HiloYoutube = {
  snippet?: {
    topLevelComment?: {
      id?: string
      snippet?: {
        textOriginal?: string
        authorDisplayName?: string
        authorChannelId?: { value?: string }
        publishedAt?: string
      }
    }
  }
}

export async function leerComentariosYoutube(
  credencial: CredencialCuenta,
  externalPostId: string,
  desde: Date,
): Promise<ComentarioEntrante[]> {
  const url =
    `${BASE}/commentThreads?part=snippet&videoId=${encodeURIComponent(externalPostId)}` +
    `&maxResults=100&order=time`

  const respuesta = await fetch(url, { headers: { authorization: `Bearer ${credencial.token}` } })
  const datos = (await respuesta.json().catch(() => ({}))) as { items?: HiloYoutube[] } & ErrorGoogle
  if (!respuesta.ok) throw new Error(datos.error?.message ?? `HTTP ${respuesta.status}`)

  return (datos.items ?? [])
    .map((item) => {
      const superior = item.snippet?.topLevelComment
      const detalle = superior?.snippet
      return {
        externalCommentId: superior?.id ?? '',
        externalPostId,
        autorUsername: detalle?.authorDisplayName ?? null,
        autorExternalId: detalle?.authorChannelId?.value ?? null,
        texto: detalle?.textOriginal ?? '',
        creadoEn: detalle?.publishedAt ? new Date(detalle.publishedAt) : new Date(),
      }
    })
    .filter((c) => c.externalCommentId !== '' && c.creadoEn >= desde)
}

/**
 * En YouTube la respuesta es pública, dentro del mismo hilo. El enlace viaja en
 * el texto, que es justo lo que la persona necesita para llegar a WhatsApp.
 */
export async function responderEnYoutube(
  credencial: CredencialCuenta,
  comentario: ComentarioEntrante,
  mensaje: string,
): Promise<ResultadoRespuesta> {
  try {
    const respuesta = await fetch(`${BASE}/comments?part=snippet`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credencial.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        snippet: { parentId: comentario.externalCommentId, textOriginal: mensaje },
      }),
    })

    const datos = (await respuesta.json().catch(() => ({}))) as { id?: string } & ErrorGoogle
    if (!respuesta.ok) {
      const texto = datos.error?.message ?? `HTTP ${respuesta.status}`
      return { estado: 'fallido', error: texto, reintentable: esReintentable(respuesta.status, texto) }
    }
    return { estado: 'enviado', referencia: datos.id ?? null }
  } catch (error) {
    return { estado: 'fallido', error: error instanceof Error ? error.message : String(error), reintentable: true }
  }
}

export const youtube: AdaptadorRed = {
  red: 'youtube',
  publicar: publicarEnYoutube,
  leerComentarios: leerComentariosYoutube,
  responder: responderEnYoutube,
  enviosPorSegundo: 5,
  cupoDiarioRespuestas: CUPO_DIARIO_RESPUESTAS,
}
