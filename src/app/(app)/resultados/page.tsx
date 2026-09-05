import { clienteServidor } from '@/lib/supabase/server'
import { Dato, Tarjeta, Vacio } from '@/app/ui'
import { lunesDe } from '@/lib/dominio/semana'

export const dynamic = 'force-dynamic'

/** Módulo 6 · Resultados: qué trajo cada pieza, y cómo va la semana por marca. */
export default async function Resultados({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>
}) {
  const { semana } = await searchParams
  const lunes = semana ?? lunesDe(new Date())
  const supabase = await clienteServidor()

  const { data: piezas } = await supabase.from('pieces').select('*').eq('semana', lunes)
  const ids = (piezas ?? []).map((p) => p.id)

  const [{ data: publicaciones }, { data: enlaces }, { data: marcas }] = await Promise.all([
    ids.length ? supabase.from('publications').select('*').in('piece_id', ids) : { data: [] },
    ids.length ? supabase.from('tracked_links').select('*').in('piece_id', ids) : { data: [] },
    supabase.from('brands').select('*'),
  ])

  const pubIds = (publicaciones ?? []).map((p) => p.id)
  const { data: comentarios } = pubIds.length
    ? await supabase.from('comments').select('*').in('publication_id', pubIds)
    : { data: [] }

  const detectados = (comentarios ?? []).filter((c) => c.keyword_id !== null).length
  const respondidos = (comentarios ?? []).filter((c) => c.estado === 'respondido').length
  const enBandeja = (comentarios ?? []).filter((c) => c.estado === 'manual_pendiente').length
  const clics = (enlaces ?? []).reduce((suma, enlace) => suma + enlace.clics, 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Resultados</h1>
        <p className="text-sm text-neutral-500">Semana del {lunes}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Dato etiqueta="Piezas" valor={(piezas ?? []).length} />
        <Dato etiqueta="Publicadas" valor={(publicaciones ?? []).filter((p) => p.estado === 'publicado').length} />
        <Dato etiqueta="Comentarios con la palabra" valor={detectados} />
        <Dato etiqueta="Mensajes enviados" valor={respondidos} />
        <Dato etiqueta="Clics al enlace" valor={clics} />
      </div>

      {enBandeja > 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {enBandeja} comentarios esperan en la bandeja manual.
        </p>
      ) : null}

      <Tarjeta titulo="Por pieza">
        {(piezas ?? []).length === 0 ? (
          <Vacio>Sin piezas en esta semana.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-neutral-500">
                <tr>
                  <th className="py-2">Pieza</th>
                  <th>Marca</th>
                  <th className="text-right">Salidas</th>
                  <th className="text-right">Detectados</th>
                  <th className="text-right">Enviados</th>
                  <th className="text-right">Clics</th>
                </tr>
              </thead>
              <tbody>
                {(piezas ?? []).map((pieza) => {
                  const suyas = (publicaciones ?? []).filter((p) => p.piece_id === pieza.id)
                  const mios = (comentarios ?? []).filter((c) =>
                    suyas.some((p) => p.id === c.publication_id),
                  )
                  const enlace = (enlaces ?? []).find((e) => e.piece_id === pieza.id)
                  const marca = (marcas ?? []).find((m) => m.id === pieza.brand_id)

                  return (
                    <tr key={pieza.id} className="border-t border-neutral-100">
                      <td className="py-2">{pieza.tema}</td>
                      <td className="text-neutral-500">{marca?.nombre}</td>
                      <td className="text-right tabular-nums">
                        {suyas.filter((p) => p.estado === 'publicado').length}/{suyas.length}
                      </td>
                      <td className="text-right tabular-nums">{mios.filter((c) => c.keyword_id).length}</td>
                      <td className="text-right tabular-nums">
                        {mios.filter((c) => c.estado === 'respondido').length}
                      </td>
                      <td className="text-right tabular-nums">{enlace?.clics ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
