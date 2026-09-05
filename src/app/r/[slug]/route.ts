import { NextResponse } from 'next/server'
import { clienteAdmin } from '@/lib/supabase/admin'

/**
 * Redirector propio. El mensaje entrega este enlace, y no el de WhatsApp
 * directo: así el dominio que viaja es de SaleADS, el destino se cambia sin
 * tocar los mensajes ya enviados, y cada clic queda contado.
 */

export const dynamic = 'force-dynamic'

export async function GET(_peticion: Request, contexto: { params: Promise<{ slug: string }> }) {
  const { slug } = await contexto.params
  const supabase = clienteAdmin()

  const { data: enlace } = await supabase
    .from('tracked_links')
    .select('id, destino_url, clics')
    .eq('slug', slug)
    .maybeSingle()

  if (!enlace) {
    return NextResponse.redirect(new URL('/', process.env.APP_URL ?? 'http://localhost:3000'))
  }

  await supabase
    .from('tracked_links')
    .update({ clics: enlace.clics + 1 })
    .eq('id', enlace.id)

  return NextResponse.redirect(enlace.destino_url, { status: 302 })
}
