import { crearSupabaseFalso, type SupabaseFalso } from '@/pruebas/supabase-falso'
import { tablasDemo, PERFIL_DEMO } from './datos'
import type { Perfil } from '@/lib/database.types'

/**
 * Modo demo: la aplicación entera contra un doble en memoria.
 *
 * Sirve para recorrer las pantallas sin proyecto de Supabase. Se enciende con
 * MODO_DEMO=1 y no existe de ninguna otra forma: sin esa variable, todo el
 * código de aquí queda inerte y los clientes reales siguen siendo los de
 * siempre.
 *
 * Lo que se escribe vive mientras el servidor esté arriba y se pierde al
 * reiniciarlo. Es a propósito: un demo que acumula basura deja de servir de
 * demo a la tercera vuelta.
 */

export function modoDemo(): boolean {
  return process.env.MODO_DEMO === '1'
}

/**
 * El doble tiene que ser el mismo entre peticiones, o cada pantalla vería su
 * propia copia y aprobar una pieza no se notaría en la siguiente. Next recarga
 * módulos en desarrollo, así que la instancia vive en globalThis y no en una
 * variable de módulo.
 */
const LLAVE = Symbol.for('motor.demo.supabase')
type Portador = typeof globalThis & { [LLAVE]?: SupabaseFalso }

export function clienteDemo(): SupabaseFalso {
  const portador = globalThis as Portador
  const existente = portador[LLAVE]
  if (existente) return existente

  const nuevo = crearSupabaseFalso(tablasDemo())
  portador[LLAVE] = nuevo
  return nuevo
}

/** La sesión del modo demo: siempre la editora, que es quien ve todo. */
export function perfilDemo(): Perfil {
  return {
    id: PERFIL_DEMO,
    nombre: 'Jess (demo)',
    email: 'demo@saleads.co',
    rol: 'editora',
    creado_at: new Date().toISOString(),
  }
}
