import { describe, expect, it } from 'vitest'
import { fila, filas } from './consulta'

describe('filas', () => {
  it('devuelve lo que llegó', () => {
    expect(filas({ data: [{ id: '1' }], error: null }, 'las piezas')).toEqual([{ id: '1' }])
  })

  it('devuelve vacío cuando de verdad no hay nada', () => {
    expect(filas({ data: [], error: null }, 'las piezas')).toEqual([])
    expect(filas({ data: null, error: null }, 'las piezas')).toEqual([])
  })

  it('lanza cuando la base falló, nombrando qué se leía', () => {
    // Devolver vacío aquí haría creer que no hay piezas, cuando lo que hay es
    // un problema de conexión.
    expect(() => filas({ data: null, error: { message: 'conexión perdida' } }, 'la parrilla')).toThrow(
      'No se pudo leer la parrilla: conexión perdida',
    )
  })
})

describe('fila', () => {
  it('devuelve la fila encontrada', () => {
    expect(fila({ data: { id: '1' }, error: null }, 'la pieza')).toEqual({ id: '1' })
  })

  it('devuelve null cuando la fila simplemente no existe', () => {
    // Una pieza que no está es una respuesta válida, no un fallo.
    expect(fila({ data: null, error: { message: 'no se encontró la fila' } }, 'la pieza')).toBeNull()
  })

  it('lanza ante un fallo de verdad', () => {
    expect(() => fila({ data: null, error: { message: 'permiso denegado' } }, 'la pieza')).toThrow(
      'permiso denegado',
    )
  })
})
