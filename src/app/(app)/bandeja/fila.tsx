'use client'

import { useState } from 'react'
import { atenderComentarioManual } from '@/app/acciones/piezas'
import { Boton, Enviar } from '@/app/formulario'

export function Fila(props: {
  comentarioId: string
  autor: string
  texto: string
  motivo: string
  intentos: number
  red: string | null
  pieza: string
  permalink: string | null
  sugerida: string
  /** El sistema lo reintenta solo: la fila no pide acción, y se ve. */
  enEspera?: boolean
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
    <article className={`rounded-silk border bg-arcilla p-4 ${props.enEspera ? 'border-dashed ' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-tinta-3">
            <span className="font-medium text-tinta">@{props.autor}</span>
            {props.red ? <span>en {props.red}</span> : null}
            <span>·</span>
            <span className="truncate">{props.pieza}</span>
          </p>

          {/* Lo que la persona escribió es lo que hay que leer: va primero y más grande. */}
          <p className="mt-1.5 text-sm text-tinta">{props.texto}</p>

          {props.motivo ? (
            <p className="mt-1.5 text-xs text-tinta-2">
              {props.motivo}
              {props.intentos > 0 ? ` · ${props.intentos} de 3 intentos` : ''}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {props.permalink ? (
            <a
              href={props.permalink}
              target="_blank"
              rel="noreferrer"
              className="rounded-silk shadow-alzado bg-arcilla px-3 py-1.5 text-xs font-medium text-tinta transition-colors hover:bg-arcilla-alta"
            >
              Ver el post
            </a>
          ) : null}
          <Boton onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar respuesta'}</Boton>
          <form action={async (datos) => setAviso((await atenderComentarioManual(datos)).mensaje)}>
            <input type="hidden" name="comentarioId" value={props.comentarioId} />
            <Enviar variante={props.enEspera ? 'secundario' : 'principal'} haciendo="Marcando">
              Ya lo atendí
            </Enviar>
          </form>
        </div>
      </div>

      <p className="mt-3 rounded-silk bg-arcilla-alta px-3 py-2 text-xs text-tinta-2">{props.sugerida}</p>

      {aviso ? (
        <p role="status" className="mt-1.5 text-xs text-tinta-3">
          {aviso}
        </p>
      ) : null}
    </article>
  )
}
