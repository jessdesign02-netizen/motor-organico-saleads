import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'

/** Cliente con la sesión de la persona. Respeta RLS. */
export async function clienteServidor() {
  const almacen = await cookies()
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env()

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (galletas) => {
        try {
          for (const { name, value, options } of galletas) {
            almacen.set(name, value, options)
          }
        } catch {
          // Server Component: el refresco de sesión lo hace el proxy.
        }
      },
    },
  })
}
