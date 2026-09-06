import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearSupabaseFalso, type SupabaseFalso } from '@/pruebas/supabase-falso'
import type { Marca } from '@/lib/database.types'

let base: SupabaseFalso
let filas: Array<{ filaId: string; valores: Record<string, string> }> = []

vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => base }))
vi.mock('@/lib/google/sheets', () => ({ leerHoja: async () => filas }))

const { sincronizarMarca } = await import('./sincronizar')

const marca: Marca = {
  id: 'marca-1',
  nombre: 'SaleADS',
  slug: 'saleads',
  sheet_id: 'HOJA_1',
  sheet_tab: 'Hoja 1',
  mapa_columnas: {},
  whatsapp_url: 'https://wa.me/57300',
  creado_at: '2026-09-01T00:00:00Z',
}

const fila = (filaId: string, valores: Record<string, string> = {}) => ({
  filaId,
  valores: {
    pieza: 'Meta Ads',
    hook: 'Nadie te lo dijo',
    formato_base: 'reel',
    link_de_drive: 'https://drive.google.com/file/d/1ABC/view',
    responsable: 'Ema',
    fecha_de_publicacion: '10/09/2026',
    recursos: '',
    ...valores,
  },
})

beforeEach(() => {
  filas = []
  base = crearSupabaseFalso({ pieces: [], resources: [], sync_logs: [] })
})

describe('sincronizarMarca · lo que trae', () => {
  it('crea la pieza desde la fila', async () => {
    filas = [fila('fila-2')]

    const resumen = await sincronizarMarca(marca)

    expect(resumen).toMatchObject({ leidas: 1, creadas: 1, actualizadas: 0, ignoradas: 0 })
    expect(base.tablas['pieces']?.[0]).toMatchObject({
      tema: 'Meta Ads',
      fecha_publicacion: '2026-09-10',
      semana: '2026-09-07',
      origen: 'sheet',
      estado: 'borrador',
    })
  })

  it('correrla dos veces deja el mismo resultado', async () => {
    filas = [fila('fila-2')]

    await sincronizarMarca(marca)
    const segunda = await sincronizarMarca(marca)

    // La huella dice que la fila no cambió, así que no hay nada que escribir.
    expect(segunda).toMatchObject({ creadas: 0, actualizadas: 0 })
    expect(base.tablas['pieces']).toHaveLength(1)
  })

  it('actualiza la pieza cuando la fila cambia', async () => {
    filas = [fila('fila-2')]
    await sincronizarMarca(marca)

    filas = [fila('fila-2', { hook: 'Otro hook' })]
    const segunda = await sincronizarMarca(marca)

    expect(segunda.actualizadas).toBe(1)
    expect(base.tablas['pieces']?.[0]?.['hook']).toBe('Otro hook')
  })
})

describe('sincronizarMarca · lo que descarta, con su motivo', () => {
  it('descarta la fila sin tema', async () => {
    filas = [fila('fila-2', { pieza: '' })]

    const resumen = await sincronizarMarca(marca)

    expect(resumen.ignoradas).toBe(1)
    expect(resumen.detalle[0]).toMatchObject({ fila: 'fila-2', motivo: 'la fila llega sin tema' })
  })

  it('descarta la fila con la fecha ilegible', async () => {
    filas = [fila('fila-2', { fecha_de_publicacion: 'el jueves' })]

    const resumen = await sincronizarMarca(marca)

    expect(resumen.detalle[0]?.motivo).toContain('no se entiende')
  })

  it('sigue con las buenas aunque una venga mal', async () => {
    filas = [fila('fila-2', { pieza: '' }), fila('fila-3')]

    const resumen = await sincronizarMarca(marca)

    expect(resumen).toMatchObject({ creadas: 1, ignoradas: 1 })
  })

  it('deja constancia de cada corrida en el log', async () => {
    filas = [fila('fila-2')]

    await sincronizarMarca(marca)

    expect(base.tablas['sync_logs']?.[0]).toMatchObject({ filas_leidas: 1, filas_creadas: 1 })
  })

  it('se detiene con su motivo cuando la marca no tiene hoja', async () => {
    const resumen = await sincronizarMarca({ ...marca, sheet_id: null })

    expect(resumen.detalle[0]?.motivo).toContain('hoja de cálculo configurada')
    expect(resumen.leidas).toBe(0)
  })
})

describe('sincronizarMarca · la pieza ya aprobada', () => {
  it('aparta el cambio en lugar de pisar lo revisado', async () => {
    filas = [fila('fila-2')]
    await sincronizarMarca(marca)

    const pieza = base.tablas['pieces']?.[0]
    if (pieza) pieza['estado'] = 'aprobado'

    filas = [fila('fila-2', { hook: 'Hook cambiado después de aprobar' })]
    const segunda = await sincronizarMarca(marca)

    expect(segunda.enEspera).toBe(1)
    // El hook aprobado sigue en pie.
    expect(base.tablas['pieces']?.[0]?.['hook']).toBe('Nadie te lo dijo')
    // Y el cambio espera confirmación, con su contenido.
    const pendiente = base.tablas['pieces']?.[0]?.['sheet_pendiente'] as Record<string, unknown>
    expect(pendiente['hook']).toBe('Hook cambiado después de aprobar')
    expect(segunda.detalle[0]?.motivo).toContain('espera confirmación')
  })

  it('hace lo mismo con una pieza ya publicada', async () => {
    filas = [fila('fila-2')]
    await sincronizarMarca(marca)
    const pieza = base.tablas['pieces']?.[0]
    if (pieza) pieza['estado'] = 'publicado'

    filas = [fila('fila-2', { pieza: 'Otro tema' })]
    const segunda = await sincronizarMarca(marca)

    expect(segunda.enEspera).toBe(1)
    expect(base.tablas['pieces']?.[0]?.['tema']).toBe('Meta Ads')
  })

  it('sí actualiza la pieza que sigue en borrador', async () => {
    filas = [fila('fila-2')]
    await sincronizarMarca(marca)

    filas = [fila('fila-2', { pieza: 'Tema corregido' })]
    const segunda = await sincronizarMarca(marca)

    expect(segunda.actualizadas).toBe(1)
    expect(base.tablas['pieces']?.[0]?.['tema']).toBe('Tema corregido')
  })
})

describe('sincronizarMarca · el recurso de la hoja', () => {
  it('vincula el recurso que ya está en la biblioteca', async () => {
    base = crearSupabaseFalso({
      pieces: [],
      resources: [{ id: 'recurso-1', brand_id: 'marca-1', titulo: 'Guía de anuncios', activo: true }],
      sync_logs: [],
    })
    filas = [fila('fila-2', { recursos: 'Guía de anuncios' })]

    await sincronizarMarca(marca)

    expect(base.tablas['pieces']?.[0]?.['resource_id']).toBe('recurso-1')
  })

  it('lo encuentra aunque esté escrito con otras mayúsculas o sin tilde', async () => {
    base = crearSupabaseFalso({
      pieces: [],
      resources: [{ id: 'recurso-1', brand_id: 'marca-1', titulo: 'Guía de anuncios', activo: true }],
      sync_logs: [],
    })
    filas = [fila('fila-2', { recursos: 'GUIA DE ANUNCIOS' })]

    await sincronizarMarca(marca)

    expect(base.tablas['pieces']?.[0]?.['resource_id']).toBe('recurso-1')
  })

  it('deja constancia del recurso que todavía no existe', async () => {
    filas = [fila('fila-2', { recursos: 'Guía que nadie cargó' })]

    const resumen = await sincronizarMarca(marca)

    expect(resumen.creadas).toBe(1)
    expect(resumen.detalle[0]?.motivo).toContain('todavía no está en la biblioteca')
  })
})
