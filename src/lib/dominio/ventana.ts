/**
 * Ventana de respuesta privada de Instagram.
 *
 * Meta cuenta 7 días desde la creación del comentario, no desde que el webhook
 * llegó. Fuente: developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
 * El detalle está en docs/00-verificacion-tecnica.md.
 */

export const DIAS_VENTANA_RESPUESTA = 7
const MS_POR_DIA = 24 * 60 * 60 * 1000

export function limiteDeVentana(creadoEn: Date): Date {
  return new Date(creadoEn.getTime() + DIAS_VENTANA_RESPUESTA * MS_POR_DIA)
}

export function dentroDeVentana(creadoEn: Date, ahora: Date = new Date()): boolean {
  return ahora.getTime() < limiteDeVentana(creadoEn).getTime()
}

/**
 * Regla 6 de la especificación, precisada con el límite real de la plataforma:
 * la publicación antigua sigue atendida mientras el comentario sea reciente y
 * la palabra clave esté vigente.
 */
export function puedeResponder(argumentos: {
  comentarioCreadoEn: Date
  claveActivaDesde: Date | null
  claveActivaHasta: Date | null
  ahora?: Date
}): { puede: boolean; motivo: string | null } {
  const ahora = argumentos.ahora ?? new Date()

  if (!dentroDeVentana(argumentos.comentarioCreadoEn, ahora)) {
    return { puede: false, motivo: 'ventana_vencida' }
  }
  if (argumentos.claveActivaDesde && ahora < argumentos.claveActivaDesde) {
    return { puede: false, motivo: 'clave_sin_activar' }
  }
  if (argumentos.claveActivaHasta && ahora >= argumentos.claveActivaHasta) {
    return { puede: false, motivo: 'clave_vencida' }
  }
  return { puede: true, motivo: null }
}
