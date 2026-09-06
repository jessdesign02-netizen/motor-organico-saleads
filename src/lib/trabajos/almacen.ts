import 'server-only'
import type { EstadoComentario, RedSocial } from '@/lib/database.types'
import { clienteAdmin } from '@/lib/supabase/admin'
import type { ComentarioEntrante } from '@/lib/redes'
import type { AlmacenMotor, ResueltoComentario } from './motor'

/**
 * Puente entre el motor y la base. Traduce los desenlaces del motor a los
 * estados de la tabla `comments`, y se apoya en las restricciones únicas para
 * cerrar la carrera entre el webhook y el sondeo.
 */

const A_ESTADO: Record<ResueltoComentario, EstadoComentario> = {
  respondido: 'respondido',
  duplicado: 'ignorado',
  autor_repetido: 'ignorado',
  sin_coincidencia: 'ignorado',
  ventana_vencida: 'manual_pendiente',
  clave_sin_activar: 'detectado',
  clave_vencida: 'ignorado',
  manual_pendiente: 'manual_pendiente',
  fallido: 'fallido',
}

export function almacenReal(keywordId: string | null): AlmacenMotor {
  const supabase = clienteAdmin()

  /**
   * Autores ya atendidos, por publicación.
   *
   * Preguntar uno por uno costaba una consulta por comentario: en el pico de
   * 300 eran 300 viajes a la base solo para esta comprobación. La lista entera
   * de una publicación cabe en una consulta, y el motor responde a los 300
   * comentarios sin volver a preguntar.
   */
  const atendidosPorPublicacion = new Map<string, Set<string>>()

  async function autoresAtendidos(publicationId: string): Promise<Set<string>> {
    const enMemoria = atendidosPorPublicacion.get(publicationId)
    if (enMemoria) return enMemoria

    const { data } = await supabase
      .from('comments')
      .select('autor_external_id')
      .eq('publication_id', publicationId)
      .eq('estado', 'respondido')
      .not('autor_external_id', 'is', null)

    const conjunto = new Set((data ?? []).map((c) => c.autor_external_id).filter((id): id is string => id !== null))
    atendidosPorPublicacion.set(publicationId, conjunto)
    return conjunto
  }

  return {
    async registrar(publicationId, comentario: ComentarioEntrante, coincidio) {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          publication_id: publicationId,
          external_comment_id: comentario.externalCommentId,
          autor_username: comentario.autorUsername,
          autor_external_id: comentario.autorExternalId,
          texto: comentario.texto,
          keyword_id: coincidio ? keywordId : null,
          estado: 'detectado',
          detectado_at: comentario.creadoEn.toISOString(),
        })
        .select('id')
        .single()

      if (!error && data) return { nuevo: true, comentarioId: data.id }

      // 23505: la restricción única lo atrapó, así que otra pasada ya lo tiene.
      const { data: existente } = await supabase
        .from('comments')
        .select('id')
        .eq('publication_id', publicationId)
        .eq('external_comment_id', comentario.externalCommentId)
        .single()

      if (existente) return { nuevo: false, comentarioId: existente.id }
      throw new Error(error?.message ?? 'El comentario no se pudo registrar')
    },

    async autorYaAtendido(publicationId, autorExternalId) {
      if (!autorExternalId) return false
      return (await autoresAtendidos(publicationId)).has(autorExternalId)
    },

    async marcar(comentarioId, estado, motivo) {
      const destino = A_ESTADO[estado] ?? 'detectado'

      // La lista en memoria se actualiza con lo que acaba de responderse: sin
      // esto, dos comentarios del mismo autor dentro del lote la verían vieja.
      if (destino === 'respondido') {
        const { data } = await supabase
          .from('comments')
          .select('publication_id, autor_external_id')
          .eq('id', comentarioId)
          .single()

        if (data?.autor_external_id) {
          const conjunto = atendidosPorPublicacion.get(data.publication_id)
          if (conjunto) conjunto.add(data.autor_external_id)
        }
      }

      await supabase
        .from('comments')
        .update({
          estado: destino as EstadoComentario,
          respondido_at: estado === 'respondido' ? new Date().toISOString() : null,
          motivo: motivo ?? null,
        })
        .eq('id', comentarioId)
    },

    async anotarEnvio(comentarioId, datos) {
      await supabase.from('dm_log').insert({
        comment_id: comentarioId,
        destinatario: datos.destinatario,
        mensaje: datos.mensaje,
        estado: datos.estado,
        error: datos.error ?? null,
      })
    },

    async respuestasDeHoy(red: RedSocial) {
      const inicioDelDia = new Date()
      inicioDelDia.setUTCHours(0, 0, 0, 0)

      const { data: cuentas } = await supabase.from('social_accounts').select('id').eq('red', red)
      const ids = (cuentas ?? []).map((c) => c.id)
      if (ids.length === 0) return 0

      const { data: publicaciones } = await supabase
        .from('publications')
        .select('id')
        .in('social_account_id', ids)
      const pubIds = (publicaciones ?? []).map((p) => p.id)
      if (pubIds.length === 0) return 0

      const { count } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .in('publication_id', pubIds)
        .eq('estado', 'respondido')
        .gte('respondido_at', inicioDelDia.toISOString())

      return count ?? 0
    },
  }
}
