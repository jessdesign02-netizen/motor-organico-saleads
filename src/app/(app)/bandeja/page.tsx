import { clienteServidor } from '@/lib/supabase/server'
import { Encabezado, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { RED, motivoLegible } from '@/lib/etiquetas'
import { Fila } from './fila'

export const dynamic = 'force-dynamic'

/**
 * Módulo 5 · Bandeja manual.
 *
 * Aquí cae lo que el motor no pudo responder solo. Antes llegaban las cuatro
 * clases de caso mezcladas y con la misma pinta, y no lo son: unas piden que la
 * persona escriba, otras solo esperan a que el sistema reintente. Ahora van
 * agrupadas por lo que hay que hacer con ellas.
 */

/** El orden es el de la urgencia: primero lo que nadie va a resolver solo. */
const GRUPOS = [
  {
    clave: 'sin_api',
    titulo: 'La red no permite responder',
    explica: 'TikTok no tiene API de respuesta. Estos hay que contestarlos desde la app, a mano.',
    de: (motivo: string | null) => motivo === 'la red carece de API de respuesta',
  },
  {
    clave: 'cupo',
    titulo: 'Se acabó el cupo del día',
    explica: 'YouTube permite 150 respuestas diarias. El resto espera a mañana o se contesta a mano.',
    de: (motivo: string | null) => motivo === 'cupo diario de la plataforma agotado',
  },
  {
    clave: 'ventana',
    titulo: 'Pasaron los 7 días de Meta',
    explica: 'Meta cierra la respuesta privada a la semana del comentario. Ya no se puede automatizar.',
    de: (motivo: string | null) => motivo === 'ventana_vencida',
  },
] as const

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
    ? await supabase
        .from('publications')
        .select('id, piece_id, permalink, social_account_id')
        .in('id', pubIds)
    : { data: [] }

  const piezaIds = [...new Set((publicaciones ?? []).map((p) => p.piece_id))]
  const [{ data: piezas }, { data: plantillas }, { data: enlaces }, { data: cuentas }] = await Promise.all([
    piezaIds.length ? supabase.from('pieces').select('id, tema').in('id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('dm_templates').select('*').in('piece_id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('tracked_links').select('*').in('piece_id', piezaIds) : { data: [] },
    supabase.from('social_accounts').select('id, red'),
  ])

  const armar = (comentario: (typeof comentarios)[number]) => {
    const publicacion = (publicaciones ?? []).find((p) => p.id === comentario.publication_id)
    const plantilla = (plantillas ?? []).find((p) => p.piece_id === publicacion?.piece_id)
    const enlace = (enlaces ?? []).find((e) => e.piece_id === publicacion?.piece_id)
    const cuenta = (cuentas ?? []).find((c) => c.id === publicacion?.social_account_id)

    return {
      comentarioId: comentario.id,
      autor: comentario.autor_username ?? 'sin autor',
      texto: comentario.texto,
      motivo: motivoLegible(comentario.motivo) ?? '',
      intentos: comentario.intentos_dm,
      red: cuenta ? RED[cuenta.red] : null,
      pieza: (piezas ?? []).find((p) => p.id === publicacion?.piece_id)?.tema ?? 'pieza sin nombre',
      permalink: publicacion?.permalink ?? null,
      sugerida: (plantilla?.mensaje ?? 'Te dejo el recurso aquí: {enlace}').replace(
        '{enlace}',
        enlace ? `/r/${enlace.slug}` : (plantilla?.destino_url ?? ''),
      ),
    }
  }

  const enGrupo = GRUPOS.map((grupo) => ({
    ...grupo,
    casos: comentarios.filter((c) => grupo.de(c.motivo)).map(armar),
  }))

  // Lo que la plataforma rechazó vuelve a la cola solo. Va aparte y al final,
  // porque no pide nada de nadie: llamarlo "pendiente" hacía perder tiempo.
  const reintentando = comentarios.filter((c) => c.estado === 'fallido').map(armar)
  const cubiertos = new Set([...enGrupo.flatMap((g) => g.casos), ...reintentando].map((c) => c.comentarioId))
  const otros = comentarios.filter((c) => !cubiertos.has(c.id)).map(armar)

  const porAtender = enGrupo.reduce((n, g) => n + g.casos.length, 0) + otros.length

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Bandeja manual"
        bajada={
          porAtender === 0
            ? 'Nada que responder a mano'
            : `${porAtender} ${porAtender === 1 ? 'comentario espera' : 'comentarios esperan'} tu respuesta`
        }
      />

      {comentarios.length === 0 ? (
        <Vacio>
          La bandeja está al día. Aquí caen los comentarios que el sistema no puede responder solo.
        </Vacio>
      ) : null}

      {enGrupo
        .filter((grupo) => grupo.casos.length > 0)
        .map((grupo) => (
          <section key={grupo.clave} className="space-y-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-tinta">
                {grupo.titulo}
                <span className="ml-2 rounded-full bg-arcilla-alta px-2 py-0.5 text-xs font-medium tabular-nums text-tinta-2">
                  {grupo.casos.length}
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-tinta-2">{grupo.explica}</p>
            </div>
            <div className="space-y-2">
              {grupo.casos.map((caso) => (
                <Fila key={caso.comentarioId} {...caso} />
              ))}
            </div>
          </section>
        ))}

      {otros.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight text-tinta">Otros casos</h2>
          <div className="space-y-2">
            {otros.map((caso) => (
              <Fila key={caso.comentarioId} {...caso} />
            ))}
          </div>
        </section>
      ) : null}

      {reintentando.length > 0 ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-tinta">
              El sistema los reintenta solo
              <span className="ml-2 rounded-full bg-arcilla-alta px-2 py-0.5 text-xs font-medium tabular-nums text-tinta-2">
                {reintentando.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-tinta-2">
              La plataforma rechazó el envío por límite de tasa. Vuelven a la cola a los 2, 8 y 30 minutos. No
              hay que hacer nada, salvo que agoten los tres intentos.
            </p>
          </div>
          <div className="space-y-2">
            {reintentando.map((caso) => (
              <Fila key={caso.comentarioId} {...caso} enEspera />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
