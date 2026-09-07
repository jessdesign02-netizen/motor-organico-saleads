'use client'

import Link from 'next/link'
import { useState } from 'react'
import { aplicarCalendario, aprobarSeleccion, descartarCalendario, proponerCalendario } from '@/app/acciones/parrilla'
import { DIAS } from '@/lib/dominio/semana'
import type { Marca, Pieza, PropuestaCalendario } from '@/lib/database.types'
import { ESTADO_PIEZA, enumerar, fechaLarga, hora } from '@/lib/etiquetas'
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
  const sinFecha = piezas.filter((p) => p.fecha_publicacion === null)

  async function correr(accion: (datos: FormData) => Promise<{ ok: boolean; mensaje: string }>, datos: FormData) {
    setAviso(await accion(datos))
    setMarcadas([])
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-tinta">{marca.nombre}</h2>
          {/* El resumen de la semana, antes de mirar día por día. */}
          <p className="text-xs text-tinta-3">
            {piezas.length === 0
              ? 'sin piezas'
              : `${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'}${
                  aprobables.length > 0 ? ` · ${aprobables.length} sin aprobar` : ''
                }`}
          </p>
        </div>

        {puedeAprobar && aprobables.length > 0 ? (
          <form action={(datos) => correr(aprobarSeleccion, datos)} className="flex items-center gap-2">
            {marcadas.map((id) => (
              <input key={id} type="hidden" name="piezaId" value={id} />
            ))}
            <button
              type="button"
              onClick={() => setMarcadas(marcadas.length === aprobables.length ? [] : aprobables.map((p) => p.id))}
              className="rounded-lg px-2 py-1 text-xs text-tinta-2 transition-colors hover:bg-hundido hover:text-tinta"
            >
              {marcadas.length === aprobables.length ? 'Quitar la selección' : `Marcar las ${aprobables.length}`}
            </button>
            <Enviar haciendo="Aprobando">
              {marcadas.length > 0 ? `Aprobar ${marcadas.length}` : 'Aprobar'}
            </Enviar>
          </form>
        ) : null}
      </div>

      <Aviso resultado={aviso} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {dias.map((dia, indice) => {
          const delDia = piezas
            .filter((p) => p.fecha_publicacion === dia)
            .sort((a, b) => (a.hora_publicacion ?? '').localeCompare(b.hora_publicacion ?? ''))
          const esHoy = dia === hoy

          return (
            <div
              key={dia}
              className={`flex min-h-28 flex-col rounded-xl border p-2 ${
                esHoy ? 'border-tinta bg-superficie' : 'border-linea bg-superficie'
              }`}
            >
              <p className="flex items-baseline gap-1.5 px-1 pb-2">
                <span className={`text-xs font-medium ${esHoy ? 'text-tinta' : 'text-tinta-2'}`}>
                  {DIAS[indice]}
                </span>
                <span className="text-xs text-tinta-3">{dia.slice(8)}</span>
                {esHoy ? (
                  <span className="ml-auto rounded-full bg-tinta px-1.5 text-[10px] font-medium text-superficie">
                    hoy
                  </span>
                ) : null}
              </p>

              <div className="flex flex-1 flex-col gap-1.5">
                {delDia.length === 0 ? (
                  <span className="px-1 text-xs text-tinta-3" aria-hidden>
                    ·
                  </span>
                ) : null}

                {delDia.map((pieza) => {
                  const falta = faltantes[pieza.id] ?? []
                  const marcable = puedeAprobar && (pieza.estado === 'revision' || pieza.estado === 'borrador')

                  return (
                    <div
                      key={pieza.id}
                      className={`rounded-lg border p-2 transition-colors ${
                        marcadas.includes(pieza.id)
                          ? 'border-tinta bg-hundido'
                          : 'border-linea bg-superficie hover:border-linea-fuerte'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        {marcable ? (
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
                            className="mt-0.5 shrink-0 accent-[var(--color-tinta)]"
                          />
                        ) : null}
                        <Link
                          href={`/piezas/${pieza.id}`}
                          className="line-clamp-3 text-xs font-medium leading-snug text-tinta hover:underline"
                        >
                          {pieza.tema}
                        </Link>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Etiqueta rotulo={ESTADO_PIEZA[pieza.estado]} titulo />
                        {pieza.hora_publicacion ? (
                          <span className="text-[11px] tabular-nums text-tinta-3">
                            {hora(pieza.hora_publicacion)}
                          </span>
                        ) : null}
                      </div>

                      {/* Lo que falta se dice sin gritar: es información, no una alarma. */}
                      {falta.length > 0 ? (
                        <p className="mt-1.5 text-[11px] leading-tight text-tinta-3">
                          Falta {enumerar(falta)}
                        </p>
                      ) : null}

                      {pieza.sheet_pendiente ? (
                        <p className="mt-1.5 text-[11px] leading-tight text-info">
                          La hoja cambió, espera confirmación
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {sinFecha.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-linea bg-superficie px-4 py-3">
          <span className="text-xs font-medium text-tinta-2">
            Sin fecha ({sinFecha.length}) · no van a salir hasta que se les ponga día
          </span>
          {sinFecha.map((pieza) => (
            <Link
              key={pieza.id}
              href={`/piezas/${pieza.id}`}
              className="rounded-lg border border-linea px-2 py-1 text-xs text-tinta transition-colors hover:border-linea-fuerte hover:bg-hundido"
            >
              {pieza.tema}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Módulo 3 · el recorrido de fechas asistido, tras una devolución. */}
      {puedeAprobar && propuesta ? (
        <div className="rounded-xl border border-info-tinte bg-info-tinte p-4">
          <p className="text-sm font-medium text-info">Propuesta de calendario</p>
          <p className="mt-0.5 text-xs text-info">
            {propuesta.motivo}. Nada se mueve hasta que lo confirmes.
          </p>
          <ul className="mt-3 space-y-1">
            {propuesta.propuesta.map((linea) => (
              <li key={linea.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-info">
                <span className="font-medium">{linea.tema}</span>
                <span>pasa al {fechaLarga(linea.fecha)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
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
        <form
          action={(datos) => correr(proponerCalendario, datos)}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-linea bg-superficie px-4 py-3"
        >
          <input type="hidden" name="marcaId" value={marca.id} />
          <input type="hidden" name="semana" value={semana} />
          <span className="text-xs text-tinta-2">Si una pieza volvió a revisión, corre el resto de la semana:</span>
          <select
            name="devueltaId"
            aria-label="Pieza que volvió a revisión"
            className="rounded-lg border border-linea-fuerte bg-superficie px-2 py-1 text-xs text-tinta"
          >
            {enRevision.map((pieza) => (
              <option key={pieza.id} value={pieza.id}>
                {pieza.tema}
              </option>
            ))}
          </select>
          <Enviar variante="secundario" haciendo="Calculando">
            Proponer calendario
          </Enviar>
        </form>
      ) : null}
    </section>
  )
}
