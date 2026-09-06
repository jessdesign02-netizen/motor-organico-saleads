import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { diasDeLaSemana, hoyEnBogota, lunesDe } from '@/lib/dominio/semana'
import { Vacio } from '@/app/ui'
import { SemanaDeLaMarca } from './semana'
import { NuevaPieza } from './nueva'

export const dynamic = 'force-dynamic'

export default async function Parrilla({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { semana } = await searchParams
  const lunes = semana ?? lunesDe(new Date())
  const dias = diasDeLaSemana(lunes)
  const hoy = hoyEnBogota()

  const perfil = await perfilActual()
  const supabase = await clienteServidor()

  const [{ data: marcas }, { data: piezas }, { data: propuestas }] = await Promise.all([
    supabase.from('brands').select('*').order('nombre'),
    supabase.from('pieces').select('*').eq('semana', lunes).order('hora_publicacion', { ascending: true }),
    supabase.from('calendar_proposals').select('*').eq('semana', lunes).is('aplicada_at', null),
  ])

  const ids = (piezas ?? []).map((p) => p.id)
  const [{ data: claves }, { data: plantillas }, { data: enlaces }] = await Promise.all([
    ids.length ? supabase.from('keywords').select('piece_id').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('dm_templates').select('piece_id').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('tracked_links').select('piece_id').in('piece_id', ids) : { data: [] },
  ])

  /** Lo que le falta a la pieza para poder salir, dicho por su nombre. */
  const faltantesDe = (piezaId: string) => {
    const pieza = (piezas ?? []).find((p) => p.id === piezaId)
    const faltan: string[] = []
    if (!pieza?.drive_url) faltan.push('video')
    if (!pieza?.fecha_publicacion) faltan.push('fecha')
    if (!pieza?.hora_publicacion) faltan.push('hora')
    if (!(claves ?? []).some((k) => k.piece_id === piezaId)) faltan.push('palabra clave')
    if (!(plantillas ?? []).some((d) => d.piece_id === piezaId)) faltan.push('mensaje')
    if (!(enlaces ?? []).some((e) => e.piece_id === piezaId)) faltan.push('enlace')
    return faltan
  }

  const puedeAprobar = perfil?.rol === 'editora' || perfil?.rol === 'aprobadora'
  const puedeCrear = perfil?.rol === 'editora' || perfil?.rol === 'audiovisual'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Parrilla</h1>
          <p className="text-sm text-neutral-500">Semana del {lunes}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/parrilla?semana=${corrimiento(lunes, -7)}`} className="text-neutral-600 hover:text-neutral-900">
            Anterior
          </Link>
          <Link href={`/parrilla?semana=${lunesDe(new Date())}`} className="text-neutral-600 hover:text-neutral-900">
            Esta semana
          </Link>
          <Link href={`/parrilla?semana=${corrimiento(lunes, 7)}`} className="text-neutral-600 hover:text-neutral-900">
            Siguiente
          </Link>
        </div>
      </header>

      {(marcas ?? []).length === 0 ? (
        <Vacio>Aún no hay marcas cargadas. Créalas en la base y conecta su hoja de cálculo.</Vacio>
      ) : null}

      {(marcas ?? []).map((marca) => (
        <SemanaDeLaMarca
          key={marca.id}
          marca={marca}
          semana={lunes}
          dias={dias}
          hoy={hoy}
          piezas={(piezas ?? []).filter((p) => p.brand_id === marca.id)}
          faltantes={Object.fromEntries(
            (piezas ?? []).filter((p) => p.brand_id === marca.id).map((p) => [p.id, faltantesDe(p.id)]),
          )}
          propuesta={(propuestas ?? []).find((p) => p.brand_id === marca.id) ?? null}
          puedeAprobar={puedeAprobar}
        />
      ))}

      {puedeCrear && (marcas ?? []).length > 0 ? <NuevaPieza marcas={marcas ?? []} semana={lunes} /> : null}
    </div>
  )
}

function corrimiento(lunes: string, dias: number): string {
  const fecha = new Date(`${lunes}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}
