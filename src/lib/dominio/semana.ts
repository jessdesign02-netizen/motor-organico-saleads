import { zonaDelEquipo } from './hora'

/** Utilidades de calendario en la hora del equipo, que por defecto es Bogotá. */

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const

export function lunesDe(fecha: Date): string {
  const copia = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))
  const dia = copia.getUTCDay()
  copia.setUTCDate(copia.getUTCDate() - (dia === 0 ? 6 : dia - 1))
  return copia.toISOString().slice(0, 10)
}

export function diasDeLaSemana(lunesIso: string): string[] {
  const base = new Date(`${lunesIso}T12:00:00Z`)
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(base)
    dia.setUTCDate(base.getUTCDate() + i)
    return dia.toISOString().slice(0, 10)
  })
}

export function hoyDelEquipo(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaDelEquipo(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
}

/**
 * Propone el nuevo calendario cuando una pieza se devuelve: las que venían
 * después corren un día, y la devuelta se va al final de la semana.
 */
export function recalcularSemana(
  piezas: ReadonlyArray<{ id: string; fecha: string | null }>,
  devueltaId: string,
  lunesIso: string,
): Array<{ id: string; fecha: string }> {
  const dias = diasDeLaSemana(lunesIso)
  const ultimoDia = dias.at(-1)
  if (!ultimoDia) return []

  const enPie = piezas
    .filter((p) => p.id !== devueltaId && p.fecha !== null)
    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))

  const propuesta: Array<{ id: string; fecha: string }> = []
  for (const [indice, pieza] of enPie.entries()) {
    const dia = dias[indice] ?? ultimoDia
    propuesta.push({ id: pieza.id, fecha: dia })
  }

  return propuesta
}
