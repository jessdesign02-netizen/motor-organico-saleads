import { describe, expect, it } from 'vitest'
import { huellaDe, interpretarFecha, leerFila, loQueFalta, lunesDeLaSemana } from './ingesta'

const fila = (valores: Record<string, string>, filaId = 'fila-2') => ({ filaId, valores })

describe('interpretarFecha', () => {
  it('acepta el formato ISO', () => {
    expect(interpretarFecha('2026-09-12')).toBe('2026-09-12')
  })

  it('acepta el formato que usa el equipo', () => {
    expect(interpretarFecha('12/09/2026')).toBe('2026-09-12')
    expect(interpretarFecha('5-9-2026')).toBe('2026-09-05')
  })

  it('devuelve null cuando la celda va vacía', () => {
    expect(interpretarFecha('   ')).toBeNull()
  })

  it('devuelve null cuando la fecha llega escrita a mano', () => {
    expect(interpretarFecha('el jueves')).toBeNull()
  })
})

describe('lunesDeLaSemana', () => {
  it('lleva cualquier día a su lunes', () => {
    expect(lunesDeLaSemana('2026-09-12')).toBe('2026-09-07')
    expect(lunesDeLaSemana('2026-09-07')).toBe('2026-09-07')
  })

  it('lleva el domingo al lunes anterior', () => {
    expect(lunesDeLaSemana('2026-09-13')).toBe('2026-09-07')
  })
})

describe('leerFila', () => {
  it('arma la pieza con los encabezados por defecto', () => {
    const salida = leerFila(
      fila({
        pieza: 'Meta Ads',
        hook: 'Nadie te lo dijo',
        formato_base: 'reel',
        link_de_drive: 'https://drive.google.com/x',
        responsable: 'Ema',
        fecha_de_publicacion: '12/09/2026',
        recursos: 'Guía de anuncios',
      }),
    )

    expect('pieza' in salida).toBe(true)
    if (!('pieza' in salida)) return
    expect(salida.pieza.tema).toBe('Meta Ads')
    expect(salida.pieza.fechaPublicacion).toBe('2026-09-12')
    expect(salida.pieza.sheetRowId).toBe('fila-2')
  })

  it('descarta la fila sin tema, con su motivo', () => {
    const salida = leerFila(fila({ pieza: '', hook: 'algo' }))
    expect('descarte' in salida).toBe(true)
    if (!('descarte' in salida)) return
    expect(salida.descarte.motivo).toContain('sin tema')
  })

  it('descarta la fila con la fecha ilegible, con su motivo', () => {
    const salida = leerFila(fila({ pieza: 'Meta Ads', fecha_de_publicacion: 'el jueves' }))
    expect('descarte' in salida).toBe(true)
    if (!('descarte' in salida)) return
    expect(salida.descarte.motivo).toContain('no se entiende')
  })

  it('respeta el mapa de columnas de la marca', () => {
    const salida = leerFila(fila({ titulo: 'Marca personal' }), { tema: 'titulo' })
    expect('pieza' in salida).toBe(true)
    if (!('pieza' in salida)) return
    expect(salida.pieza.tema).toBe('Marca personal')
  })
})

describe('huella e incompletos', () => {
  it('la huella cambia cuando cambia una celda', () => {
    const antes = huellaDe({ pieza: 'A', hook: 'B' })
    const despues = huellaDe({ pieza: 'A', hook: 'C' })
    expect(antes).not.toBe(despues)
  })

  it('la huella se sostiene sin importar el orden de las columnas', () => {
    expect(huellaDe({ a: '1', b: '2' })).toBe(huellaDe({ b: '2', a: '1' }))
  })

  it('señala qué le falta a la pieza para poder salir', () => {
    const salida = leerFila(fila({ pieza: 'Meta Ads' }))
    if (!('pieza' in salida)) throw new Error('debía leerse')
    expect(loQueFalta(salida.pieza)).toEqual(['link de Drive', 'fecha de publicación', 'hook'])
  })
})
