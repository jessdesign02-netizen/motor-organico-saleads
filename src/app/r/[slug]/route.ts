import { NextResponse } from 'next/server'
import { clienteAdmin } from '@/lib/supabase/admin'
import { destinoPermitido } from '@/lib/seguridad'

/**
 * Redirector propio. El mensaje entrega este enlace, y no el de WhatsApp
 * directo: así el dominio que viaja es de SaleADS, el destino se cambia sin
 * tocar los mensajes ya enviados, y cada clic queda contado.
 */

export const dynamic = 'force-dynamic'

function inicio(): URL {
  return new URL('/', process.env.APP_URL ?? 'http://localhost:3000')
}

export async function GET(_peticion: Request, contexto: { params: Promise<{ slug: string }> }) {
  const { slug } = await contexto.params
  const supabase = clienteAdmin()

  const { data: enlace } = await supabase
    .from('tracked_links')
    .select('id, destino_url, clics')
    .eq('slug', slug)
    .maybeSingle()

  if (!enlace) return NextResponse.redirect(inicio(), { status: 302 })

  // El enlace lleva el dominio de SaleADS, así que un destino fuera del embudo
  // convertiría ese dominio en trampolín hacia cualquier parte. Se comprueba
  // aquí además de al guardarlo: el destino puede haber cambiado después.
  if (!destinoPermitido(enlace.destino_url)) {
    console.error('[redirector] destino fuera de la lista:', enlace.id)
    return NextResponse.redirect(inicio(), { status: 302 })
  }

  await supabase
    .from('tracked_links')
    .update({ clics: enlace.clics + 1 })
    .eq('id', enlace.id)

  return NextResponse.redirect(enlace.destino_url, { status: 302 })
}
