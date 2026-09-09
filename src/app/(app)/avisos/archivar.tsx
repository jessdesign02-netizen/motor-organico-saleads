'use client'

import { useState } from 'react'
import { marcarAvisoLeido, marcarTodosLeidos } from '@/app/acciones/avisos'
import { Enviar } from '@/app/formulario'

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
      <Enviar haciendo="Archivando">Archivar</Enviar>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-critico">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function ArchivarTodo() {
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <form
      action={async () => setAviso((await marcarTodosLeidos()).mensaje)}
      className="flex items-center gap-2"
    >
      <Enviar variante="secundario" haciendo="Archivando">
        Archivar todo
      </Enviar>
      {aviso ? (
        <span role="status" className="text-xs text-tinta-3">
          {aviso}
        </span>
      ) : null}
    </form>
  )
}
