import { NextResponse } from 'next/server'
import { clienteAdmin } from '@/lib/supabase/admin'

/**
 * Fase 3 · la biblioteca se actualiza sola.
 *
 * La página pública de recursos consume esto en lugar de mantenerse a mano.
 * Devuelve solo lo activo, agrupado por sección, y queda abierto a propósito:
 * son enlaces que ya son públicos.
 */

export const dynamic = 'force-dynamic'

export async function GET(peticion: Request) {
  const url = new URL(peticion.url)
  const marca = url.searchParams.get('marca')

  const supabase = clienteAdmin()

  let consulta = supabase
    .from('resources')
    .select('id, titulo, descripcion, tipo, url, seccion, brand_id, creado_at')
    .eq('activo', true)
    .order('creado_at', { ascending: false })

  if (marca) {
    const { data: encontrada } = await supabase.from('brands').select('id').eq('slug', marca).maybeSingle()
    if (!encontrada) return NextResponse.json({ error: 'esa marca no existe' }, { status: 404 })
    consulta = consulta.eq('brand_id', encontrada.id)
  }

  const { data: recursos, error } = await consulta
  if (error) {
    // La ruta es pública, así que el detalle se queda en el servidor. Hacia
    // afuera va un mensaje que no dice nada de la base.
    console.error('[recursos] la consulta falló:', error.message)
    return NextResponse.json({ error: 'la biblioteca no está disponible ahora' }, { status: 503 })
  }

  const secciones = [...new Set((recursos ?? []).map((r) => r.seccion ?? 'Sin sección'))]

  return NextResponse.json(
    {
      actualizado: new Date().toISOString(),
      total: (recursos ?? []).length,
      secciones: secciones.map((seccion) => ({
        nombre: seccion,
        recursos: (recursos ?? [])
          .filter((r) => (r.seccion ?? 'Sin sección') === seccion)
          .map(({ id, titulo, descripcion, tipo, url: enlace }) => ({
            id,
            titulo,
            descripcion,
            tipo,
            url: enlace,
          })),
      })),
    },
    {
      headers: {
        // La biblioteca cambia pocas veces al día, y así la página pública
        // responde rápido sin castigar la base.
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
        'access-control-allow-origin': '*',
      },
    },
  )
}
