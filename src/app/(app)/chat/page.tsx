import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { Encabezado, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { RED, motivoLegible } from '@/lib/etiquetas'
import type { AutorMensaje } from '@/lib/database.types'
import { Conversaciones, type Conversacion, type Mensaje } from './conversaciones'

export const dynamic = 'force-dynamic'

/** El agente calla mientras la fecha guardada siga en el futuro. */
function enPausa(hasta: string | null): boolean {
  return Boolean(hasta && new Date(hasta) > new Date())
}

/**
 * Chat en vivo.
 *
 * Dos cosas distintas se leen igual, así que se muestran juntas.
 *
 * La primera es el motor de comentarios: alguien comentó la palabra clave y el
 * sistema le mandó el enlace. Se arma uniendo `comments` con `dm_log` por
 * persona y publicación, y ahí termina — es un turno, no una conversación.
 *
 * La segunda son los mensajes directos que atiende el agente desde n8n, en
 * `dm_threads` y `dm_messages`. Esos sí siguen: van y vienen, y el equipo puede
 * tomarlos a mano.
 */
export default async function ChatEnVivo() {
  const supabase = await clienteServidor()

  const comentarios = filas(
    await supabase.from('comments').select('*').order('detectado_at', { ascending: false }).limit(200),
    'las conversaciones',
  )

  const pubIds = [...new Set(comentarios.map((c) => c.publication_id))]
  const { data: publicaciones } = pubIds.length
    ? await supabase
        .from('publications')
        .select('id, piece_id, permalink, social_account_id')
        .in('id', pubIds)
    : { data: [] }

  const piezaIds = [...new Set((publicaciones ?? []).map((p) => p.piece_id))]
  const comentarioIds = comentarios.map((c) => c.id)

  const [
    { data: piezas },
    { data: claves },
    { data: plantillas },
    { data: enlaces },
    { data: cuentas },
    { data: envios },
  ] = await Promise.all([
    piezaIds.length ? supabase.from('pieces').select('id, tema').in('id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('keywords').select('*').in('piece_id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('dm_templates').select('*').in('piece_id', piezaIds) : { data: [] },
    piezaIds.length ? supabase.from('tracked_links').select('*').in('piece_id', piezaIds) : { data: [] },
    supabase.from('social_accounts').select('id, red'),
    comentarioIds.length ? supabase.from('dm_log').select('*').in('comment_id', comentarioIds) : { data: [] },
  ])

  /**
   * Una conversación es una persona en una publicación. La misma persona en dos
   * publicaciones son dos hilos: el contexto es la pieza, y mezclarlos haría
   * ilegible de qué se está hablando.
   */
  const porHilo = new Map<string, Conversacion>()

  for (const comentario of [...comentarios].reverse()) {
    const publicacion = (publicaciones ?? []).find((p) => p.id === comentario.publication_id)
    const pieza = (piezas ?? []).find((p) => p.id === publicacion?.piece_id)
    const clave = (claves ?? []).find((k) => k.piece_id === publicacion?.piece_id)
    const plantilla = (plantillas ?? []).find((p) => p.piece_id === publicacion?.piece_id)
    const enlace = (enlaces ?? []).find((e) => e.piece_id === publicacion?.piece_id)
    const cuenta = (cuentas ?? []).find((c) => c.id === publicacion?.social_account_id)

    const autor = comentario.autor_username ?? comentario.autor_external_id ?? 'sin autor'
    const hiloId = `${comentario.publication_id}:${comentario.autor_external_id ?? autor}`

    const necesitaMano = comentario.estado === 'manual_pendiente' || comentario.estado === 'fallido'

    const mensajes: Mensaje[] = [
      {
        id: comentario.id,
        deLaPersona: true,
        texto: comentario.texto,
        cuando: comentario.detectado_at,
        rotulo: 'Comentó',
        estado: comentario.estado,
        motivo: motivoLegible(comentario.motivo),
        fallo: null,
      },
    ]

    // Lo que el sistema le mandó, si llegó a mandarlo.
    for (const envio of (envios ?? []).filter((e) => e.comment_id === comentario.id)) {
      mensajes.push({
        id: envio.id,
        deLaPersona: false,
        texto: envio.mensaje,
        cuando: envio.enviado_at,
        rotulo: 'El sistema respondió',
        estado: null,
        motivo: null,
        fallo: envio.estado === 'fallido' ? (envio.error ?? 'no salió') : null,
      })
    }

    const existente = porHilo.get(hiloId)
    if (existente) {
      existente.mensajes.push(...mensajes)
      existente.ultimoAt = comentario.detectado_at
      existente.estado = comentario.estado
      existente.necesitaMano = existente.necesitaMano || necesitaMano
      continue
    }

    porHilo.set(hiloId, {
      clave: hiloId,
      origen: 'comentario',
      pausado: false,
      autor,
      red: cuenta ? RED[cuenta.red] : null,
      pieza: pieza?.tema ?? 'pieza sin nombre',
      piezaId: publicacion?.piece_id ?? null,
      permalink: publicacion?.permalink ?? null,
      palabra: clave?.palabra ?? null,
      clics: enlace?.clics ?? null,
      ultimoAt: comentario.detectado_at,
      estado: comentario.estado,
      necesitaMano,
      sugerida: (plantilla?.mensaje ?? 'Te dejo el recurso aquí: {enlace}').replace(
        '{enlace}',
        enlace ? `/r/${enlace.slug}` : (plantilla?.destino_url ?? ''),
      ),
      mensajes,
    })
  }

  // Los mensajes directos. A diferencia del comentario, aquí la conversación
  // sigue: cada hilo es una persona, no una persona en una publicación.
  const hilosDm = filas(
    await supabase.from('dm_threads').select('*').order('ultimo_at', { ascending: false }).limit(100),
    'los mensajes directos',
  )

  const { data: mensajesDm } = hilosDm.length
    ? await supabase
        .from('dm_messages')
        .select('*')
        .in(
          'thread_id',
          hilosDm.map((h) => h.id),
        )
        .order('enviado_at', { ascending: true })
    : { data: [] }

  const ROTULO: Record<AutorMensaje, string> = {
    persona: 'Escribió',
    agente: 'Respondió el agente',
    humano: 'Respondió el equipo',
  }

  for (const hilo of hilosDm) {
    const suyos = (mensajesDm ?? []).filter((m) => m.thread_id === hilo.id)

    porHilo.set(`dm:${hilo.id}`, {
      clave: `dm:${hilo.id}`,
      origen: 'dm',
      pausado: enPausa(hilo.agente_pausado_hasta),
      autor: hilo.contacto_username ?? hilo.contacto_external_id,
      red: RED.instagram,
      // Nada de esto aplica a un mensaje directo: no hay pieza, ni palabra
      // clave, ni enlace que contar. La pantalla los omite cuando vienen vacíos.
      pieza: null,
      piezaId: null,
      permalink: null,
      palabra: null,
      clics: null,
      ultimoAt: hilo.ultimo_at,
      estado: null,
      necesitaMano: false,
      sugerida: '',
      mensajes: suyos.map((mensaje) => ({
        id: mensaje.id,
        deLaPersona: mensaje.autor === 'persona',
        texto: mensaje.texto,
        cuando: mensaje.enviado_at,
        rotulo: ROTULO[mensaje.autor],
        estado: null,
        motivo: null,
        fallo: mensaje.error,
      })),
    })
  }

  // Lo más reciente arriba, y lo que pide una mano por encima de lo demás.
  const conversaciones = [...porHilo.values()].sort((a, b) => {
    if (a.necesitaMano !== b.necesitaMano) return a.necesitaMano ? -1 : 1
    return b.ultimoAt.localeCompare(a.ultimoAt)
  })

  const pendientes = conversaciones.filter((c) => c.necesitaMano).length

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Chat en vivo"
        bajada={
          conversaciones.length === 0
            ? 'Todavía sin conversaciones'
            : `${conversaciones.length} ${conversaciones.length === 1 ? 'conversación' : 'conversaciones'}${
                pendientes > 0 ? ` · ${pendientes} esperan tu mano` : ' · todas atendidas'
              }`
        }
      >
        {pendientes > 0 ? (
          <Link
            href="/bandeja"
            className="rounded-silk shadow-alzado bg-arcilla px-3.5 py-2 text-sm font-medium text-tinta transition-colors hover:bg-arcilla-alta"
          >
            Agrupar por motivo
          </Link>
        ) : null}
      </Encabezado>

      {conversaciones.length === 0 ? (
        <Vacio>
          Aquí aparecen dos cosas: quien comenta la palabra clave con el mensaje que el sistema le envía, y
          las conversaciones por mensaje directo que atiende el agente. Se llena solo.
        </Vacio>
      ) : (
        <Conversaciones conversaciones={conversaciones} />
      )}
    </div>
  )
}
