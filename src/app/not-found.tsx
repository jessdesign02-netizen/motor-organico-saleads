import Link from 'next/link'

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold tracking-tight">Esta dirección no existe</h1>
      <p className="text-sm text-tinta-2">
        Puede que la pieza se haya eliminado, o que el enlace venga con un error de copia.
      </p>
      <Link
        href="/parrilla"
        className="w-fit rounded-md bg-tinta px-4 py-2 text-sm font-medium text-superficie"
      >
        Volver a la parrilla
      </Link>
    </main>
  )
}
