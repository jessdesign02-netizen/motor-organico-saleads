'use client'

import { useState } from 'react'
import { marcarAvisoLeido, marcarTodosLeidos } from '@/app/acciones/avisos'

export function Archivar({ avisoId }: { avisoId: string }) {
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      action={async (datos) => {
        const salida = await marcarAvisoLeido(datos)
        setError(salida.ok ? null : salida.mensaje)
      }}
    >
      <input type="hidden" name="avisoId" value={avisoId} />
      <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white">
        Archivar
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </form>
  )
}

export function ArchivarTodo() {
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <form action={async () => setAviso((await marcarTodosLeidos()).mensaje)} className="flex items-center gap-2">
      <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
        Archivar todo
      </button>
      {aviso ? <span className="text-xs text-neutral-500">{aviso}</span> : null}
    </form>
  )
}
