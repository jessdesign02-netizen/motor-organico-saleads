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
      const { count } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('publication_id', publicationId)
        .eq('autor_external_id', autorExternalId)
        .eq('estado', 'respondido')
      return (count ?? 0) > 0
    },

    async marcar(comentarioId, estado, motivo) {
      const destino = A_ESTADO[estado] ?? 'detectado'
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
