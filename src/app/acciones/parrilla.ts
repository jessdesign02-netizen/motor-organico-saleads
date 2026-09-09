'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/server'
import { exigirRol, PUEDE_APROBAR, PUEDE_EDITAR } from '@/lib/sesion'
import { excedeLaRed, limpiarCaptions } from '@/lib/dominio/caption'
import { lunesDe, recalcularSemana } from '@/lib/dominio/semana'
import type { RedSocial } from '@/lib/database.types'
import { esquemaNuevaPieza, esquemaRecurso } from './esquemas'
import { envolver, exigirEscritura, type Respuesta } from './comunes'

/**
 * Entrega 8 · Lo que faltaba de los módulos 1, 3 y 6:
 * crear piezas dentro de la app, aprobar la semana en bloque, el recorrido de
 * fechas asistido tras una devolución, y la confirmación de un cambio de la
 * hoja sobre una pieza ya aprobada.
 */

export async function crearPieza(datos: FormData): Promise<Respuesta> {
  return envolver('Crear la pieza', async () => {
    await exigirRol(...PUEDE_EDITAR)

    const entrada = esquemaNuevaPieza.parse({
      marcaId: datos.get('marcaId'),
      tema: datos.get('tema'),
      fecha: datos.get('fecha') || null,
    })

    const supabase = await clienteServidor()
    const semana = entrada.fecha ? lunesDe(new Date(`${entrada.fecha}T12:00:00Z`)) : lunesDe(new Date())

    exigirEscritura(
      await supabase
        .from('pieces')
        .insert({
          brand_id: entrada.marcaId,
          tema: entrada.tema,
          fecha_publicacion: entrada.fecha,
          semana,
          origen: 'app',
          estado: 'borrador',
        })
        .select('id'),
      'Crear la pieza',
    )

    revalidatePath('/parrilla')
    return `Pieza "${entrada.tema}" creada`
  })
}

/** Módulo 3 · aprobación en bloque, para que Karen resuelva la semana de una vez. */
export async function aprobarSeleccion(datos: FormData): Promise<Respuesta> {
  return envolver('Aprobar la selección', async () => {
    const perfil = await exigirRol(...PUEDE_APROBAR)

    const ids = datos
      .getAll('piezaId')
      .map(String)
      .filter((id) => id !== '')
    if (ids.length === 0) throw new Error('Marca al menos una pieza')

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('approvals')
        .insert(ids.map((id) => ({ piece_id: id, usuario_id: perfil.id, accion: 'aprobar' as const })))
        .select('id'),
      'Registrar las aprobaciones',
    )

    revalidatePath('/parrilla')
    return `${ids.length} ${ids.length === 1 ? 'pieza aprobada' : 'piezas aprobadas'}`
  })
}

/**
 * Módulo 3 · el recorrido de fechas asistido.
 *
 * La devolución ya liberó la fecha de la pieza. Esto propone cómo queda el
 * resto de la semana, y guarda la propuesta sin aplicarla: la confirmación es
 * de la persona, en un clic.
 */
export async function proponerCalendario(datos: FormData): Promise<Respuesta> {
  return envolver('Proponer el calendario', async () => {
    const perfil = await exigirRol(...PUEDE_APROBAR)

    const entrada = z
      .object({
        marcaId: z.string().uuid(),
        semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        devueltaId: z.string().uuid(),
      })
      .parse({
        marcaId: datos.get('marcaId'),
        semana: datos.get('semana'),
        devueltaId: datos.get('devueltaId'),
      })

    const supabase = await clienteServidor()
    const { data: piezas } = await supabase
      .from('pieces')
      .select('id, tema, fecha_publicacion')
      .eq('brand_id', entrada.marcaId)
      .eq('semana', entrada.semana)
      // Una pieza ya programada tiene su hora copiada en publications: moverle
      // la fecha aquí dejaría las dos cosas en desacuerdo. El recorrido alcanza
      // solo lo que todavía no salió a la cola.
      .in('estado', ['aprobado', 'borrador', 'revision'])

    const propuesta = recalcularSemana(
      (piezas ?? []).map((p) => ({ id: p.id, fecha: p.fecha_publicacion })),
      entrada.devueltaId,
      entrada.semana,
    ).map((linea) => ({
      ...linea,
      tema: (piezas ?? []).find((p) => p.id === linea.id)?.tema ?? '',
    }))

    if (propuesta.length === 0) throw new Error('La semana se queda sin piezas que correr')

    exigirEscritura(
      await supabase
        .from('calendar_proposals')
        .upsert(
          {
            brand_id: entrada.marcaId,
            semana: entrada.semana,
            propuesta,
            motivo: 'una pieza volvió a revisión',
            creada_por: perfil.id,
            aplicada_at: null,
          },
          { onConflict: 'brand_id,semana' },
        )
        .select('id'),
      'Guardar la propuesta',
    )

    revalidatePath('/parrilla')
    return `Propuesta lista para ${propuesta.length} piezas`
  })
}

export async function aplicarCalendario(datos: FormData): Promise<Respuesta> {
  return envolver('Aplicar el calendario', async () => {
    await exigirRol(...PUEDE_APROBAR)

    const { propuestaId } = z
      .object({ propuestaId: z.string().uuid() })
      .parse({ propuestaId: datos.get('propuestaId') })

    const supabase = await clienteServidor()
    const { data: propuesta } = await supabase
      .from('calendar_proposals')
      .select('*')
      .eq('id', propuestaId)
      .single()

    if (!propuesta) throw new Error('La propuesta ya no existe')
    if (propuesta.aplicada_at) throw new Error('Esa propuesta ya se aplicó')

    for (const linea of propuesta.propuesta) {
      exigirEscritura(
        await supabase
          .from('pieces')
          .update({ fecha_publicacion: linea.fecha })
          .eq('id', linea.id)
          .in('estado', ['aprobado', 'borrador', 'revision'])
          .select('id'),
        `Mover "${linea.tema}" al ${linea.fecha}`,
      )
    }

    exigirEscritura(
      await supabase
        .from('calendar_proposals')
        .update({ aplicada_at: new Date().toISOString() })
        .eq('id', propuestaId)
        .select('id'),
      'Cerrar la propuesta',
    )

    revalidatePath('/parrilla')
    return `Calendario aplicado a ${propuesta.propuesta.length} piezas`
  })
}

export async function descartarCalendario(datos: FormData): Promise<Respuesta> {
  return envolver('Descartar la propuesta', async () => {
    await exigirRol(...PUEDE_APROBAR)
    const { propuestaId } = z
      .object({ propuestaId: z.string().uuid() })
      .parse({ propuestaId: datos.get('propuestaId') })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase.from('calendar_proposals').delete().eq('id', propuestaId).select('id'),
      'Descartar la propuesta',
    )

    revalidatePath('/parrilla')
    return 'Propuesta descartada. La semana queda como estaba'
  })
}

/**
 * Caso especial de la sección 7: la hoja cambió con la pieza ya aprobada.
 * El cambio esperaba apartado, y aquí se acepta o se descarta.
 */
export async function resolverCambioDeHoja(datos: FormData): Promise<Respuesta> {
  return envolver('Resolver el cambio de la hoja', async () => {
    await exigirRol(...PUEDE_APROBAR)

    const entrada = z
      .object({ piezaId: z.string().uuid(), decision: z.enum(['aceptar', 'descartar']) })
      .parse({ piezaId: datos.get('piezaId'), decision: datos.get('decision') })

    const supabase = await clienteServidor()
    const { data: pieza } = await supabase
      .from('pieces')
      .select('sheet_pendiente')
      .eq('id', entrada.piezaId)
      .single()

    if (!pieza?.sheet_pendiente) throw new Error('Esa pieza no tiene cambios en espera')

    if (entrada.decision === 'descartar') {
      // Se conserva la huella nueva para que la próxima corrida no vuelva a avisar.
      const huella = pieza.sheet_pendiente['sheet_hash']
      exigirEscritura(
        await supabase
          .from('pieces')
          .update({ sheet_pendiente: null, sheet_hash: typeof huella === 'string' ? huella : null })
          .eq('id', entrada.piezaId)
          .select('id'),
        'Descartar el cambio',
      )
      revalidatePath(`/piezas/${entrada.piezaId}`)
      return 'Cambio descartado. La pieza queda como la aprobaron'
    }

    // `visto_at` es marca de la sincronización, así que no viaja a la pieza.
    const campos = Object.fromEntries(
      Object.entries(pieza.sheet_pendiente as Record<string, unknown>).filter(
        ([campo]) => campo !== 'visto_at',
      ),
    )
    exigirEscritura(
      await supabase
        .from('pieces')
        .update({ ...campos, sheet_pendiente: null })
        .eq('id', entrada.piezaId)
        .select('id'),
      'Aceptar el cambio',
    )

    revalidatePath(`/piezas/${entrada.piezaId}`)
    revalidatePath('/parrilla')
    return 'Cambio aplicado desde la hoja'
  })
}

/** Módulo 2 · caption diferenciado por red, heredando del base. */
export async function guardarCaptionsPorRed(datos: FormData): Promise<Respuesta> {
  return envolver('Guardar los captions por red', async () => {
    await exigirRol(...PUEDE_EDITAR)

    const entrada = z
      .object({
        piezaId: z.string().uuid(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        youtube: z.string().optional(),
      })
      .parse({
        piezaId: datos.get('piezaId'),
        instagram: datos.get('instagram') || undefined,
        tiktok: datos.get('tiktok') || undefined,
        youtube: datos.get('youtube') || undefined,
      })

    const captions = limpiarCaptions(entrada)

    // Lo que la red va a rechazar se detiene aquí, antes de la hora de salida.
    for (const [red, texto] of Object.entries(captions)) {
      if (excedeLaRed(red as RedSocial, texto)) {
        throw new Error(`El caption de ${red} pasa el límite de la plataforma`)
      }
    }

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase.from('pieces').update({ captions_red: captions }).eq('id', entrada.piezaId).select('id'),
      'Guardar los captions',
    )

    revalidatePath(`/piezas/${entrada.piezaId}`)
    const cuantos = Object.keys(captions).length
    return cuantos === 0 ? 'Todas las redes heredan el caption base' : `${cuantos} redes con caption propio`
  })
}

export async function crearRecurso(datos: FormData): Promise<Respuesta> {
  return envolver('Crear el recurso', async () => {
    await exigirRol(...PUEDE_EDITAR)

    const entrada = esquemaRecurso.parse({
      marcaId: datos.get('marcaId'),
      titulo: datos.get('titulo'),
      tipo: datos.get('tipo'),
      url: datos.get('url'),
      seccion: datos.get('seccion') || undefined,
      descripcion: datos.get('descripcion') || undefined,
    })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('resources')
        .insert({
          brand_id: entrada.marcaId,
          titulo: entrada.titulo,
          tipo: entrada.tipo,
          url: entrada.url,
          seccion: entrada.seccion ?? null,
          descripcion: entrada.descripcion ?? null,
        })
        .select('id'),
      'Crear el recurso',
    )

    revalidatePath('/recursos')
    return `Recurso "${entrada.titulo}" en la biblioteca`
  })
}
