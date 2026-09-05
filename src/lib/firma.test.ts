import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { firmaValida } from './firma'

const SECRETO = 'secreto-de-prueba'
const CUERPO = JSON.stringify({ entry: [{ changes: [{ field: 'comments' }] }] })

function firmar(cuerpo: string, secreto = SECRETO) {
  return 'sha256=' + createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex')
}

describe('firma del webhook', () => {
  it('acepta la firma que corresponde al cuerpo', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO), SECRETO)).toBe(true)
  })

  it('rechaza la firma de otro secreto', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO, 'otro'), SECRETO)).toBe(false)
  })

  it('rechaza el cuerpo alterado después de firmar', () => {
    const firma = firmar(CUERPO)
    expect(firmaValida(CUERPO + ' ', firma, SECRETO)).toBe(false)
  })

  it('rechaza la petición sin cabecera', () => {
    expect(firmaValida(CUERPO, null, SECRETO)).toBe(false)
  })

  it('rechaza una cabecera de otro largo sin reventar', () => {
    expect(firmaValida(CUERPO, 'sha256=corta', SECRETO)).toBe(false)
  })

  it('rechaza la firma sin el prefijo del algoritmo', () => {
    expect(firmaValida(CUERPO, firmar(CUERPO).replace('sha256=', ''), SECRETO)).toBe(false)
  })
})
