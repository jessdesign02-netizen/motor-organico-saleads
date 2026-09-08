/**
 * El emblema y el panel de contexto de las pantallas de entrada.
 *
 * Un login a secas no dice a qué está entrando la persona. El panel de la
 * derecha lo cuenta en tres líneas, y de paso da a la pantalla algo que mirar
 * que no sea un formulario flotando en el vacío.
 */

export function Emblema({ tamano = 40 }: { tamano?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={tamano}
      height={tamano}
      className="shrink-0"
      role="img"
      aria-label="Motor Orgánico"
    >
      <rect width="32" height="32" rx="8" fill="var(--color-tinta)" />
      <circle cx="16" cy="16" r="3.2" fill="var(--color-superficie)" />
      <g stroke="var(--color-superficie)" strokeWidth="1.8" fill="none" opacity="0.9">
        <ellipse cx="16" cy="16" rx="10.5" ry="5" transform="rotate(45 16 16)" />
        <ellipse cx="16" cy="16" rx="10.5" ry="5" transform="rotate(-45 16 16)" />
      </g>
    </svg>
  )
}

const PASOS = [
  {
    titulo: 'La parrilla se llena sola',
    detalle: 'La hoja de cálculo se lee cada quince minutos. Nadie copia filas a mano.',
  },
  {
    titulo: 'Apruebas el día en un clic',
    detalle: 'Es el único punto donde el sistema espera una decisión humana.',
  },
  {
    titulo: 'Los comentarios se responden solos',
    detalle: 'Quien escribe la palabra clave recibe su mensaje con el enlace, en segundos.',
  },
]

export function Panel() {
  return (
    <aside className="relative hidden flex-col justify-center overflow-hidden bg-tinta px-12 py-16 lg:flex xl:px-20">
      {/* Un halo muy leve: da fondo sin competir con el texto. */}
      <span
        className="pointer-events-none absolute -right-40 top-1/4 size-[32rem] rounded-full bg-superficie/[0.04] blur-3xl"
        aria-hidden
      />

      <div className="relative max-w-md">
        <div className="flex items-center gap-3">
          <Emblema tamano={32} />
          <span className="text-[15px] font-semibold text-superficie">Motor Orgánico</span>
        </div>

        <p className="mt-12 text-[28px] font-semibold leading-tight tracking-tight text-superficie">
          Publica, escucha y responde
          <br />
          sin estar encima.
        </p>

        <ul className="mt-10 space-y-6">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-4">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-superficie/15 text-[11px] font-semibold text-superficie"
                aria-hidden
              >
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-superficie">{paso.titulo}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-superficie/60">
                  {paso.detalle}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-12 text-xs text-superficie/40">SaleADS · Juanads</p>
      </div>
    </aside>
  )
}
