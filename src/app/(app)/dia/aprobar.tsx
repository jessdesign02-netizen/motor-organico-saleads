'use client'

import { useState } from 'react'
import { programarDia } from '@/app/acciones/piezas'
import { Aviso, Enviar } from '@/app/formulario'

/** La aprobación del día en un clic, que es el punto de control del sistema. */
export function AprobarDia({ fecha, cuantas }: { fecha: string; cuantas: number }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <div className="rounded-silk shadow-alzado bg-arcilla shadow-alzado p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-tinta">
            {cuantas} {cuantas === 1 ? 'pieza está lista' : 'piezas están listas'} para salir
          </p>
          {/* El único punto del sistema donde se espera una decisión humana. */}
          <p className="mt-0.5 text-xs text-tinta-2">
            Al confirmar entran a la cola y salen a su hora, con su automatización encendida.
          </p>
        </div>
        <form action={async (datos) => setAviso(await programarDia(datos))} aria-label="Aprobar el día">
          <input type="hidden" name="fecha" value={fecha} />
          <Enviar haciendo="Programando">Aprobar el día</Enviar>
        </form>
      </div>
      {aviso ? (
        <div className="mt-3">
          <Aviso resultado={aviso} />
        </div>
      ) : null}
    </div>
  )
}
