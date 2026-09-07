'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  IconoAutomatizaciones,
  IconoAvisos,
  IconoChat,
  IconoConfiguracion,
  IconoContactos,
  IconoDashboard,
  IconoDia,
  IconoDiagnostico,
  IconoParrilla,
  IconoPublicaciones,
  IconoRecursos,
  IconoResultados,
} from './iconos'

/**
 * El menú lateral.
 *
 * Antes eran ocho enlaces en una fila arriba, sin señal de dónde estabas y sin
 * sitio para crecer. En vertical caben los nombres completos, la sección activa
 * se ve, y lo que pide atención lleva su cuenta al lado.
 *
 * Se divide en dos: lo que se usa para trabajar, y lo que se mira cuando algo
 * va mal. Mezclarlos hacía que el diagnóstico pesara lo mismo que la parrilla.
 */

export type Cuentas = { chat: number; avisos: number }

type Entrada = {
  href: string
  texto: string
  icono: (p: { className?: string }) => ReactNode
  cuenta?: number
  tono?: 'aviso' | 'neutro'
}

export function BarraLateral({
  nombre,
  rol,
  cuentas,
}: {
  nombre: string
  rol: string
  cuentas: Cuentas
}) {
  const ruta = usePathname()
  const [abierta, setAbierta] = useState(false)

  const principales: Entrada[] = [
    { href: '/dashboard', texto: 'Dashboard', icono: IconoDashboard },
    { href: '/contactos', texto: 'Contactos', icono: IconoContactos },
    { href: '/chat', texto: 'Chat en vivo', icono: IconoChat, cuenta: cuentas.chat, tono: 'aviso' },
    { href: '/publicaciones', texto: 'Publicaciones', icono: IconoPublicaciones },
    { href: '/parrilla', texto: 'Parrilla', icono: IconoParrilla },
    { href: '/resultados', texto: 'Resultados', icono: IconoResultados },
    { href: '/automatizaciones', texto: 'Automatizaciones', icono: IconoAutomatizaciones },
    { href: '/configuracion', texto: 'Configuración', icono: IconoConfiguracion },
  ]

  const operacion: Entrada[] = [
    { href: '/dia', texto: 'El día', icono: IconoDia },
    { href: '/avisos', texto: 'Avisos', icono: IconoAvisos, cuenta: cuentas.avisos, tono: 'aviso' },
    { href: '/recursos', texto: 'Recursos', icono: IconoRecursos },
    { href: '/diagnostico', texto: 'Diagnóstico', icono: IconoDiagnostico },
  ]

  const activa = (href: string) => ruta === href || ruta.startsWith(`${href}/`)

  const enlace = (entrada: Entrada) => {
    const Icono = entrada.icono
    const puesta = activa(entrada.href)
    return (
      <li key={entrada.href}>
        <Link
          href={entrada.href}
          aria-current={puesta ? 'page' : undefined}
          onClick={() => setAbierta(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            puesta
              ? 'bg-hundido font-medium text-tinta'
              : 'text-tinta-2 hover:bg-hundido hover:text-tinta'
          }`}
        >
          <Icono className={`size-[18px] shrink-0 ${puesta ? 'text-tinta' : 'text-tinta-3'}`} />
          <span className="flex-1 truncate">{entrada.texto}</span>
          {entrada.cuenta && entrada.cuenta > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                entrada.tono === 'aviso' ? 'bg-aviso-tinte text-aviso' : 'bg-hundido text-tinta-2'
              }`}
            >
              {entrada.cuenta}
            </span>
          ) : null}
        </Link>
      </li>
    )
  }

  return (
    <>
      {/* En pantalla estrecha la barra se guarda y se abre con un botón. */}
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        aria-controls="barra-lateral"
        className="fixed left-4 top-3 z-30 rounded-lg border border-linea bg-superficie p-2 lg:hidden"
      >
        <span className="sr-only">Menú</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      {abierta ? (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={() => setAbierta(false)}
          className="fixed inset-0 z-20 bg-tinta/20 lg:hidden"
        />
      ) : null}

      <aside
        id="barra-lateral"
        className={`fixed inset-y-0 left-0 z-20 flex w-60 shrink-0 flex-col border-r border-linea bg-superficie transition-transform lg:translate-x-0 ${
          abierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-linea px-5 py-4">
          <p className="text-sm font-semibold tracking-tight text-tinta">Motor Orgánico</p>
          <p className="text-xs text-tinta-3">SaleADS · Juanads</p>
        </div>

        <div className="flex items-center gap-2.5 border-b border-linea px-5 py-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-hundido text-xs font-semibold text-tinta-2"
            aria-hidden
          >
            {nombre.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-medium text-tinta">{nombre}</span>
            <span className="block text-xs text-tinta-3">{rol}</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">{principales.map(enlace)}</ul>

          <p className="px-3 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wide text-tinta-3">
            Operación
          </p>
          <ul className="space-y-0.5">{operacion.map(enlace)}</ul>
        </nav>

        <form action="/auth/salir" method="post" className="border-t border-linea p-3">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-tinta-2 transition-colors hover:bg-hundido hover:text-tinta"
          >
            Salir
          </button>
        </form>
      </aside>
    </>
  )
}
