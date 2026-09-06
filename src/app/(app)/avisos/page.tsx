import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { Vacio } from '@/app/ui'
import { Archivar, ArchivarTodo } from './archivar'

export const dynamic = 'force-dynamic'

const TITULOS: Record<string, string> = {
  publicacion_fallida: 'Publicación fallida',
  borrador_tiktok: 'Borrador en TikTok',
  token_por_vencer: 'Acceso por vencer',
  bandeja_con_espera: 'Bandeja con espera',
  cupo_agotado: 'Cupo agotado',
}

export default async function Avisos() {
  const supabase = await clienteServidor()

  const [{ data: pendientes }, { data: archivados }] = await Promise.all([
    supabase.from('notices').select('*').is('leido_at', null).order('creado_at', { ascending: false }),
    supabase
      .from('notices')
      .select('*')
      .not('leido_at', 'is', null)
      .order('leido_at', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Avisos</h1>
          <p className="text-sm text-neutral-500">
            {(pendientes ?? []).length} sin atender
          </p>
        </div>
        {(pendientes ?? []).length > 0 ? <ArchivarTodo /> : null}
      </header>

      {(pendientes ?? []).length === 0 ? <Vacio>Nada pendiente por ahora.</Vacio> : null}

      <div className="space-y-2">
        {(pendientes ?? []).map((aviso) => (
          <article
            key={aviso.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div className="min-w-0">
              <p className="text-xs text-neutral-500">{TITULOS[aviso.tipo] ?? aviso.tipo}</p>
              <p className="text-sm font-medium">{aviso.titulo}</p>
              {aviso.detalle ? <p className="mt-1 text-sm text-neutral-600">{aviso.detalle}</p> : null}
              <p className="mt-1 text-xs text-neutral-400">{aviso.creado_at.slice(0, 16).replace('T', ' ')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {aviso.piece_id ? (
                <Link
                  href={`/piezas/${aviso.piece_id}`}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs"
                >
                  Abrir
                </Link>
              ) : null}
              <Archivar avisoId={aviso.id} />
            </div>
          </article>
        ))}
      </div>

      {(archivados ?? []).length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-neutral-500">Archivados</summary>
          <ul className="mt-2 space-y-1 text-sm text-neutral-500">
            {(archivados ?? []).map((aviso) => (
              <li key={aviso.id}>{aviso.titulo}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
