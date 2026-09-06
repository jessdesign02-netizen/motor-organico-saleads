'use client'

import { useState } from 'react'
import { resolverCambioDeHoja } from '@/app/acciones/parrilla'

/**
 * Caso especial de la sección 7: la hoja cambió con la pieza ya aprobada.
 * Se muestra la diferencia campo por campo, y la persona decide. Nada se
 * sobrescribe solo sobre algo que ya pasó por revisión.
 */
export function CambioDeHoja({
  piezaId,
  cambio,
  actual,
  puedeResolver,
}: {
  piezaId: string
  cambio: Record<string, unknown>
  actual: Record<string, string | null>
  puedeResolver: boolean
}) {
  const [aviso, setAviso] = useState<string | null>(null)

  const diferencias = Object.entries(actual).filter(([campo, valor]) => {
    const nuevo = cambio[campo]
    return typeof nuevo === 'string' && nuevo !== (valor ?? '')
  })

  return (
    <div className="rounded-lg border border-sky-300 bg-sky-50 p-4">
      <p className="text-sm font-medium text-sky-900">
        La hoja cambió después de que esta pieza quedó aprobada
      </p>

      {diferencias.length === 0 ? (
        <p className="mt-1 text-xs text-sky-800">El cambio llega en campos que la app no muestra.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs text-sky-900">
          {diferencias.map(([campo, valor]) => (
            <li key={campo}>
              <span className="font-medium">{campo.replace('_', ' ')}:</span>{' '}
              <span className="line-through opacity-60">{valor || 'vacío'}</span> {'→'}{' '}
              <span>{String(cambio[campo])}</span>
            </li>
          ))}
        </ul>
      )}

      {puedeResolver ? (
        <div className="mt-3 flex items-center gap-2">
          <form action={async (datos) => setAviso((await resolverCambioDeHoja(datos)).mensaje)}>
            <input type="hidden" name="piezaId" value={piezaId} />
            <button
              type="submit"
              name="decision"
              value="aceptar"
              className="rounded-md bg-sky-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Aceptar el cambio
            </button>
          </form>
          <form action={async (datos) => setAviso((await resolverCambioDeHoja(datos)).mensaje)}>
            <input type="hidden" name="piezaId" value={piezaId} />
            <button
              type="submit"
              name="decision"
              value="descartar"
              className="rounded-md border border-sky-300 px-3 py-1.5 text-xs"
            >
              Dejar lo aprobado
            </button>
          </form>
          {aviso ? <span className="text-xs text-sky-900">{aviso}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
