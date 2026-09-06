import { clienteServidor } from '@/lib/supabase/server'
import { Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { Fila } from './fila'

export const dynamic = 'force-dynamic'

/**
 * Módulo 5 · Bandeja manual.
 *
 * Aquí cae lo que el motor no pudo responder solo: TikTok, que carece de API de
 * respuesta, los comentarios que pasaron la ventana de siete días de Meta, y el
 * desborde del cupo diario de YouTube. Cada caso llega con la respuesta lista
 * para copiar, de modo que atenderlo tome segundos.
 */
export default async function Bandeja() {
  const supabase = await clienteServidor()

  const comentarios = filas(
    await supabase
      .from('comments')
      .select('*')
      .in('estado', ['manual_pendiente', 'fallido'])
      .order('detectado_at', { ascending: false })
      .limit(200),
    'la bandeja',
  )

  const pubIds = [...new Set(comentarios.map((c) => c.publication_id))]
  const { data: publicaciones } = pubIds.length
    ? await supabase.from('publications').select('id, piece_id, permalink').in('id', pubIds)
    : { data: [] }

  const piezaIds = [...new Set((publicaciones ?? []).map((p) => p.piece_id))]
  const [{ data: piezas }, { data: plantillas }, { data: enlaces }] = await Promise.all([
    piezaIds.length ? supabase.from('pieces').select('id, tema').in('id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('dm_templates').select('*').in('piece_id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('tracked_links').select('*').in('piece_id', piezaIds) : { data: [] },
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Bandeja manual</h1>
        <p className="text-sm text-neutral-500">
          Lo que necesita una mano: TikTok, la ventana vencida de Meta y el desborde de cuota.
        </p>
      </header>

      {comentarios.length === 0 ? <Vacio>La bandeja está al día.</Vacio> : null}

      <div className="space-y-2">
        {comentarios.map((comentario) => {
          const publicacion = (publicaciones ?? []).find((p) => p.id === comentario.publication_id)
          const pieza = (piezas ?? []).find((p) => p.id === publicacion?.piece_id)
          const plantilla = (plantillas ?? []).find((p) => p.piece_id === publicacion?.piece_id)
          const enlace = (enlaces ?? []).find((e) => e.piece_id === publicacion?.piece_id)

          const sugerida = (plantilla?.mensaje ?? 'Te dejo el recurso aquí: {enlace}').replace(
            '{enlace}',
            enlace ? `/r/${enlace.slug}` : (plantilla?.destino_url ?? ''),
          )

          return (
            <Fila
              key={comentario.id}
              comentarioId={comentario.id}
              autor={comentario.autor_username ?? 'sin autor'}
              texto={comentario.texto}
              motivo={
                comentario.intentos_dm > 0
                  ? `${comentario.motivo ?? comentario.estado} · ${comentario.intentos_dm} intentos`
                  : (comentario.motivo ?? comentario.estado)
              }
              pieza={pieza?.tema ?? 'pieza sin nombre'}
              permalink={publicacion?.permalink ?? null}
              sugerida={sugerida}
            />
          )
        })}
      </div>
    </div>
  )
}
