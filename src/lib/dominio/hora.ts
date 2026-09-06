import { fromZonedTime, toZonedTime } from 'date-fns-tz'

/**
 * Conversión entre la hora del equipo y la hora del servidor.
 *
 * El equipo programa en hora de Bogotá y el servidor corre en UTC. Escribir el
 * desfase a mano funciona hasta que la zona cambia o la marca opera desde otro
 * país, así que la conversión pasa por la zona con nombre.
 */

export const ZONA_POR_DEFECTO = 'America/Bogota'

export function zonaDelEquipo(): string {
  return process.env.ZONA_HORARIA || ZONA_POR_DEFECTO
}

/** Toma la fecha y la hora tal como las escribió la persona, y devuelve el instante real. */
export function instanteDe(
  fechaIso: string,
  hora: string | null,
  zona: string = zonaDelEquipo(),
): Date {
  const horaCompleta = (hora ?? '18:00').slice(0, 5)
  return fromZonedTime(`${fechaIso}T${horaCompleta}:00`, zona)
}

/** El mismo instante, leído en la hora del equipo. */
export function enHoraDelEquipo(instante: Date, zona: string = zonaDelEquipo()): Date {
  return toZonedTime(instante, zona)
}

export function horaLegible(instante: Date, zona: string = zonaDelEquipo()): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante)
}
