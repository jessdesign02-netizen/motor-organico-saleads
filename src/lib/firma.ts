import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Meta firma cada webhook con el secreto de la app. Sin verificar la firma,
 * cualquiera podría inventar comentarios y disparar mensajes en nombre de la
 * marca. La comparación va en tiempo constante.
 */
export function firmaValida(cuerpo: string, cabecera: string | null, secreto: string): boolean {
  if (!cabecera) return false

  const esperada = 'sha256=' + createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex')
  const a = Buffer.from(cabecera)
  const b = Buffer.from(esperada)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
