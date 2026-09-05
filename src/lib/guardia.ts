import 'server-only'

/**
 * Los trabajos programados se llaman desde Vercel Cron con una cabecera propia.
 * Sin ella, la ruta contesta 401: una publicación no se dispara desde afuera.
 */
export function cronAutorizado(peticion: Request): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  return peticion.headers.get('authorization') === `Bearer ${secreto}`
}
