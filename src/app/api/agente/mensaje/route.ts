import { NextResponse } from 'next/server'
import { z } from 'zod'
import { clienteAdmin } from '@/lib/supabase/admin'
import { agenteAutorizado } from '@/lib/guardia'

/**
 * Puerta del agente de mensajes directos.
 *
 * El agente vive en n8n y atiende los DM de Instagram. Esta ruta es donde
 * reporta cada turno de la conversación —lo que entró y lo que contestó— para
 * que Chat en vivo lo muestre.
 *
 * Devuelve `pausado`, que es la única respuesta que al agente le importa: si el
 * equipo tomó el hilo a mano, el agente se calla y deja de contestar ahí.
 */

export const dynamic = 'force-dynamic'

const esquema = z.object({
  /** IGSID de la persona. Identifica el hilo por sí solo. */
  contacto_external_id: z.string().min(1),
  contacto_username: z.string().min(1).nullish(),
  autor: z.enum(['persona', 'agente', 'humano']),
  texto: z.string().min(1),
  /** El id que devuelve Instagram, si lo hay. Evita guardar dos veces lo mismo. */
  external_message_id: z.string().min(1).nullish(),
  error: z.string().min(1).nullish(),
  enviado_at: z.string().datetime().nullish(),
})

export async function POST(peticion: Request) {
  if (!agenteAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }

  const cuerpo = await peticion.json().catch(() => null)
  const leido = esquema.safeParse(cuerpo)
  if (!leido.success) {
    return NextResponse.json(
      { error: 'cuerpo inválido', detalle: leido.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      { status: 400 },
    )
  }

  const datos = leido.data
  const supabase = clienteAdmin()

  // El hilo se crea al primer mensaje y se reutiliza siempre. El username se
  // refresca en cada turno porque la gente se lo cambia, y el hilo se identifica
  // por el IGSID, no por el arroba.
  const { data: hilo, error: fallaHilo } = await supabase
    .from('dm_threads')
    .upsert(
      {
        contacto_external_id: datos.contacto_external_id,
        ...(datos.contacto_username ? { contacto_username: datos.contacto_username } : {}),
      },
      { onConflict: 'contacto_external_id' },
    )
    .select('id, agente_pausado_hasta')
    .single()

  if (fallaHilo || !hilo) {
    return NextResponse.json(
      { error: `no se pudo abrir el hilo: ${fallaHilo?.message ?? 'sin detalle'}` },
      { status: 500 },
    )
  }

  const { error: fallaMensaje } = await supabase.from('dm_messages').insert({
    thread_id: hilo.id,
    autor: datos.autor,
    texto: datos.texto,
    external_message_id: datos.external_message_id ?? null,
    error: datos.error ?? null,
    ...(datos.enviado_at ? { enviado_at: datos.enviado_at } : {}),
  })

  // 23505 es el índice único del identificador de Instagram: el mismo mensaje
  // llegando dos veces no es un fallo, es Meta reintentando la entrega.
  const repetido = fallaMensaje?.code === '23505'
  if (fallaMensaje && !repetido) {
    return NextResponse.json(
      { error: `no se pudo guardar el mensaje: ${fallaMensaje.message}` },
      { status: 500 },
    )
  }

  const pausado = Boolean(
    hilo.agente_pausado_hasta && new Date(hilo.agente_pausado_hasta) > new Date(),
  )

  return NextResponse.json({ hilo: hilo.id, pausado, repetido })
}
