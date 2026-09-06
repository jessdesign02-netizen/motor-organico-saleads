import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComentarioEntrante, CredencialCuenta } from './tipos'
import {
  CUPO_DIARIO_RESPUESTAS,
  leerComentariosYoutube,
  publicarEnYoutube,
  responderEnYoutube,
  youtube,
} from './youtube'

const credencial: CredencialCuenta = {
  cuentaId: 'c1',
  red: 'youtube',
  externalAccountId: 'CANAL_1',
  token: 'token-de-prueba',
}

type Respuesta = { ok?: boolean; status?: number; cuerpo?: unknown; bytes?: Uint8Array }

function simular(...respuestas: Respuesta[]) {
  let indice = 0
  const espia = vi.fn((url: string, init?: RequestInit) => {
    const actual = respuestas[Math.min(indice, respuestas.length - 1)]
    indice++
    return Promise.resolve({
      ok: actual?.ok ?? true,
      status: actual?.status ?? 200,
      json: async () => actual?.cuerpo ?? {},
      arrayBuffer: async () => (actual?.bytes ?? new Uint8Array([1, 2, 3])).buffer,
      url,
      init,
    })
  })
  vi.stubGlobal('fetch', espia)
  return espia
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publicarEnYoutube', () => {
  it('sube el video y devuelve el enlace del Short', async () => {
    simular({ bytes: new Uint8Array([9, 9, 9]) }, { cuerpo: { id: 'VIDEO_1' } })

    const salida = await publicarEnYoutube(credencial, {
      videoUrl: 'https://ejemplo.co/v.mp4',
      caption: 'un caption',
    })

    expect(salida).toEqual({
      estado: 'publicado',
      externalPostId: 'VIDEO_1',
      permalink: 'https://www.youtube.com/shorts/VIDEO_1',
    })
  })

  it('recorta el título a los cien caracteres que admite YouTube', async () => {
    const espia = simular({ bytes: new Uint8Array([1]) }, { cuerpo: { id: 'V1' } })

    await publicarEnYoutube(credencial, {
      videoUrl: 'https://ejemplo.co/v.mp4',
      caption: 'x'.repeat(300),
      titulo: 'y'.repeat(300),
    })

    const cuerpo = new TextDecoder().decode(espia.mock.calls[1]?.[1]?.body as Uint8Array)
    const metadatos = JSON.parse(cuerpo.slice(cuerpo.indexOf('{'), cuerpo.lastIndexOf('}') + 1))
    expect(metadatos.snippet.title).toHaveLength(100)
    // La descripción conserva el caption entero.
    expect(metadatos.snippet.description).toHaveLength(300)
  })

  it('usa el caption como título cuando no hay uno propio', async () => {
    const espia = simular({ bytes: new Uint8Array([1]) }, { cuerpo: { id: 'V1' } })

    await publicarEnYoutube(credencial, { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'el caption' })

    const cuerpo = new TextDecoder().decode(espia.mock.calls[1]?.[1]?.body as Uint8Array)
    expect(cuerpo).toContain('"title":"el caption"')
  })

  it('publica en abierto y declarado como no dirigido a niños', async () => {
    const espia = simular({ bytes: new Uint8Array([1]) }, { cuerpo: { id: 'V1' } })

    await publicarEnYoutube(credencial, { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'c' })

    const cuerpo = new TextDecoder().decode(espia.mock.calls[1]?.[1]?.body as Uint8Array)
    expect(cuerpo).toContain('"privacyStatus":"public"')
    expect(cuerpo).toContain('"selfDeclaredMadeForKids":false')
  })

  it('reintenta cuando el video fuente no responde', async () => {
    simular({ ok: false, status: 404 })

    const salida = await publicarEnYoutube(credencial, { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'c' })

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.error).toContain('404')
    expect(salida.reintentable).toBe(true)
  })

  it('deja de reintentar cuando la cuota diaria se agotó', async () => {
    simular(
      { bytes: new Uint8Array([1]) },
      { ok: false, status: 403, cuerpo: { error: { message: 'quotaExceeded' } } },
    )

    const salida = await publicarEnYoutube(credencial, { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'c' })

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    // La cuota vuelve mañana: insistir hoy solo gasta intentos.
    expect(salida.reintentable).toBe(false)
  })

  it('reintenta cuando el límite es de ritmo y no de cuota', async () => {
    simular(
      { bytes: new Uint8Array([1]) },
      { ok: false, status: 403, cuerpo: { error: { message: 'rateLimitExceeded' } } },
    )

    const salida = await publicarEnYoutube(credencial, { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'c' })

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
  })
})

describe('responderEnYoutube', () => {
  const comentario: ComentarioEntrante = {
    externalCommentId: 'HILO_1',
    externalPostId: 'VIDEO_1',
    autorUsername: 'ana',
    autorExternalId: 'UC_ANA',
    texto: 'automatiza',
    creadoEn: new Date('2026-09-10T14:00:00Z'),
  }

  it('responde dentro del hilo del comentario', async () => {
    const espia = simular({ cuerpo: { id: 'RESPUESTA_1' } })

    const salida = await responderEnYoutube(credencial, comentario, 'aquí tienes el enlace')

    expect(salida.estado).toBe('enviado')
    const cuerpo = JSON.parse(String(espia.mock.calls[0]?.[1]?.body ?? '{}'))
    // parentId es lo que convierte esto en respuesta y no en comentario suelto.
    expect(cuerpo.snippet.parentId).toBe('HILO_1')
    expect(cuerpo.snippet.textOriginal).toBe('aquí tienes el enlace')
  })

  it('deja de reintentar con la cuota agotada', async () => {
    simular({ ok: false, status: 403, cuerpo: { error: { message: 'quotaExceeded' } } })

    const salida = await responderEnYoutube(credencial, comentario, 'hola')

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(false)
  })

  it('reintenta cuando la plataforma se cae', async () => {
    simular({ ok: false, status: 500, cuerpo: {} })

    const salida = await responderEnYoutube(credencial, comentario, 'hola')

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
  })
})

describe('leerComentariosYoutube', () => {
  const hilo = (id: string, fecha: string) => ({
    snippet: {
      topLevelComment: {
        id,
        snippet: {
          textOriginal: 'automatiza',
          authorDisplayName: 'Ana',
          authorChannelId: { value: 'UC_ANA' },
          publishedAt: fecha,
        },
      },
    },
  })

  it('convierte los hilos a lo que el motor espera', async () => {
    simular({ cuerpo: { items: [hilo('H1', '2026-09-10T10:00:00Z')] } })

    const salida = await leerComentariosYoutube(credencial, 'VIDEO_1', new Date('2026-09-01'))

    expect(salida[0]).toMatchObject({
      externalCommentId: 'H1',
      autorUsername: 'Ana',
      autorExternalId: 'UC_ANA',
      texto: 'automatiza',
    })
  })

  it('descarta lo anterior a la fecha pedida', async () => {
    simular({
      cuerpo: { items: [hilo('VIEJO', '2026-08-01T10:00:00Z'), hilo('NUEVO', '2026-09-10T10:00:00Z')] },
    })

    const salida = await leerComentariosYoutube(credencial, 'VIDEO_1', new Date('2026-09-01'))

    expect(salida.map((c) => c.externalCommentId)).toEqual(['NUEVO'])
  })

  it('descarta el hilo que llega sin identificador', async () => {
    simular({ cuerpo: { items: [{ snippet: {} }] } })

    const salida = await leerComentariosYoutube(credencial, 'VIDEO_1', new Date('2026-09-01'))

    expect(salida).toEqual([])
  })

  it('lanza cuando YouTube rechaza la lectura', async () => {
    simular({ ok: false, status: 401, cuerpo: { error: { message: 'credenciales inválidas' } } })

    await expect(leerComentariosYoutube(credencial, 'VIDEO_1', new Date())).rejects.toThrow(
      'credenciales inválidas',
    )
  })
})

describe('el cupo de YouTube', () => {
  it('deja margen bajo el techo que impone la cuota', () => {
    // comments.insert cuesta 50 sobre 10.000 diarias: caben 200 respuestas.
    // El cupo se queda por debajo, porque leer los hilos consume aparte.
    expect(CUPO_DIARIO_RESPUESTAS).toBeLessThan(200)
    expect(youtube.cupoDiarioRespuestas).toBe(CUPO_DIARIO_RESPUESTAS)
  })

  it('YouTube sí responde por API, a diferencia de TikTok', () => {
    expect(youtube.responder).not.toBeNull()
    expect(youtube.leerComentarios).not.toBeNull()
  })
})
