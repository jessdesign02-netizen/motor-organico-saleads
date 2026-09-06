import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { hoyDelEquipo } from '@/lib/dominio/semana'
import { Etiqueta, Tarjeta, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { AprobarDia } from './aprobar'

export const dynamic = 'force-dynamic'

/** Módulo 4 · el panel del día: lo que va a salir, en una sola pantalla. */
export default async function PanelDelDia({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const { fecha } = await searchParams
  const dia = fecha ?? hoyDelEquipo()
  const perfil = await perfilActual()
  const supabase = await clienteServidor()

  const piezas = filas(
    await supabase
      .from('pieces')
      .select('*')
      .eq('fecha_publicacion', dia)
      .order('hora_publicacion', { ascending: true }),
    'las piezas del día',
  )

  const ids = piezas.map((p) => p.id)
  const [{ data: claves }, { data: plantillas }, { data: publicaciones }, { data: marcas }] = await Promise.all([
    ids.length ? supabase.from('keywords').select('*').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('dm_templates').select('*').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('publications').select('*').in('piece_id', ids) : { data: [] },
    supabase.from('brands').select('*'),
  ])

  const listas = piezas.filter((p) => p.estado === 'aprobado')

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">El día</h1>
          <p className="text-sm text-neutral-500">{dia} · hora de Bogotá</p>
        </div>
        <Link href="/parrilla" className="text-sm text-neutral-600 hover:text-neutral-900">
          Ver la semana
        </Link>
      </header>

      {piezas.length === 0 ? <Vacio>Nada programado para este día.</Vacio> : null}

      {piezas.map((pieza) => {
        const clave = (claves ?? []).find((k) => k.piece_id === pieza.id)
        const plantilla = (plantillas ?? []).find((p) => p.piece_id === pieza.id)
        const suyas = (publicaciones ?? []).filter((p) => p.piece_id === pieza.id)
        const marca = (marcas ?? []).find((m) => m.id === pieza.brand_id)

        return (
          <Tarjeta key={pieza.id} titulo={`${pieza.hora_publicacion?.slice(0, 5) ?? '--:--'} · ${pieza.tema}`}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-3">
                <p className="text-xs text-neutral-500">
                  {marca?.nombre} · <Etiqueta>{pieza.estado}</Etiqueta>
                </p>
                <div>
                  <p className="text-xs font-medium text-neutral-600">Caption</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{pieza.caption_base ?? 'sin caption'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-600">Mensaje directo</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{plantilla?.mensaje ?? 'sin mensaje'}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-neutral-600">Palabra clave</p>
                  <p className="mt-1 font-mono text-sm">{clave?.palabra ?? 'sin definir'}</p>
                  {clave?.variantes.length ? (
                    <p className="mt-1 text-xs text-neutral-500">{clave.variantes.slice(0, 6).join(', ')}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-600">Salidas</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {suyas.length === 0 ? <li className="text-neutral-500">sin programar</li> : null}
                    {suyas.map((publicacion) => (
                      <li key={publicacion.id} className="flex items-center gap-2">
                        <Etiqueta>{publicacion.estado}</Etiqueta>
                        {publicacion.ultimo_error ? (
                          <span className="text-red-700">{publicacion.ultimo_error}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={`/piezas/${pieza.id}`} className="inline-block text-xs text-neutral-600 underline">
                  Abrir la pieza
                </Link>
              </div>
            </div>
          </Tarjeta>
        )
      })}

      {perfil?.rol === 'editora' && listas.length > 0 ? (
        <AprobarDia fecha={dia} cuantas={listas.length} />
      ) : null}
    </div>
  )
}
