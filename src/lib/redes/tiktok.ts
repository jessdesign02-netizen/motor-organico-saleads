import type {
  AdaptadorRed,
  CredencialCuenta,
  PeticionPublicar,
  ResultadoPublicar,
} from './tipos'

/**
 * TikTok Content Posting API.
 *
 * El scope video.publish permite iniciar la publicación. Mientras el cliente
 * carece de auditoría, todo lo que sale queda en visibilidad privada, así que
 * el flujo entrega el video al buzón del creador y la persona lo suelta desde
 * la app. La casilla `publicacionDirecta` se activa el día que pase la auditoría.
 *
 * Comentarios y mensajes directos viven fuera del API público, de modo que
 * TikTok trabaja con bandeja manual completa.
 *
 * Fuentes en docs/00-verificacion-tecnica.md.
 */

const BASE = 'https://open.tiktokapis.com/v2'

type RespuestaTikTok = {
  data?: { publish_id?: string }
  error?: { code?: string; message?: string }
}

export async function publicarEnTiktok(
  credencial: CredencialCuenta,
  peticion: PeticionPublicar,
  publicacionDirecta = false,
): Promise<ResultadoPublicar> {
  const ruta = publicacionDirecta ? '/post/publish/video/init/' : '/post/publish/inbox/video/init/'

  const cuerpo = publicacionDirecta
    ? {
        post_info: {
          title: peticion.caption.slice(0, 2200),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: peticion.videoUrl },
      }
    : { source_info: { source: 'PULL_FROM_URL', video_url: peticion.videoUrl } }

  try {
    const respuesta = await fetch(`${BASE}${ruta}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credencial.token}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(cuerpo),
    })

    const datos = (await respuesta.json().catch(() => ({}))) as RespuestaTikTok
    const publishId = datos.data?.publish_id

    if (!respuesta.ok || !publishId) {
      const mensaje = datos.error?.message ?? `HTTP ${respuesta.status}`
      return { estado: 'fallido', error: mensaje, reintentable: respuesta.status >= 500 }
    }

    if (publicacionDirecta) {
      return { estado: 'publicado', externalPostId: publishId, permalink: null }
    }

    return {
      estado: 'borrador',
      referencia: publishId,
      nota: 'El video llegó al buzón de TikTok. Se suelta desde la app del creador.',
    }
  } catch (error) {
    return { estado: 'fallido', error: error instanceof Error ? error.message : String(error), reintentable: true }
  }
}

export const tiktok: AdaptadorRed = {
  red: 'tiktok',
  publicar: (credencial, peticion) => publicarEnTiktok(credencial, peticion, false),
  leerComentarios: null,
  responder: null,
  enviosPorSegundo: 1,
  cupoDiarioRespuestas: null,
}
