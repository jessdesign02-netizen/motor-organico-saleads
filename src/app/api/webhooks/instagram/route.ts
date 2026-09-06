import { NextResponse } from 'next/server'
import { clienteAdmin } from '@/lib/supabase/admin'
import { firmaValida } from '@/lib/firma'
import { atenderComentarios } from '@/lib/trabajos/escuchar'
import type { ComentarioEntrante } from '@/lib/redes'
import { leerCargaMeta, sinLosPropios } from '@/lib/redes/webhook-meta'

/**
 * Webhook de comentarios de Instagram, campo `comments`.
 *
 * Meta espera un 200 rápido: si la respuesta tarda, reintenta la entrega y el
 * mismo comentario llega dos veces. El motor lo soporta por idempotencia, y aun
 * así aquí se contesta apenas la firma queda comprobada.
 */

export const dynamic = 'force-dynamic'

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

  let carga: unknown
  try {
    carga = JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ error: 'cuerpo ilegible' }, { status: 400 })
  }

  const lectura = leerCargaMeta(carga)
  if (lectura.comentarios.length === 0) {
    // Un 200 cierra la entrega: sin él, Meta reintenta el lote completo por algo
    // que no era para nosotros.
    return NextResponse.json({ atendidas: 0, descartados: lectura.descartados.length })
  }

  const supabase = clienteAdmin()

  // Las publicaciones, de una sola consulta: un lote puede traer decenas de
  // comentarios de la misma pieza, y Meta espera una respuesta rápida.
  const postsExternos = [...new Set(lectura.comentarios.map((c) => c.externalPostId))]
  const { data: publicaciones } = await supabase
    .from('publications')
    .select('id, social_account_id, external_post_id')
    .in('external_post_id', postsExternos)

  const porPostExterno = new Map((publicaciones ?? []).map((p) => [p.external_post_id ?? '', p]))

  // Los comentarios de las propias cuentas quedan fuera: responderle al equipo
  // gastaría el único mensaje que la ventana permite.
  const { data: cuentas } = await supabase.from('social_accounts').select('external_account_id')
  const propias = (cuentas ?? []).map((c) => c.external_account_id)

  const porPublicacion = new Map<string, ComentarioEntrante[]>()
  for (const comentario of sinLosPropios(lectura.comentarios, propias)) {
    const publicacion = porPostExterno.get(comentario.externalPostId)
    if (!publicacion) continue

    const lista = porPublicacion.get(publicacion.id) ?? []
    lista.push(comentario)
    porPublicacion.set(publicacion.id, lista)
  }

  for (const [publicationId, comentarios] of porPublicacion) {
    await atenderComentarios(publicationId, comentarios)
  }

  return NextResponse.json({
    atendidas: porPublicacion.size,
    descartados: lectura.descartados.length,
  })
}
