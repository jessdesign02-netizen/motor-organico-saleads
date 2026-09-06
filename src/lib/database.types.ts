/**
 * Tipos de la base. Reflejan supabase/migrations/0001_esquema.sql.
 * Al tocar una migración, se actualiza este archivo en el mismo commit.
 */

export type RolApp = 'editora' | 'aprobadora' | 'audiovisual' | 'observador'
export type RedSocial = 'instagram' | 'tiktok' | 'youtube'
export type EstadoPieza = 'borrador' | 'revision' | 'aprobado' | 'programado' | 'publicado' | 'fallido'
export type EstadoPublicacion = 'pendiente' | 'publicando' | 'publicado' | 'fallido'
export type EstadoComentario = 'detectado' | 'respondido' | 'fallido' | 'ignorado' | 'manual_pendiente'
export type EstadoDm = 'enviado' | 'fallido'
export type AccionAprobacion = 'aprobar' | 'devolver'
export type TipoRecurso = 'pdf' | 'skill' | 'html' | 'artefacto' | 'video'
export type OrigenPieza = 'sheet' | 'app'

// supabase-js exige Relationships: sin él, el cliente resuelve cada tabla a never.
type Fila<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }

export type Perfil = {
  id: string
  nombre: string | null
  email: string | null
  rol: RolApp
  creado_at: string
}

export type Marca = {
  id: string
  nombre: string
  slug: string
  sheet_id: string | null
  sheet_tab: string
  mapa_columnas: Record<string, string>
  whatsapp_url: string | null
  creado_at: string
}

export type CuentaSocial = {
  id: string
  brand_id: string
  red: RedSocial
  handle: string
  external_account_id: string
  credential_ref: string
  token_expira_at: string | null
  activa: boolean
  /** TikTok: se enciende el día que pasa la auditoría de Content Posting. */
  publicacion_directa: boolean
  /** Vacío usa el valor por defecto del adaptador de esa red. */
  cupo_respuestas_dia: number | null
  creado_at: string
}

export type TipoAviso =
  | 'publicacion_fallida'
  | 'borrador_tiktok'
  | 'token_por_vencer'
  | 'bandeja_con_espera'
  | 'cupo_agotado'
  | 'pieza_devuelta'

export type Aviso = {
  id: string
  tipo: TipoAviso
  titulo: string
  detalle: string | null
  brand_id: string | null
  piece_id: string | null
  clave: string
  leido_at: string | null
  creado_at: string
}

export type Recurso = {
  id: string
  brand_id: string
  titulo: string
  descripcion: string | null
  tipo: TipoRecurso
  url: string
  seccion: string | null
  activo: boolean
  creado_at: string
}

export type Pieza = {
  id: string
  brand_id: string
  semana: string
  tema: string
  hook: string | null
  formato: string | null
  drive_url: string | null
  storage_path: string | null
  /** Cuándo se puede borrar la copia pública del video. */
  storage_expira_at: string | null
  video_bytes: number | null
  /** Lo último que salió mal al bajar el video, para que la pantalla lo diga. */
  video_error: string | null
  caption_base: string | null
  resource_id: string | null
  fecha_publicacion: string | null
  hora_publicacion: string | null
  responsable: string | null
  estado: EstadoPieza
  aprobada_por: string | null
  aprobada_at: string | null
  origen: OrigenPieza
  sheet_row_id: string | null
  sheet_hash: string | null
  sheet_pendiente: Record<string, unknown> | null
  /** Caption por red. Lo que falte hereda de caption_base. */
  captions_red: Partial<Record<RedSocial, string>>
  creado_at: string
  actualizado_at: string
}

export type PropuestaCalendario = {
  id: string
  brand_id: string
  semana: string
  propuesta: Array<{ id: string; fecha: string; tema: string }>
  motivo: string | null
  creada_por: string | null
  creada_at: string
  aplicada_at: string | null
}

export type PalabraClave = {
  id: string
  piece_id: string
  palabra: string
  variantes: string[]
  activa_desde: string | null
  activa_hasta: string | null
  creado_at: string
}

export type PlantillaDm = {
  id: string
  piece_id: string
  mensaje: string
  cta_texto: string | null
  destino_url: string
  creado_at: string
}

export type EnlaceRastreado = {
  id: string
  piece_id: string
  slug: string
  destino_url: string
  clics: number
  creado_at: string
}

export type Publicacion = {
  id: string
  piece_id: string
  social_account_id: string
  caption_final: string | null
  estado: EstadoPublicacion
  external_post_id: string | null
  permalink: string | null
  publicado_at: string | null
  programado_at: string | null
  intentos: number
  proximo_intento_at: string | null
  ultimo_error: string | null
  creado_at: string
  actualizado_at: string
}

export type Comentario = {
  id: string
  publication_id: string
  external_comment_id: string
  autor_username: string | null
  autor_external_id: string | null
  texto: string
  keyword_id: string | null
  estado: EstadoComentario
  /** Por qué quedó así: lo lee la persona en la bandeja manual. */
  motivo: string | null
  detectado_at: string
  respondido_at: string | null
}

export type RegistroDm = {
  id: string
  comment_id: string
  destinatario: string | null
  mensaje: string
  estado: EstadoDm
  enviado_at: string
  error: string | null
}

export type Aprobacion = {
  id: string
  piece_id: string
  usuario_id: string | null
  accion: AccionAprobacion
  comentario: string | null
  creado_at: string
}

export type RegistroSync = {
  id: string
  brand_id: string
  filas_leidas: number
  filas_creadas: number
  filas_actualizadas: number
  filas_ignoradas: number
  detalle: Array<{ fila: string; motivo: string }>
  corrio_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: Fila<Perfil>
      brands: Fila<Marca>
      social_accounts: Fila<CuentaSocial>
      resources: Fila<Recurso>
      pieces: Fila<Pieza>
      keywords: Fila<PalabraClave>
      dm_templates: Fila<PlantillaDm>
      tracked_links: Fila<EnlaceRastreado>
      publications: Fila<Publicacion>
      comments: Fila<Comentario>
      dm_log: Fila<RegistroDm>
      approvals: Fila<Aprobacion>
      sync_logs: Fila<RegistroSync>
      calendar_proposals: Fila<PropuestaCalendario>
      notices: Fila<Aviso>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      rol_app: RolApp
      red_social: RedSocial
      estado_pieza: EstadoPieza
      estado_pub: EstadoPublicacion
      estado_comentario: EstadoComentario
      estado_dm: EstadoDm
      accion_aprobacion: AccionAprobacion
      tipo_recurso: TipoRecurso
      origen_pieza: OrigenPieza
    }
    CompositeTypes: Record<string, never>
  }
}
