import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearSupabaseFalso, type SupabaseFalso } from '@/pruebas/supabase-falso'

let base: SupabaseFalso
vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => base }))

const { avisar, avisarTokensPorVencer } = await import('./avisos')

const cuenta = (extra: Record<string, unknown> = {}) => ({
  id: 'cuenta-1',
  handle: '@saleads.ai',
  red: 'instagram',
  brand_id: 'marca-1',
  activa: true,
  token_expira_at: null,
  ...extra,
})

beforeEach(() => {
  base = crearSupabaseFalso({ notices: [], social_accounts: [] })
})

describe('avisar', () => {
  it('deja el aviso con su tipo y su detalle', async () => {
    await avisar({ tipo: 'publicacion_fallida', clave: 'k1', titulo: 'algo falló', detalle: 'el motivo' })

    expect(base.tablas['notices']?.[0]).toMatchObject({
      tipo: 'publicacion_fallida',
      titulo: 'algo falló',
      detalle: 'el motivo',
    })
  })

  it('acepta el aviso sin detalle', async () => {
    await avisar({ tipo: 'borrador_tiktok', clave: 'k2', titulo: 'un borrador espera' })
    expect(base.tablas['notices']?.[0]?.['detalle']).toBeNull()
  })
})

describe('avisarTokensPorVencer', () => {
  it('avisa del acceso que vence dentro de la semana', async () => {
    const dentroDeTres = new Date(Date.now() + 3 * 86_400_000).toISOString()
    base = crearSupabaseFalso({ notices: [], social_accounts: [cuenta({ token_expira_at: dentroDeTres })] })

    const revisadas = await avisarTokensPorVencer()

    expect(revisadas).toBe(1)
    expect(String(base.tablas['notices']?.[0]?.['titulo'])).toContain('@saleads.ai')
    expect(base.tablas['notices']?.[0]?.['tipo']).toBe('token_por_vencer')
  })

  it('deja quieto el acceso que aún tiene meses', async () => {
    const dentroDeUnMes = new Date(Date.now() + 30 * 86_400_000).toISOString()
    base = crearSupabaseFalso({ notices: [], social_accounts: [cuenta({ token_expira_at: dentroDeUnMes })] })

    expect(await avisarTokensPorVencer()).toBe(0)
    expect(base.tablas['notices']).toHaveLength(0)
  })

  it('deja quieto el acceso sin fecha de vencimiento', async () => {
    base = crearSupabaseFalso({ notices: [], social_accounts: [cuenta()] })
    expect(await avisarTokensPorVencer()).toBe(0)
  })

  it('salta la cuenta que ya está en pausa', async () => {
    const dentroDeTres = new Date(Date.now() + 3 * 86_400_000).toISOString()
    base = crearSupabaseFalso({
      notices: [],
      social_accounts: [cuenta({ token_expira_at: dentroDeTres, activa: false })],
    })

    expect(await avisarTokensPorVencer()).toBe(0)
  })

  it('la clave lleva la fecha, así que renovar el token calla el aviso', async () => {
    const dentroDeTres = new Date(Date.now() + 3 * 86_400_000).toISOString()
    base = crearSupabaseFalso({ notices: [], social_accounts: [cuenta({ token_expira_at: dentroDeTres })] })

    await avisarTokensPorVencer()
    const clave = String(base.tablas['notices']?.[0]?.['clave'])

    expect(clave).toContain('cuenta-1')
    expect(clave).toContain(dentroDeTres.slice(0, 10))
  })

  it('ajusta cuántos días de anticipación se piden', async () => {
    const dentroDeDiez = new Date(Date.now() + 10 * 86_400_000).toISOString()
    base = crearSupabaseFalso({ notices: [], social_accounts: [cuenta({ token_expira_at: dentroDeDiez })] })

    expect(await avisarTokensPorVencer(7)).toBe(0)
    expect(await avisarTokensPorVencer(14)).toBe(1)
  })
})
