import { describe, expect, it } from 'vitest'
import { diasDeLaSemana, hoyDelEquipo, lunesDe, recalcularSemana } from './semana'

describe('calendario', () => {
  it('lleva cualquier día a su lunes', () => {
    expect(lunesDe(new Date('2026-09-10T12:00:00Z'))).toBe('2026-09-07')
    expect(lunesDe(new Date('2026-09-13T12:00:00Z'))).toBe('2026-09-07')
  })

  it('arma los siete días de la semana', () => {
    const dias = diasDeLaSemana('2026-09-07')
    expect(dias).toHaveLength(7)
    expect(dias[0]).toBe('2026-09-07')
    expect(dias[6]).toBe('2026-09-13')
  })

  it('da el día de Bogotá, no el del servidor', () => {
    // Medianoche UTC es todavía el día anterior en Bogotá.
    expect(hoyDelEquipo(new Date('2026-09-10T02:00:00Z'))).toBe('2026-09-09')
  })
})

describe('recalcularSemana', () => {
  it('corre las piezas que seguían y saca la devuelta del calendario', () => {
    const piezas = [
      { id: 'a', fecha: '2026-09-07' },
      { id: 'b', fecha: '2026-09-08' },
      { id: 'c', fecha: '2026-09-09' },
    ]

    const propuesta = recalcularSemana(piezas, 'b', '2026-09-07')

    expect(propuesta).toEqual([
      { id: 'a', fecha: '2026-09-07' },
      { id: 'c', fecha: '2026-09-08' },
    ])
  })

  it('deja la semana intacta cuando la devuelta iba de última', () => {
    const piezas = [
      { id: 'a', fecha: '2026-09-07' },
      { id: 'b', fecha: '2026-09-08' },
    ]
    expect(recalcularSemana(piezas, 'b', '2026-09-07')).toEqual([{ id: 'a', fecha: '2026-09-07' }])
  })

  it('devuelve vacío cuando la semana se queda sin piezas', () => {
    expect(recalcularSemana([{ id: 'a', fecha: '2026-09-07' }], 'a', '2026-09-07')).toEqual([])
  })
})
