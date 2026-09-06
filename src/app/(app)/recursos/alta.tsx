'use client'

import { useState } from 'react'
import { crearRecurso } from '@/app/acciones/parrilla'
import { Aviso, Campo, ENTRADA, Enviar } from '@/app/formulario'
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
      aria-label="Agregar un recurso"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta="Título">
          <input name="titulo" required className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Enlace del recurso">
          <input name="url" type="url" placeholder="https://" required className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Marca">
          <select name="marcaId" required className={ENTRADA} defaultValue={marcas[0]?.id ?? ''}>
            {marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {marca.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Tipo">
          <select name="tipo" className={ENTRADA} defaultValue="pdf">
            {['pdf', 'skill', 'html', 'artefacto', 'video'].map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Sección de la biblioteca">
          <input name="seccion" className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Descripción">
          <input name="descripcion" className={ENTRADA} />
        </Campo>
      </div>
      <div className="flex items-center gap-3">
        <Enviar haciendo="Guardando">Guardar</Enviar>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-neutral-500">
          Cancelar
        </button>
        <Aviso resultado={aviso} />
      </div>
    </form>
  )
}
