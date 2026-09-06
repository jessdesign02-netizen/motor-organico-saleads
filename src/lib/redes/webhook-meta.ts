import type { ComentarioEntrante } from './tipos'

/**
 * Lectura del webhook de comentarios de Meta.
 *
 * Es la puerta por donde entra cada lead, así que trata la carga como lo que es:
 * texto que llega de afuera y puede venir de cualquier forma. Lo que no se
 * entiende se descarta con su motivo, en lugar de romper la entrega entera y
 * hacer que Meta reintente el lote completo.
 */

export type CambioMeta = {
  field?: string
  value?: {
    id?: string
    text?: string
    media?: { id?: string }
    from?: { id?: string; username?: string }
    created_time?: number
    /** Meta marca así los comentarios que la propia cuenta escribe. */
    parent_id?: string
  }
}

export type CargaMeta = {
  object?: string
  entry?: Array<{ id?: string; time?: number; changes?: CambioMeta[] }>
}

export type ComentarioDelWebhook = ComentarioEntrante & { externalPostId: string }

export type LecturaWebhook = {
  comentarios: ComentarioDelWebhook[]
  /** Lo que se descartó, y por qué. Sirve para diagnosticar sin adivinar. */
  descartados: Array<{ motivo: string; id?: string }>
}

export function leerCargaMeta(carga: unknown, ahora: Date = new Date()): LecturaWebhook {
  const salida: LecturaWebhook = { comentarios: [], descartados: [] }

  if (typeof carga !== 'object' || carga === null) {
    salida.descartados.push({ motivo: 'la carga no es un objeto' })
    return salida
  }

  const datos = carga as CargaMeta

  // Meta manda otros objetos por el mismo webhook. Solo interesa Instagram.
  if (datos.object && datos.object !== 'instagram') {
    salida.descartados.push({ motivo: `la carga es de ${datos.object}, no de instagram` })
    return salida
  }

  if (!Array.isArray(datos.entry)) {
    salida.descartados.push({ motivo: 'la carga llega sin entradas' })
    return salida
  }

  for (const entrada of datos.entry) {
    if (!Array.isArray(entrada?.changes)) {
      salida.descartados.push({ motivo: 'la entrada llega sin cambios', id: entrada?.id })
      continue
    }

    for (const cambio of entrada.changes) {
      // El mismo webhook entrega mensajes, menciones y otros campos.
      if (cambio?.field !== 'comments') {
        salida.descartados.push({ motivo: `campo ${cambio?.field ?? 'sin nombre'}` })
        continue
      }

      const valor = cambio.value
      if (!valor?.id) {
        salida.descartados.push({ motivo: 'el comentario llega sin identificador' })
        continue
      }
      if (!valor.media?.id) {
        salida.descartados.push({ motivo: 'el comentario llega sin publicación', id: valor.id })
        continue
      }

      salida.comentarios.push({
        externalCommentId: valor.id,
        externalPostId: valor.media.id,
        autorUsername: valor.from?.username ?? null,
        autorExternalId: valor.from?.id ?? null,
        texto: typeof valor.text === 'string' ? valor.text : '',
        // Meta manda segundos; JavaScript cuenta milisegundos.
        creadoEn: valor.created_time ? new Date(valor.created_time * 1000) : ahora,
      })
    }
  }

  return salida
}

/**
 * Descarta los comentarios que la propia marca escribió.
 *
 * Responder al propio equipo gastaría el único mensaje que la ventana permite,
 * y dejaría a esa persona sin poder recibirlo si comenta de verdad.
 */
export function sinLosPropios(
  comentarios: readonly ComentarioDelWebhook[],
  cuentasPropias: readonly string[],
): ComentarioDelWebhook[] {
  const propias = new Set(cuentasPropias)
  return comentarios.filter((c) => c.autorExternalId === null || !propias.has(c.autorExternalId))
}
