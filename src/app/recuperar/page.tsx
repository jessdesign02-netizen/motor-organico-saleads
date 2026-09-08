import Link from 'next/link'
import { Suspense } from 'react'
import { Emblema, Panel } from '@/app/ingresar/marca'
import { PedirEnlace } from './formulario'

export const metadata = { title: 'Recuperar la clave · Motor Orgánico' }

export default function Recuperar() {
  return (
    <div className="grid min-h-screen bg-superficie lg:grid-cols-2">
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[22rem]">
          <div className="flex items-center gap-3 lg:hidden">
            <Emblema tamano={36} />
            <span className="text-[15px] font-semibold text-tinta">Motor Orgánico</span>
          </div>

          <h1 className="mt-8 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-tinta lg:mt-0">
            Recuperar la clave
          </h1>
          <p className="mt-1 text-sm text-tinta-2">
            Te llega un enlace al correo para poner una nueva.
          </p>

          <div className="mt-8">
            <Suspense fallback={<div className="h-40" />}>
              <PedirEnlace />
            </Suspense>
          </div>

          <p className="mt-6 text-[13px] text-tinta-2">
            <Link href="/ingresar" className="underline underline-offset-2 hover:text-tinta">
              ← Volver a entrar
            </Link>
          </p>
        </div>
      </main>

      <Panel />
    </div>
  )
}
