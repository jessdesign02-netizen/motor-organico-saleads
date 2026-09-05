import 'server-only'
import { clienteAdmin } from '@/lib/supabase/admin'
import { leerHoja } from '@/lib/google/sheets'
import { leerFila, lunesDeLaSemana, type Descarte, type PiezaDesdeHoja } from '@/lib/dominio/ingesta'
import type { Marca, Pieza } from '@/lib/database.types'

/**
 * Módulo 1 · Ingesta de la parrilla.
 *
 * Lee la hoja de cálculo y concilia por sheet_row_id, de modo que correr la
 * sincronización dos veces deja el mismo resultado. Cuando la hoja cambia sobre
 * una pieza ya aprobada, el cambio queda apartado en `sheet_pendiente` y espera
 * confirmación, en lugar de pisar lo que Karen ya revisó.
 */

export type ResumenSync = {
  marca: string
  leidas: number
  creadas: number
  actualizadas: number
  ignoradas: number
  enEspera: number
  detalle: Descarte[]
}

const ESTADOS_INTOCABLES = new Set<Pieza['estado']>(['aprobado', 'programado', 'publicado'])

function camposDePieza(pieza: PiezaDesdeHoja) {
  const fecha = pieza.fechaPublicacion
  return {
    tema: pieza.tema,
    hook: pieza.hook,
    formato: pieza.formato,
    drive_url: pieza.driveUrl,
    responsable: pieza.responsable,
    fecha_publicacion: fecha,
    semana: fecha ? lunesDeLaSemana(fecha) : lunesDeLaSemana(new Date().toISOString().slice(0, 10)),
    sheet_hash: pieza.huella,
  }
}

export async function sincronizarMarca(marca: Marca): Promise<ResumenSync> {
  const supabase = clienteAdmin()
  const resumen: ResumenSync = {
    marca: marca.nombre,
    leidas: 0,
    creadas: 0,
    actualizadas: 0,
    ignoradas: 0,
    enEspera: 0,
    detalle: [],
  }

  if (!marca.sheet_id) {
    resumen.detalle.push({ fila: '-', motivo: 'la marca aún no tiene hoja de cálculo configurada' })
    return resumen
  }

  const filas = await leerHoja(marca.sheet_id, marca.sheet_tab)
  resumen.leidas = filas.length

  const { data: existentes } = await supabase
    .from('pieces')
    .select('id, sheet_row_id, sheet_hash, estado')
    .eq('brand_id', marca.id)

  const porFila = new Map((existentes ?? []).map((p) => [p.sheet_row_id ?? '', p]))

  for (const fila of filas) {
    const lectura = leerFila(fila, marca.mapa_columnas)

    if ('descarte' in lectura) {
      resumen.ignoradas++
      resumen.detalle.push(lectura.descarte)
      continue
    }

    const campos = camposDePieza(lectura.pieza)
    const existente = porFila.get(lectura.pieza.sheetRowId)

    if (!existente) {
      const { error } = await supabase.from('pieces').insert({
        brand_id: marca.id,
        origen: 'sheet',
        sheet_row_id: lectura.pieza.sheetRowId,
        estado: 'borrador',
        ...campos,
      })
      if (error) {
        resumen.ignoradas++
        resumen.detalle.push({ fila: lectura.pieza.sheetRowId, motivo: error.message })
        continue
      }
      resumen.creadas++
      continue
    }

    if (existente.sheet_hash === lectura.pieza.huella) continue

    // Caso especial: la hoja cambió después de que la pieza quedó aprobada.
    if (ESTADOS_INTOCABLES.has(existente.estado)) {
      await supabase
        .from('pieces')
        .update({ sheet_pendiente: { ...campos, visto_at: new Date().toISOString() } })
        .eq('id', existente.id)
      resumen.enEspera++
      resumen.detalle.push({
        fila: lectura.pieza.sheetRowId,
        motivo: 'la hoja cambió con la pieza ya aprobada, el cambio espera confirmación',
      })
      continue
    }

    const { error } = await supabase.from('pieces').update(campos).eq('id', existente.id)
    if (error) {
      resumen.ignoradas++
      resumen.detalle.push({ fila: lectura.pieza.sheetRowId, motivo: error.message })
      continue
    }
    resumen.actualizadas++
  }

  await supabase.from('sync_logs').insert({
    brand_id: marca.id,
    filas_leidas: resumen.leidas,
    filas_creadas: resumen.creadas,
    filas_actualizadas: resumen.actualizadas,
    filas_ignoradas: resumen.ignoradas,
    detalle: resumen.detalle,
  })

  return resumen
}

export async function sincronizarTodo(): Promise<ResumenSync[]> {
  const supabase = clienteAdmin()
  const { data: marcas } = await supabase.from('brands').select('*')
  const salida: ResumenSync[] = []

  for (const marca of marcas ?? []) {
    try {
      salida.push(await sincronizarMarca(marca))
    } catch (error) {
      salida.push({
        marca: marca.nombre,
        leidas: 0,
        creadas: 0,
        actualizadas: 0,
        ignoradas: 0,
        enEspera: 0,
        detalle: [{ fila: '-', motivo: error instanceof Error ? error.message : String(error) }],
      })
    }
  }

  return salida
}
