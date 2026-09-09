import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { env } from '@/lib/env'
import { modoDemo, clienteDemo } from '@/lib/demo/cliente'

type Cliente = ReturnType<typeof createClient<Database>>

/**
 * Cliente de servicio, sin RLS. Vive solo en los trabajos programados y en los
 * webhooks, donde no hay sesión de persona. Nunca llega al navegador.
 */
export function clienteAdmin(): Cliente {
  // Modo demo: el mismo doble que usan las pantallas, para que un trabajo y una
  // pantalla vean los mismos datos.
  if (modoDemo()) return clienteDemo() as unknown as Cliente

  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env()
  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
