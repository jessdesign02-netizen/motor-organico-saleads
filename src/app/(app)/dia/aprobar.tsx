'use client'

import { useState } from 'react'
import { programarDia } from '@/app/acciones/piezas'
import { Aviso, Enviar } from '@/app/formulario'

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
        className="mt-3 flex flex-wrap items-center gap-3"
        aria-label="Aprobar el día"
      >
        <input type="hidden" name="fecha" value={fecha} />
        <Enviar haciendo="Programando">Aprobar el día y soltar</Enviar>
        <Aviso resultado={aviso} />
      </form>
    </div>
  )
}
