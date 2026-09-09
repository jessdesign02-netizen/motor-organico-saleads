import { Emblema, Panel } from '@/app/ingresar/marca'
import { exigirSesion } from '@/lib/sesion'
import { ClaveNueva } from './formulario'

export const metadata = { title: 'Clave nueva · ClaveChat' }
export const dynamic = 'force-dynamic'

/**
 * Solo se llega aquí con una sesión de recuperación, que la crea
 * `/auth/entrada` al canjear el código del correo. Por eso la pantalla vive
 * detrás de la guardia como cualquier otra.
 */
export default async function PonerClaveNueva() {
  const perfil = await exigirSesion()

  return (
    <div className="grid min-h-screen bg-arcilla lg:grid-cols-2">
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[22rem]">
          <div className="flex items-center gap-3 lg:hidden">
            <Emblema tamano={36} />
            <span className="text-[15px] font-semibold text-tinta">ClaveChat</span>
          </div>

          <h1 className="mt-8 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-tinta lg:mt-0">
            Pon una clave nueva
          </h1>
          <p className="mt-1 text-sm text-tinta-2">
            Para <span className="font-medium text-tinta">{perfil.email}</span>. Al guardarla entras directo.
          </p>

          <div className="mt-8">
            <ClaveNueva />
          </div>
        </div>
      </main>

      <Panel />
    </div>
  )
}
