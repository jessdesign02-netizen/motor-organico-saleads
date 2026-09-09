import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComentarioEntrante, CredencialCuenta } from './tipos'
import { leerComentariosInstagram, publicarEnInstagram, responderPrivadoInstagram } from './instagram'

const credencial: CredencialCuenta = {
  cuentaId: 'c1',
  red: 'instagram',
  externalAccountId: 'IG_ACCOUNT',
  token: 'token-de-prueba',
  pageId: 'PAGE_1',
}

const peticion = { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'un caption' }

type Respuesta = { ok?: boolean; status?: number; cuerpo: unknown }

/**
 * Encola las respuestas que el fetch va a devolver, en orden. Así se arma la
 * secuencia real de Instagram: crear contenedor, consultar estado, publicar.
 */
function simular(...respuestas: Respuesta[]) {
  let indice = 0
  const espia = vi.fn((url: string, init?: RequestInit) => {
    const actual = respuestas[Math.min(indice, respuestas.length - 1)]
    indice++
    return Promise.resolve({
      ok: actual?.ok ?? true,
      status: actual?.status ?? 200,
      json: async () => actual?.cuerpo ?? {},
      url,
      init,
    })
  })
  vi.stubGlobal('fetch', espia)
  return espia
}

const listo = { cuerpo: { status_code: 'FINISHED' } }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** El adaptador espera entre consultas. Aquí el tiempo corre solo. */
async function sinEsperas<T>(trabajo: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  const promesa = trabajo()
  await vi.runAllTimersAsync()
  return promesa
}

describe('publicarEnInstagram', () => {
  it('sigue la secuencia de contenedor, espera y publicación', async () => {
    const espia = simular(
      { cuerpo: { id: 'CONTENEDOR_1' } },
      listo,
      { cuerpo: { id: 'IG_POST_1' } },
      { cuerpo: { permalink: 'https://instagram.com/p/XYZ' } },
    )

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida).toEqual({
      estado: 'publicado',
      externalPostId: 'IG_POST_1',
      permalink: 'https://instagram.com/p/XYZ',
    })

    const llamadas = espia.mock.calls.map((c) => String(c[0]))
    expect(llamadas[0]).toContain('/IG_ACCOUNT/media')
    expect(llamadas[2]).toContain('/IG_ACCOUNT/media_publish')
  })

  it('manda el video como REELS, con su caption', async () => {
    const espia = simular({ cuerpo: { id: 'C1' } }, listo, { cuerpo: { id: 'P1' } }, { cuerpo: {} })

    await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    const cuerpo = JSON.parse(String(espia.mock.calls[0]?.[1]?.body ?? '{}'))
    expect(cuerpo.media_type).toBe('REELS')
    expect(cuerpo.video_url).toBe('https://ejemplo.co/v.mp4')
    expect(cuerpo.caption).toBe('un caption')
  })

  it('espera a que el video termine de procesarse antes de publicar', async () => {
    // Instagram tarda: publicar antes de tiempo devuelve un error que parece de
    // permisos y no lo es.
    const espia = simular(
      { cuerpo: { id: 'C1' } },
      { cuerpo: { status_code: 'IN_PROGRESS' } },
      { cuerpo: { status_code: 'IN_PROGRESS' } },
      { cuerpo: { status_code: 'FINISHED' } },
      { cuerpo: { id: 'P1' } },
      { cuerpo: {} },
    )

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('publicado')
    // Tres consultas de estado antes de la publicación.
    expect(espia.mock.calls.filter((c) => String(c[0]).includes('status_code'))).toHaveLength(3)
  })

  it('se rinde sin reintentar cuando Meta rechaza el video al procesarlo', async () => {
    simular({ cuerpo: { id: 'C1' } }, { cuerpo: { status_code: 'ERROR' } })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    // Reintentar un video que Meta rechaza solo gasta llamadas.
    expect(salida.reintentable).toBe(false)
  })

  it('deja el permalink en nulo cuando Meta no lo devuelve', async () => {
    simular({ cuerpo: { id: 'C1' } }, listo, { cuerpo: { id: 'P1' } }, { ok: false, status: 400, cuerpo: {} })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida).toMatchObject({ estado: 'publicado', externalPostId: 'P1', permalink: null })
  })

  it('trata el límite de tasa como reintentable', async () => {
    simular({ ok: false, status: 400, cuerpo: { error: { message: 'rate limited', code: 4 } } })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
  })

  it('trata el permiso faltante como definitivo', async () => {
    simular({ ok: false, status: 403, cuerpo: { error: { message: 'permiso ausente', code: 200 } } })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    // Un permiso ausente se resuelve en el App Review, no esperando.
    expect(salida.reintentable).toBe(false)
  })

  it('trata la caída de la plataforma como reintentable', async () => {
    simular({ ok: false, status: 503, cuerpo: {} })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
  })

  it('avisa cuando Meta devuelve el contenedor sin id', async () => {
    simular({ cuerpo: {} })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.error).toContain('sin id')
  })
})

describe('responderPrivadoInstagram', () => {
  const comentario: ComentarioEntrante = {
    externalCommentId: 'COMENTARIO_1',
    externalPostId: 'IG_POST_1',
    autorUsername: 'ana',
    autorExternalId: 'U1',
    texto: 'automatiza',
    creadoEn: new Date('2026-09-10T14:00:00Z'),
  }

  it('responde al comentario, no al usuario', async () => {
    const espia = simular({ cuerpo: { message_id: 'M1', id: 'M1' } })

    const salida = await responderPrivadoInstagram(credencial, comentario, 'aquí tienes')

    expect(salida.estado).toBe('enviado')
    const cuerpo = JSON.parse(String(espia.mock.calls[0]?.[1]?.body ?? '{}'))
    // La respuesta privada se dirige por comment_id: es lo que abre la ventana.
    expect(cuerpo.recipient).toEqual({ comment_id: 'COMENTARIO_1' })
    expect(cuerpo.message.text).toBe('aquí tienes')
  })

  it('usa el id de la Página, que es el que Meta exige aquí', async () => {
    const espia = simular({ cuerpo: { id: 'M1' } })

    await responderPrivadoInstagram(credencial, comentario, 'hola')

    expect(String(espia.mock.calls[0]?.[0])).toContain('/PAGE_1/messages')
  })

  it('cae a la cuenta cuando la Página no está configurada', async () => {
    const espia = simular({ cuerpo: { id: 'M1' } })
    const sinPagina = Object.fromEntries(
      Object.entries(credencial).filter(([campo]) => campo !== 'pageId'),
    ) as CredencialCuenta

    await responderPrivadoInstagram(sinPagina, comentario, 'hola')

    expect(String(espia.mock.calls[0]?.[0])).toContain('/IG_ACCOUNT/messages')
  })

  it('trata el límite de mensajería como reintentable', async () => {
    simular({ ok: false, status: 400, cuerpo: { error: { message: 'demasiados mensajes', code: 613 } } })

    const salida = await responderPrivadoInstagram(credencial, comentario, 'hola')

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
  })

  it('trata la ventana cerrada como definitivo', async () => {
    simular({ ok: false, status: 400, cuerpo: { error: { message: 'fuera de la ventana', code: 10 } } })

    const salida = await responderPrivadoInstagram(credencial, comentario, 'hola')

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    // Los siete días no vuelven: reintentar sobra.
    expect(salida.reintentable).toBe(false)
  })
})

describe('leerComentariosInstagram', () => {
  it('convierte lo que devuelve Meta a lo que el motor espera', async () => {
    simular({
      cuerpo: {
        data: [
          {
            id: 'C1',
            text: 'automatiza',
            timestamp: '2026-09-10T14:00:00+0000',
            from: { id: 'U1', username: 'ana' },
          },
        ],
      },
    })

    const salida = await leerComentariosInstagram(credencial, 'IG_POST_1', new Date('2026-09-01'))

    expect(salida).toHaveLength(1)
    expect(salida[0]).toMatchObject({
      externalCommentId: 'C1',
      autorUsername: 'ana',
      autorExternalId: 'U1',
      texto: 'automatiza',
    })
  })

  it('descarta lo anterior a la fecha pedida', async () => {
    simular({
      cuerpo: {
        data: [
          { id: 'VIEJO', text: 'a', timestamp: '2026-08-01T10:00:00+0000', from: { id: 'U1' } },
          { id: 'NUEVO', text: 'b', timestamp: '2026-09-10T10:00:00+0000', from: { id: 'U2' } },
        ],
      },
    })

    const salida = await leerComentariosInstagram(credencial, 'IG_POST_1', new Date('2026-09-01'))

    expect(salida.map((c) => c.externalCommentId)).toEqual(['NUEVO'])
  })

  it('sobrevive al comentario sin texto ni autor', async () => {
    simular({ cuerpo: { data: [{ id: 'C1', timestamp: '2026-09-10T10:00:00+0000' }] } })

    const salida = await leerComentariosInstagram(credencial, 'IG_POST_1', new Date('2026-09-01'))

    expect(salida[0]).toMatchObject({ texto: '', autorUsername: null, autorExternalId: null })
  })

  it('lanza cuando Meta rechaza la lectura, para que el sondeo lo registre', async () => {
    simular({ ok: false, status: 401, cuerpo: { error: { message: 'token inválido' } } })

    await expect(leerComentariosInstagram(credencial, 'IG_POST_1', new Date())).rejects.toThrow(
      'token inválido',
    )
  })
})

describe('el contenedor sobrevive al reintento', () => {
  it('devuelve el contenedor cuando el video sigue procesándose', async () => {
    simular({ cuerpo: { id: 'C_LENTO' } }, { cuerpo: { status_code: 'IN_PROGRESS' } })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
    // Sin esto, el reintento subiría el video otra vez.
    expect(salida.contenedorId).toBe('C_LENTO')
  })

  it('retoma el contenedor en lugar de subir el video de nuevo', async () => {
    const espia = simular(listo, { cuerpo: { id: 'P1' } }, { cuerpo: { permalink: 'https://ig/p/1' } })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion, 'C_LENTO'))

    expect(salida).toMatchObject({ estado: 'publicado', externalPostId: 'P1' })
    // Ninguna llamada crea un contenedor nuevo.
    expect(espia.mock.calls.filter((c) => String(c[0]).endsWith('/media'))).toHaveLength(0)
    expect(String(espia.mock.calls[0]?.[0])).toContain('C_LENTO')
  })

  it('devuelve el contenedor también cuando la red se corta', async () => {
    let indice = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        indice++
        if (indice === 1) return { ok: true, status: 200, json: async () => ({ id: 'C_CORTADO' }), url }
        throw new Error('la conexión se cayó')
      }),
    )

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.contenedorId).toBe('C_CORTADO')
  })

  it('deja el contenedor fuera cuando Meta rechazó el video', async () => {
    simular({ cuerpo: { id: 'C_MALO' } }, { cuerpo: { status_code: 'ERROR' } })

    const salida = await sinEsperas(() => publicarEnInstagram(credencial, peticion))

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    // Ese contenedor ya no sirve: retomarlo fallaría igual.
    expect(salida.contenedorId).toBeUndefined()
  })
})
