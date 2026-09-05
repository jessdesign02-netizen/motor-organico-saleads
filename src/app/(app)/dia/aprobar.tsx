'use client'

import { useState } from 'react'
import { programarDia } from '@/app/acciones/piezas'

/** La aprobación del día en un clic, que es el punto de control del sistema. */
export function AprobarDia({ fecha, cuantas }: { fecha: string; cuantas: number }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <div className="rounded-lg border border-neutral-900 bg-white p-5">
      <p className="text-sm">
        {cuantas} {cuantas === 1 ? 'pieza aprobada sale' : 'piezas aprobadas salen'} este día.
      </p>
      <form
        action={async (datos) => setAviso(await programarDia(datos))}
        className="mt-3 flex items-center gap-3"
      >
        <input type="hidden" name="fecha" value={fecha} />
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Aprobar el día y soltar
        </button>
        {aviso ? (
          <span className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</span>
        ) : null}
      </form>
    </div>
  )
}
