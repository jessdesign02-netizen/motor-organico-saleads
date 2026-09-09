'use client'

import { useEffect } from 'react'

/**
 * Lo que se ve cuando algo revienta en una pantalla.
 *
 * Sin esto, un fallo de la base dejaba la pantalla por defecto de Next: fondo
 * en blanco y un texto genérico que no dice qué hacer. Aquí al menos hay un
 * camino de vuelta y la señal de dónde mirar.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[pantalla]', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold tracking-tight">Esta pantalla no cargó</h1>

      <p className="text-sm text-tinta-2">
        Casi siempre es la conexión con la base de datos. Reintenta, y si vuelve a pasar, abre{' '}
        <a href="/diagnostico" className="underline">
          el diagnóstico
        </a>
        : dice qué parte del sistema está fallando.
      </p>

      {error.digest ? <p className="text-xs text-tinta-3">Referencia del error: {error.digest}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-tinta px-4 py-2 text-sm font-medium text-white"
        >
          Reintentar
        </button>
        <a href="/parrilla" className="rounded-md shadow-alzado px-4 py-2 text-sm font-medium">
          Volver a la parrilla
        </a>
      </div>
    </main>
  )
}
