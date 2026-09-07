'use client'

import { useEffect } from 'react'

/** El mismo camino de vuelta, dentro de la aplicación y con su navegación. */
export default function ErrorDeSeccion({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[seccion]', error)
  }, [error])

  return (
    <div className="rounded-lg border border-linea bg-critico-tinte p-6">
      <h2 className="text-sm font-semibold text-critico">Esta sección no cargó</h2>
      <p className="mt-1 text-sm text-critico">
        Casi siempre es la conexión con la base. El resto de la herramienta sigue disponible desde el menú.
      </p>
      {error.digest ? <p className="mt-1 text-xs text-critico">Referencia: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-md bg-red-900 px-3 py-1.5 text-sm font-medium text-superficie"
      >
        Reintentar
      </button>
    </div>
  )
}
