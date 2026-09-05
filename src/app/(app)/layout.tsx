import Link from 'next/link'
import type { ReactNode } from 'react'
import { exigirSesion } from '@/lib/sesion'

const SECCIONES = [
  { href: '/parrilla', texto: 'Parrilla' },
  { href: '/dia', texto: 'El día' },
  { href: '/bandeja', texto: 'Bandeja' },
  { href: '/resultados', texto: 'Resultados' },
  { href: '/diagnostico', texto: 'Diagnóstico' },
]

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const perfil = await exigirSesion()

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="text-sm font-semibold tracking-tight">Motor Orgánico</span>
          <nav className="flex flex-1 gap-4 text-sm text-neutral-600">
            {SECCIONES.map((seccion) => (
              <Link key={seccion.href} href={seccion.href} className="hover:text-neutral-900">
                {seccion.texto}
              </Link>
            ))}
          </nav>
          <span className="text-xs text-neutral-500">
            {perfil.nombre ?? perfil.email} · {perfil.rol}
          </span>
          <form action="/auth/salir" method="post">
            <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-900">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
