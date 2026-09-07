import type { ReactNode } from 'react'
import { cifra, type Rotulo, type Tono } from '@/lib/etiquetas'

/**
 * Las piezas visuales compartidas.
 *
 * Todas se escriben contra los tokens de globals.css, nunca contra un color
 * fijo. Eso es lo que permite cambiar la paleta —o añadir modo oscuro— sin
 * recorrer las nueve pantallas.
 */

// ---------------------------------------------------------------------------
// Etiquetas de estado
// ---------------------------------------------------------------------------

const TONOS: Record<Tono, string> = {
  neutro: 'bg-hundido text-tinta-2',
  bien: 'bg-bien-tinte text-bien',
  aviso: 'bg-aviso-tinte text-aviso',
  info: 'bg-info-tinte text-info',
  serio: 'bg-serio-tinte text-serio',
  critico: 'bg-critico-tinte text-critico',
}

/**
 * Un estado nunca viaja solo en el color: el texto lo dice. Así se entiende con
 * daltonismo, en blanco y negro, y sin haber aprendido la convención.
 */
export function Etiqueta({ rotulo, titulo }: { rotulo: Rotulo; titulo?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONOS[rotulo.tono]}`}
      {...(titulo && rotulo.explica ? { title: rotulo.explica } : {})}
    >
      {rotulo.texto}
    </span>
  )
}

/** Un punto de color con su texto al lado. Para listas donde el chip pesa demasiado. */
export function Punto({ tono, children }: { tono: Tono; children: ReactNode }) {
  const color: Record<Tono, string> = {
    neutro: 'bg-tinta-3',
    bien: 'bg-bien',
    aviso: 'bg-aviso',
    info: 'bg-info',
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
        <h1 className="text-xl font-semibold tracking-tight text-tinta">{titulo}</h1>
        {bajada ? <p className="mt-0.5 text-sm text-tinta-2">{bajada}</p> : null}
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
  /** Sin relleno propio: para tablas y listas que llegan hasta el borde. */
  ajustado?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-linea bg-superficie">
      {titulo ? (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linea px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-tinta">{titulo}</h2>
            {bajada ? <p className="mt-0.5 text-xs text-tinta-2">{bajada}</p> : null}
          </div>
          {accion}
        </div>
      ) : null}
      <div className={ajustado ? '' : 'p-5'}>{children}</div>
    </section>
  )
}

/**
 * El vacío dice qué falta y cómo llenarlo. Un "no hay nada" a secas deja a la
 * persona sin saber si el sistema está roto o si de verdad no hay nada.
 */
export function Vacio({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-linea-fuerte px-6 py-10 text-center">
      <p className="text-sm text-tinta-2">{children}</p>
      {accion ? <div className="mt-4 flex justify-center">{accion}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/**
 * La cifra manda y la etiqueta la acompaña, no al revés. Las cifras sueltas van
 * en figuras proporcionales; tabular-nums se reserva para columnas que alinean.
 */
export function Dato({
  etiqueta,
  valor,
  nota,
  tono,
}: {
  etiqueta: string
  valor: string | number
  nota?: string
  tono?: Tono
}) {
  const acento: Record<Tono, string> = {
    neutro: 'text-tinta',
    bien: 'text-bien',
    aviso: 'text-aviso',
    info: 'text-info',
    serio: 'text-serio',
    critico: 'text-critico',
  }
  return (
    <div className="rounded-xl border border-linea bg-superficie px-4 py-3.5">
      <p className="text-xs text-tinta-2">{etiqueta}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${tono ? acento[tono] : 'text-tinta'}`}>
        {typeof valor === 'number' ? cifra(valor) : valor}
      </p>
      {nota ? <p className="mt-0.5 text-xs text-tinta-3">{nota}</p> : null}
    </div>
  )
}

/**
 * Barra de magnitud dentro de una fila. Compara de un vistazo lo que una
 * columna de números obliga a leer uno por uno.
 */
export function Barra({
  valor,
  maximo,
  serie = 1,
}: {
  valor: number
  maximo: number
  serie?: 1 | 2 | 3
}) {
  const ancho = maximo > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / maximo) * 100) : 0
  const color = { 1: 'bg-serie-1', 2: 'bg-serie-2', 3: 'bg-serie-3' }[serie]
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-hundido" aria-hidden>
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
          <tr className="border-b border-linea">
            {cabeceras.map((cabecera, i) => (
              <th
                key={i}
                scope="col"
                className={`px-5 py-2.5 text-xs font-medium text-tinta-2 ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linea [&>tr]:transition-colors [&>tr:hover]:bg-hundido/50">
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
      className={`px-5 py-3 ${numero ? 'text-right tabular-nums' : 'text-left'} ${
        apagado ? 'text-tinta-3' : 'text-tinta'
      }`}
    >
      {children}
    </td>
  )
}
