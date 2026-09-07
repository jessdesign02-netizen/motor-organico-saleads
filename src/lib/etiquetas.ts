import type {
  EstadoComentario,
  EstadoPieza,
  EstadoPublicacion,
  RedSocial,
  RolApp,
  TipoAviso,
  TipoRecurso,
} from '@/lib/database.types'

/**
 * Cómo se dicen las cosas en pantalla.
 *
 * La interfaz mostraba los valores tal como salen de la base: `manual_pendiente`,
 * `ventana_vencida`, `instagram`, `2026-09-07`. Son nombres de programador, y la
 * persona que los lee tiene que traducirlos cada vez.
 *
 * Aquí viven en un solo sitio, con su tono. Cambiar cómo se llama un estado es
 * cambiar una línea, no buscarlo por nueve pantallas.
 */

export type Tono = 'neutro' | 'bien' | 'aviso' | 'info' | 'serio' | 'critico'

export type Rotulo = {
  texto: string
  tono: Tono
  /** Lo que la persona necesita saber, cuando el nombre no basta. */
  explica?: string
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export const ESTADO_PIEZA: Record<EstadoPieza, Rotulo> = {
  borrador: { texto: 'Borrador', tono: 'neutro', explica: 'Todavía no la ha visto nadie' },
  revision: { texto: 'En revisión', tono: 'aviso', explica: 'Espera que Karen la apruebe o la devuelva' },
  aprobado: { texto: 'Aprobada', tono: 'info', explica: 'Lista para programarse el día que salga' },
  programado: { texto: 'Programada', tono: 'info', explica: 'Ya está en la cola, sale a su hora' },
  publicado: { texto: 'Publicada', tono: 'bien', explica: 'En vivo, con su automatización encendida' },
  fallido: { texto: 'No salió', tono: 'critico', explica: 'La plataforma la rechazó. El motivo está en Avisos' },
}

export const ESTADO_PUBLICACION: Record<EstadoPublicacion, Rotulo> = {
  pendiente: { texto: 'En cola', tono: 'neutro' },
  publicando: { texto: 'Saliendo', tono: 'info' },
  publicado: { texto: 'En vivo', tono: 'bien' },
  fallido: { texto: 'No salió', tono: 'critico' },
}

/**
 * `fallido` en un comentario no significa que se perdió: significa que la
 * plataforma rechazó el envío y el caso vuelve a la cola. Llamarlo "fallido"
 * hacía pensar que había que atenderlo a mano, y no era así.
 */
export const ESTADO_COMENTARIO: Record<EstadoComentario, Rotulo> = {
  detectado: { texto: 'Detectado', tono: 'neutro' },
  respondido: { texto: 'Respondido', tono: 'bien' },
  fallido: { texto: 'Reintentando', tono: 'serio', explica: 'El sistema lo vuelve a intentar solo' },
  ignorado: { texto: 'Sin acción', tono: 'neutro' },
  manual_pendiente: { texto: 'Necesita tu mano', tono: 'aviso' },
}

// ---------------------------------------------------------------------------
// Motivos · por qué un comentario quedó sin responder
// ---------------------------------------------------------------------------

const MOTIVOS: Record<string, string> = {
  ventana_vencida: 'Pasaron los 7 días que da Meta para responder en privado',
  clave_sin_activar: 'La palabra clave todavía no estaba activa',
  clave_vencida: 'La palabra clave ya venció',
  autor_repetido: 'Esta persona ya recibió su mensaje en esta publicación',
  sin_coincidencia: 'El comentario no trae la palabra clave',
}

/** Traduce los motivos de máquina y deja pasar los que ya están escritos para leer. */
export function motivoLegible(motivo: string | null): string | null {
  if (!motivo) return null
  return MOTIVOS[motivo] ?? errorLegible(motivo) ?? motivo
}

/**
 * Los errores de las plataformas llegan en inglés y con su código dentro:
 * "(#613) Calls to this api have exceeded the rate limit". Eso lo lee un
 * programador, no la persona que abre la bandeja a las ocho de la mañana.
 *
 * Se traduce lo que se repite, y lo que no se reconoce pasa tal cual: inventar
 * una explicación para un error desconocido sería peor que mostrarlo crudo.
 */
const ERRORES: Array<{ señal: RegExp; texto: string }> = [
  { señal: /#613|rate limit/i, texto: 'La plataforma frenó el envío por exceso de mensajes. Se reintenta solo.' },
  { señal: /#4\b|#17\b|request limit/i, texto: 'Se alcanzó el tope de llamadas de la app. Se reintenta solo.' },
  { señal: /#32\b|page request limit/i, texto: 'La cuenta llegó a su tope por hora. Se reintenta solo.' },
  { señal: /quotaExceeded/i, texto: 'Se acabó la cuota diaria de YouTube. Vuelve mañana.' },
  { señal: /expired|invalid.*token|session has expired/i, texto: 'El acceso venció. Renuévalo en Configuración.' },
  { señal: /sigue en proceso/i, texto: 'El video seguía procesándose después de dos minutos.' },
  { señal: /permission|#200\b/i, texto: 'Faltan permisos en la app de Meta para hacer esto.' },
]

export function errorLegible(error: string | null): string | null {
  if (!error) return null
  return ERRORES.find((e) => e.señal.test(error))?.texto ?? null
}

// ---------------------------------------------------------------------------
// Redes, roles, tipos
// ---------------------------------------------------------------------------

export const RED: Record<RedSocial, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

export const ROL: Record<RolApp, Rotulo> = {
  editora: { texto: 'Editora', tono: 'info', explica: 'Define la automatización y aprueba el día' },
  aprobadora: { texto: 'Aprobadora', tono: 'info', explica: 'Revisa la semana, aprueba y devuelve' },
  audiovisual: { texto: 'Audiovisual', tono: 'neutro', explica: 'Carga el video y deja la pieza en revisión' },
  observador: { texto: 'Observador', tono: 'neutro', explica: 'Solo lectura' },
}

export const TIPO_RECURSO: Record<TipoRecurso, string> = {
  pdf: 'PDF',
  skill: 'Skill',
  html: 'Herramienta',
  artefacto: 'Artefacto',
  video: 'Video',
}

export const TIPO_AVISO: Record<TipoAviso, Rotulo> = {
  publicacion_fallida: { texto: 'No salió', tono: 'critico' },
  borrador_tiktok: { texto: 'Espera en TikTok', tono: 'aviso' },
  token_por_vencer: { texto: 'Acceso por vencer', tono: 'serio' },
  bandeja_con_espera: { texto: 'Bandeja con espera', tono: 'aviso' },
  cupo_agotado: { texto: 'Cupo agotado', tono: 'aviso' },
  pieza_devuelta: { texto: 'Devuelta', tono: 'aviso' },
}

// ---------------------------------------------------------------------------
// Fechas · la interfaz mostraba ISO en todas partes
// ---------------------------------------------------------------------------

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Se lee al mediodía UTC para que el día no se corra por la zona horaria. */
function partes(iso: string): { dia: number; mes: number; ano: number } | null {
  const encontrado = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!encontrado) return null
  const [, ano, mes, dia] = encontrado
  return { dia: Number(dia), mes: Number(mes) - 1, ano: Number(ano) }
}

/** "7 sep" */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const p = partes(iso)
  if (!p) return iso
  return `${p.dia} ${MESES_CORTOS[p.mes] ?? ''}`
}

/** "7 de septiembre" */
export function fechaLarga(iso: string | null): string {
  if (!iso) return 'sin fecha'
  const p = partes(iso)
  if (!p) return iso
  return `${p.dia} de ${MESES[p.mes] ?? ''}`
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** "Lunes, 7 de septiembre". El día de la semana ubica más que el número. */
export function fechaConDia(iso: string | null): string {
  if (!iso) return 'sin fecha'
  const p = partes(iso)
  if (!p) return iso
  const dia = DIAS_SEMANA[new Date(Date.UTC(p.ano, p.mes, p.dia)).getUTCDay()] ?? ''
  return `${dia}, ${p.dia} de ${MESES[p.mes] ?? ''}`
}

/** "Del 7 al 13 de septiembre", y con los dos meses cuando la semana los cruza. */
export function rangoDeSemana(lunesIso: string): string {
  const inicio = partes(lunesIso)
  if (!inicio) return lunesIso
  const fin = partes(
    new Date(Date.UTC(inicio.ano, inicio.mes, inicio.dia + 6)).toISOString().slice(0, 10),
  )
  if (!fin) return lunesIso

  if (inicio.mes === fin.mes) {
    return `Del ${inicio.dia} al ${fin.dia} de ${MESES[inicio.mes] ?? ''}`
  }
  return `Del ${inicio.dia} de ${MESES_CORTOS[inicio.mes] ?? ''} al ${fin.dia} de ${MESES_CORTOS[fin.mes] ?? ''}`
}

/** "18:00" a partir de un time de Postgres, que llega como 18:00:00. */
export function hora(valor: string | null): string {
  if (!valor) return '—'
  return valor.slice(0, 5)
}

/** "hace 3 horas", "hace 2 días". Para las bitácoras, donde el reloj exacto sobra. */
export function hace(iso: string | null, ahora: Date = new Date()): string {
  if (!iso) return '—'
  const minutos = Math.round((ahora.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  return fechaCorta(iso.slice(0, 10))
}

/** "en 5 días" · para lo que va a pasar, como un token que vence. */
export function dentroDe(iso: string | null, ahora: Date = new Date()): string {
  if (!iso) return '—'
  const dias = Math.round((new Date(iso).getTime() - ahora.getTime()) / 86_400_000)
  if (dias < 0) return `venció hace ${Math.abs(dias)} días`
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `en ${dias} días`
}

/** Une con comas y una "y" al final, que es como se lee una lista. */
export function enumerar(partes: readonly string[]): string {
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

/**
 * Las cifras con separador de miles. 1151 se lee mal de un vistazo; 1.151 no.
 * Colombia usa el punto, así que la localización no es decorativa.
 */
export function cifra(valor: number): string {
  return new Intl.NumberFormat('es-CO').format(valor)
}
