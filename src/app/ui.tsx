import type { ReactNode } from 'react'

const TONOS: Record<string, string> = {
  borrador: 'bg-neutral-100 text-neutral-700',
  revision: 'bg-amber-100 text-amber-800',
  aprobado: 'bg-emerald-100 text-emerald-800',
  programado: 'bg-sky-100 text-sky-800',
  publicado: 'bg-violet-100 text-violet-800',
  fallido: 'bg-red-100 text-red-800',
  pendiente: 'bg-neutral-100 text-neutral-700',
  respondido: 'bg-emerald-100 text-emerald-800',
  manual_pendiente: 'bg-amber-100 text-amber-800',
}

export function Etiqueta({ children }: { children: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${TONOS[children] ?? TONOS.borrador}`}>
      {children.replace('_', ' ')}
    </span>
  )
}

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Vacio({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">{children}</p>
}

export function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs text-neutral-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{valor}</p>
    </div>
  )
}
