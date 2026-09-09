'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Botones y campos, en Silk.
 *
 * El botón sobresale de la arcilla y al pulsarlo se hunde: es toda la
 * gramática del estilo, y de paso da la respuesta táctil que en un botón plano
 * hay que fingir con un cambio de color.
 *
 * El campo de texto va al revés, tallado en la superficie. Recibe algo, así que
 * se hunde.
 */

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-silk px-4 py-2.5 text-sm font-medium transition-all active:shadow-pulsado disabled:cursor-not-allowed disabled:opacity-55'

const VARIANTES = {
  /** Manda en la pantalla. El color es el relleno, no solo la tinta. */
  principal: 'bg-primario text-white shadow-alzado hover:brightness-105',
  /** Misma arcilla, relieve propio: presente sin competir. */
  secundario: 'bg-arcilla text-tinta shadow-alzado hover:shadow-suave',
  /** Ya está tallado: para lo que está activo o seleccionado. */
  hundido: 'bg-arcilla text-primario-texto shadow-hundido',
  /** Lo que borra o descarta se anuncia antes de pulsarlo. */
  peligro: 'bg-arcilla text-critico shadow-alzado hover:shadow-suave',
} as const

export function Enviar({
  children,
  haciendo,
  variante = 'principal',
}: {
  children: ReactNode
  /** Lo que se muestra mientras corre: "Guardando", "Publicando". */
  haciendo?: string
  variante?: keyof typeof VARIANTES
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${BASE} ${VARIANTES[variante]} ${pending ? 'shadow-pulsado' : ''}`}
    >
      {pending ? (
        <>
          <Girando />
          {haciendo ?? 'Un momento'}
        </>
      ) : (
        children
      )}
    </button>
  )
}

/** Que algo se mueva es la diferencia entre "trabajando" y "colgado". */
function Girando() {
  return (
    <svg className="size-3.5 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Botón que no envía un formulario: navega o cambia algo en la pantalla. */
export function Boton({
  children,
  onClick,
  variante = 'secundario',
  tipo = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variante?: keyof typeof VARIANTES
  tipo?: 'button' | 'reset'
}) {
  return (
    <button type={tipo} onClick={onClick} className={`${BASE} ${VARIANTES[variante]}`}>
      {children}
    </button>
  )
}

/**
 * El resultado de una acción, anunciado también a un lector de pantalla.
 * `role="status"` lo lee sin interrumpir; `role="alert"` interrumpe, que es lo
 * que corresponde cuando algo salió mal.
 */
export function Aviso({ resultado }: { resultado: { ok: boolean; mensaje: string } | null }) {
  if (!resultado) return null

  return (
    <p
      role={resultado.ok ? 'status' : 'alert'}
      aria-live={resultado.ok ? 'polite' : 'assertive'}
      className={`rounded-silk bg-arcilla px-4 py-3 text-sm shadow-hundido ${
        resultado.ok ? 'text-bien' : 'text-critico'
      }`}
    >
      {resultado.mensaje}
    </p>
  )
}

/** Campo con su etiqueta de verdad, en lugar de un texto de relleno dentro. */
export function Campo({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-tinta-2">{etiqueta}</span>
      <div className="mt-2">{children}</div>
      {ayuda ? <span className="mt-2 block text-xs text-tinta-3">{ayuda}</span> : null}
    </label>
  )
}

/** Tallado en la arcilla: recibe algo, así que se hunde en lugar de sobresalir. */
export const ENTRADA =
  'w-full rounded-silk bg-arcilla px-4 py-2.5 text-sm text-tinta shadow-hundido outline-none placeholder:text-tinta-3 focus:shadow-pulsado disabled:text-tinta-3'
