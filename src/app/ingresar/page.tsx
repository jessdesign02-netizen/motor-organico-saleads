import { Suspense } from 'react'
import { Formulario } from './formulario'
import { Emblema, Panel } from './marca'

export const metadata = { title: 'Entrar · Motor Orgánico' }

export default function Ingresar() {
  return (
    <div className="grid min-h-screen bg-arcilla lg:grid-cols-2">
      {/* El formulario primero en el marcado: es a lo que se viene. */}
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[22rem]">
          <div className="flex items-center gap-3 lg:hidden">
            <Emblema tamano={36} />
            <span className="text-[15px] font-semibold text-tinta">Motor Orgánico</span>
          </div>

          <h1 className="mt-8 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-tinta lg:mt-0">
            Entra a tu cuenta
          </h1>
          <p className="mt-1 text-sm text-tinta-2">
            Se entra por invitación. Si aún no tienes cuenta, pídesela a Jess.
          </p>

          <div className="mt-8">
            {/* useSearchParams necesita un límite de Suspense para no romper la compilación. */}
            <Suspense fallback={<div className="h-64" />}>
              <Formulario />
            </Suspense>
          </div>
        </div>
      </main>

      <Panel />
    </div>
  )
}
