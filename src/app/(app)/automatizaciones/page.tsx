import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { Encabezado, Etiqueta, Punto, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { ESTADO_PIEZA, RED, fechaCorta } from '@/lib/etiquetas'

export const dynamic = 'force-dynamic'

/**
 * Automatizaciones.
 *
 * Una automatización es lo que en ManyChat sería una regla: palabra clave →
 * mensaje → enlace. Aquí vive pegada a su pieza, y hasta ahora solo se veía
 * entrando a la pieza una por una. Verlas juntas es lo que permite darse cuenta
 * de que una palabra no está trayendo a nadie, o de que una quedó a medias.
 */
export default async function Automatizaciones() {
  const supabase = await clienteServidor()

  const claves = filas(
    await supabase.from('keywords').select('*').order('creado_at', { ascending: false }),
    'las automatizaciones',
  )

  const piezaIds = claves.map((k) => k.piece_id)
  const [
    { data: piezas },
    { data: plantillas },
    { data: enlaces },
    { data: publicaciones },
    { data: marcas },
  ] = await Promise.all([
    piezaIds.length ? supabase.from('pieces').select('*').in('id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('dm_templates').select('*').in('piece_id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('tracked_links').select('*').in('piece_id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('publications').select('*').in('piece_id', piezaIds) : { data: [] },
    supabase.from('brands').select('id, nombre'),
  ])

  const pubIds = (publicaciones ?? []).map((p) => p.id)
  const [{ data: comentarios }, { data: cuentas }] = await Promise.all([
    pubIds.length ? supabase.from('comments').select('*').in('publication_id', pubIds) : { data: [] },
    supabase.from('social_accounts').select('id, red'),
  ])

  const armadas = claves.map((clave) => {
    const pieza = (piezas ?? []).find((p) => p.id === clave.piece_id)
    const plantilla = (plantillas ?? []).find((p) => p.piece_id === clave.piece_id)
    const enlace = (enlaces ?? []).find((e) => e.piece_id === clave.piece_id)
    const suyas = (publicaciones ?? []).filter((p) => p.piece_id === clave.piece_id)
    const mios = (comentarios ?? []).filter((c) => suyas.some((p) => p.id === c.publication_id))

    return {
      clave,
      pieza,
      plantilla,
      enlace,
      marca: (marcas ?? []).find((m) => m.id === pieza?.brand_id)?.nombre ?? '',
      redes: suyas
        .map((p) => (cuentas ?? []).find((c) => c.id === p.social_account_id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => RED[c.red]),
      /** Encendida = ya salió y la palabra está vigente. Es lo que decide si responde o no. */
      encendida: Boolean(clave.activa_desde) && !clave.activa_hasta,
      detectados: mios.length,
      enviados: mios.filter((c) => c.estado === 'respondido').length,
      clics: enlace?.clics ?? 0,
      // Sin una de las tres, la pieza ni siquiera puede programarse.
      completa: Boolean(plantilla && enlace),
    }
  })

  const encendidas = armadas.filter((a) => a.encendida).length
  const incompletas = armadas.filter((a) => !a.completa).length

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Automatizaciones"
        bajada={
          armadas.length === 0
            ? 'Todavía sin automatizaciones'
            : `${armadas.length} en total · ${encendidas} escuchando${incompletas > 0 ? ` · ${incompletas} a medias` : ''}`
        }
      />

      {armadas.length === 0 ? (
        <Vacio
          accion={
            <Link
              href="/parrilla"
              className="rounded-silk shadow-alzado bg-arcilla px-3.5 py-2 text-sm font-medium text-tinta transition-colors hover:bg-arcilla-alta"
            >
              Ir a la parrilla
            </Link>
          }
        >
          Una automatización se crea dentro de la pieza: palabra clave, mensaje y enlace.
        </Vacio>
      ) : null}

      <div className="space-y-3">
        {armadas.map((a) => (
          <article
            key={a.clave.id}
            className="overflow-hidden rounded-silk shadow-alzado bg-arcilla shadow-alzado"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-wide text-tinta">{a.clave.palabra}</h2>
                  {a.encendida ? (
                    <Punto tono="bien">escuchando</Punto>
                  ) : (
                    <Punto tono="neutro">{a.clave.activa_hasta ? 'vencida' : 'aún no sale'}</Punto>
                  )}
                  {!a.completa ? (
                    <Etiqueta
                      rotulo={{ texto: 'A medias', tono: 'aviso', explica: 'Le falta mensaje o enlace' }}
                      titulo
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-tinta-2">
                  {a.pieza ? (
                    <Link
                      href={`/piezas/${a.pieza.id}`}
                      className="underline underline-offset-2 hover:text-tinta"
                    >
                      {a.pieza.tema}
                    </Link>
                  ) : (
                    'pieza eliminada'
                  )}
                  {a.marca ? ` · ${a.marca}` : ''}
                  {a.pieza?.fecha_publicacion ? ` · ${fechaCorta(a.pieza.fecha_publicacion)}` : ''}
                  {a.redes.length > 0 ? ` · ${[...new Set(a.redes)].join(', ')}` : ''}
                </p>
              </div>

              {a.pieza ? <Etiqueta rotulo={ESTADO_PIEZA[a.pieza.estado]} titulo /> : null}
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[1fr_14rem]">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-tinta-2">También responde a</p>
                  <p className="mt-1 text-xs leading-relaxed text-tinta-3">
                    {a.clave.variantes.length > 0 ? a.clave.variantes.join(' · ') : 'solo la palabra exacta'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-tinta-2">Mensaje que envía</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-silk bg-arcilla-alta px-3 py-2 text-sm text-tinta">
                    {a.plantilla?.mensaje ?? <span className="text-tinta-3">Sin mensaje todavía</span>}
                  </p>
                </div>
              </div>

              {/* Los tres números que dicen si la automatización sirve. */}
              <dl className="grid grid-cols-3 gap-3 md:grid-cols-1">
                {[
                  { etiqueta: 'Detectados', valor: a.detectados },
                  { etiqueta: 'Mensajes enviados', valor: a.enviados },
                  { etiqueta: 'Clics al enlace', valor: a.clics },
                ].map((dato) => (
                  <div key={dato.etiqueta} className="rounded-silk bg-arcilla-alta px-3 py-2">
                    <dt className="text-[11px] text-tinta-2">{dato.etiqueta}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-tinta">{dato.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
