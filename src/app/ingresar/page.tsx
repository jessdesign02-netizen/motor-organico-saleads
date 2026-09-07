import { Formulario } from './formulario'

export default function Ingresar() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Motor Orgánico</h1>
      <p className="mt-1 text-sm text-tinta-3">SaleADS y Juanads</p>
      <Formulario />
      <p className="mt-6 text-xs text-tinta-3">
        Se entra por invitación. Si aún no tienes cuenta, pídesela a Jess.
      </p>
    </main>
  )
}
