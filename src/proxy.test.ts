import { describe, expect, it } from 'vitest'
import { esPublica } from './proxy'

/**
 * El guardia de rutas es la primera puerta. Una ruta que debía quedar abierta y
 * termina detrás del login rompe algo que se ve desde afuera: el redirector que
 * recibe la gente, el webhook de Meta o la biblioteca pública.
 */
describe('rutas públicas', () => {
  const abiertas = [
    ['la entrada', '/ingresar'],
    ['la salida de sesión', '/auth/salir'],
    ['el webhook de Meta', '/api/webhooks/instagram'],
    ['los trabajos programados', '/api/cron/publicar'],
    ['la biblioteca pública', '/api/recursos'],
    ['la biblioteca de una marca', '/api/recursos?marca=saleads'],
    ['el redirector del mensaje', '/r/automatiza-abc123'],
  ] as const

  for (const [nombre, ruta] of abiertas) {
    it(`deja pasar ${nombre}`, () => {
      expect(esPublica(ruta)).toBe(true)
    })
  }

  const cerradas = [
    ['la parrilla', '/parrilla'],
    ['una pieza', '/piezas/abc'],
    ['el panel del día', '/dia'],
    ['la bandeja', '/bandeja'],
    ['los resultados', '/resultados'],
    ['la configuración', '/configuracion'],
    ['la raíz', '/'],
  ] as const

  for (const [nombre, ruta] of cerradas) {
    it(`exige sesión en ${nombre}`, () => {
      expect(esPublica(ruta)).toBe(false)
    })
  }
})
