'use client'

import { useState } from 'react'
import { atenderComentarioManual } from '@/app/acciones/piezas'
import { Enviar } from '@/app/formulario'

export function Fila(props: {
  comentarioId: string
  autor: string
  texto: string
  motivo: string
  pieza: string
  permalink: string | null
  sugerida: string
}) {
  const [copiado, setCopiado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(props.sugerida)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // El portapapeles falla sin https o sin permiso. El texto está a la vista
      // justo debajo, así que la persona puede seleccionarlo a mano.
      setAviso('El portapapeles no respondió. El texto está abajo, listo para seleccionar.')
    }
  }

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm">
            <span className="font-medium">@{props.autor}</span>
            <span className="text-neutral-500"> · {props.pieza}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-800">{props.texto}</p>
          <p className="mt-1 text-xs text-amber-700">{props.motivo}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {props.permalink ? (
            <a
              href={props.permalink}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs"
            >
              Ver
            </a>
          ) : null}
          <button
            type="button"
            onClick={copiar}
            aria-label={`Copiar la respuesta para ${props.autor}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs"
          >
            {copiado ? 'Copiado' : 'Copiar respuesta'}
          </button>
          <form action={async (datos) => setAviso((await atenderComentarioManual(datos)).mensaje)}>
            <input type="hidden" name="comentarioId" value={props.comentarioId} />
            <Enviar haciendo="Marcando">Listo</Enviar>
          </form>
        </div>
      </div>
      <p className="mt-2 rounded bg-neutral-50 p-2 text-xs text-neutral-600">{props.sugerida}</p>
      {aviso ? (
        <p role="status" className="mt-1 text-xs text-neutral-500">
          {aviso}
        </p>
      ) : null}
    </article>
  )
}
