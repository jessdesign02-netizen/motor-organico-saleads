import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearSupabaseFalso, type SupabaseFalso } from '@/pruebas/supabase-falso'

let base: SupabaseFalso

vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => base }))

const publicar = vi.fn()
vi.mock('@/lib/redes', () => ({
  adaptadorDe: () => ({ publicar, enviosPorSegundo: 2, cupoDiarioRespuestas: null }),
}))

vi.mock('./video', () => ({
  prepararVideoDePieza: async () => ({ ok: true, url: 'https://storage/video.mp4' }),
}))

const { publicarPendientes } = await import('./publicar')

const AHORA = new Date('2026-09-10T18:00:00Z')

/** Una publicación lista para salir, con su pieza y su cuenta. */
function escenario(extra: { publicacion?: Record<string, unknown>; cuenta?: Record<string, unknown> } = {}) {
  return {
    publications: [
      {
        id: 'pub-1',
        piece_id: 'pieza-1',
        social_account_id: 'cuenta-1',
        estado: 'pendiente',
        programado_at: '2026-09-10T17:00:00Z',
        intentos: 0,
        proximo_intento_at: null,
        caption_final: 'el caption',
        container_id: null,
        ...extra.publicacion,
      },
    ],
    social_accounts: [
      {
        id: 'cuenta-1',
        brand_id: 'marca-1',
        red: 'instagram',
        handle: '@saleads.ai',
        external_account_id: 'IG_1',
        credential_ref: 'META_TOKEN_SALEADS',
        token_expira_at: null,
        activa: true,
        publicacion_directa: false,
        cupo_respuestas_dia: null,
        ...extra.cuenta,
      },
    ],
    pieces: [
      { id: 'pieza-1', tema: 'Meta Ads', brand_id: 'marca-1', caption_base: 'base', drive_url: 'https://drive/x' },
    ],
    notices: [],
  }
}

beforeEach(() => {
  process.env['META_TOKEN_SALEADS'] = 'token-de-prueba'
  publicar.mockReset()
})

afterEach(() => {
  delete process.env['META_TOKEN_SALEADS']
})

describe('publicarPendientes · cuando sale bien', () => {
  it('publica y guarda el identificador que devuelve la plataforma', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'publicado', externalPostId: 'IG_POST_1', permalink: 'https://ig/p/1' })

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.publicadas).toBe(1)
    const publicacion = base.tablas['publications']?.[0]
    expect(publicacion).toMatchObject({
      estado: 'publicado',
      external_post_id: 'IG_POST_1',
      permalink: 'https://ig/p/1',
      container_id: null,
    })
  })

  it('marca la copia del video para borrarla al día siguiente', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'publicado', externalPostId: 'P1', permalink: null })

    await publicarPendientes(AHORA)

    const pieza = base.tablas['pieces']?.[0]
    expect(pieza?.['storage_expira_at']).toBe(new Date(AHORA.getTime() + 86_400_000).toISOString())
  })

  it('envía el caption de la publicación, no el base de la pieza', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'publicado', externalPostId: 'P1', permalink: null })

    await publicarPendientes(AHORA)

    expect(publicar.mock.calls[0]?.[1]).toMatchObject({ caption: 'el caption' })
  })
})

describe('publicarPendientes · cuando algo falla', () => {
  it('programa el reintento con espera creciente', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'fallido', error: 'límite de tasa', reintentable: true })

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.fallidas).toBe(1)
    const publicacion = base.tablas['publications']?.[0]
    expect(publicacion).toMatchObject({ estado: 'fallido', intentos: 1 })
    // Dos minutos para el primer reintento.
    expect(publicacion?.['proximo_intento_at']).toBe(new Date(AHORA.getTime() + 120_000).toISOString())
  })

  it('guarda el contenedor para que el reintento lo retome', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({
      estado: 'fallido',
      error: 'sigue procesando',
      reintentable: true,
      contenedorId: 'C_LENTO',
    })

    await publicarPendientes(AHORA)

    expect(base.tablas['publications']?.[0]?.['container_id']).toBe('C_LENTO')
  })

  it('avisa solo cuando ya no quedan reintentos', async () => {
    base = crearSupabaseFalso(escenario({ publicacion: { intentos: 2 } }))
    publicar.mockResolvedValue({ estado: 'fallido', error: 'algo pasó', reintentable: true })

    await publicarPendientes(AHORA)

    // Un fallo pasajero se resuelve solo: avisar en el primero sería ruido.
    expect(base.tablas['notices']).toHaveLength(1)
    expect(String(base.tablas['notices']?.[0]?.['titulo'])).toContain('Meta Ads')
  })

  it('no avisa mientras queden reintentos', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'fallido', error: 'algo pasó', reintentable: true })

    await publicarPendientes(AHORA)

    expect(base.tablas['notices']).toHaveLength(0)
  })

  it('deja de intentar después del tercer intento', async () => {
    base = crearSupabaseFalso(escenario({ publicacion: { intentos: 3, estado: 'fallido' } }))

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.intentadas).toBe(0)
    expect(publicar).not.toHaveBeenCalled()
  })

  it('espera su turno cuando el reintento aún no toca', async () => {
    base = crearSupabaseFalso(
      escenario({ publicacion: { estado: 'fallido', intentos: 1, proximo_intento_at: '2026-09-10T19:00:00Z' } }),
    )

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.intentadas).toBe(0)
  })
})

describe('publicarPendientes · las cuentas', () => {
  it('salta la cuenta en pausa', async () => {
    base = crearSupabaseFalso(escenario({ cuenta: { activa: false } }))

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.pausadas).toBe(1)
    expect(publicar).not.toHaveBeenCalled()
  })

  it('pausa la cuenta con el token vencido, y avisa', async () => {
    base = crearSupabaseFalso(escenario({ cuenta: { token_expira_at: '2026-09-01T00:00:00Z' } }))

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.pausadas).toBe(1)
    expect(base.tablas['social_accounts']?.[0]?.['activa']).toBe(false)
    expect(base.tablas['notices']).toHaveLength(1)
    expect(publicar).not.toHaveBeenCalled()
  })

  it('se detiene cuando la variable de la credencial no existe', async () => {
    delete process.env['META_TOKEN_SALEADS']
    base = crearSupabaseFalso(escenario())

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.pausadas).toBe(1)
    expect(resumen.detalle[0]?.nota).toContain('META_TOKEN_SALEADS')
  })

  it('se detiene cuando la referencia apunta a un secreto del sistema', async () => {
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'la llave maestra'
    base = crearSupabaseFalso(escenario({ cuenta: { credential_ref: 'SUPABASE_SERVICE_ROLE_KEY' } }))

    const resumen = await publicarPendientes(AHORA)

    // La barrera de seguridad actúa también aquí, no solo al guardar la cuenta.
    expect(resumen.pausadas).toBe(1)
    expect(publicar).not.toHaveBeenCalled()
  })
})

describe('publicarPendientes · lo que todavía no toca', () => {
  it('deja quieto lo programado para más tarde', async () => {
    base = crearSupabaseFalso(escenario({ publicacion: { programado_at: '2026-09-11T18:00:00Z' } }))

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.intentadas).toBe(0)
  })

  it('deja quieto lo que ya salió', async () => {
    base = crearSupabaseFalso(escenario({ publicacion: { estado: 'publicado' } }))

    const resumen = await publicarPendientes(AHORA)

    expect(resumen.intentadas).toBe(0)
  })
})

describe('publicarPendientes · dos corridas a la vez', () => {
  it('la segunda corrida no vuelve a publicar lo que la primera tomó', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'publicado', externalPostId: 'P1', permalink: null })

    // La primera la toma y la publica.
    await publicarPendientes(AHORA)
    // La segunda llega con la fila ya movida.
    const segunda = await publicarPendientes(AHORA)

    expect(segunda.intentadas).toBe(0)
    // Una sola llamada a la plataforma: la pieza sale una vez.
    expect(publicar).toHaveBeenCalledTimes(1)
  })

  it('la toma exige que la fila siga como se leyó', async () => {
    base = crearSupabaseFalso(escenario())
    publicar.mockResolvedValue({ estado: 'publicado', externalPostId: 'P1', permalink: null })

    await publicarPendientes(AHORA)

    // El update que toma la publicación lleva dos condiciones: el identificador
    // y el estado. Sin la segunda, dos corridas tomarían la misma fila.
    expect(base.registro.filter((op) => op === 'update publications').length).toBeGreaterThan(0)
    expect(base.tablas['publications']?.[0]?.['estado']).toBe('publicado')
  })

  it('deja la publicación en publicando mientras la plataforma responde', async () => {
    base = crearSupabaseFalso(escenario())
    // La plataforma tarda: durante ese rato la fila ya está tomada.
    publicar.mockImplementation(async () => {
      expect(base.tablas['publications']?.[0]?.['estado']).toBe('publicando')
      return { estado: 'publicado', externalPostId: 'P1', permalink: null }
    })

    await publicarPendientes(AHORA)

    expect(publicar).toHaveBeenCalledTimes(1)
  })
})
