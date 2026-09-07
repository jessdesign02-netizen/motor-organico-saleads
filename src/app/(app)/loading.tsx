/**
 * Lo que se ve mientras la pantalla trae sus datos. Sin esto, la navegación se
 * queda quieta y parece que el clic no llegó.
 */
export default function Cargando() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-6 w-48 animate-pulse rounded bg-hundido" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-hundido" />
        ))}
      </div>
    </div>
  )
}
