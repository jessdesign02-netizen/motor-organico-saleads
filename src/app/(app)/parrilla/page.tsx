import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { DIAS, diasDeLaSemana, hoyEnBogota, lunesDe } from '@/lib/dominio/semana'
import { Etiqueta, Vacio } from '@/app/ui'

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

  const supabase = await clienteServidor()
  const { data: marcas } = await supabase.from('brands').select('*').order('nombre')
  const { data: piezas } = await supabase
    .from('pieces')
    .select('*')
    .eq('semana', lunes)
    .order('hora_publicacion', { ascending: true })

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Parrilla</h1>
          <p className="text-sm text-neutral-500">Semana del {lunes}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/parrilla?semana=${corrimiento(lunes, -7)}`} className="text-neutral-600 hover:text-neutral-900">
            Semana anterior
          </Link>
          <Link href={`/parrilla?semana=${corrimiento(lunes, 7)}`} className="text-neutral-600 hover:text-neutral-900">
            Semana siguiente
          </Link>
        </div>
      </header>

      {(marcas ?? []).length === 0 ? (
        <Vacio>Aún no hay marcas cargadas. Créalas en la base y conecta su hoja de cálculo.</Vacio>
      ) : null}

      {(marcas ?? []).map((marca) => (
        <section key={marca.id}>
          <h2 className="mb-2 text-sm font-semibold tracking-tight">{marca.nombre}</h2>
          <div className="grid grid-cols-7 gap-2">
            {dias.map((dia, indice) => {
              const delDia = (piezas ?? []).filter(
                (p) => p.brand_id === marca.id && p.fecha_publicacion === dia,
              )
              return (
                <div
                  key={dia}
                  className={`min-h-28 rounded-lg border p-2 ${
                    dia === hoy ? 'border-neutral-900' : 'border-neutral-200'
                  } bg-white`}
                >
                  <p className="text-xs text-neutral-500">
                    {DIAS[indice]} {dia.slice(8)}
                  </p>
                  <div className="mt-2 space-y-1">
                    {delDia.map((pieza) => (
                      <Link
                        key={pieza.id}
                        href={`/piezas/${pieza.id}`}
                        className="block rounded border border-neutral-200 p-2 text-xs hover:border-neutral-400"
                      >
                        <span className="line-clamp-2 font-medium">{pieza.tema}</span>
                        <span className="mt-1 flex items-center gap-1">
                          <Etiqueta>{pieza.estado}</Etiqueta>
                          {pieza.sheet_pendiente ? (
                            <span className="text-amber-700" title="La hoja cambió y espera confirmación">
                              ●
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-tight">Sin fecha</h2>
        <div className="flex flex-wrap gap-2">
          {(piezas ?? [])
            .filter((p) => p.fecha_publicacion === null)
            .map((pieza) => (
              <Link
                key={pieza.id}
                href={`/piezas/${pieza.id}`}
                className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs hover:border-neutral-400"
              >
                {pieza.tema}
              </Link>
            ))}
        </div>
      </section>
    </div>
  )
}

function corrimiento(lunes: string, dias: number): string {
  const fecha = new Date(`${lunes}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}
