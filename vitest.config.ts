import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    alias: {
      // `server-only` existe para que un módulo de servidor no llegue al
      // navegador. Bajo vitest ya corremos en node, así que se neutraliza.
      'server-only': fileURLToPath(new URL('./src/pruebas/server-only.ts', import.meta.url)),
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
