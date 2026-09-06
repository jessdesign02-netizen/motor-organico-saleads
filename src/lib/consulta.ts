import 'server-only'

/**
 * Lectura de datos en las pantallas.
 *
 * Las páginas ignoraban el error de cada consulta y seguían con los datos en
 * nulo, así que un fallo de la base se veía como una parrilla vacía: la persona
 * concluía que no había piezas, cuando lo que había era un problema.
 *
 * Ahora el fallo se propaga y lo recoge la pantalla de error, que sí dice qué
 * pasó y adónde ir.
 */

export type ResultadoConsulta<T> = { data: T | null; error: { message: string } | null }

export function filas<T>(resultado: ResultadoConsulta<T[]>, queSeLeia: string): T[] {
  if (resultado.error) {
    throw new Error(`No se pudo leer ${queSeLeia}: ${resultado.error.message}`)
  }
  return resultado.data ?? []
}

export function fila<T>(resultado: ResultadoConsulta<T>, queSeLeia: string): T | null {
  // Una fila que no existe es una respuesta válida, no un fallo.
  if (resultado.error && resultado.error.message.includes('no se encontró')) return null
  if (resultado.error) {
    throw new Error(`No se pudo leer ${queSeLeia}: ${resultado.error.message}`)
  }
  return resultado.data
}
