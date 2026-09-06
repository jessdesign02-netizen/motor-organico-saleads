import type { RedSocial } from '@/lib/database.types'

export type CredencialCuenta = {
  cuentaId: string
  red: RedSocial
  externalAccountId: string
  token: string
  /** Instagram exige el id de la Página para la respuesta privada. */
  pageId?: string
  /** TikTok: publicación directa en lugar de borrador al buzón. */
  publicacionDirecta?: boolean
  /** Cupo propio de esa cuenta, cuando la marca lo ajusta. */
  cupoRespuestasDia?: number | null
}

export type PeticionPublicar = {
  videoUrl: string
  caption: string
  titulo?: string
}

export type ResultadoPublicar =
  | { estado: 'publicado'; externalPostId: string; permalink: string | null }
  | { estado: 'borrador'; referencia: string; nota: string }
  | { estado: 'fallido'; error: string; reintentable: boolean }

export type ComentarioEntrante = {
  externalCommentId: string
  externalPostId: string
  autorUsername: string | null
  autorExternalId: string | null
  texto: string
  creadoEn: Date
}

export type ResultadoRespuesta =
  | { estado: 'enviado'; referencia: string | null }
  | { estado: 'fallido'; error: string; reintentable: boolean }

/**
 * Lo que el motor necesita de cada red. Una red que carece de alguna capacidad
 * la deja en null, y el motor manda ese caso a la bandeja manual.
 */
export type AdaptadorRed = {
  red: RedSocial
  publicar: (credencial: CredencialCuenta, peticion: PeticionPublicar) => Promise<ResultadoPublicar>
  leerComentarios:
    | ((credencial: CredencialCuenta, externalPostId: string, desde: Date) => Promise<ComentarioEntrante[]>)
    | null
  responder:
    | ((credencial: CredencialCuenta, comentario: ComentarioEntrante, mensaje: string) => Promise<ResultadoRespuesta>)
    | null
  /** Cuántos envíos por segundo tolera la plataforma. */
  enviosPorSegundo: number
  /** Cupo diario de respuestas, cuando la cuota lo impone. */
  cupoDiarioRespuestas: number | null
}
