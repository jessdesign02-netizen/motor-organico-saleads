import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refresco de sesión y guardia de rutas.
 *
 * La comprobación de permisos vive además en la base, con RLS, y en cada Server
 * Action. Esto solo evita que alguien sin sesión vea una pantalla en blanco.
 */

export const RUTAS_PUBLICAS = [
  '/ingresar',
  // Pedir el enlace de recuperación es justo lo que se hace sin poder entrar.
  '/recuperar',
  // Aquí aterrizan los enlaces del correo: canjean el código y crean la sesión.
  '/auth',
  // El webhook lo firma Meta, y los cron llevan su propia cabecera.
  '/api/webhooks',
  '/api/cron',
  // El agente de mensajes directos corre en n8n, sin sesión, y entra con AGENTE_SECRET.
  '/api/agente',
  // La biblioteca pública de recursos la consume bio.saleads.co, sin sesión.
  '/api/recursos',
  // El redirector lo abre quien recibió el mensaje.
  '/r/',
]

export function esPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((publica) => ruta.startsWith(publica))
}

export async function proxy(peticion: NextRequest) {
  const respuesta = NextResponse.next({ request: peticion })
  const ruta = peticion.nextUrl.pathname

  if (esPublica(ruta)) return respuesta

  // Modo demo: no hay sesión que refrescar ni a quién redirigir. La guardia
  // vuelve en cuanto MODO_DEMO deja de estar puesta.
  if (process.env.MODO_DEMO === '1') return respuesta

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
