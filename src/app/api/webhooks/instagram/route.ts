import { NextResponse } from 'next/server'
import { clienteAdmin } from '@/lib/supabase/admin'
import { firmaValida } from '@/lib/firma'
import { atenderComentarios } from '@/lib/trabajos/escuchar'
import type { ComentarioEntrante } from '@/lib/redes'

/**
 * Webhook de comentarios de Instagram, campo `comments`.
 *
 * Meta espera un 200 rápido: si la respuesta tarda, reintenta la entrega y el
 * mismo comentario llega dos veces. El motor lo soporta por idempotencia, y aun
 * así aquí se contesta apenas la firma queda comprobada.
 */

export const dynamic = 'force-dynamic'

type CambioMeta = {
  field?: string
  value?: {
    id?: string
    text?: string
    media?: { id?: string }
    from?: { id?: string; username?: string }
    created_time?: number
  }
}

/** Verificación de suscripción: Meta la pide una sola vez, al conectar. */
export async function GET(peticion: Request) {
  const url = new URL(peticion.url)
  const modo = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const reto = url.searchParams.get('hub.challenge')

  if (modo === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(reto ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'verificación rechazada' }, { status: 403 })
}

export async function POST(peticion: Request) {
  const secreto = process.env.META_APP_SECRET
  const cuerpo = await peticion.text()

  if (!secreto || !firmaValida(cuerpo, peticion.headers.get('x-hub-signature-256'), secreto)) {
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 })
  }

  let carga: { entry?: Array<{ changes?: CambioMeta[] }> }
  try {
    carga = JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ error: 'cuerpo ilegible' }, { status: 400 })
  }

  const supabase = clienteAdmin()
  const porPublicacion = new Map<string, ComentarioEntrante[]>()

  for (const entrada of carga.entry ?? []) {
    for (const cambio of entrada.changes ?? []) {
      if (cambio.field !== 'comments') continue
      const valor = cambio.value
      const postExterno = valor?.media?.id
      if (!valor?.id || !postExterno) continue

      const { data: publicacion } = await supabase
        .from('publications')
        .select('id')
        .eq('external_post_id', postExterno)
        .maybeSingle()
      if (!publicacion) continue

      const lista = porPublicacion.get(publicacion.id) ?? []
      lista.push({
        externalCommentId: valor.id,
        externalPostId: postExterno,
        autorUsername: valor.from?.username ?? null,
        autorExternalId: valor.from?.id ?? null,
        texto: valor.text ?? '',
        creadoEn: valor.created_time ? new Date(valor.created_time * 1000) : new Date(),
      })
      porPublicacion.set(publicacion.id, lista)
    }
  }

  for (const [publicationId, comentarios] of porPublicacion) {
    await atenderComentarios(publicationId, comentarios)
  }

  return NextResponse.json({ atendidas: porPublicacion.size })
}
