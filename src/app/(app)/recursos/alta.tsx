'use client'

import { useState } from 'react'
import { crearRecurso } from '@/app/acciones/parrilla'
import type { Marca } from '@/lib/database.types'

export function AltaRecurso({ marcas }: { marcas: Marca[] }) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
      >
        Agregar un recurso
      </button>
    )
  }

  return (
    <form
      action={async (datos) => {
        const salida = await crearRecurso(datos)
        setAviso(salida)
        if (salida.ok) setAbierto(false)
      }}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <input name="titulo" placeholder="Título" required className={ENTRADA} />
        <input name="url" placeholder="https://" required className={ENTRADA} />
        <select name="marcaId" required className={ENTRADA} defaultValue={marcas[0]?.id ?? ''}>
          {marcas.map((marca) => (
            <option key={marca.id} value={marca.id}>
              {marca.nombre}
            </option>
          ))}
        </select>
        <select name="tipo" className={ENTRADA} defaultValue="pdf">
          {['pdf', 'skill', 'html', 'artefacto', 'video'].map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
        <input name="seccion" placeholder="Sección de la biblioteca" className={ENTRADA} />
        <input name="descripcion" placeholder="Descripción" className={ENTRADA} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white">
          Guardar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-neutral-500">
          Cancelar
        </button>
        {aviso ? (
          <span className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</span>
        ) : null}
      </div>
    </form>
  )
}

const ENTRADA = 'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm'
