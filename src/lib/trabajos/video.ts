import 'server-only'
import { clienteAdmin } from '@/lib/supabase/admin'
import { descargarDeDrive } from '@/lib/google/drive'
import { avisar } from './avisos'

/**
 * Copia del video de Drive a Storage.
 *
 * Instagram, TikTok y YouTube descargan el video desde una URL pública. El
 * enlace de Drive pide sesión, así que publicar desde ahí falla siempre. Esta
 * copia es el puente, y vive 24 horas después de publicar.
 */

const BUCKET = 'videos'
/** Instagram admite hasta 1 GB en un Reel. */
const BYTES_MAXIMOS = 1_024 * 1_024 * 1_024

export type ResumenVideo = {
  preparadas: number
  yaListas: number
  fallidas: number
  detalle: Array<{ pieza: string; estado: string; nota?: string }>
}

/** La URL que la plataforma descarga. */
export function urlPublica(supabaseUrl: string, ruta: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${ruta}`
}

export async function prepararVideoDePieza(piezaId: string): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const supabase = clienteAdmin()

  const { data: pieza } = await supabase
    .from('pieces')
    .select('id, drive_url, storage_path, tema, brand_id')
    .eq('id', piezaId)
    .single()

  if (!pieza) return { ok: false, error: 'la pieza ya no existe' }
  if (!pieza.drive_url) return { ok: false, error: 'la pieza llega sin enlace de Drive' }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return { ok: false, error: 'falta NEXT_PUBLIC_SUPABASE_URL' }

  // La copia vigente se reutiliza: bajar el mismo video dos veces sobra.
  if (pieza.storage_path) return { ok: true, url: urlPublica(base, pieza.storage_path) }

  try {
    const video = await descargarDeDrive(pieza.drive_url)

    if (video.bytes > BYTES_MAXIMOS) {
      const error = `El video pesa ${Math.round(video.bytes / 1_048_576)} MB y el techo es 1 GB`
      await supabase.from('pieces').update({ video_error: error }).eq('id', piezaId)
      return { ok: false, error }
    }

    const ruta = `${pieza.brand_id}/${piezaId}.mp4`

    const { error: fallo } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, video.contenido, { contentType: video.tipo, upsert: true })

    if (fallo) {
      await supabase.from('pieces').update({ video_error: fallo.message }).eq('id', piezaId)
      return { ok: false, error: fallo.message }
    }

    await supabase
      .from('pieces')
      .update({ storage_path: ruta, video_bytes: video.bytes, video_error: null })
      .eq('id', piezaId)

    return { ok: true, url: urlPublica(base, ruta) }
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error)
    await supabase.from('pieces').update({ video_error: detalle }).eq('id', piezaId)
    await avisar({
      tipo: 'publicacion_fallida',
      clave: `video:${piezaId}:${detalle.slice(0, 40)}`,
      titulo: `El video de "${pieza.tema}" no se pudo bajar de Drive`,
      detalle,
      brandId: pieza.brand_id,
      pieceId: piezaId,
    })
    return { ok: false, error: detalle }
  }
}

/**
 * Prepara lo que sale pronto. Se adelanta a la hora de publicación para que la
 * descarga no compita con ella: un video grande tarda, y la cola de publicación
 * corre cada cinco minutos.
 */
export async function prepararVideosProximos(
  ahora: Date = new Date(),
  horasDeAnticipacion = 6,
): Promise<ResumenVideo> {
  const supabase = clienteAdmin()
  const resumen: ResumenVideo = { preparadas: 0, yaListas: 0, fallidas: 0, detalle: [] }

  const hasta = new Date(ahora.getTime() + horasDeAnticipacion * 3_600_000).toISOString()

  const { data: publicaciones } = await supabase
    .from('publications')
    .select('piece_id')
    .eq('estado', 'pendiente')
    .lte('programado_at', hasta)

  const piezas = [...new Set((publicaciones ?? []).map((p) => p.piece_id))]

  for (const piezaId of piezas) {
    const { data: pieza } = await supabase
      .from('pieces')
      .select('storage_path, tema')
      .eq('id', piezaId)
      .single()

    if (pieza?.storage_path) {
      resumen.yaListas++
      continue
    }

    const salida = await prepararVideoDePieza(piezaId)
    if (salida.ok) {
      resumen.preparadas++
      resumen.detalle.push({ pieza: pieza?.tema ?? piezaId, estado: 'lista' })
    } else {
      resumen.fallidas++
      resumen.detalle.push({ pieza: pieza?.tema ?? piezaId, estado: 'fallida', nota: salida.error })
    }
  }

  return resumen
}

/**
 * Borra las copias que ya cumplieron. Storage cuesta, y el video original vive
 * en Drive: esta copia solo existe para el momento de publicar.
 */
/** Tope por corrida, para que el trabajo termine dentro de su ventana de tiempo. */
const COPIAS_POR_CORRIDA = 100

export async function limpiarCopiasVencidas(ahora: Date = new Date()): Promise<number> {
  const supabase = clienteAdmin()

  // El trabajo corre cada hora, así que lo que no quepa hoy se lleva la
  // siguiente. Terminar a tiempo importa más que vaciarlo todo de una vez.
  const { data: vencidas } = await supabase
    .from('pieces')
    .select('id, storage_path')
    .not('storage_path', 'is', null)
    .lt('storage_expira_at', ahora.toISOString())
    .limit(COPIAS_POR_CORRIDA)

  let borradas = 0
  for (const pieza of vencidas ?? []) {
    if (!pieza.storage_path) continue
    const { error } = await supabase.storage.from(BUCKET).remove([pieza.storage_path])
    if (error) continue

    await supabase
      .from('pieces')
      .update({ storage_path: null, storage_expira_at: null })
      .eq('id', pieza.id)
    borradas++
  }

  return borradas
}
