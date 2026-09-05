import { z } from 'zod'

/**
 * Toda credencial vive en variables de entorno. El arranque falla con el nombre
 * exacto de lo que falta, en lugar de romperse a mitad de una publicación.
 */
const esquemaServidor = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().min(1).optional(),

  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),

  YOUTUBE_CLIENT_ID: z.string().min(1).optional(),
  YOUTUBE_CLIENT_SECRET: z.string().min(1).optional(),

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'TOKEN_ENCRYPTION_KEY debe ser 64 caracteres hexadecimales')
    .optional(),
  CRON_SECRET: z.string().min(16).optional(),

  APP_URL: z.string().url().default('http://localhost:3000'),
  ZONA_HORARIA: z.string().default('America/Bogota'),
})

export type EnvServidor = z.infer<typeof esquemaServidor>

let cache: EnvServidor | null = null

export function env(): EnvServidor {
  if (cache) return cache
  const resultado = esquemaServidor.safeParse(process.env)
  if (!resultado.success) {
    const faltantes = resultado.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ')
    throw new Error(`Faltan variables de entorno:\n  ${faltantes}`)
  }
  cache = resultado.data
  return cache
}

/** Devuelve el valor o null, para las funciones que degradan sin la credencial. */
export function envOpcional<K extends keyof EnvServidor>(clave: K): EnvServidor[K] | null {
  const bruto = process.env[clave as string]
  if (!bruto) return null
  return env()[clave]
}
