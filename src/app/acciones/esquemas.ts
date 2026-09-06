import { z } from 'zod'
import { referenciaValida, motivoDeReferenciaInvalida } from '@/lib/seguridad'

/**
 * Los esquemas de entrada, aparte de las acciones.
 *
 * Viven fuera del archivo con 'use server' para poder probarlos: son la primera
 * barrera contra lo que llega mal escrito, y estaban sin una sola prueba.
 * Los mensajes se leen en pantalla, así que dicen qué hacer, no qué falló.
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

export const esquemaPieza = z.object({
  piezaId: z.string().uuid(),
  tema: z.string().min(3, 'El tema necesita al menos tres letras'),
  hook: z.string().optional(),
  captionBase: z.string().optional(),
  recursoId: z.string().uuid().nullable().optional(),
  fecha: z.string().regex(FECHA, 'La fecha va en formato AAAA-MM-DD').nullable().optional(),
  hora: z.string().regex(HORA, 'La hora va en formato HH:MM').nullable().optional(),
})

export const esquemaAutomatizacion = z.object({
  piezaId: z.string().uuid(),
  palabra: z.string().min(3, 'La palabra clave necesita al menos tres letras'),
  variantes: z.string().optional(),
  mensaje: z.string().min(10, 'El mensaje directo necesita al menos diez letras'),
  destinoWhatsapp: z.string().url('El destino de WhatsApp va como enlace completo'),
})

export const esquemaRevision = z.object({
  piezaId: z.string().uuid(),
  accion: z.enum(['aprobar', 'devolver']),
  comentario: z.string().optional(),
})

export const esquemaNuevaPieza = z.object({
  marcaId: z.string().uuid(),
  tema: z.string().min(3, 'El tema necesita al menos tres letras'),
  fecha: z.string().regex(FECHA).nullable(),
})

export const esquemaRecurso = z.object({
  marcaId: z.string().uuid(),
  titulo: z.string().min(3, 'El título necesita al menos tres letras'),
  tipo: z.enum(['pdf', 'skill', 'html', 'artefacto', 'video']),
  url: z.string().url('El recurso va con su enlace completo'),
  seccion: z.string().optional(),
  descripcion: z.string().optional(),
})

export const esquemaCuenta = z.object({
  marcaId: z.string().uuid(),
  red: z.enum(['instagram', 'tiktok', 'youtube']),
  handle: z.string().min(2, 'El handle necesita al menos dos letras'),
  externalAccountId: z.string().min(1, 'Falta el id de la cuenta en la plataforma'),
  credentialRef: z.string().superRefine((referencia, control) => {
    if (referenciaValida(referencia)) return
    control.addIssue({ code: 'custom', message: motivoDeReferenciaInvalida(referencia) })
  }),
  tokenExpiraAt: z.string().regex(FECHA).nullable(),
})

export const esquemaMarca = z.object({
  nombre: z.string().min(2, 'El nombre necesita al menos dos letras'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'El slug va en minúsculas, con números y guiones'),
  sheetId: z.string().optional(),
  sheetTab: z.string().optional(),
  whatsappUrl: z.string().url('El WhatsApp va como enlace completo').optional().or(z.literal('')),
})

export const esquemaRol = z.object({
  personaId: z.string().uuid(),
  rol: z.enum(['editora', 'aprobadora', 'audiovisual', 'observador']),
})

/**
 * Las variantes que la persona escribe a mano, separadas por coma o por salto
 * de línea. La normalización y el descarte de la propia palabra los hace quien
 * llama, porque esa regla vive en el dominio.
 */
export function partirVariantes(entrada: string | undefined): string[] {
  return (entrada ?? '')
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter((v) => v !== '')
}
