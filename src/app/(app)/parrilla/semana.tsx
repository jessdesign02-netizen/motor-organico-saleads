'use client'

import Link from 'next/link'
import { useState } from 'react'
import { aplicarCalendario, aprobarSeleccion, descartarCalendario, proponerCalendario } from '@/app/acciones/parrilla'
import { DIAS } from '@/lib/dominio/semana'
import type { Marca, Pieza, PropuestaCalendario } from '@/lib/database.types'
import { Etiqueta } from '@/app/ui'
import { Aviso, Enviar } from '@/app/formulario'

type Props = {
  marca: Marca
  semana: string
  dias: string[]
  hoy: string
  piezas: Pieza[]
  faltantes: Record<string, string[]>
  propuesta: PropuestaCalendario | null
  puedeAprobar: boolean
}

export function SemanaDeLaMarca({ marca, semana, dias, hoy, piezas, faltantes, propuesta, puedeAprobar }: Props) {
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  const enRevision = piezas.filter((p) => p.estado === 'revision')
  const aprobables = piezas.filter((p) => p.estado === 'revision' || p.estado === 'borrador')

  async function correr(accion: (datos: FormData) => Promise<{ ok: boolean; mensaje: string }>, datos: FormData) {
    setAviso(await accion(datos))
    setMarcadas([])
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{marca.nombre}</h2>
        {puedeAprobar && aprobables.length > 0 ? (
          <form action={(datos) => correr(aprobarSeleccion, datos)} className="flex items-center gap-2">
            {marcadas.map((id) => (
              <input key={id} type="hidden" name="piezaId" value={id} />
            ))}
            <button
              type="button"
              onClick={() => setMarcadas(marcadas.length === aprobables.length ? [] : aprobables.map((p) => p.id))}
              className="text-xs text-neutral-600 hover:text-neutral-900"
            >
              {marcadas.length === aprobables.length ? 'Quitar la selección' : 'Marcar la semana'}
            </button>
            <Enviar haciendo="Aprobando">
              {marcadas.length > 0 ? `Aprobar ${marcadas.length}` : 'Aprobar'}
            </Enviar>
          </form>
        ) : null}
      </div>

      <Aviso resultado={aviso} />

      <div className="grid grid-cols-7 gap-2">
        {dias.map((dia, indice) => {
          const delDia = piezas.filter((p) => p.fecha_publicacion === dia)
          return (
            <div
              key={dia}
              className={`min-h-32 rounded-lg border p-2 ${dia === hoy ? 'border-neutral-900' : 'border-neutral-200'} bg-white`}
            >
              <p className="text-xs text-neutral-500">
                {DIAS[indice]} {dia.slice(8)}
              </p>
              <div className="mt-2 space-y-1">
                {delDia.map((pieza) => {
                  const falta = faltantes[pieza.id] ?? []
                  return (
                    <div key={pieza.id} className="rounded border border-neutral-200 p-2 text-xs">
                      <div className="flex items-start gap-1">
                        {puedeAprobar && (pieza.estado === 'revision' || pieza.estado === 'borrador') ? (
                          <input
                            type="checkbox"
                            checked={marcadas.includes(pieza.id)}
                            aria-label={`Marcar ${pieza.tema}`}
                            onChange={(e) =>
                              setMarcadas(
                                e.target.checked
                                  ? [...marcadas, pieza.id]
                                  : marcadas.filter((id) => id !== pieza.id),
                              )
                            }
                            className="mt-0.5"
                          />
                        ) : null}
                        <Link href={`/piezas/${pieza.id}`} className="line-clamp-2 font-medium hover:underline">
                          {pieza.tema}
                        </Link>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Etiqueta>{pieza.estado}</Etiqueta>
                        {pieza.sheet_pendiente ? (
                          <span className="text-sky-700" title="La hoja cambió y espera confirmación">
                            hoja ●
                          </span>
                        ) : null}
                      </div>
                      {falta.length > 0 ? (
                        <p className="mt-1 text-amber-700">falta {falta.join(', ')}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {piezas.some((p) => p.fecha_publicacion === null) ? (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-neutral-500">Sin fecha:</span>
          {piezas
            .filter((p) => p.fecha_publicacion === null)
            .map((pieza) => (
              <Link
                key={pieza.id}
                href={`/piezas/${pieza.id}`}
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs hover:border-neutral-400"
              >
                {pieza.tema}
              </Link>
            ))}
        </div>
      ) : null}

      {/* Módulo 3 · el recorrido de fechas asistido, tras una devolución. */}
      {puedeAprobar && propuesta ? (
        <div className="rounded-lg border border-sky-300 bg-sky-50 p-4">
          <p className="text-sm font-medium text-sky-900">Propuesta de calendario</p>
          <p className="text-xs text-sky-800">{propuesta.motivo}</p>
          <ul className="mt-2 space-y-1 text-xs text-sky-900">
            {propuesta.propuesta.map((linea) => (
              <li key={linea.id}>
                {linea.tema} pasa al {linea.fecha}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <form action={(datos) => correr(aplicarCalendario, datos)}>
              <input type="hidden" name="propuestaId" value={propuesta.id} />
              <Enviar haciendo="Aplicando">Confirmar el calendario</Enviar>
            </form>
            <form action={(datos) => correr(descartarCalendario, datos)}>
              <input type="hidden" name="propuestaId" value={propuesta.id} />
              <Enviar variante="secundario" haciendo="Descartando">
                Dejarlo como está
              </Enviar>
            </form>
          </div>
        </div>
      ) : null}

      {puedeAprobar && !propuesta && enRevision.length > 0 ? (
        <form action={(datos) => correr(proponerCalendario, datos)} className="flex items-center gap-2">
          <input type="hidden" name="marcaId" value={marca.id} />
          <input type="hidden" name="semana" value={semana} />
          <select
            name="devueltaId"
            aria-label="Pieza que volvió a revisión"
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
          >
            {enRevision.map((pieza) => (
              <option key={pieza.id} value={pieza.id}>
                {pieza.tema}
              </option>
            ))}
          </select>
          <Enviar variante="secundario" haciendo="Calculando">
            Proponer nuevo calendario
          </Enviar>
        </form>
      ) : null}
    </section>
  )
}
