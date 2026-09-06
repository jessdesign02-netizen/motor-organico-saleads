import type { RedSocial } from '@/lib/database.types'

/**
 * Herencia del caption: cada red usa el suyo, y la que no tenga uno propio
 * toma el base. Ninguna sale en blanco.
 */

export const LIMITES_CAPTION: Record<RedSocial, number> = {
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
}

export function captionDeLaRed(
  red: RedSocial,
  captionsPorRed: Partial<Record<RedSocial, string>> | null | undefined,
  captionBase: string | null,
): string {
  const propio = captionsPorRed?.[red]?.trim()
  if (propio) return propio
  return captionBase?.trim() ?? ''
}

/** Lo que la red va a rechazar antes de intentarlo. */
export function excedeLaRed(red: RedSocial, texto: string): boolean {
  return texto.length > LIMITES_CAPTION[red]
}

/** Solo se guarda lo que la persona escribió. Lo vacío vuelve a heredar. */
export function limpiarCaptions(
  entrada: Partial<Record<RedSocial, string | undefined>>,
): Partial<Record<RedSocial, string>> {
  const salida: Partial<Record<RedSocial, string>> = {}
  for (const red of Object.keys(LIMITES_CAPTION) as RedSocial[]) {
    const texto = entrada[red]?.trim()
    if (texto) salida[red] = texto
  }
  return salida
}
