/**
 * Los iconos del menú, dibujados a mano en SVG.
 *
 * Una librería de iconos son cientos de kilobytes para usar ocho. Estos son
 * trazos de 1.5 sobre una caja de 24, que es lo que los hace verse de la misma
 * familia aunque los dibuje una persona distinta cada vez.
 */

type Props = { className?: string }

function Marco({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-[18px] shrink-0'}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconoDashboard(p: Props) {
  return (
    <Marco {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Marco>
  )
}

export function IconoContactos(p: Props) {
  return (
    <Marco {...p}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8" />
      <path d="M17.5 14.2A5 5 0 0 1 20.5 19" />
    </Marco>
  )
}

export function IconoChat(p: Props) {
  return (
    <Marco {...p}>
      <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.4L4 21l1.4-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
      <path d="M8.5 11.5h7M8.5 14.5h4" />
    </Marco>
  )
}

export function IconoPublicaciones(p: Props) {
  return (
    <Marco {...p}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M3.5 9h17" />
      <path d="m10.5 13 3.5 2-3.5 2v-4Z" />
    </Marco>
  )
}

export function IconoParrilla(p: Props) {
  return (
    <Marco {...p}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8.5 3v3M15.5 3v3" />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" />
    </Marco>
  )
}

export function IconoResultados(p: Props) {
  return (
    <Marco {...p}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7.5" y="12" width="3.5" height="5" rx="1" />
      <rect x="13.5" y="7.5" width="3.5" height="9.5" rx="1" />
    </Marco>
  )
}

export function IconoAutomatizaciones(p: Props) {
  return (
    <Marco {...p}>
      <circle cx="12" cy="12" r="2.5" />
      <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(45 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-45 12 12)" />
    </Marco>
  )
}

export function IconoConfiguracion(p: Props) {
  return (
    <Marco {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5M18.7 18.7l-1.5-1.5M6.8 6.8 5.3 5.3" />
    </Marco>
  )
}

export function IconoDia(p: Props) {
  return (
    <Marco {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Marco>
  )
}

export function IconoAvisos(p: Props) {
  return (
    <Marco {...p}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </Marco>
  )
}

export function IconoRecursos(p: Props) {
  return (
    <Marco {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5v-10Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5v-10Z" />
    </Marco>
  )
}

export function IconoDiagnostico(p: Props) {
  return (
    <Marco {...p}>
      <path d="M3 12h4l2.5-6 4 12L16 12h5" />
    </Marco>
  )
}
