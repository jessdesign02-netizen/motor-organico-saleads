import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refresco de sesión y guardia de rutas.
 *
 * La comprobación de permisos vive además en la base, con RLS, y en cada Server
 * Action. Esto solo evita que alguien sin sesión vea una pantalla en blanco.
 */

const PUBLICAS = ['/ingresar', '/auth', '/api/webhooks', '/api/cron', '/r/']

export async function proxy(peticion: NextRequest) {
  const respuesta = NextResponse.next({ request: peticion })
  const ruta = peticion.nextUrl.pathname

  if (PUBLICAS.some((publica) => ruta.startsWith(publica))) return respuesta

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (galletas) => {
          for (const { name, value, options } of galletas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/ingresar'
    destino.searchParams.set('volver', ruta)
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
