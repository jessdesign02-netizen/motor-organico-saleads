import { describe, expect, it } from 'vitest'
import {
  mejorHora,
  rankingDePalabras,
  rendimientoPorHook,
  rendimientoPorHora,
  rendimientoPorTema,
  type PiezaMedida,
} from './analitica'

const pieza = (parcial: Partial<PiezaMedida> & { piezaId: string }): PiezaMedida => ({
  tema: 'Meta Ads',
  hook: 'dato duro',
  palabra: 'AUTOMATIZA',
  hora: '18:00:00',
  detectados: 10,
  enviados: 10,
  clics: 5,
  ...parcial,
})

describe('rankingDePalabras', () => {
  it('suma lo de cada palabra y ordena por clics', () => {
    const filas = rankingDePalabras([
      pieza({ piezaId: 'a', palabra: 'GUIA', clics: 3 }),
      pieza({ piezaId: 'b', palabra: 'AUTOMATIZA', clics: 20 }),
      pieza({ piezaId: 'c', palabra: 'AUTOMATIZA', clics: 10 }),
    ])

    expect(filas[0]?.etiqueta).toBe('AUTOMATIZA')
    expect(filas[0]?.clics).toBe(30)
    expect(filas[0]?.piezas).toBe(2)
    expect(filas[1]?.etiqueta).toBe('GUIA')
  })

  it('calcula los clics por cada cien detectados', () => {
    const filas = rankingDePalabras([pieza({ piezaId: 'a', detectados: 40, clics: 10 })])
    expect(filas[0]?.conversion).toBe(25)
  })

  it('deja la conversión en cero cuando nadie comentó', () => {
    const filas = rankingDePalabras([pieza({ piezaId: 'a', detectados: 0, clics: 0 })])
    expect(filas[0]?.conversion).toBe(0)
  })

  it('descarta las piezas sin palabra clave', () => {
    expect(rankingDePalabras([pieza({ piezaId: 'a', palabra: null })])).toEqual([])
  })
})

describe('rendimiento por tema y por hook', () => {
  it('agrupa por tema', () => {
    const filas = rendimientoPorTema([
      pieza({ piezaId: 'a', tema: 'Meta Ads', clics: 5 }),
      pieza({ piezaId: 'b', tema: 'Meta Ads', clics: 5 }),
      pieza({ piezaId: 'c', tema: 'Creatividad', clics: 1 }),
    ])

    expect(filas[0]).toMatchObject({ etiqueta: 'Meta Ads', piezas: 2, clics: 10 })
  })

  it('agrupa por tipo de hook', () => {
    const filas = rendimientoPorHook([
      pieza({ piezaId: 'a', hook: 'pregunta', clics: 9 }),
      pieza({ piezaId: 'b', hook: 'dato duro', clics: 2 }),
    ])

    expect(filas[0]?.etiqueta).toBe('pregunta')
  })
})

describe('rendimientoPorHora', () => {
  it('agrupa por franja y ordena por hora', () => {
    const filas = rendimientoPorHora([
      pieza({ piezaId: 'a', hora: '18:30:00' }),
      pieza({ piezaId: 'b', hora: '18:00:00' }),
      pieza({ piezaId: 'c', hora: '07:15:00' }),
    ])

    expect(filas.map((f) => f.etiqueta)).toEqual(['07:00', '18:00'])
    expect(filas[1]?.piezas).toBe(2)
  })
})

describe('mejorHora', () => {
  it('devuelve la franja con más envíos por pieza', () => {
    const piezas = [
      ...Array.from({ length: 3 }, (_, i) => pieza({ piezaId: `t${i}`, hora: '07:00:00', enviados: 2 })),
      ...Array.from({ length: 3 }, (_, i) => pieza({ piezaId: `n${i}`, hora: '18:00:00', enviados: 40 })),
    ]

    expect(mejorHora(piezas)?.hora).toBe('18:00')
  })

  it('calla cuando ninguna franja tiene piezas suficientes', () => {
    expect(mejorHora([pieza({ piezaId: 'a', enviados: 500 })])).toBeNull()
  })

  it('descarta la franja afortunada de una sola pieza', () => {
    const piezas = [
      pieza({ piezaId: 'suerte', hora: '03:00:00', enviados: 900 }),
      ...Array.from({ length: 3 }, (_, i) => pieza({ piezaId: `n${i}`, hora: '18:00:00', enviados: 40 })),
    ]

    expect(mejorHora(piezas)?.hora).toBe('18:00')
  })
})
