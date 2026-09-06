import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearSupabaseFalso, type SupabaseFalso } from '@/pruebas/supabase-falso'

let base: SupabaseFalso

vi.mock('@/lib/supabase/admin', () => ({ clienteAdmin: () => base }))

const descargar = vi.fn()
vi.mock('@/lib/google/drive', () => ({ descargarDeDrive: (enlace: string) => descargar(enlace) }))

const { limpiarCopiasVencidas, prepararVideoDePieza, urlPublica } = await import('./video')

const AHORA = new Date('2026-09-10T18:00:00Z')

const pieza = (extra: Record<string, unknown> = {}) => ({
  pieces: [
    {
      id: 'pieza-1',
      brand_id: 'marca-1',
      tema: 'Meta Ads',
      drive_url: 'https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrSTUvwx/view',
      storage_path: null,
      storage_expira_at: null,
      video_error: null,
      ...extra,
    },
  ],
  notices: [],
})

beforeEach(() => {
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://ejemplo.supabase.co'
  descargar.mockReset()
  descargar.mockResolvedValue({
    contenido: new Uint8Array([1, 2, 3]),
    tipo: 'video/mp4',
    nombre: 'v.mp4',
    bytes: 3,
  })
})

afterEach(() => {
  delete process.env['NEXT_PUBLIC_SUPABASE_URL']
})

describe('urlPublica', () => {
  it('arma la dirección que la plataforma va a descargar', () => {
    expect(urlPublica('https://x.supabase.co', 'marca/pieza.mp4')).toBe(
      'https://x.supabase.co/storage/v1/object/public/videos/marca/pieza.mp4',
    )
  })

  it('tolera la barra final de la dirección base', () => {
    expect(urlPublica('https://x.supabase.co/', 'a.mp4')).toContain('.co/storage')
  })
})

describe('prepararVideoDePieza', () => {
  it('baja el video de Drive y lo deja en Storage', async () => {
    base = crearSupabaseFalso(pieza())

    const salida = await prepararVideoDePieza('pieza-1')

    expect(salida).toEqual({
      ok: true,
      url: 'https://ejemplo.supabase.co/storage/v1/object/public/videos/marca-1/pieza-1.mp4',
    })
    expect(base.archivos.has('videos/marca-1/pieza-1.mp4')).toBe(true)
    expect(base.tablas['pieces']?.[0]).toMatchObject({
      storage_path: 'marca-1/pieza-1.mp4',
      video_bytes: 3,
      video_error: null,
    })
  })

  it('reutiliza la copia que ya existe, sin volver a bajarla', async () => {
    base = crearSupabaseFalso(pieza({ storage_path: 'marca-1/pieza-1.mp4' }))

    const salida = await prepararVideoDePieza('pieza-1')

    expect(salida.ok).toBe(true)
    // Bajar el mismo video dos veces gasta tiempo y ancho de banda.
    expect(descargar).not.toHaveBeenCalled()
  })

  it('rechaza el video que pasa el techo de la plataforma', async () => {
    base = crearSupabaseFalso(pieza())
    descargar.mockResolvedValue({
      contenido: new Uint8Array(),
      tipo: 'video/mp4',
      nombre: 'v.mp4',
      bytes: 2 * 1_024 * 1_024 * 1_024,
    })

    const salida = await prepararVideoDePieza('pieza-1')

    expect(salida.ok).toBe(false)
    if (salida.ok) return
    expect(salida.error).toContain('1 GB')
    // El motivo queda escrito para que la pantalla lo diga.
    expect(base.tablas['pieces']?.[0]?.['video_error']).toContain('1 GB')
  })

  it('deja el error de Drive escrito, y avisa', async () => {
    base = crearSupabaseFalso(pieza())
    descargar.mockRejectedValue(new Error('el archivo pide permisos'))

    const salida = await prepararVideoDePieza('pieza-1')

    expect(salida.ok).toBe(false)
    expect(base.tablas['pieces']?.[0]?.['video_error']).toBe('el archivo pide permisos')
    expect(base.tablas['notices']).toHaveLength(1)
    expect(String(base.tablas['notices']?.[0]?.['titulo'])).toContain('Meta Ads')
  })

  it('se detiene cuando la pieza llega sin enlace de Drive', async () => {
    base = crearSupabaseFalso(pieza({ drive_url: null }))

    const salida = await prepararVideoDePieza('pieza-1')

    expect(salida.ok).toBe(false)
    if (salida.ok) return
    expect(salida.error).toContain('sin enlace de Drive')
    expect(descargar).not.toHaveBeenCalled()
  })

  it('se detiene cuando la pieza ya no existe', async () => {
    base = crearSupabaseFalso({ pieces: [], notices: [] })

    const salida = await prepararVideoDePieza('pieza-1')

    expect(salida.ok).toBe(false)
  })
})

describe('limpiarCopiasVencidas', () => {
  it('borra la copia que ya cumplió y suelta su ruta', async () => {
    base = crearSupabaseFalso(
      pieza({ storage_path: 'marca-1/pieza-1.mp4', storage_expira_at: '2026-09-09T18:00:00Z' }),
    )
    base.archivos.set('videos/marca-1/pieza-1.mp4', 'contenido')

    const borradas = await limpiarCopiasVencidas(AHORA)

    expect(borradas).toBe(1)
    expect(base.archivos.has('videos/marca-1/pieza-1.mp4')).toBe(false)
    expect(base.tablas['pieces']?.[0]).toMatchObject({ storage_path: null, storage_expira_at: null })
  })

  it('deja quieta la copia que todavía sirve', async () => {
    base = crearSupabaseFalso(
      pieza({ storage_path: 'marca-1/pieza-1.mp4', storage_expira_at: '2026-09-11T18:00:00Z' }),
    )

    expect(await limpiarCopiasVencidas(AHORA)).toBe(0)
    expect(base.tablas['pieces']?.[0]?.['storage_path']).toBe('marca-1/pieza-1.mp4')
  })

  it('deja quieta la copia sin fecha de vencimiento, porque aún no ha salido', async () => {
    base = crearSupabaseFalso(pieza({ storage_path: 'marca-1/pieza-1.mp4', storage_expira_at: null }))

    expect(await limpiarCopiasVencidas(AHORA)).toBe(0)
  })
})
