import { clienteServidor } from '@/lib/supabase/server'
import Link from 'next/link'
import { Barra, Celda, Dato, Encabezado, Tabla, Tarjeta, Vacio } from '@/app/ui'
import { RED, rangoDeSemana } from '@/lib/etiquetas'
import { filas } from '@/lib/consulta'
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
export default async function Resultados({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams
  const lunes = semana ?? lunesDe(new Date())
  const supabase = await clienteServidor()

  const piezas = filas(
    await supabase.from('pieces').select('*').eq('semana', lunes),
    'las piezas de la semana',
  )
  const ids = piezas.map((p) => p.id)

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
  const medidas = piezas.map((pieza) => {
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
  const enCola = (comentarios ?? []).filter((c) => c.estado === 'fallido').length
  const clics = (enlaces ?? []).reduce((suma, enlace) => suma + enlace.clics, 0)

  return (
    <div className="space-y-6">
      <Encabezado titulo="Resultados" bajada={rangoDeSemana(lunes)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Dato etiqueta="Piezas" valor={piezas.length} nota="en la semana" />
        <Dato
          etiqueta="Salidas publicadas"
          valor={(publicaciones ?? []).filter((p) => p.estado === 'publicado').length}
          nota="pieza por red"
        />
        <Dato etiqueta="Comentarios con la palabra" valor={detectados} nota="con la palabra clave" />
        <Dato etiqueta="Mensajes enviados" valor={respondidos} nota="respuesta automática" />
        <Dato etiqueta="Clics al enlace" valor={clics} nota="acumulado de la pieza" />
      </div>

      {enBandeja > 0 || enCola > 0 ? (
        <p className="rounded-silk bg-arcilla shadow-hundido px-4 py-3 text-sm text-aviso">
          {enBandeja > 0
            ? `${enBandeja} ${enBandeja === 1 ? 'comentario espera' : 'comentarios esperan'} tu respuesta. `
            : ''}
          {enCola > 0 ? `${enCola} ${enCola === 1 ? 'vuelve' : 'vuelven'} a intentarse solos.` : ''}
        </p>
      ) : null}

      {hora ? (
        <p className="rounded-silk shadow-alzado bg-arcilla shadow-alzado px-4 py-3 text-sm text-tinta">
          La franja de las <span className="font-semibold">{hora.hora}</span> es la que más gente trajo:{' '}
          {hora.enviados} mensajes sobre {hora.piezas} piezas.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Palabras clave" bajada="detectados · enviados · clics">
          <Ranking filas={porPalabra} vacio="Sin palabras clave medidas todavía." />
        </Tarjeta>
        <Tarjeta titulo="Temas" bajada="detectados · enviados · clics">
          <Ranking filas={porTema} vacio="Sin temas medidos todavía." />
        </Tarjeta>
        <Tarjeta titulo="Tipos de hook" bajada="detectados · enviados · clics">
          <Ranking filas={porHook} vacio="Sin hooks medidos todavía." />
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Por marca y por red"
        bajada="Cada red lleva su propio estado: una pieza puede salir en una y fallar en otra"
        ajustado
      >
        <Tabla
          cabeceras={['Marca', 'Red', 'Publicadas', 'No salieron', 'Detectados', 'Enviados', 'En bandeja']}
        >
          {comparativa.flatMap(({ marca, porRed }) =>
            porRed.map((fila) => (
              <tr key={`${marca.id}-${fila.red}`}>
                <Celda apagado={!fila.conectada}>{marca.nombre}</Celda>
                <Celda numero apagado={!fila.conectada}>
                  {RED[fila.red]}
                  {fila.conectada ? '' : ' · sin conectar'}
                </Celda>
                <Celda numero apagado={fila.publicadas === 0}>
                  {fila.publicadas}
                </Celda>
                <Celda numero apagado={fila.fallidas === 0}>
                  {fila.fallidas > 0 ? <span className="text-critico">{fila.fallidas}</span> : 0}
                </Celda>
                <Celda numero apagado={fila.detectados === 0}>
                  {fila.detectados}
                </Celda>
                <Celda numero apagado={fila.enviados === 0}>
                  {fila.enviados}
                </Celda>
                <Celda numero apagado={fila.enBandeja === 0}>
                  {fila.enBandeja > 0 ? <span className="text-aviso">{fila.enBandeja}</span> : 0}
                </Celda>
              </tr>
            )),
          )}
        </Tabla>
      </Tarjeta>

      <Tarjeta titulo="Por pieza" ajustado>
        {piezas.length === 0 ? (
          <div className="p-5">
            <Vacio>Sin piezas en esta semana.</Vacio>
          </div>
        ) : (
          <Tabla cabeceras={['Pieza', 'Marca', 'Salidas', 'Detectados', 'Enviados', 'Clics']}>
            {medidas.map((medida) => {
              const pieza = piezas.find((p) => p.id === medida.piezaId)
              const suyas = (publicaciones ?? []).filter((p) => p.piece_id === medida.piezaId)
              const marca = (marcas ?? []).find((m) => m.id === pieza?.brand_id)

              return (
                <tr key={medida.piezaId}>
                  <Celda>
                    <Link href={`/piezas/${medida.piezaId}`} className="underline-offset-2 hover:underline">
                      {medida.tema}
                    </Link>
                  </Celda>
                  <Celda numero apagado>
                    {marca?.nombre}
                  </Celda>
                  <Celda numero apagado={suyas.length === 0}>
                    {suyas.filter((p) => p.estado === 'publicado').length}/{suyas.length}
                  </Celda>
                  <Celda numero apagado={medida.detectados === 0}>
                    {medida.detectados}
                  </Celda>
                  <Celda numero apagado={medida.enviados === 0}>
                    {medida.enviados}
                  </Celda>
                  <Celda numero apagado={medida.clics === 0}>
                    {medida.clics}
                  </Celda>
                </tr>
              )
            })}
          </Tabla>
        )}
      </Tarjeta>
    </div>
  )
}

/**
 * Las cinco primeras de cada corte.
 *
 * Antes esta lista mostraba una "conversión" que salía de dividir los clics
 * entre los comentarios detectados, y daba cosas como 1450%. No era un
 * porcentaje: los clics los pone cualquiera que abra el enlace —incluido quien
 * llega desde la bio— y los detectados solo cuentan a quien comentó la palabra.
 * Dividir dos poblaciones distintas no da una tasa.
 *
 * Ahora se muestran los tres números del embudo, en orden, y una barra que
 * compara cada fila contra la mejor. La barra lleva su cifra al lado, que es lo
 * que permite leerla sin depender del color.
 */
function Ranking({ filas, vacio }: { filas: FilaRanking[]; vacio: string }) {
  if (filas.length === 0) return <p className="text-sm text-tinta-3">{vacio}</p>

  const primeras = filas.slice(0, 5)
  const tope = Math.max(...primeras.map((f) => f.detectados), 1)

  return (
    <ul className="space-y-3">
      {primeras.map((fila) => (
        <li key={fila.etiqueta}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-tinta">{fila.etiqueta}</span>
            <span className="shrink-0 text-xs tabular-nums text-tinta-2">
              {fila.detectados} · {fila.enviados} · {fila.clics}
            </span>
          </div>
          <div className="mt-1.5">
            <Barra valor={fila.detectados} maximo={tope} />
          </div>
        </li>
      ))}
    </ul>
  )
}
