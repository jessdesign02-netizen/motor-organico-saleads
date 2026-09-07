import type { ReactNode } from 'react'
import { exigirSesion } from '@/lib/sesion'
import { clienteServidor } from '@/lib/supabase/server'
import { ROL } from '@/lib/etiquetas'
import { BarraLateral } from './barra-lateral'

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const perfil = await exigirSesion()
  const supabase = await clienteServidor()

  /**
   * Lo pendiente se cuenta aquí, una vez, para que el menú lo muestre en todas
   * las pantallas. Sin esto había que entrar a buscar para descubrir que había
   * algo esperando.
   */
  const [{ count: enChat }, { count: sinLeer }] = await Promise.all([
    supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['manual_pendiente', 'fallido']),
    supabase.from('notices').select('id', { count: 'exact', head: true }).is('leido_at', null),
  ])

  return (
    <div className="min-h-screen">
      <BarraLateral
        nombre={perfil.nombre ?? perfil.email ?? 'Sin nombre'}
        rol={ROL[perfil.rol].texto}
        cuentas={{ chat: enChat ?? 0, avisos: sinLeer ?? 0 }}
      />
      <main className="px-6 py-8 lg:pl-[16.5rem]">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
