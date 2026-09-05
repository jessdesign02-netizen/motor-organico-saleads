import { describe, expect, it } from 'vitest'
import { coincide, colapsar, generarVariantes, normalizar } from './clave'

describe('normalizar', () => {
  it('sube a mayúsculas y quita las tildes', () => {
    expect(normalizar('automatización')).toBe('AUTOMATIZACION')
    expect(normalizar('Guía')).toBe('GUIA')
  })

  it('descarta signos, espacios y emojis', () => {
    expect(normalizar('¡GRATIS! 🔥')).toBe('GRATIS')
    expect(normalizar('me-gusta_esto')).toBe('MEGUSTAESTO')
  })

  it('conserva los números', () => {
    expect(normalizar('plan2026')).toBe('PLAN2026')
  })

  it('devuelve cadena vacía cuando solo hay signos', () => {
    expect(normalizar('!!! ???')).toBe('')
    expect(normalizar('')).toBe('')
  })
})

describe('colapsar', () => {
  it('reduce las letras repetidas a una', () => {
    expect(colapsar('QUIEEEROO')).toBe('QUIERO')
    expect(colapsar('GRATISSS')).toBe('GRATIS')
  })
})

describe('generarVariantes', () => {
  it('propone formas alternas sin repetir la base', () => {
    const variantes = generarVariantes('GRATIS')
    expect(variantes).not.toContain('GRATIS')
    expect(variantes).toContain('GRATISS')
    expect(variantes).toContain('GRATI')
  })

  it('agrega el plural cuando la palabra va en singular', () => {
    expect(generarVariantes('GUIA')).toContain('GUIAS')
  })

  it('quita la ese cuando la palabra ya va en plural', () => {
    expect(generarVariantes('LEADS')).toContain('LEAD')
  })

  it('devuelve vacío cuando la palabra queda sin letras', () => {
    expect(generarVariantes('¡!')).toEqual([])
  })

  it('normaliza la entrada antes de derivar', () => {
    expect(generarVariantes('guía')).toContain('GUIAS')
  })
})

describe('coincide · la tabla de casos de la regla 4', () => {
  const palabra = 'AUTOMATIZA'
  const variantes = generarVariantes(palabra)

  const debenCoincidir: Array<[string, string]> = [
    ['exacta', 'AUTOMATIZA'],
    ['en minúsculas', 'automatiza'],
    ['mezclada', 'AuToMaTiZa'],
    ['con tilde de más', 'automatizá'],
    ['dentro de una frase larga', 'hola, me interesa mucho, automatiza por favor 🙏'],
    ['con signos pegados', '¿automatiza?'],
    ['con letras repetidas', 'automatizaaa'],
    ['con la ese del plural', 'automatizas'],
    ['con emojis alrededor', '🔥 automatiza 🔥'],
    ['partida por espacios', 'auto matiza'],
    ['con salto de línea', 'quiero\nautomatiza\nya'],
  ]

  for (const [nombre, texto] of debenCoincidir) {
    it(`coincide ${nombre}`, () => {
      expect(coincide(texto, palabra, variantes).coincide).toBe(true)
    })
  }

  const debenFallar: Array<[string, string]> = [
    ['palabra distinta', 'quiero información'],
    ['comentario vacío', ''],
    ['solo signos', '!!!'],
    ['solo emojis', '🔥🔥🔥'],
    ['palabra parecida pero corta', 'auto'],
  ]

  for (const [nombre, texto] of debenFallar) {
    it(`descarta ${nombre}`, () => {
      expect(coincide(texto, palabra, variantes).coincide).toBe(false)
    })
  }

  it('informa la forma que disparó la coincidencia', () => {
    expect(coincide('dame automatizas ya', palabra, variantes).forma).toBeTruthy()
  })

  it('descarta cuando la palabra clave queda vacía', () => {
    expect(coincide('lo que sea', '!!!', []).coincide).toBe(false)
  })
})
