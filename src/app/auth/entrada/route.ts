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

  /**
   * Google rebota aquí con `error` cuando el alta falló. El trigger de la base
   * revienta con `correo_no_invitado` para quien no está en la lista, y eso
   * llega envuelto en un server_error genérico: sin traducirlo, la persona ve
   * "Database error saving new user" y no sabe qué hacer con eso.
   */
  const fallaOauth = url.searchParams.get('error')
  if (fallaOauth) {
    const descripcion = url.searchParams.get('error_description') ?? ''
    const rebote = new URL('/ingresar', url.origin)
    rebote.searchParams.set(
      'problema',
      /correo_no_invitado|saving new user|database error/i.test(descripcion) ? 'sin-invitacion' : 'oauth',
    )
    return NextResponse.redirect(rebote)
  }

  if (!codigo) {
    const fallo = new URL('/ingresar', url.origin)
    fallo.searchParams.set('problema', 'enlace-incompleto')
    return NextResponse.redirect(fallo)
  }

  const supabase = await clienteServidor()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    // El mismo trigger puede saltar aquí, cuando el alta viene por correo.
    if (/correo_no_invitado|saving new user|database error/i.test(error.message)) {
      const fuera = new URL('/ingresar', url.origin)
      fuera.searchParams.set('problema', 'sin-invitacion')
      return NextResponse.redirect(fuera)
    }
    // Un enlace vencido o ya usado es el caso corriente, no una excepción.
    const fallo = new URL('/recuperar', url.origin)
    fallo.searchParams.set('problema', 'enlace-vencido')
    return NextResponse.redirect(fallo)
  }

  return NextResponse.redirect(new URL(destino, url.origin))
}
