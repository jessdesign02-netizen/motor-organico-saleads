import { describe, expect, it } from 'vitest'
import { captionDeLaRed, excedeLaRed, limpiarCaptions } from './caption'

describe('captionDeLaRed', () => {
  it('usa el caption propio de la red', () => {
    expect(captionDeLaRed('instagram', { instagram: 'para IG' }, 'base')).toBe('para IG')
  })

  it('hereda el base cuando la red no tiene el suyo', () => {
    expect(captionDeLaRed('tiktok', { instagram: 'para IG' }, 'base')).toBe('base')
  })

  it('hereda el base cuando el propio llega en blanco', () => {
    expect(captionDeLaRed('youtube', { youtube: '   ' }, 'base')).toBe('base')
  })

  it('devuelve vacío cuando tampoco hay base', () => {
    expect(captionDeLaRed('instagram', null, null)).toBe('')
  })
})

describe('excedeLaRed', () => {
  it('avisa cuando el caption pasa el límite de Instagram', () => {
    expect(excedeLaRed('instagram', 'a'.repeat(2201))).toBe(true)
    expect(excedeLaRed('instagram', 'a'.repeat(2200))).toBe(false)
  })

  it('YouTube admite más texto', () => {
    expect(excedeLaRed('youtube', 'a'.repeat(3000))).toBe(false)
  })
})

describe('limpiarCaptions', () => {
  it('descarta lo vacío para que vuelva a heredar', () => {
    expect(limpiarCaptions({ instagram: 'algo', tiktok: '  ', youtube: undefined })).toEqual({
      instagram: 'algo',
    })
  })

  it('recorta los espacios de sobra', () => {
    expect(limpiarCaptions({ instagram: '  hola  ' })).toEqual({ instagram: 'hola' })
  })
})
