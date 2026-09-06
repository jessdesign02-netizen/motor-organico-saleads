import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CredencialCuenta } from './tipos'
import { publicarEnTiktok, tiktok } from './tiktok'

const credencial: CredencialCuenta = {
  cuentaId: 'c1',
  red: 'tiktok',
  externalAccountId: 'TT_1',
  token: 'token',
}

const peticion = { videoUrl: 'https://ejemplo.co/v.mp4', caption: 'un caption' }

function simularRespuesta(cuerpo: unknown, ok = true) {
  // Los argumentos van tipados aunque el cuerpo los ignore: las pruebas leen
  // después la URL y el body con los que se llamó.
  const espia = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => cuerpo, url, init }),
  )
  vi.stubGlobal('fetch', espia)
  return espia
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TikTok · buzón y publicación directa', () => {
  it('sin auditoría, el video va al buzón del creador', async () => {
    const espia = simularRespuesta({ data: { publish_id: 'P1' } })

    const salida = await publicarEnTiktok(credencial, peticion, false)

    expect(salida.estado).toBe('borrador')
    expect(String(espia.mock.calls[0]?.[0] ?? '')).toContain('/post/publish/inbox/video/init/')
  })

  it('con la auditoría pasada, publica directo', async () => {
    const espia = simularRespuesta({ data: { publish_id: 'P2' } })

    const salida = await publicarEnTiktok(credencial, peticion, true)

    expect(salida.estado).toBe('publicado')
    expect(String(espia.mock.calls[0]?.[0] ?? '')).toContain('/post/publish/video/init/')
  })

  it('la casilla de la cuenta decide, sin tocar código', async () => {
    simularRespuesta({ data: { publish_id: 'P3' } })

    const conBandera = await tiktok.publicar({ ...credencial, publicacionDirecta: true }, peticion)
    expect(conBandera.estado).toBe('publicado')

    simularRespuesta({ data: { publish_id: 'P4' } })
    const sinBandera = await tiktok.publicar(credencial, peticion)
    expect(sinBandera.estado).toBe('borrador')
  })

  it('la publicación directa manda el caption y la visibilidad pública', async () => {
    const espia = simularRespuesta({ data: { publish_id: 'P5' } })

    await publicarEnTiktok(credencial, peticion, true)

    const cuerpo = JSON.parse(String(espia.mock.calls[0]?.[1]?.body ?? '{}'))
    expect(cuerpo.post_info.title).toBe('un caption')
    expect(cuerpo.post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE')
  })

  it('un fallo del servidor queda como reintentable', async () => {
    simularRespuesta({ error: { message: 'la plataforma está caída' } }, false)

    const salida = await publicarEnTiktok(credencial, peticion, false)

    expect(salida.estado).toBe('fallido')
    if (salida.estado !== 'fallido') return
    expect(salida.reintentable).toBe(true)
  })

  it('TikTok deja los comentarios fuera del API, así que el motor usa la bandeja', () => {
    expect(tiktok.leerComentarios).toBeNull()
    expect(tiktok.responder).toBeNull()
  })
})
