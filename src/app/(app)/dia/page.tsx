import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { hoyDelEquipo } from '@/lib/dominio/semana'
import { ESTADO_PIEZA, ESTADO_PUBLICACION, RED, fechaLarga, hora } from '@/lib/etiquetas'
import { Encabezado, Etiqueta, Vacio } from '@/app/ui'
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
  const [{ data: claves }, { data: plantillas }, { data: publicaciones }, { data: marcas }, { data: cuentas }] =
    await Promise.all([
      ids.length ? supabase.from('keywords').select('*').in('piece_id', ids) : { data: [] },
      ids.length ? supabase.from('dm_templates').select('*').in('piece_id', ids) : { data: [] },
      ids.length ? supabase.from('publications').select('*').in('piece_id', ids) : { data: [] },
      supabase.from('brands').select('*'),
      supabase.from('social_accounts').select('id, red, handle'),
    ])

  const listas = piezas.filter((p) => p.estado === 'aprobado')

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="El día"
        bajada={`${dia === hoyDelEquipo() ? 'Hoy, ' : ''}${fechaLarga(dia)} · hora de Bogotá`}
      >
        <Link
          href="/parrilla"
          className="rounded-lg px-2.5 py-1.5 text-sm text-tinta-2 transition-colors hover:bg-hundido hover:text-tinta"
        >
          Ver la semana
        </Link>
      </Encabezado>

      {/* La decisión del día va arriba: es a lo que se entra a esta pantalla. */}
      {perfil?.rol === 'editora' && listas.length > 0 ? (
        <AprobarDia fecha={dia} cuantas={listas.length} />
      ) : null}

      {piezas.length === 0 ? (
        <Vacio
          accion={
            <Link
              href="/parrilla"
              className="rounded-lg border border-linea-fuerte bg-superficie px-3.5 py-2 text-sm font-medium text-tinta transition-colors hover:bg-hundido"
            >
              Ir a la parrilla
            </Link>
          }
        >
          Nada sale este día. Lo que se programe en la parrilla aparece aquí.
        </Vacio>
      ) : null}

      {piezas.map((pieza) => {
        const clave = (claves ?? []).find((k) => k.piece_id === pieza.id)
        const plantilla = (plantillas ?? []).find((p) => p.piece_id === pieza.id)
        const suyas = (publicaciones ?? []).filter((p) => p.piece_id === pieza.id)
        const marca = (marcas ?? []).find((m) => m.id === pieza.brand_id)

        return (
          <article key={pieza.id} className="overflow-hidden rounded-xl border border-linea bg-superficie shadow-carta">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-linea px-5 py-3.5">
              <span className="text-lg font-semibold tabular-nums tracking-tight text-tinta">
                {hora(pieza.hora_publicacion)}
              </span>
              <h2 className="flex-1 text-sm font-medium text-tinta">{pieza.tema}</h2>
              <span className="text-xs text-tinta-3">{marca?.nombre}</span>
              <Etiqueta rotulo={ESTADO_PIEZA[pieza.estado]} titulo />
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[1fr_18rem]">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-tinta-2">Caption</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-tinta">
                    {pieza.caption_base ?? <span className="text-tinta-3">Sin caption</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-tinta-2">
                    Mensaje que recibe quien comente la palabra
                  </p>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-hundido px-3 py-2 text-sm text-tinta">
                    {plantilla?.mensaje ?? <span className="text-tinta-3">Sin mensaje</span>}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-tinta-2">Palabra clave</p>
                  {clave ? (
                    <>
                      <p className="mt-1 text-base font-semibold tracking-wide text-tinta">{clave.palabra}</p>
                      {clave.variantes.length > 0 ? (
                        <p className="mt-1 text-xs leading-relaxed text-tinta-3">
                          también responde a {clave.variantes.slice(0, 5).join(', ')}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-tinta-3">Sin definir · la pieza no puede programarse</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-tinta-2">Salidas</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {suyas.length === 0 ? (
                      <li className="text-xs text-tinta-3">Sin programar todavía</li>
                    ) : null}
                    {suyas.map((publicacion) => {
                      const cuenta = (cuentas ?? []).find((c) => c.id === publicacion.social_account_id)
                      return (
                        <li key={publicacion.id} className="text-xs">
                          <span className="flex items-center gap-2">
                            <span className="flex-1 text-tinta">
                              {cuenta ? RED[cuenta.red] : 'Cuenta'}
                            </span>
                            <Etiqueta rotulo={ESTADO_PUBLICACION[publicacion.estado]} />
                          </span>
                          {publicacion.ultimo_error ? (
                            <span className="mt-0.5 block text-tinta-3">{publicacion.ultimo_error}</span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <Link
                  href={`/piezas/${pieza.id}`}
                  className="inline-block text-xs text-tinta-2 underline underline-offset-2 hover:text-tinta"
                >
                  Abrir la pieza
                </Link>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
