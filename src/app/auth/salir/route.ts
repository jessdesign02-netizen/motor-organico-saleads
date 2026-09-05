import { NextResponse } from 'next/server'
import { clienteServidor } from '@/lib/supabase/server'

export async function POST(peticion: Request) {
  const supabase = await clienteServidor()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/ingresar', peticion.url))
}
