import { NextResponse } from 'next/server'
import { clienteServidor } from '@/lib/supabase/server'

export async function POST(peticion: Request) {
  const supabase = await clienteServidor()
  await supabase.auth.signOut()

  // Con la marca, la pantalla de entrada confirma que la salida ocurrió en vez
  // de parecer que la sesión se cayó sola.
  const destino = new URL('/ingresar', peticion.url)
  destino.searchParams.set('salio', '1')
  return NextResponse.redirect(destino, { status: 303 })
}
