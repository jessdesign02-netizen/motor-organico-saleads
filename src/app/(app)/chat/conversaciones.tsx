'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { atenderComentarioManual } from '@/app/acciones/piezas'
import { Boton, Enviar } from '@/app/formulario'
import { Etiqueta } from '@/app/ui'
import { ESTADO_COMENTARIO, errorLegible, hace } from '@/lib/etiquetas'
import type { EstadoComentario } from '@/lib/database.types'

/**
 * Chat en vivo · el CRM de conversaciones.
 *
 * El agente ya responde solo. Esto no lo hace: lo muestra. Cada conversación es
 * lo que una persona escribió y lo que el sistema le contestó, en orden, con lo
 * que pasó después —si abrió el enlace— al lado.
 *
 * "En vivo" se resuelve refrescando desde el servidor cada pocos segundos. Con
 * Supabase real esto puede pasar a una suscripción Realtime y el resto de la
 * pantalla no se entera: lo único que cambia es de dónde llegan los datos.
 */

const CADA = 15_000

export type Mensaje = {
  id: string
  deLaPersona: boolean
  texto: string
  cuando: string
  estado: EstadoComentario | null
  motivo: string | null
  fallo: string | null
}

export type Conversacion = {
  clave: string
  autor: string
  red: string | null
  pieza: string
  piezaId: string | null
  permalink: string | null
  palabra: string | null
  clics: number | null
  ultimoAt: string
  estado: EstadoComentario
  necesitaMano: boolean
  sugerida: string
  mensajes: Mensaje[]
}

const FILTROS = [
  { clave: 'todas', texto: 'Todas' },
  { clave: 'mano', texto: 'Necesitan tu mano' },
  { clave: 'respondidas', texto: 'Respondidas' },
] as const

export function Conversaciones({ conversaciones }: { conversaciones: Conversacion[] }) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['clave']>('todas')
  const [abierta, setAbierta] = useState<string | null>(conversaciones[0]?.clave ?? null)
  const [vivo, setVivo] = useState(true)
  const [copiado, setCopiado] = useState(false)

  // Trae lo que haya llegado desde la última vez. router.refresh() vuelve a
  // correr el componente de servidor sin recargar la página ni perder el hilo
  // que la persona está leyendo.
  useEffect(() => {
    if (!vivo) return
    const reloj = setInterval(() => router.refresh(), CADA)
    return () => clearInterval(reloj)
  }, [vivo, router])

  const visibles = conversaciones.filter((c) => {
    if (filtro === 'mano') return c.necesitaMano
    if (filtro === 'respondidas') return c.estado === 'respondido'
    return true
  })

  const hilo = visibles.find((c) => c.clave === abierta) ?? visibles[0] ?? null

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar conversaciones">
          {FILTROS.map((f) => {
            const cuantas =
              f.clave === 'mano'
                ? conversaciones.filter((c) => c.necesitaMano).length
                : f.clave === 'respondidas'
                  ? conversaciones.filter((c) => c.estado === 'respondido').length
                  : conversaciones.length
            return (
              <button
                key={f.clave}
                type="button"
                role="tab"
                aria-selected={filtro === f.clave}
                onClick={() => setFiltro(f.clave)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  filtro === f.clave
                    ? 'bg-hundido font-medium text-tinta'
                    : 'text-tinta-2 hover:bg-hundido hover:text-tinta'
                }`}
              >
                {f.texto}
                <span className="ml-1.5 tabular-nums text-tinta-3">{cuantas}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setVivo(!vivo)}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-tinta-2 transition-colors hover:bg-hundido"
          aria-pressed={vivo}
        >
          <span
            className={`size-2 rounded-full ${vivo ? 'animate-pulse bg-bien' : 'bg-tinta-3'}`}
            aria-hidden
          />
          {vivo ? 'En vivo' : 'Pausado'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Lista de conversaciones */}
        <div className="max-h-[34rem] overflow-y-auto rounded-xl border border-linea bg-superficie shadow-carta">
          {visibles.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-tinta-3">Nada por aquí todavía.</p>
          ) : null}
          <ul className="divide-y divide-linea">
            {visibles.map((conversacion) => {
              const puesta = hilo?.clave === conversacion.clave
              const ultimo = conversacion.mensajes.at(-1)
              return (
                <li key={conversacion.clave}>
                  <button
                    type="button"
                    onClick={() => setAbierta(conversacion.clave)}
                    aria-current={puesta ? 'true' : undefined}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      puesta ? 'bg-hundido' : 'hover:bg-hundido'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-tinta">
                        @{conversacion.autor}
                      </span>
                      <span className="shrink-0 text-[11px] text-tinta-3">
                        {hace(conversacion.ultimoAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-tinta-2">
                      {ultimo && !ultimo.deLaPersona ? (
                        <span className="text-tinta-3">Tú: </span>
                      ) : null}
                      {ultimo?.texto ?? ''}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Etiqueta rotulo={ESTADO_COMENTARIO[conversacion.estado]} />
                      {conversacion.red ? (
                        <span className="text-[11px] text-tinta-3">{conversacion.red}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* El hilo */}
        {hilo ? (
          <div className="flex max-h-[34rem] flex-col rounded-xl border border-linea bg-superficie shadow-carta">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linea px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-tinta">@{hilo.autor}</p>
                <p className="mt-0.5 text-xs text-tinta-2">
                  {hilo.red ? `${hilo.red} · ` : ''}
                  {hilo.piezaId ? (
                    <Link href={`/piezas/${hilo.piezaId}`} className="underline underline-offset-2">
                      {hilo.pieza}
                    </Link>
                  ) : (
                    hilo.pieza
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hilo.permalink ? (
                  <a
                    href={hilo.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-linea-fuerte bg-superficie px-3 py-1.5 text-xs font-medium text-tinta transition-colors hover:bg-hundido"
                  >
                    Ver el post
                  </a>
                ) : null}
                {hilo.necesitaMano ? (
                  <>
                    <Boton onClick={() => copiar(hilo.sugerida)}>
                      {copiado ? '✓ Copiado' : 'Copiar respuesta'}
                    </Boton>
                    <form
                      action={async (datos) => {
                        await atenderComentarioManual(datos)
                        router.refresh()
                      }}
                    >
                      <input type="hidden" name="comentarioId" value={hilo.mensajes[0]?.id ?? ''} />
                      <Enviar haciendo="Marcando">Ya lo atendí</Enviar>
                    </form>
                  </>
                ) : null}
              </div>
            </div>

            {/* Los datos que hacen de esto un CRM y no un chat suelto. */}
            <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b border-linea px-5 py-2.5 text-xs">
              <div className="flex gap-1.5">
                <dt className="text-tinta-3">Palabra</dt>
                <dd className="font-medium text-tinta">{hilo.palabra ?? '—'}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-tinta-3">Clics al enlace</dt>
                <dd className="font-medium tabular-nums text-tinta">{hilo.clics ?? 0}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-tinta-3">Estado</dt>
                <dd>
                  <Etiqueta rotulo={ESTADO_COMENTARIO[hilo.estado]} titulo />
                </dd>
              </div>
            </dl>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {hilo.mensajes.map((mensaje) => (
                <div
                  key={mensaje.id}
                  className={`flex ${mensaje.deLaPersona ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="max-w-[85%]">
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm ${
                        mensaje.deLaPersona
                          ? 'rounded-bl-sm bg-hundido text-tinta'
                          : 'rounded-br-sm bg-info-tinte text-info'
                      }`}
                    >
                      {mensaje.texto}
                    </div>
                    <p
                      className={`mt-1 flex items-center gap-2 text-[11px] text-tinta-3 ${
                        mensaje.deLaPersona ? '' : 'justify-end'
                      }`}
                    >
                      <span>{mensaje.deLaPersona ? 'Comentó' : 'El sistema respondió'}</span>
                      <span>{hace(mensaje.cuando)}</span>
                    </p>
                    {mensaje.fallo ? (
                      <p className="mt-0.5 text-right text-[11px] text-serio">
                        {errorLegible(mensaje.fallo) ?? mensaje.fallo}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

              {hilo.necesitaMano ? (
                <div className="rounded-xl border border-dashed border-linea-fuerte px-4 py-3">
                  <p className="text-xs font-medium text-tinta-2">
                    El sistema no pudo responder aquí
                  </p>
                  <p className="mt-0.5 text-xs text-tinta-3">{hilo.mensajes.at(-1)?.motivo ?? ''}</p>
                  <p className="mt-2 rounded-lg bg-hundido px-3 py-2 text-xs text-tinta-2">
                    {hilo.sugerida}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-linea-fuerte px-6 py-16">
            <p className="text-sm text-tinta-3">Elige una conversación de la lista.</p>
          </div>
        )}
      </div>
    </div>
  )
}
