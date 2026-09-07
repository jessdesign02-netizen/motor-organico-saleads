'use client'

import { useState } from 'react'
import { crearPieza } from '@/app/acciones/parrilla'
import { Aviso, Campo, ENTRADA, Enviar } from '@/app/formulario'
import type { Marca } from '@/lib/database.types'

/** Módulo 1 · crear una pieza dentro de la app, sin pasar por la hoja. */
export function NuevaPieza({ marcas, semana }: { marcas: Marca[]; semana: string }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <form
      action={async (datos) => setAviso(await crearPieza(datos))}
      className="space-y-3 rounded-xl border border-dashed border-linea-fuerte bg-superficie p-4"
      aria-label="Crear una pieza"
    >
      <p className="text-xs font-medium text-tinta-2">
        Crear una pieza a mano, sin esperar a la hoja de cálculo
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Marca">
          <select name="marcaId" className={ENTRADA} defaultValue={marcas[0]?.id ?? ''}>
            {marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {marca.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <div className="min-w-64 flex-1">
          <Campo etiqueta="Tema de la pieza">
            <input name="tema" required className={ENTRADA} />
          </Campo>
        </div>

        <Campo etiqueta="Fecha">
          <input type="date" name="fecha" defaultValue={semana} className={ENTRADA} />
        </Campo>

        <Enviar haciendo="Creando">Crear pieza</Enviar>
      </div>

      <Aviso resultado={aviso} />
    </form>
  )
}
