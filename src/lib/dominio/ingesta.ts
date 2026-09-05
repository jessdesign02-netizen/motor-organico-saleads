import type { FilaHoja } from '@/lib/google/sheets'

/**
 * Conversión de una fila de la hoja a los campos de una pieza, y decisión de
 * qué hacer con ella. La lógica vive aparte del acceso a la red para poder
 * probarla con filas de mentira.
 */

export const COLUMNAS_POR_DEFECTO: Record<string, string> = {
  tema: 'pieza',
  hook: 'hook',
  formato: 'formato_base',
  drive_url: 'link_de_drive',
  responsable: 'responsable',
  fecha_publicacion: 'fecha_de_publicacion',
  recurso: 'recursos',
}

export type PiezaDesdeHoja = {
  sheetRowId: string
  tema: string
  hook: string | null
  formato: string | null
  driveUrl: string | null
  responsable: string | null
  fechaPublicacion: string | null
  recurso: string | null
  /** Huella del contenido, para saber si la fila cambió desde la última pasada. */
  huella: string
}

export type Descarte = { fila: string; motivo: string }

export type LecturaFila = { pieza: PiezaDesdeHoja } | { descarte: Descarte }

/** Fecha en formato ISO a partir de lo que escriba el equipo: 12/09/2026, 2026-09-12. */
export function interpretarFecha(entrada: string): string | null {
  const texto = entrada.trim()
  if (texto === '') return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  if (iso) return texto

  const latino = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto)
  if (latino) {
    const [, dia, mes, ano] = latino
    if (!dia || !mes || !ano) return null
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  return null
}

/** El lunes de la semana a la que pertenece una fecha. */
export function lunesDeLaSemana(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00Z`)
  const dia = fecha.getUTCDay()
  const retroceso = dia === 0 ? 6 : dia - 1
  fecha.setUTCDate(fecha.getUTCDate() - retroceso)
  return fecha.toISOString().slice(0, 10)
}

export function huellaDe(valores: Record<string, string>): string {
  return Object.keys(valores)
    .sort()
    .map((clave) => `${clave}=${valores[clave] ?? ''}`)
    .join('|')
}

export function leerFila(fila: FilaHoja, mapa: Record<string, string> = {}): LecturaFila {
  const columnas = { ...COLUMNAS_POR_DEFECTO, ...mapa }
  const valor = (campo: string): string => {
    const columna = columnas[campo]
    if (!columna) return ''
    return fila.valores[columna] ?? ''
  }

  const tema = valor('tema')
  if (tema === '') {
    return { descarte: { fila: fila.filaId, motivo: 'la fila llega sin tema' } }
  }

  const fechaTexto = valor('fecha_publicacion')
  const fecha = interpretarFecha(fechaTexto)
  if (fechaTexto !== '' && fecha === null) {
    return {
      descarte: { fila: fila.filaId, motivo: `la fecha "${fechaTexto}" no se entiende` },
    }
  }

  const driveUrl = valor('drive_url')

  return {
    pieza: {
      sheetRowId: fila.filaId,
      tema,
      hook: valor('hook') || null,
      formato: valor('formato') || null,
      driveUrl: driveUrl || null,
      responsable: valor('responsable') || null,
      fechaPublicacion: fecha,
      recurso: valor('recurso') || null,
      huella: huellaDe(fila.valores),
    },
  }
}

/** Los campos que hacen falta para que la pieza pueda salir. */
export function loQueFalta(pieza: PiezaDesdeHoja): string[] {
  const faltan: string[] = []
  if (!pieza.driveUrl) faltan.push('link de Drive')
  if (!pieza.fechaPublicacion) faltan.push('fecha de publicación')
  if (!pieza.hook) faltan.push('hook')
  return faltan
}
