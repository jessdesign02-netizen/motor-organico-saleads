import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { diasDeLaSemana, hoyDelEquipo, lunesDe } from '@/lib/dominio/semana'
import { rangoDeSemana } from '@/lib/etiquetas'
import { Encabezado, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { SemanaDeLaMarca } from './semana'
import { NuevaPieza } from './nueva'

export const dynamic = 'force-dynamic'

export default async function Parrilla({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams
  const lunes = semana ?? lunesDe(new Date())
  const dias = diasDeLaSemana(lunes)
  const hoy = hoyDelEquipo()
  const estaSemana = lunesDe(new Date())

  const perfil = await perfilActual()
  const supabase = await clienteServidor()

  const [respuestaMarcas, respuestaPiezas, respuestaPropuestas] = await Promise.all([
    supabase.from('brands').select('*').order('nombre'),
    supabase.from('pieces').select('*').eq('semana', lunes).order('hora_publicacion', { ascending: true }),
    supabase.from('calendar_proposals').select('*').eq('semana', lunes).is('aplicada_at', null),
  ])

  // Un fallo de la base se veía como una parrilla vacía, y eso lleva a concluir
  // que no hay piezas cuando lo que hay es un problema.
  const marcas = filas(respuestaMarcas, 'las marcas')
  const piezas = filas(respuestaPiezas, 'la parrilla de la semana')
  const propuestas = filas(respuestaPropuestas, 'las propuestas de calendario')

  const ids = piezas.map((p) => p.id)
  const [{ data: claves }, { data: plantillas }, { data: enlaces }] = await Promise.all([
    ids.length ? supabase.from('keywords').select('piece_id').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('dm_templates').select('piece_id').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('tracked_links').select('piece_id').in('piece_id', ids) : { data: [] },
  ])

  /** Lo que le falta a la pieza para poder salir, dicho por su nombre. */
  const faltantesDe = (piezaId: string) => {
    const pieza = piezas.find((p) => p.id === piezaId)
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

  const paso = (dias: number) => {
    const fecha = new Date(`${lunes}T12:00:00Z`)
    fecha.setUTCDate(fecha.getUTCDate() + dias)
    return fecha.toISOString().slice(0, 10)
  }

  const navegar =
    'rounded-silk px-2.5 py-1.5 text-sm text-tinta-2 transition-colors hover:bg-arcilla-alta hover:text-tinta'

  return (
    <div className="space-y-8">
      <Encabezado titulo="Parrilla" bajada={rangoDeSemana(lunes)}>
        <Link href={`/parrilla?semana=${paso(-7)}`} className={navegar} aria-label="Semana anterior">
          ←
        </Link>
        {lunes !== estaSemana ? (
          <Link href={`/parrilla?semana=${estaSemana}`} className={navegar}>
            Esta semana
          </Link>
        ) : null}
        <Link href={`/parrilla?semana=${paso(7)}`} className={navegar} aria-label="Semana siguiente">
          →
        </Link>
      </Encabezado>

      {marcas.length === 0 ? (
        <Vacio>Aún no hay marcas cargadas. Créalas en Ajustes y conecta su hoja de cálculo.</Vacio>
      ) : null}

      {marcas.map((marca) => (
        <SemanaDeLaMarca
          key={marca.id}
          marca={marca}
          semana={lunes}
          dias={dias}
          hoy={hoy}
          piezas={piezas.filter((p) => p.brand_id === marca.id)}
          faltantes={Object.fromEntries(
            piezas.filter((p) => p.brand_id === marca.id).map((p) => [p.id, faltantesDe(p.id)]),
          )}
          propuesta={propuestas.find((p) => p.brand_id === marca.id) ?? null}
          puedeAprobar={puedeAprobar}
        />
      ))}

      {puedeCrear && marcas.length > 0 ? <NuevaPieza marcas={marcas ?? []} semana={lunes} /> : null}
    </div>
  )
}
