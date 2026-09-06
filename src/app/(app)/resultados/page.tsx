import { clienteServidor } from '@/lib/supabase/server'
import { Dato, Tarjeta, Vacio } from '@/app/ui'
import { lunesDe } from '@/lib/dominio/semana'
import {
  mejorHora,
  rankingDePalabras,
  rendimientoPorHook,
  rendimientoPorTema,
  type FilaRanking,
} from '@/lib/dominio/analitica'

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
  const [{ data: comentarios }, { data: cuentas }] = await Promise.all([
    pubIds.length ? supabase.from('comments').select('*').in('publication_id', pubIds) : { data: [] },
    supabase.from('social_accounts').select('id, red, brand_id, handle'),
  ])

  // Módulo 6 · comparativa por marca y por red.
  const REDES = ['instagram', 'tiktok', 'youtube'] as const
  const comparativa = (marcas ?? []).map((marca) => ({
    marca,
    porRed: REDES.map((red) => {
      const suyas = (cuentas ?? []).filter((c) => c.brand_id === marca.id && c.red === red).map((c) => c.id)
      const pubs = (publicaciones ?? []).filter((p) => suyas.includes(p.social_account_id))
      const coments = (comentarios ?? []).filter((c) => pubs.some((p) => p.id === c.publication_id))
      return {
        red,
        conectada: suyas.length > 0,
        publicadas: pubs.filter((p) => p.estado === 'publicado').length,
        fallidas: pubs.filter((p) => p.estado === 'fallido').length,
        detectados: coments.filter((c) => c.keyword_id !== null).length,
        enviados: coments.filter((c) => c.estado === 'respondido').length,
        enBandeja: coments.filter((c) => c.estado === 'manual_pendiente').length,
      }
    }),
  }))

  const { data: claves } = ids.length
    ? await supabase.from('keywords').select('piece_id, palabra').in('piece_id', ids)
    : { data: [] }

  // Fase 3 · qué funcionó, medido sobre lo que ya está registrado.
  const medidas = (piezas ?? []).map((pieza) => {
    const suyas = (publicaciones ?? []).filter((p) => p.piece_id === pieza.id)
    const mios = (comentarios ?? []).filter((c) => suyas.some((p) => p.id === c.publication_id))
    return {
      piezaId: pieza.id,
      tema: pieza.tema,
      hook: pieza.hook,
      palabra: (claves ?? []).find((k) => k.piece_id === pieza.id)?.palabra ?? null,
      hora: pieza.hora_publicacion,
      detectados: mios.filter((c) => c.keyword_id !== null).length,
      enviados: mios.filter((c) => c.estado === 'respondido').length,
      clics: (enlaces ?? []).find((e) => e.piece_id === pieza.id)?.clics ?? 0,
    }
  })

  const porPalabra = rankingDePalabras(medidas)
  const porTema = rendimientoPorTema(medidas)
  const porHook = rendimientoPorHook(medidas)
  const hora = mejorHora(medidas)

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

      {hora ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
          La franja de las <span className="font-semibold">{hora.hora}</span> es la que más gente trajo:{' '}
          {hora.enviados} mensajes sobre {hora.piezas} piezas.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Tarjeta titulo="Palabras clave">
          <Ranking filas={porPalabra} vacio="Sin palabras clave medidas todavía." />
        </Tarjeta>
        <Tarjeta titulo="Temas">
          <Ranking filas={porTema} vacio="Sin temas medidos todavía." />
        </Tarjeta>
        <Tarjeta titulo="Tipos de hook">
          <Ranking filas={porHook} vacio="Sin hooks medidos todavía." />
        </Tarjeta>
      </div>

      <Tarjeta titulo="Por marca y por red">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="py-2">Marca</th>
                <th>Red</th>
                <th className="text-right">Publicadas</th>
                <th className="text-right">Fallidas</th>
                <th className="text-right">Detectados</th>
                <th className="text-right">Enviados</th>
                <th className="text-right">En bandeja</th>
              </tr>
            </thead>
            <tbody>
              {comparativa.flatMap(({ marca, porRed }) =>
                porRed.map((fila) => (
                  <tr key={`${marca.id}-${fila.red}`} className="border-t border-neutral-100">
                    <td className="py-2">{marca.nombre}</td>
                    <td className="text-neutral-600">
                      {fila.red}
                      {fila.conectada ? '' : ' · sin conectar'}
                    </td>
                    <td className="text-right tabular-nums">{fila.publicadas}</td>
                    <td className={`text-right tabular-nums ${fila.fallidas > 0 ? 'text-red-700' : ''}`}>
                      {fila.fallidas}
                    </td>
                    <td className="text-right tabular-nums">{fila.detectados}</td>
                    <td className="text-right tabular-nums">{fila.enviados}</td>
                    <td className={`text-right tabular-nums ${fila.enBandeja > 0 ? 'text-amber-700' : ''}`}>
                      {fila.enBandeja}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>

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

/** Las cinco primeras de cada corte, con los clics por cada cien detectados. */
function Ranking({ filas, vacio }: { filas: FilaRanking[]; vacio: string }) {
  if (filas.length === 0) return <p className="text-sm text-neutral-500">{vacio}</p>

  return (
    <ul className="space-y-2 text-sm">
      {filas.slice(0, 5).map((fila) => (
        <li key={fila.etiqueta} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">{fila.etiqueta}</span>
          <span className="shrink-0 tabular-nums text-neutral-500">
            {fila.clics} clics · {fila.conversion}%
          </span>
        </li>
      ))}
    </ul>
  )
}
