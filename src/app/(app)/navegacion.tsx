'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * El menú.
 *
 * Antes eran ocho enlaces del mismo peso, sin señal de dónde estabas. Ahora la
 * sección activa se marca, y las dos que piden acción —bandeja y avisos— llevan
 * su cuenta encima: lo que necesita una mano se ve sin entrar a buscarlo.
 */

type Seccion = { href: string; texto: string; cuenta?: number }

export function Navegacion({ diarias, sistema }: { diarias: Seccion[]; sistema: Seccion[] }) {
  const ruta = usePathname()
  const activa = (href: string) => ruta === href || ruta.startsWith(`${href}/`)

  const enlace = (seccion: Seccion) => (
    <Link
      key={seccion.href}
      href={seccion.href}
      aria-current={activa(seccion.href) ? 'page' : undefined}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        activa(seccion.href)
          ? 'bg-hundido font-medium text-tinta'
          : 'text-tinta-2 hover:bg-hundido hover:text-tinta'
      }`}
    >
      {seccion.texto}
      {seccion.cuenta && seccion.cuenta > 0 ? (
        <span className="rounded-full bg-aviso-tinte px-1.5 text-xs font-medium tabular-nums text-aviso">
          {seccion.cuenta}
        </span>
      ) : null}
    </Link>
  )

  return (
    <nav className="flex flex-1 flex-wrap items-center gap-1">
      {diarias.map(enlace)}
      <span className="mx-1 hidden h-4 w-px bg-linea sm:block" aria-hidden />
      {sistema.map(enlace)}
    </nav>
  )
}
