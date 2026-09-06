/**
 * Fase 3 · panel de resultados ampliado.
 *
 * Funciones puras sobre lo que ya está registrado: qué palabra clave trajo más
 * gente, qué tema y qué tipo de hook rinden, y a qué hora conviene publicar.
 * Sin acceso a la base, para poder probarlas con datos de mentira.
 */

export type PiezaMedida = {
  piezaId: string
  tema: string | null
  hook: string | null
  palabra: string | null
  hora: string | null
  detectados: number
  enviados: number
  clics: number
}

export type FilaRanking = {
  etiqueta: string
  piezas: number
  detectados: number
  enviados: number
  clics: number
  /** Clics por cada cien comentarios detectados. Dice qué tan lejos llega la gente. */
  conversion: number
}

function agrupar(piezas: readonly PiezaMedida[], por: (p: PiezaMedida) => string | null): FilaRanking[] {
  const cubos = new Map<string, FilaRanking>()

  for (const pieza of piezas) {
    const etiqueta = por(pieza)
    if (!etiqueta) continue

    const fila = cubos.get(etiqueta) ?? {
      etiqueta,
      piezas: 0,
      detectados: 0,
      enviados: 0,
      clics: 0,
      conversion: 0,
    }

    fila.piezas++
    fila.detectados += pieza.detectados
    fila.enviados += pieza.enviados
    fila.clics += pieza.clics
    cubos.set(etiqueta, fila)
  }

  for (const fila of cubos.values()) {
    fila.conversion = fila.detectados === 0 ? 0 : Math.round((fila.clics / fila.detectados) * 100)
  }

  return [...cubos.values()].sort((a, b) => b.clics - a.clics || b.detectados - a.detectados)
}

export function rankingDePalabras(piezas: readonly PiezaMedida[]): FilaRanking[] {
  return agrupar(piezas, (p) => p.palabra)
}

export function rendimientoPorTema(piezas: readonly PiezaMedida[]): FilaRanking[] {
  return agrupar(piezas, (p) => p.tema)
}

export function rendimientoPorHook(piezas: readonly PiezaMedida[]): FilaRanking[] {
  return agrupar(piezas, (p) => p.hook)
}

/** La hora se agrupa por franja, porque el minuto exacto no dice nada. */
export function rendimientoPorHora(piezas: readonly PiezaMedida[]): FilaRanking[] {
  return agrupar(piezas, (p) => (p.hora ? `${p.hora.slice(0, 2)}:00` : null)).sort((a, b) =>
    a.etiqueta.localeCompare(b.etiqueta),
  )
}

/**
 * La hora que más gente trajo, con un mínimo de piezas para que la sugerencia
 * se sostenga. Una sola pieza afortunada no es una recomendación.
 */
export function mejorHora(
  piezas: readonly PiezaMedida[],
  minimoDePiezas = 3,
): { hora: string; enviados: number; piezas: number } | null {
  const franjas = rendimientoPorHora(piezas).filter((f) => f.piezas >= minimoDePiezas)
  if (franjas.length === 0) return null

  const mejor = franjas.reduce((a, b) => (b.enviados / b.piezas > a.enviados / a.piezas ? b : a))
  return { hora: mejor.etiqueta, enviados: mejor.enviados, piezas: mejor.piezas }
}
