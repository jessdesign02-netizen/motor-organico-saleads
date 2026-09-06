'use client'

import { useState } from 'react'
import { crearPieza } from '@/app/acciones/parrilla'
import type { Marca } from '@/lib/database.types'

/** Módulo 1 · crear una pieza dentro de la app, sin pasar por la hoja. */
export function NuevaPieza({ marcas, semana }: { marcas: Marca[]; semana: string }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <form
      action={async (datos) => setAviso(await crearPieza(datos))}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-4"
    >
      <select name="marcaId" className={ENTRADA} defaultValue={marcas[0]?.id ?? ''}>
        {marcas.map((marca) => (
          <option key={marca.id} value={marca.id}>
            {marca.nombre}
          </option>
        ))}
      </select>
      <input name="tema" placeholder="Tema de la pieza" required className={`${ENTRADA} flex-1`} />
      <input type="date" name="fecha" defaultValue={semana} className={ENTRADA} />
      <button type="submit" className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white">
        Crear pieza
      </button>
      {aviso ? (
        <span className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</span>
      ) : null}
    </form>
  )
}

const ENTRADA = 'rounded-md border border-neutral-300 px-3 py-2 text-sm'
