'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/server'
import { exigirRol, PUEDE_APROBAR, PUEDE_EDITAR } from '@/lib/sesion'
import { captionDeLaRed } from '@/lib/dominio/caption'
import { generarVariantes, normalizar } from '@/lib/dominio/clave'
import { envolver, exigirEscritura, type Respuesta } from './comunes'

/**
 * Módulo 2 · Preparación de la pieza, y Módulo 3 · Aprobación.
 *
 * Cada regla se valida aquí y otra vez en la base. Zod atrapa lo que llega mal
 * escrito, y los triggers atrapan lo que llegue por otro camino.
 */

const esquemaPieza = z.object({
  piezaId: z.string().uuid(),
  tema: z.string().min(3, 'El tema necesita al menos tres letras'),
  hook: z.string().optional(),
  captionBase: z.string().optional(),
  recursoId: z.string().uuid().nullable().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va en formato AAAA-MM-DD').nullable().optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'La hora va en formato HH:MM').nullable().optional(),
})

export async function guardarPieza(datos: FormData): Promise<Respuesta> {
  return envolver('Guardar la pieza', async () => {
    await exigirRol(...PUEDE_EDITAR)

    const entrada = esquemaPieza.parse({
      piezaId: datos.get('piezaId'),
      tema: datos.get('tema'),
      hook: datos.get('hook') || undefined,
      captionBase: datos.get('captionBase') || undefined,
      recursoId: datos.get('recursoId') || null,
      fecha: datos.get('fecha') || null,
      hora: datos.get('hora') || null,
    })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('pieces')
        .update({
          tema: entrada.tema,
          hook: entrada.hook ?? null,
          caption_base: entrada.captionBase ?? null,
          resource_id: entrada.recursoId ?? null,
          fecha_publicacion: entrada.fecha ?? null,
          hora_publicacion: entrada.hora ?? null,
        })
        .eq('id', entrada.piezaId)
        .select('id'),
      'Guardar la pieza',
    )

    revalidatePath(`/piezas/${entrada.piezaId}`)
    revalidatePath('/parrilla')
    return 'Pieza guardada'
  })
}

const esquemaClave = z.object({
  piezaId: z.string().uuid(),
  palabra: z.string().min(3, 'La palabra clave necesita al menos tres letras'),
  variantes: z.string().optional(),
  mensaje: z.string().min(10, 'El mensaje directo necesita al menos diez letras'),
  destinoWhatsapp: z.string().url('El destino de WhatsApp va como enlace completo'),
})

/** Slug corto y estable para el enlace rastreado. */
function slugDe(palabra: string, piezaId: string): string {
  return `${normalizar(palabra).toLowerCase().slice(0, 12)}-${piezaId.slice(0, 6)}`
}

export async function guardarAutomatizacion(datos: FormData): Promise<Respuesta> {
  return envolver('Guardar la automatización', async () => {
    await exigirRol('editora')

    const entrada = esquemaClave.parse({
      piezaId: datos.get('piezaId'),
      palabra: datos.get('palabra'),
      variantes: datos.get('variantes') || undefined,
      mensaje: datos.get('mensaje'),
      destinoWhatsapp: datos.get('destinoWhatsapp'),
    })

    const palabra = normalizar(entrada.palabra)
    if (palabra === '') throw new Error('La palabra clave queda vacía después de normalizar')

    // Las variantes escritas a mano mandan. Sin ellas, se derivan solas.
    const manuales = (entrada.variantes ?? '')
      .split(/[,\n]/)
      .map((v) => normalizar(v))
      .filter((v) => v !== '' && v !== palabra)
    const variantes = manuales.length > 0 ? [...new Set(manuales)] : generarVariantes(palabra)

    const supabase = await clienteServidor()
    const slug = slugDe(palabra, entrada.piezaId)

    // El texto prellenado de WhatsApp lleva la palabra: así el equipo comercial
    // sabe de qué pieza viene la persona.
    const destino = new URL(entrada.destinoWhatsapp)
    destino.searchParams.set('text', `Hola, vengo por ${palabra}`)

    exigirEscritura(
      await supabase
        .from('keywords')
        .upsert({ piece_id: entrada.piezaId, palabra, variantes }, { onConflict: 'piece_id' })
        .select('id'),
      'Guardar la palabra clave',
    )

    exigirEscritura(
      await supabase
        .from('dm_templates')
        .upsert(
          { piece_id: entrada.piezaId, mensaje: entrada.mensaje, destino_url: destino.toString() },
          { onConflict: 'piece_id' },
        )
        .select('id'),
      'Guardar el mensaje directo',
    )

    exigirEscritura(
      await supabase
        .from('tracked_links')
        .upsert({ piece_id: entrada.piezaId, slug, destino_url: destino.toString() }, { onConflict: 'piece_id' })
        .select('id'),
      'Guardar el enlace rastreado',
    )

    revalidatePath(`/piezas/${entrada.piezaId}`)
    return `Automatización lista con la palabra ${palabra}`
  })
}

/**
 * El paso que faltaba entre la hoja y la revisión de Karen. Lo da quien carga
 * el contenido, y por eso alcanza también al rol audiovisual.
 */
export async function enviarARevision(datos: FormData): Promise<Respuesta> {
  return envolver('Enviar a revisión', async () => {
    await exigirRol(...PUEDE_EDITAR)

    const { piezaId } = z.object({ piezaId: z.string().uuid() }).parse({ piezaId: datos.get('piezaId') })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('pieces')
        .update({ estado: 'revision' })
        .eq('id', piezaId)
        .eq('estado', 'borrador')
        .select('id'),
      'Enviar a revisión',
    )

    revalidatePath(`/piezas/${piezaId}`)
    revalidatePath('/parrilla')
    return 'Pieza enviada a revisión'
  })
}

export async function resolverPieza(datos: FormData): Promise<Respuesta> {
  return envolver('Resolver la pieza', async () => {
    const perfil = await exigirRol(...PUEDE_APROBAR)

    const entrada = z
      .object({
        piezaId: z.string().uuid(),
        accion: z.enum(['aprobar', 'devolver']),
        comentario: z.string().optional(),
      })
      .parse({
        piezaId: datos.get('piezaId'),
        accion: datos.get('accion'),
        comentario: datos.get('comentario') || undefined,
      })

    if (entrada.accion === 'devolver' && !entrada.comentario) {
      throw new Error('Una devolución va con el motivo escrito')
    }

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('approvals')
        .insert({
          piece_id: entrada.piezaId,
          usuario_id: perfil.id,
          accion: entrada.accion,
          comentario: entrada.comentario ?? null,
        })
        .select('id'),
      'Registrar la decisión',
    )

    revalidatePath('/parrilla')
    revalidatePath('/dia')
    return entrada.accion === 'aprobar' ? 'Pieza aprobada' : 'Pieza devuelta a revisión'
  })
}

/** Módulo 4 · el panel del día. Aprobar el día programa lo que va a salir. */
export async function programarDia(datos: FormData): Promise<Respuesta> {
  return envolver('Programar el día', async () => {
    await exigirRol('editora')

    const { fecha } = z
      .object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse({ fecha: datos.get('fecha') })

    const supabase = await clienteServidor()

    const { data: piezas, error } = await supabase
      .from('pieces')
      .select('id, hora_publicacion, brand_id, caption_base, captions_red')
      .eq('fecha_publicacion', fecha)
      .eq('estado', 'aprobado')
    if (error) throw new Error(error.message)
    if ((piezas ?? []).length === 0) throw new Error('No hay piezas aprobadas para ese día')

    let programadas = 0
    const problemas: string[] = []

    for (const pieza of piezas ?? []) {
      const { data: cuentas } = await supabase
        .from('social_accounts')
        .select('id, red')
        .eq('brand_id', pieza.brand_id)
        .eq('activa', true)

      if ((cuentas ?? []).length === 0) {
        problemas.push('una pieza quedó sin cuentas activas')
        continue
      }

      const programadoAt = new Date(`${fecha}T${pieza.hora_publicacion ?? '18:00'}:00-05:00`).toISOString()

      for (const cuenta of cuentas ?? []) {
        const captionFinal = captionDeLaRed(cuenta.red, pieza.captions_red, pieza.caption_base)

        await supabase
          .from('publications')
          .upsert(
            {
              piece_id: pieza.id,
              social_account_id: cuenta.id,
              estado: 'pendiente',
              programado_at: programadoAt,
              caption_final: captionFinal,
            },
            { onConflict: 'piece_id,social_account_id' },
          )
      }

      // El trigger de la base exige palabra clave, mensaje y enlace aquí.
      const { error: fallo } = await supabase
        .from('pieces')
        .update({ estado: 'programado' })
        .eq('id', pieza.id)

      if (fallo) problemas.push(fallo.message)
      else programadas++
    }

    revalidatePath('/dia')
    const cola = problemas.length > 0 ? ` · pendiente: ${problemas.join('; ')}` : ''
    return `${programadas} piezas programadas para el ${fecha}${cola}`
  })
}

export async function atenderComentarioManual(datos: FormData): Promise<Respuesta> {
  return envolver('Marcar el comentario', async () => {
    await exigirRol('editora')

    const { comentarioId } = z
      .object({ comentarioId: z.string().uuid() })
      .parse({ comentarioId: datos.get('comentarioId') })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('comments')
        .update({ estado: 'respondido', respondido_at: new Date().toISOString() })
        .eq('id', comentarioId)
        .select('id'),
      'Marcar el comentario',
    )

    revalidatePath('/bandeja')
    return 'Comentario marcado como atendido'
  })
}
