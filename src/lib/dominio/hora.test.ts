import { describe, expect, it } from 'vitest'
import { enHoraDelEquipo, horaLegible, instanteDe } from './hora'

describe('instanteDe', () => {
  it('lleva la hora de Bogotá al instante real en UTC', () => {
    // Bogotá va cinco horas detrás de UTC, todo el año.
    expect(instanteDe('2026-09-08', '18:00').toISOString()).toBe('2026-09-08T23:00:00.000Z')
  })

  it('cruza al día siguiente cuando la hora es tarde', () => {
    expect(instanteDe('2026-09-08', '20:00').toISOString()).toBe('2026-09-09T01:00:00.000Z')
  })

  it('toma las seis de la tarde cuando la hora llega vacía', () => {
    expect(instanteDe('2026-09-08', null).toISOString()).toBe('2026-09-08T23:00:00.000Z')
  })

  it('tolera la hora con segundos, como la guarda Postgres', () => {
    expect(instanteDe('2026-09-08', '18:00:00').toISOString()).toBe('2026-09-08T23:00:00.000Z')
  })

  it('respeta otra zona cuando la marca opera desde otro país', () => {
    // Ciudad de México va una hora detrás de Bogotá.
    expect(instanteDe('2026-09-08', '18:00', 'America/Mexico_City').toISOString()).toBe(
      '2026-09-09T00:00:00.000Z',
    )
  })

  it('sostiene el horario de verano de las zonas que lo usan', () => {
    const verano = instanteDe('2026-07-01', '12:00', 'America/New_York').toISOString()
    const invierno = instanteDe('2026-01-15', '12:00', 'America/New_York').toISOString()
    expect(verano).toBe('2026-07-01T16:00:00.000Z')
    expect(invierno).toBe('2026-01-15T17:00:00.000Z')
  })
})

describe('lectura en hora del equipo', () => {
  it('devuelve la hora que la persona reconoce', () => {
    expect(horaLegible(new Date('2026-09-08T23:00:00Z'))).toBe('18:00')
  })

  it('la ida y la vuelta coinciden', () => {
    const instante = instanteDe('2026-09-08', '07:30')
    expect(enHoraDelEquipo(instante).getHours()).toBe(7)
  })
})
