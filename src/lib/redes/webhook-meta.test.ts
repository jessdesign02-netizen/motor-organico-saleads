import { describe, expect, it } from 'vitest'
import { leerCargaMeta, sinLosPropios, type ComentarioDelWebhook } from './webhook-meta'

const AHORA = new Date('2026-09-10T15:00:00Z')

const comentario = (extra: Record<string, unknown> = {}) => ({
  field: 'comments',
  value: {
    id: 'C1',
    text: 'automatiza',
    media: { id: 'IG_POST_1' },
    from: { id: 'U1', username: 'ana' },
    created_time: 1_788_000_000,
    ...extra,
  },
})

const carga = (...cambios: unknown[]) => ({
  object: 'instagram',
  entry: [{ id: 'IG_ACCOUNT', time: 1_788_000_000, changes: cambios }],
})

describe('leerCargaMeta · lo que llega bien', () => {
  it('convierte el comentario a lo que el motor espera', () => {
    const { comentarios } = leerCargaMeta(carga(comentario()), AHORA)

    expect(comentarios).toHaveLength(1)
    expect(comentarios[0]).toMatchObject({
      externalCommentId: 'C1',
      externalPostId: 'IG_POST_1',
      autorUsername: 'ana',
      autorExternalId: 'U1',
      texto: 'automatiza',
    })
  })

  it('convierte los segundos de Meta a milisegundos', () => {
    const { comentarios } = leerCargaMeta(carga(comentario({ created_time: 1_788_000_000 })), AHORA)
    expect(comentarios[0]?.creadoEn.getTime()).toBe(1_788_000_000_000)
  })

  it('toma la hora actual cuando Meta no manda la suya', () => {
    const { comentarios } = leerCargaMeta(carga(comentario({ created_time: undefined })), AHORA)
    expect(comentarios[0]?.creadoEn).toEqual(AHORA)
  })

  it('lee varios comentarios de una sola entrega', () => {
    const { comentarios } = leerCargaMeta(
      carga(comentario(), comentario({ id: 'C2' }), comentario({ id: 'C3' })),
      AHORA,
    )
    expect(comentarios.map((c) => c.externalCommentId)).toEqual(['C1', 'C2', 'C3'])
  })

  it('lee varias entradas en la misma carga', () => {
    const { comentarios } = leerCargaMeta(
      {
        object: 'instagram',
        entry: [
          { id: 'A', changes: [comentario()] },
          { id: 'B', changes: [comentario({ id: 'C2', media: { id: 'IG_POST_2' } })] },
        ],
      },
      AHORA,
    )
    expect(comentarios).toHaveLength(2)
    expect(comentarios[1]?.externalPostId).toBe('IG_POST_2')
  })

  it('acepta el comentario sin autor identificado', () => {
    const { comentarios } = leerCargaMeta(carga(comentario({ from: undefined })), AHORA)
    expect(comentarios[0]).toMatchObject({ autorUsername: null, autorExternalId: null })
  })
})

describe('leerCargaMeta · lo que se descarta, con su motivo', () => {
  const casos: Array<[string, unknown, string]> = [
    ['un objeto que no es de Instagram', { object: 'page', entry: [] }, 'es de page'],
    ['una carga sin entradas', { object: 'instagram' }, 'sin entradas'],
    ['una entrada sin cambios', { object: 'instagram', entry: [{ id: 'A' }] }, 'sin cambios'],
    ['un texto suelto', 'no soy json de meta', 'no es un objeto'],
    ['un valor nulo', null, 'no es un objeto'],
  ]

  for (const [nombre, entrada, motivo] of casos) {
    it(`descarta ${nombre}`, () => {
      const lectura = leerCargaMeta(entrada, AHORA)
      expect(lectura.comentarios).toEqual([])
      expect(lectura.descartados[0]?.motivo).toContain(motivo)
    })
  }

  it('descarta los campos que no son comentarios, sin perder los que sí', () => {
    const lectura = leerCargaMeta(
      carga({ field: 'messages', value: { id: 'M1' } }, comentario(), { field: 'mentions' }),
      AHORA,
    )

    expect(lectura.comentarios).toHaveLength(1)
    expect(lectura.descartados).toHaveLength(2)
    expect(lectura.descartados[0]?.motivo).toContain('messages')
  })

  it('descarta el comentario sin identificador', () => {
    const lectura = leerCargaMeta(carga(comentario({ id: undefined })), AHORA)
    expect(lectura.descartados[0]?.motivo).toContain('sin identificador')
  })

  it('descarta el comentario sin publicación', () => {
    const lectura = leerCargaMeta(carga(comentario({ media: undefined })), AHORA)
    expect(lectura.descartados[0]?.motivo).toContain('sin publicación')
    expect(lectura.descartados[0]?.id).toBe('C1')
  })

  it('trata el texto ausente como texto vacío, sin romperse', () => {
    const { comentarios } = leerCargaMeta(carga(comentario({ text: undefined })), AHORA)
    expect(comentarios[0]?.texto).toBe('')
  })

  it('trata un texto que no es texto como texto vacío', () => {
    const { comentarios } = leerCargaMeta(carga(comentario({ text: { raro: true } })), AHORA)
    expect(comentarios[0]?.texto).toBe('')
  })

  it('sigue con los buenos aunque uno del lote venga roto', () => {
    // Perder el lote entero por un comentario mal formado sería peor: Meta lo
    // reintentaría completo y los buenos quedarían esperando.
    const lectura = leerCargaMeta(carga(comentario({ id: undefined }), comentario({ id: 'C2' })), AHORA)
    expect(lectura.comentarios.map((c) => c.externalCommentId)).toEqual(['C2'])
    expect(lectura.descartados).toHaveLength(1)
  })
})

describe('sinLosPropios', () => {
  const del = (autor: string | null): ComentarioDelWebhook => ({
    externalCommentId: `C-${autor}`,
    externalPostId: 'IG_POST_1',
    autorUsername: autor,
    autorExternalId: autor,
    texto: 'automatiza',
    creadoEn: AHORA,
  })

  it('deja fuera lo que escribió la propia cuenta', () => {
    // Responderle al equipo gastaría el único mensaje que la ventana permite.
    const salida = sinLosPropios([del('IG_ACCOUNT'), del('U1')], ['IG_ACCOUNT'])
    expect(salida.map((c) => c.autorExternalId)).toEqual(['U1'])
  })

  it('deja fuera las dos marcas cuando comentan entre ellas', () => {
    const salida = sinLosPropios([del('SALEADS'), del('JUANADS'), del('U1')], ['SALEADS', 'JUANADS'])
    expect(salida).toHaveLength(1)
  })

  it('conserva el comentario sin autor identificado', () => {
    expect(sinLosPropios([del(null)], ['IG_ACCOUNT'])).toHaveLength(1)
  })

  it('deja pasar todo cuando no hay cuentas propias que excluir', () => {
    expect(sinLosPropios([del('U1'), del('U2')], [])).toHaveLength(2)
  })
})
