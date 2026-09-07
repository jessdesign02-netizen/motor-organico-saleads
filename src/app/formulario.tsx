'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Piezas compartidas de los formularios.
 *
 * Sin estado de envío, una acción que tarda parece no haber pasado y la persona
 * vuelve a pulsar. En "Crear pieza" eso creaba dos piezas, y en "Aprobar el día"
 * disparaba dos veces la publicación. El botón se bloquea mientras corre, y
 * dice lo que está haciendo.
 */

const VARIANTES = {
  // Un solo botón manda en cada pantalla, y se ve que manda.
  principal: 'bg-tinta text-superficie hover:bg-tinta-2',
  // El secundario se leía casi blanco sobre blanco. Ahora tiene tinta propia.
  secundario: 'border border-linea-fuerte bg-superficie text-tinta hover:bg-hundido',
  // Lo que borra o descarta se anuncia antes de que la persona lo pulse.
  peligro: 'border border-critico-tinte bg-critico-tinte text-critico hover:border-critico',
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
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]}`}
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

/** Que algo se mueva mientras se espera es la diferencia entre "trabajando" y "colgado". */
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
    <button
      type={tipo}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${VARIANTES[variante]}`}
    >
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
      className={`rounded-lg px-3 py-2 text-sm ${
        resultado.ok ? 'bg-bien-tinte text-bien' : 'bg-critico-tinte text-critico'
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
      <span className="text-xs font-medium text-tinta-2">{etiqueta}</span>
      <div className="mt-1.5">{children}</div>
      {ayuda ? <span className="mt-1.5 block text-xs text-tinta-3">{ayuda}</span> : null}
    </label>
  )
}

export const ENTRADA =
  'w-full rounded-lg border border-linea-fuerte bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-tinta-3 disabled:bg-hundido disabled:text-tinta-3'
