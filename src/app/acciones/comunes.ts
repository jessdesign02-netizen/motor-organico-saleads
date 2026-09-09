import 'server-only'

/**
 * RLS deniega un UPDATE o un DELETE en silencio: la fila queda fuera de la
 * política, se tocan cero filas y no llega ninguna excepción. Dar eso por
 * bueno mostraría un "listo" sobre algo que nunca ocurrió, así que toda
 * escritura pasa por aquí.
 */
export function exigirEscritura<T>(
  resultado: { data: T[] | null; error: { message: string } | null },
  queHacia: string,
): T[] {
  if (resultado.error) throw new Error(`${queHacia}: ${resultado.error.message}`)
  const filas = resultado.data ?? []
  if (filas.length === 0) {
    throw new Error(`${queHacia}: la operación no alcanzó ninguna fila. Revisa tus permisos.`)
  }
  return filas
}

export type Respuesta = { ok: true; mensaje: string } | { ok: false; mensaje: string }

export async function envolver(queHacia: string, trabajo: () => Promise<string>): Promise<Respuesta> {
  try {
    return { ok: true, mensaje: await trabajo() }
  } catch (error) {
    return { ok: false, mensaje: error instanceof Error ? error.message : `${queHacia} falló` }
  }
}
