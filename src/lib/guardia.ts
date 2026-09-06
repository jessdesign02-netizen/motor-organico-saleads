import 'server-only'
import { secretoCoincide } from './seguridad'

/**
 * Los trabajos programados se llaman desde Vercel Cron con una cabecera propia.
 * Sin ella, la ruta contesta 401: una publicación no se dispara desde afuera.
 *
 * La comparación va en tiempo constante. Comparar con === deja que el tiempo de
 * respuesta diga cuántos caracteres coinciden, y con eso el secreto se adivina
 * de a una letra.
 */
export function cronAutorizado(peticion: Request): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false

  const cabecera = peticion.headers.get('authorization')
  return secretoCoincide(cabecera, `Bearer ${secreto}`)
}
