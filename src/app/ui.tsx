import type { ReactNode } from 'react'
import { cifra, type Rotulo, type Tono } from '@/lib/etiquetas'

/**
 * Las piezas visuales compartidas, en Silk.
 *
 * Nada lleva borde. Lo que separa una superficie de otra es el relieve: sombra
 * oscura abajo a la derecha, clara arriba a la izquierda. Todo comparte el tono
 * de la arcilla, porque en cuanto una superficie cambia de color la ilusión de
 * profundidad se rompe.
 */

// ---------------------------------------------------------------------------
// Etiquetas de estado
// ---------------------------------------------------------------------------

const TINTA_TONO: Record<Tono, string> = {
  neutro: 'text-tinta-2',
  bien: 'text-bien',
  aviso: 'text-aviso',
  info: 'text-info',
  serio: 'text-serio',
  critico: 'text-critico',
}

/**
 * El estado va en el texto, no solo en el color: así se entiende con daltonismo
 * y en blanco y negro. La píldora se levanta apenas de la arcilla en lugar de
 * pintarse de un tinte, que rompería la familia de color del estilo.
 */
export function Etiqueta({ rotulo, titulo }: { rotulo: Rotulo; titulo?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-arcilla px-2.5 py-1 text-xs font-medium shadow-suave ${TINTA_TONO[rotulo.tono]}`}
      {...(titulo && rotulo.explica ? { title: rotulo.explica } : {})}
    >
      {rotulo.texto}
    </span>
  )
}

/** Un punto de color con su texto al lado, para listas donde la píldora pesa. */
export function Punto({ tono, children }: { tono: Tono; children: ReactNode }) {
  const color: Record<Tono, string> = {
    neutro: 'bg-tinta-3',
    bien: 'bg-bien',
    aviso: 'bg-aviso',
    info: 'bg-primario',
    serio: 'bg-serio',
    critico: 'bg-critico',
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tinta-2">
      <span className={`size-1.5 shrink-0 rounded-full ${color[tono]}`} aria-hidden />
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Estructura de página
// ---------------------------------------------------------------------------

export function Encabezado({
  titulo,
  bajada,
  children,
}: {
  titulo: string
  bajada?: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] leading-tight tracking-tight text-tinta">{titulo}</h1>
        {bajada ? <p className="mt-1 text-sm text-tinta-2">{bajada}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </header>
  )
}

export function Tarjeta({
  titulo,
  bajada,
  accion,
  children,
  ajustado = false,
}: {
  titulo?: string
  bajada?: string
  accion?: ReactNode
  children: ReactNode
  /** Sin relleno propio: para listas que llegan hasta el borde de la tarjeta. */
  ajustado?: boolean
}) {
  return (
    <section className="rounded-silk bg-arcilla p-6 shadow-alzado">
      {titulo ? (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] tracking-tight text-tinta">{titulo}</h2>
            {bajada ? <p className="mt-1 text-xs text-tinta-2">{bajada}</p> : null}
          </div>
          {accion}
        </div>
      ) : null}
      <div className={ajustado ? '-mx-2' : ''}>{children}</div>
    </section>
  )
}

/**
 * El vacío dice qué falta y cómo llenarlo. Se talla en la arcilla en vez de
 * levantarse: no hay nada que sacar a la superficie.
 */
export function Vacio({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-silk bg-arcilla px-6 py-10 text-center shadow-hundido">
      <p className="text-sm text-tinta-2">{children}</p>
      {accion ? <div className="mt-4 flex justify-center">{accion}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

export function Dato({
  etiqueta,
  valor,
  nota,
  acento = 'neutro',
}: {
  etiqueta: string
  valor: string | number
  nota?: string
  acento?: 'neutro' | 'primario' | 'terciario' | 'bien' | 'aviso'
}) {
  const color: Record<string, string> = {
    neutro: 'text-tinta',
    primario: 'text-primario-texto',
    terciario: 'text-terciario-texto',
    bien: 'text-bien',
    aviso: 'text-aviso',
  }

  return (
    <div className="flex min-h-[7.5rem] flex-col justify-between rounded-silk bg-arcilla p-5 shadow-alzado">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tinta-3">{etiqueta}</p>
      <div className="mt-3">
        <p className={`text-[1.75rem] font-semibold leading-none tracking-tight ${color[acento]}`}>
          {typeof valor === 'number' ? cifra(valor) : valor}
        </p>
        {nota ? <p className={`mt-1.5 text-[13px] ${color[acento]}`}>{nota}</p> : null}
      </div>
    </div>
  )
}

/** Barra de magnitud: pista tallada, relleno alzado. */
export function Barra({ valor, maximo, serie = 1 }: { valor: number; maximo: number; serie?: 1 | 2 | 3 }) {
  const ancho = maximo > 0 ? Math.max(valor > 0 ? 3 : 0, (valor / maximo) * 100) : 0
  const color = { 1: 'bg-serie-1', 2: 'bg-serie-2', 3: 'bg-serie-3' }[serie]
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-arcilla shadow-hundido" aria-hidden>
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${ancho}%` }} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

export function Tabla({ cabeceras, children }: { cabeceras: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {cabeceras.map((cabecera, i) => (
              <th
                key={i}
                scope="col"
                className={`px-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-tinta-3 ${
                  i === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        {/* Sin líneas divisorias: en neomorfismo el aire separa, no el trazo. */}
        <tbody className="[&>tr]:rounded-silk [&>tr]:transition-shadow hover:[&>tr]:shadow-suave">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function Celda({
  children,
  numero = false,
  apagado = false,
}: {
  children: ReactNode
  numero?: boolean
  apagado?: boolean
}) {
  return (
    <td
      className={`px-4 py-3.5 ${numero ? 'text-right tabular-nums' : 'text-left'} ${
        apagado ? 'text-tinta-3' : 'text-tinta'
      }`}
    >
      {children}
    </td>
  )
}

/** Icono en una pastilla con relieve. Le pone cara a una franja o a un atajo. */
export function Marca({
  children,
  acento = 'primario',
  tamano = 'md',
}: {
  children: ReactNode
  acento?: 'primario' | 'terciario' | 'neutro'
  tamano?: 'sm' | 'md'
}) {
  const color = {
    primario: 'text-primario',
    terciario: 'text-terciario',
    neutro: 'text-tinta-3',
  }[acento]
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-arcilla shadow-suave ${color} ${
        tamano === 'sm' ? 'size-9' : 'size-12'
      }`}
      aria-hidden
    >
      {children}
    </span>
  )
}
