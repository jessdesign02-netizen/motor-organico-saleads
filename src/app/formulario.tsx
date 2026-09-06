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

export function Enviar({
  children,
  haciendo,
  variante = 'principal',
}: {
  children: ReactNode
  /** Lo que se muestra mientras corre: "Guardando", "Publicando". */
  haciendo?: string
  variante?: 'principal' | 'secundario'
}) {
  const { pending } = useFormStatus()

  const estilo =
    variante === 'principal'
      ? 'rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white'
      : 'rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium'

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${estilo} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {pending ? (haciendo ?? 'Un momento') : children}
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
      className={`text-sm ${resultado.ok ? 'text-emerald-700' : 'text-red-700'}`}
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
      <span className="text-xs font-medium text-neutral-600">{etiqueta}</span>
      <div className="mt-1">{children}</div>
      {ayuda ? <span className="mt-1 block text-xs text-neutral-500">{ayuda}</span> : null}
    </label>
  )
}

export const ENTRADA =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50'
