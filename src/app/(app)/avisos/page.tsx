import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { Encabezado, Etiqueta, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { TIPO_AVISO, hace } from '@/lib/etiquetas'
import { Archivar, ArchivarTodo } from './archivar'

export const dynamic = 'force-dynamic'

export default async function Avisos() {
  const supabase = await clienteServidor()

  const [respuestaPendientes, respuestaArchivados] = await Promise.all([
    supabase.from('notices').select('*').is('leido_at', null).order('creado_at', { ascending: false }),
    supabase
      .from('notices')
      .select('*')
      .not('leido_at', 'is', null)
      .order('leido_at', { ascending: false })
      .limit(20),
  ])

  const pendientes = filas(respuestaPendientes, 'los avisos pendientes')
  const archivados = filas(respuestaArchivados, 'los avisos archivados')

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Avisos"
        bajada={
          pendientes.length === 0
            ? 'Nada sin atender'
            : `${pendientes.length} sin atender`
        }
      >
        {pendientes.length > 0 ? <ArchivarTodo /> : null}
      </Encabezado>

      {pendientes.length === 0 ? (
        <Vacio>
          Todo en orden. Aquí aparecen las publicaciones que fallaron, los videos que no bajaron de
          Drive y los accesos por vencer.
        </Vacio>
      ) : null}

      <div className="space-y-2">
        {pendientes.map((aviso) => (
          <article
            key={aviso.id}
            className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-linea bg-superficie p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta rotulo={TIPO_AVISO[aviso.tipo]} />
                <span className="text-xs text-tinta-3">{hace(aviso.creado_at)}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-tinta">{aviso.titulo}</p>
              {aviso.detalle ? <p className="mt-0.5 text-sm text-tinta-2">{aviso.detalle}</p> : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {aviso.piece_id ? (
                <Link
                  href={`/piezas/${aviso.piece_id}`}
                  className="rounded-lg border border-linea-fuerte bg-superficie px-3 py-1.5 text-xs font-medium text-tinta transition-colors hover:bg-hundido"
                >
                  Abrir la pieza
                </Link>
              ) : null}
              <Archivar avisoId={aviso.id} />
            </div>
          </article>
        ))}
      </div>

      {archivados.length > 0 ? (
        <details className="rounded-xl border border-linea bg-superficie">
          <summary className="cursor-pointer px-5 py-3 text-sm text-tinta-2 hover:text-tinta">
            Archivados ({archivados.length})
          </summary>
          <ul className="divide-y divide-linea border-t border-linea">
            {archivados.map((aviso) => (
              <li key={aviso.id} className="flex items-baseline justify-between gap-4 px-5 py-2.5">
                <span className="text-sm text-tinta-2">{aviso.titulo}</span>
                <span className="shrink-0 text-xs text-tinta-3">{hace(aviso.leido_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
