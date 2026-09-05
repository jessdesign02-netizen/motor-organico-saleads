/**
 * Cola con control de tasa y reintentos.
 *
 * Meta admite 2 llamadas por segundo por cuenta profesional en los endpoints de
 * mensajería, y alrededor de 750 respuestas privadas por hora sobre
 * publicaciones. El pico real medido es de 300 comentarios en minutos, así que
 * la cola se dimensiona a ese límite y respeta el orden de llegada.
 */

export const ENVIOS_POR_SEGUNDO = 2
export const ENVIOS_POR_HORA = 750
export const INTENTOS_MAXIMOS = 3

/** Espera creciente entre intentos, en milisegundos: 2, 8 y 30 minutos. */
export const ESPERAS_MS = [2, 8, 30].map((minutos) => minutos * 60 * 1000)

export function esperaDelIntento(intento: number): number | null {
  const espera = ESPERAS_MS[intento - 1]
  return espera ?? null
}

export function proximoIntentoAt(intento: number, desde: Date = new Date()): Date | null {
  const espera = esperaDelIntento(intento)
  if (espera === null) return null
  return new Date(desde.getTime() + espera)
}

export type ResultadoTarea<T> =
  | { estado: 'listo'; valor: T }
  | { estado: 'fallido'; error: string }

export type OpcionesCola = {
  porSegundo?: number
  /** Se inyecta en las pruebas para no esperar de verdad. */
  dormir?: (ms: number) => Promise<void>
  ahora?: () => number
}

const dormirReal = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms))

/**
 * Procesa las tareas en orden, sin superar el ritmo permitido. Una tarea que
 * falla queda registrada y la cola sigue: perder el resto por un fallo suelto
 * sería peor que el fallo.
 */
export async function procesarConTasa<E, S>(
  entradas: readonly E[],
  tarea: (entrada: E, indice: number) => Promise<S>,
  opciones: OpcionesCola = {},
): Promise<Array<ResultadoTarea<S>>> {
  const porSegundo = opciones.porSegundo ?? ENVIOS_POR_SEGUNDO
  const dormir = opciones.dormir ?? dormirReal
  const ahora = opciones.ahora ?? (() => Date.now())
  const intervalo = porSegundo > 0 ? 1000 / porSegundo : 0

  const salida: Array<ResultadoTarea<S>> = []
  let siguientePermitido = ahora()

  for (const [indice, entrada] of entradas.entries()) {
    const espera = siguientePermitido - ahora()
    if (espera > 0) await dormir(espera)
    siguientePermitido = Math.max(ahora(), siguientePermitido) + intervalo

    try {
      salida.push({ estado: 'listo', valor: await tarea(entrada, indice) })
    } catch (error) {
      salida.push({
        estado: 'fallido',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return salida
}

/**
 * Deja una sola entrada por clave, conservando la primera. Es la idempotencia
 * del sondeo: el mismo comentario visto dos veces se responde una.
 */
export function unicoPorClave<T>(entradas: readonly T[], clave: (entrada: T) => string): T[] {
  const vistos = new Set<string>()
  const salida: T[] = []
  for (const entrada of entradas) {
    const k = clave(entrada)
    if (vistos.has(k)) continue
    vistos.add(k)
    salida.push(entrada)
  }
  return salida
}
