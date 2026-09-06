import { describe, expect, it } from 'vitest'
import { idDeDrive } from './drive'

describe('idDeDrive', () => {
  const validos: Array<[string, string]> = [
    ['enlace de compartir', 'https://drive.google.com/file/d/1AbC_dEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing'],
    ['enlace con parámetro', 'https://drive.google.com/uc?export=download&id=1AbC_dEfGhIjKlMnOpQrStUvWxYz'],
    ['enlace de abrir', 'https://drive.google.com/open?id=1AbC_dEfGhIjKlMnOpQrStUvWxYz'],
  ]

  for (const [nombre, enlace] of validos) {
    it(`saca el id de un ${nombre}`, () => {
      expect(idDeDrive(enlace)).toBe('1AbC_dEfGhIjKlMnOpQrStUvWxYz')
    })
  }

  it('acepta el id suelto', () => {
    expect(idDeDrive('1AbC_dEfGhIjKlMnOpQrStUvWxYz')).toBe('1AbC_dEfGhIjKlMnOpQrStUvWxYz')
  })

  it('tolera los espacios de alrededor', () => {
    expect(idDeDrive('  1AbC_dEfGhIjKlMnOpQrStUvWxYz  ')).toBe('1AbC_dEfGhIjKlMnOpQrStUvWxYz')
  })

  it('devuelve null cuando el enlace es de otra parte', () => {
    expect(idDeDrive('https://youtube.com/watch?v=abc')).toBeNull()
    expect(idDeDrive('')).toBeNull()
  })

  it('devuelve null cuando el texto es demasiado corto para ser un id', () => {
    expect(idDeDrive('abc123')).toBeNull()
  })
})
