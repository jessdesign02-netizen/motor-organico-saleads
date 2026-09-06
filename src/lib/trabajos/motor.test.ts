import { describe, expect, it } from 'vitest'
import { generarVariantes } from '@/lib/dominio/clave'
import type { AdaptadorRed, ComentarioEntrante, CredencialCuenta } from '@/lib/redes'
import { componerMensaje, procesarComentarios, type AlmacenMotor, type Automatizacion } from './motor'

const AHORA = new Date('2026-09-10T15:00:00Z')

/**
 * Almacén en memoria que reproduce las mismas restricciones que la base:
 * único por (publicación, comentario externo) y un solo respondido por autor.
 * Si el motor se salta una regla, aquí revienta igual que en Postgres.
 */
function almacenDePrueba(gastadasHoy = 0) {
  const comentarios = new Map<string, { id: string; autor: string | null; estado: string }>()
  const envios: Array<{ comentarioId: string; estado: string }> = []
  const respondidosPorAutor = new Set<string>()
  let secuencia = 0

  const almacen: AlmacenMotor = {
    async registrar(publicationId, comentario) {
      const llave = `${publicationId}::${comentario.externalCommentId}`
      const existente = comentarios.get(llave)
      if (existente) return { nuevo: false, comentarioId: existente.id }
      const id = `c${++secuencia}`
      comentarios.set(llave, { id, autor: comentario.autorExternalId, estado: 'detectado' })
      return { nuevo: true, comentarioId: id }
    },
    async autorYaAtendido(publicationId, autorExternalId) {
      if (!autorExternalId) return false
      return respondidosPorAutor.has(`${publicationId}::${autorExternalId}`)
    },
    async marcar(comentarioId, estado) {
      for (const [, valor] of comentarios) {
        if (valor.id !== comentarioId) continue
        if (estado === 'respondido') {
          if (valor.autor) {
            const llave = `pub-1::${valor.autor}`
            if (respondidosPorAutor.has(llave)) {
              throw new Error('la base rechaza la segunda respuesta al mismo autor')
            }
            respondidosPorAutor.add(llave)
          }
        }
        valor.estado = estado
      }
    },
    async anotarEnvio(comentarioId, datos) {
      if (envios.some((e) => e.comentarioId === comentarioId)) {
        throw new Error('la base rechaza el segundo envío para el mismo comentario')
      }
      envios.push({ comentarioId, estado: datos.estado })
    },
    async respuestasDeHoy() {
      return gastadasHoy
    },
  }

  return { almacen, comentarios, envios, respondidosPorAutor }
}

function adaptadorFalso(
  opciones: { responde?: boolean; cupo?: number | null; fallaEn?: (indice: number) => boolean } = {},
) {
  const enviados: string[] = []
  let indice = 0

  const adaptador: AdaptadorRed = {
    red: 'instagram',
    publicar: async () => ({ estado: 'fallido', error: 'sin uso', reintentable: false }),
    leerComentarios: null,
    responder:
      opciones.responde === false
        ? null
        : async (_credencial, comentario) => {
            const actual = indice++
            if (opciones.fallaEn?.(actual)) {
              return { estado: 'fallido', error: 'límite de la plataforma', reintentable: true }
            }
            enviados.push(comentario.externalCommentId)
            return { estado: 'enviado', referencia: `m${actual}` }
          },
    enviosPorSegundo: 2,
    cupoDiarioRespuestas: opciones.cupo ?? null,
  }

  return { adaptador, enviados }
}

const credencial: CredencialCuenta = {
  cuentaId: 'cuenta-1',
  red: 'instagram',
  externalAccountId: 'IG_1',
  token: 'token',
}

const automatizacion: Automatizacion = {
  publicationId: 'pub-1',
  externalPostId: 'IG_POST_1',
  red: 'instagram',
  palabra: 'AUTOMATIZA',
  variantes: generarVariantes('AUTOMATIZA'),
  mensaje: 'Aquí tienes la guía que pediste con {palabra}.',
  enlace: 'https://bio.saleads.co/r/meta1',
  claveActivaDesde: new Date('2026-09-08T18:00:00Z'),
  claveActivaHasta: null,
}

function comentario(parcial: Partial<ComentarioEntrante> & { externalCommentId: string }): ComentarioEntrante {
  return {
    externalPostId: 'IG_POST_1',
    autorUsername: 'alguien',
    autorExternalId: 'U-generico',
    texto: 'automatiza',
    creadoEn: new Date('2026-09-10T14:00:00Z'),
    ...parcial,
  }
}

/** Deja pasar el control sin gastar tiempo real de espera. */
const sinEsperar = async () => {}

describe('componerMensaje', () => {
  it('reemplaza el enlace y la palabra', () => {
    expect(componerMensaje('Toma {palabra}: {enlace}', 'https://x.co/a', 'GRATIS')).toBe(
      'Toma GRATIS: https://x.co/a',
    )
  })

  it('agrega el enlace cuando la plantilla se olvidó de ponerlo', () => {
    expect(componerMensaje('Ahí va', 'https://x.co/a', 'GRATIS')).toContain('https://x.co/a')
  })
})

describe('motor de comentarios · reglas una por una', () => {
  it('responde al comentario con la palabra dentro de una frase', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [comentario({ externalCommentId: 'C1', texto: 'hola, me interesa, AutomatiZá 🙏', autorExternalId: 'U1' })],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.respondidos).toBe(1)
    expect(enviados).toEqual(['C1'])
  })

  it('descarta el comentario sin la palabra', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [comentario({ externalCommentId: 'C1', texto: 'qué buen video' })],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.sinCoincidencia).toBe(1)
    expect(enviados).toEqual([])
  })

  it('responde una sola vez cuando el mismo comentario llega dos veces en el lote', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [
        comentario({ externalCommentId: 'C1', autorExternalId: 'U1' }),
        comentario({ externalCommentId: 'C1', autorExternalId: 'U1' }),
      ],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.respondidos).toBe(1)
    expect(resumen.duplicados).toBe(1)
    expect(enviados).toEqual(['C1'])
  })

  it('responde una sola vez cuando el sondeo repite una pasada anterior', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()
    const lote = [comentario({ externalCommentId: 'C1', autorExternalId: 'U1' })]
    const opciones = { ahora: AHORA, dormir: sinEsperar }

    await procesarComentarios(lote, automatizacion, adaptador, credencial, almacen, opciones)
    const segunda = await procesarComentarios(lote, automatizacion, adaptador, credencial, almacen, opciones)

    expect(segunda.respondidos).toBe(0)
    expect(segunda.duplicados).toBe(1)
    expect(enviados).toEqual(['C1'])
  })

  it('atiende una sola vez al autor que comenta la palabra dos veces', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [
        comentario({ externalCommentId: 'C1', autorExternalId: 'U1', texto: 'automatiza' }),
        comentario({ externalCommentId: 'C2', autorExternalId: 'U1', texto: 'automatiza otra vez' }),
      ],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.respondidos).toBe(1)
    expect(enviados).toEqual(['C1'])
    expect(resumen.detalle.find((d) => d.externalCommentId === 'C2')?.resultado).toBe('autor_repetido')
  })

  it('manda a la bandeja el comentario que pasó la ventana de siete días', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [comentario({ externalCommentId: 'C1', autorExternalId: 'U1', creadoEn: new Date('2026-09-01T10:00:00Z') })],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.respondidos).toBe(0)
    expect(resumen.detalle[0]?.resultado).toBe('ventana_vencida')
    expect(enviados).toEqual([])
  })

  it('atiende el comentario reciente sobre una publicación vieja', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [comentario({ externalCommentId: 'C1', autorExternalId: 'U1', creadoEn: new Date('2026-09-10T09:00:00Z') })],
      { ...automatizacion, claveActivaDesde: new Date('2026-06-01T10:00:00Z') },
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.respondidos).toBe(1)
  })

  it('deja quieto el comentario cuando la palabra clave ya venció', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador } = adaptadorFalso()

    const resumen = await procesarComentarios(
      [comentario({ externalCommentId: 'C1', autorExternalId: 'U1' })],
      { ...automatizacion, claveActivaHasta: new Date('2026-09-09T00:00:00Z') },
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.detalle[0]?.resultado).toBe('clave_vencida')
  })

  it('manda a la bandeja manual la red que carece de API de respuesta', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador } = adaptadorFalso({ responde: false })

    const resumen = await procesarComentarios(
      [comentario({ externalCommentId: 'C1', autorExternalId: 'U1' })],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.aBandejaManual).toBe(1)
    expect(resumen.detalle[0]?.motivo).toContain('carece de API')
  })

  it('respeta el cupo diario y desborda a la bandeja', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso({ cupo: 2 })

    const resumen = await procesarComentarios(
      Array.from({ length: 5 }, (_, i) =>
        comentario({ externalCommentId: `C${i}`, autorExternalId: `U${i}` }),
      ),
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(enviados).toHaveLength(2)
    expect(resumen.aBandejaManual).toBe(3)
  })

  it('registra el fallo de envío sin llevarse por delante el resto del lote', async () => {
    const { almacen, envios } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso({ fallaEn: (i) => i === 0 })

    const resumen = await procesarComentarios(
      [
        comentario({ externalCommentId: 'C1', autorExternalId: 'U1' }),
        comentario({ externalCommentId: 'C2', autorExternalId: 'U2' }),
      ],
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(resumen.fallidos).toBe(1)
    expect(resumen.respondidos).toBe(1)
    expect(enviados).toEqual(['C2'])
    expect(envios).toHaveLength(2)
  })
})

describe('motor de comentarios · cupo de la plataforma', () => {
  it('el cupo de la cuenta manda sobre el de la red', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso({ cupo: 150 })

    await procesarComentarios(
      Array.from({ length: 4 }, (_, i) => comentario({ externalCommentId: `C${i}`, autorExternalId: `U${i}` })),
      automatizacion,
      adaptador,
      { ...credencial, cupoRespuestasDia: 2 },
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(enviados).toHaveLength(2)
  })

  it('descuenta lo ya gastado en el día', async () => {
    const { almacen } = almacenDePrueba(148)
    const { adaptador, enviados } = adaptadorFalso({ cupo: 150 })

    const resumen = await procesarComentarios(
      Array.from({ length: 5 }, (_, i) => comentario({ externalCommentId: `C${i}`, autorExternalId: `U${i}` })),
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(enviados).toHaveLength(2)
    expect(resumen.aBandejaManual).toBe(3)
  })

  it('la red sin cupo responde todo lo que llega', async () => {
    const { almacen } = almacenDePrueba(5000)
    const { adaptador, enviados } = adaptadorFalso({ cupo: null })

    await procesarComentarios(
      Array.from({ length: 3 }, (_, i) => comentario({ externalCommentId: `C${i}`, autorExternalId: `U${i}` })),
      automatizacion,
      adaptador,
      credencial,
      almacen,
      { ahora: AHORA, dormir: sinEsperar },
    )

    expect(enviados).toHaveLength(3)
  })
})

describe('motor de comentarios · el pico real de 300 comentarios', () => {
  it('responde el pico sin perder ninguno, sin repetir autor y sin pasarse del ritmo', async () => {
    const { almacen, envios } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    // 300 comentarios como llegan de verdad:
    //   200 con la palabra bien escrita, cada uno de un autor distinto
    //    40 con la palabra mal escrita, que también deben recibir respuesta
    //    30 sin la palabra
    //    20 repetidos del mismo autor que ya comentó
    //    10 que el webhook entregó dos veces
    const lote: ComentarioEntrante[] = []

    for (let i = 0; i < 200; i++) {
      lote.push(comentario({ externalCommentId: `OK${i}`, autorExternalId: `A${i}`, texto: 'automatiza' }))
    }
    const malEscritas = ['AUTOMATIZAAA', 'automatizas', 'Automatizá!!', 'quiero automatiza ya 🔥', 'auto matiza']
    for (let i = 0; i < 40; i++) {
      lote.push(
        comentario({
          externalCommentId: `MAL${i}`,
          autorExternalId: `B${i}`,
          texto: malEscritas[i % malEscritas.length] ?? 'automatiza',
        }),
      )
    }
    for (let i = 0; i < 30; i++) {
      lote.push(comentario({ externalCommentId: `NO${i}`, autorExternalId: `C${i}`, texto: 'qué buen video 👏' }))
    }
    for (let i = 0; i < 20; i++) {
      lote.push(comentario({ externalCommentId: `REP${i}`, autorExternalId: `A${i}`, texto: 'automatiza otra vez' }))
    }
    for (let i = 0; i < 10; i++) {
      lote.push(comentario({ externalCommentId: `OK${i}`, autorExternalId: `A${i}`, texto: 'automatiza' }))
    }

    expect(lote).toHaveLength(300)

    // Reloj falso: mide el ritmo sin esperar de verdad.
    let instante = 0
    const dormir = async (ms: number) => {
      instante += ms
    }
    const reloj = () => instante

    const resumen = await procesarComentarios(lote, automatizacion, adaptador, credencial, almacen, {
      ahora: AHORA,
      dormir,
      reloj,
    })

    // Ninguno se pierde: cada comentario tiene su desenlace registrado.
    expect(resumen.recibidos).toBe(300)
    expect(resumen.detalle).toHaveLength(300)

    // 240 con la palabra, cada uno de autor nuevo, reciben respuesta.
    expect(resumen.respondidos).toBe(240)
    expect(enviados).toHaveLength(240)
    expect(new Set(enviados).size).toBe(240)

    expect(resumen.sinCoincidencia).toBe(30)
    expect(resumen.duplicados).toBe(30) // 20 de autor repetido y 10 de webhook repetido
    expect(resumen.fallidos).toBe(0)

    // Un envío por comentario respondido, nunca dos.
    expect(envios).toHaveLength(240)

    // El ritmo respeta las 2 llamadas por segundo de Meta.
    const segundos = instante / 1000
    expect(segundos).toBeGreaterThanOrEqual((240 - 1) / 2)
    expect(240 / Math.max(segundos, 1)).toBeLessThanOrEqual(2.05)
  })

  it('atiende el pico igual cuando el webhook y el sondeo corren a la vez', async () => {
    const { almacen } = almacenDePrueba()
    const { adaptador, enviados } = adaptadorFalso()

    const lote = Array.from({ length: 300 }, (_, i) =>
      comentario({ externalCommentId: `C${i}`, autorExternalId: `A${i}`, texto: 'automatiza' }),
    )
    const opciones = { ahora: AHORA, dormir: sinEsperar }

    // El sondeo vuelve a ver el mismo lote mientras el webhook lo procesa.
    const [webhook, sondeo] = await Promise.all([
      procesarComentarios(lote, automatizacion, adaptador, credencial, almacen, opciones),
      procesarComentarios(lote, automatizacion, adaptador, credencial, almacen, opciones),
    ])

    expect(webhook.respondidos + sondeo.respondidos).toBe(300)
    expect(enviados).toHaveLength(300)
    expect(new Set(enviados).size).toBe(300)
  })
})
