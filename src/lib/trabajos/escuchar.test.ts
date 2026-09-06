import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearSupabaseFalso, type SupabaseFalso } from '@/pruebas/supabase-falso'

let base: SupabaseFalso
vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => base }))

const leerComentarios = vi.fn()
const responder = vi.fn()
vi.mock('@/lib/redes', () => ({
  adaptadorDe: () => ({
    red: 'instagram',
    publicar: vi.fn(),
    leerComentarios,
    responder,
    enviosPorSegundo: 2,
    cupoDiarioRespuestas: null,
  }),
}))

const { reintentarMensajes, sondearComentarios } = await import('./escuchar')

const AHORA = new Date('2026-09-10T18:00:00Z')

/** Una publicación en vivo, con su palabra clave activa y todo lo necesario. */
function enVivo(extra: { clave?: Record<string, unknown>; comentarios?: Record<string, unknown>[] } = {}) {
  return {
    publications: [
      {
        id: 'pub-1',
        piece_id: 'pieza-1',
        social_account_id: 'cuenta-1',
        estado: 'publicado',
        external_post_id: 'IG_POST_1',
        publicado_at: '2026-09-08T18:00:00Z',
      },
    ],
    social_accounts: [
      {
        id: 'cuenta-1',
        red: 'instagram',
        external_account_id: 'IG_1',
        credential_ref: 'META_TOKEN_SALEADS',
        brand_id: 'marca-1',
      },
    ],
    keywords: [
      {
        id: 'clave-1',
        piece_id: 'pieza-1',
        palabra: 'AUTOMATIZA',
        variantes: ['AUTOMATIZAS'],
        activa_desde: '2026-09-08T18:00:00Z',
        activa_hasta: null,
        ...extra.clave,
      },
    ],
    dm_templates: [
      { id: 'dm-1', piece_id: 'pieza-1', mensaje: 'aquí tienes {enlace}', destino_url: 'https://wa.me/57300' },
    ],
    tracked_links: [{ id: 'link-1', piece_id: 'pieza-1', slug: 'automatiza-abc', destino_url: 'https://wa.me/57300' }],
    comments: extra.comentarios ?? [],
    dm_log: [],
  }
}

const entrante = (id: string, autor: string) => ({
  externalCommentId: id,
  externalPostId: 'IG_POST_1',
  autorUsername: autor,
  autorExternalId: autor,
  texto: 'automatiza',
  creadoEn: new Date('2026-09-10T17:00:00Z'),
})

beforeEach(() => {
  process.env['META_TOKEN_SALEADS'] = 'token'
  process.env['APP_URL'] = 'https://motor.saleads.co'
  leerComentarios.mockReset()
  responder.mockReset()
  responder.mockResolvedValue({ estado: 'enviado', referencia: 'M1' })
})

describe('sondearComentarios', () => {
  it('responde al comentario que trae la palabra', async () => {
    base = crearSupabaseFalso(enVivo())
    leerComentarios.mockResolvedValue([entrante('C1', 'ana')])

    const salida = await sondearComentarios(AHORA)

    expect(salida[0]?.respondidos).toBe(1)
    expect(base.tablas['comments']?.[0]).toMatchObject({ estado: 'respondido', external_comment_id: 'C1' })
    expect(base.tablas['dm_log']?.[0]).toMatchObject({ estado: 'enviado' })
  })

  it('manda el enlace propio, no el de WhatsApp directo', async () => {
    base = crearSupabaseFalso(enVivo())
    leerComentarios.mockResolvedValue([entrante('C1', 'ana')])

    await sondearComentarios(AHORA)

    // El dominio que viaja en el mensaje es de SaleADS, y el clic queda contado.
    expect(String(responder.mock.calls[0]?.[2])).toContain('https://motor.saleads.co/r/automatiza-abc')
  })

  it('salta la publicación cuya palabra clave ya venció', async () => {
    base = crearSupabaseFalso(enVivo({ clave: { activa_hasta: '2026-09-09T00:00:00Z' } }))

    const salida = await sondearComentarios(AHORA)

    expect(salida).toEqual([])
    // Ese descarte sale de una sola consulta, sin armar el contexto completo.
    expect(leerComentarios).not.toHaveBeenCalled()
  })

  it('pide solo los comentarios de los últimos siete días', async () => {
    base = crearSupabaseFalso(enVivo())
    leerComentarios.mockResolvedValue([])

    await sondearComentarios(AHORA)

    const desde = leerComentarios.mock.calls[0]?.[2] as Date
    expect(desde.toISOString()).toBe(new Date(AHORA.getTime() - 7 * 86_400_000).toISOString())
  })

  it('sigue con las demás publicaciones cuando una falla', async () => {
    const tablas = enVivo()
    tablas.publications.push({ ...tablas.publications[0]!, id: 'pub-2', external_post_id: 'IG_POST_2' })
    base = crearSupabaseFalso(tablas)

    leerComentarios.mockRejectedValueOnce(new Error('token inválido'))
    leerComentarios.mockResolvedValueOnce([entrante('C1', 'ana')])

    const salida = await sondearComentarios(AHORA)

    expect(salida).toHaveLength(1)
    expect(salida[0]?.respondidos).toBe(1)
  })

  it('se detiene cuando la referencia de la credencial no vale', async () => {
    const tablas = enVivo()
    tablas.social_accounts[0]!.credential_ref = 'SUPABASE_SERVICE_ROLE_KEY'
    base = crearSupabaseFalso(tablas)

    const salida = await sondearComentarios(AHORA)

    expect(salida).toEqual([])
    expect(leerComentarios).not.toHaveBeenCalled()
  })

  it('atiende una sola vez lo que ya estaba registrado', async () => {
    base = crearSupabaseFalso(
      enVivo({
        comentarios: [
          {
            id: 'com-1',
            publication_id: 'pub-1',
            external_comment_id: 'C1',
            autor_external_id: 'ana',
            estado: 'respondido',
            texto: 'automatiza',
          },
        ],
      }),
    )
    leerComentarios.mockResolvedValue([entrante('C1', 'ana')])

    const salida = await sondearComentarios(AHORA)

    expect(salida[0]?.duplicados).toBe(1)
    expect(responder).not.toHaveBeenCalled()
  })
})

describe('reintentarMensajes', () => {
  const fallido = (extra: Record<string, unknown> = {}) => ({
    id: 'com-1',
    publication_id: 'pub-1',
    external_comment_id: 'C1',
    autor_username: 'ana',
    autor_external_id: 'ana',
    texto: 'automatiza',
    estado: 'fallido',
    intentos_dm: 1,
    proximo_intento_at: '2026-09-10T17:00:00Z',
    detectado_at: '2026-09-10T16:00:00Z',
    ...extra,
  })

  it('vuelve a enviar el mensaje que la plataforma rechazó', async () => {
    base = crearSupabaseFalso(enVivo({ comentarios: [fallido()] }))

    const salida = await reintentarMensajes(AHORA)

    expect(salida[0]?.respondidos).toBe(1)
    expect(base.tablas['comments']?.[0]?.['estado']).toBe('respondido')
  })

  it('respeta el turno del que todavía no toca', async () => {
    base = crearSupabaseFalso(
      enVivo({ comentarios: [fallido({ proximo_intento_at: '2026-09-10T19:00:00Z' })] }),
    )

    expect(await reintentarMensajes(AHORA)).toEqual([])
    expect(responder).not.toHaveBeenCalled()
  })

  it('vuelve a pasar por la ventana de siete días', async () => {
    // Puede haberse cerrado mientras el comentario esperaba su turno.
    base = crearSupabaseFalso(
      enVivo({ comentarios: [fallido({ detectado_at: '2026-09-01T10:00:00Z' })] }),
    )

    const salida = await reintentarMensajes(AHORA)

    expect(salida[0]?.respondidos).toBe(0)
    expect(salida[0]?.detalle[0]?.resultado).toBe('ventana_vencida')
  })

  it('agrupa por publicación para armar el contexto una sola vez', async () => {
    base = crearSupabaseFalso(
      enVivo({
        comentarios: [
          fallido(),
          fallido({ id: 'com-2', external_comment_id: 'C2', autor_external_id: 'luis' }),
        ],
      }),
    )

    const salida = await reintentarMensajes(AHORA)

    expect(salida).toHaveLength(1)
    expect(salida[0]?.respondidos).toBe(2)
  })

  it('deja quieto lo que ya está en la bandeja', async () => {
    base = crearSupabaseFalso(
      enVivo({ comentarios: [fallido({ estado: 'manual_pendiente', intentos_dm: 3 })] }),
    )

    expect(await reintentarMensajes(AHORA)).toEqual([])
  })
})
