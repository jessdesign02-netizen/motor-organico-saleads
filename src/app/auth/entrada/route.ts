import { NextResponse } from 'next/server'
import { clienteServidor } from '@/lib/supabase/server'
import { destinoTrasEntrar } from '@/lib/auth-errores'

/**
 * Donde aterrizan los enlaces que manda Supabase por correo.
 *
 * El cliente de `@supabase/ssr` usa PKCE, así que el enlace de recuperación no
 * trae una sesión: trae un código de un solo uso que hay que canjear en el
 * servidor. Sin esta ruta, el enlace del correo llevaba a una pantalla que
 * pedía iniciar sesión, que es justo lo que la persona no puede hacer.
 */
export async function GET(peticion: Request) {
  const url = new URL(peticion.url)
  const codigo = url.searchParams.get('code')
  const destino = destinoTrasEntrar(url.searchParams.get('destino'))

  if (!codigo) {
    const fallo = new URL('/ingresar', url.origin)
    fallo.searchParams.set('problema', 'enlace-incompleto')
    return NextResponse.redirect(fallo)
  }

  const supabase = await clienteServidor()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    // Un enlace vencido o ya usado es el caso corriente, no una excepción.
    const fallo = new URL('/recuperar', url.origin)
    fallo.searchParams.set('problema', 'enlace-vencido')
    return NextResponse.redirect(fallo)
  }

  return NextResponse.redirect(new URL(destino, url.origin))
}
