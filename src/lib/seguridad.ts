/**
 * Barreras de seguridad que no dependen de la sesión.
 *
 * Lo que entra aquí protege contra el error propio, no solo contra el ataque
 * de afuera: una referencia mal escrita en Ajustes o un destino equivocado en
 * un enlace tienen consecuencias que la sesión no alcanza a contener.
 */

/**
 * Referencias de credencial permitidas.
 *
 * `credential_ref` se guarda en la base y se usa para leer `process.env`. Sin
 * esta lista, una referencia como SUPABASE_SERVICE_ROLE_KEY haría que el
 * sistema enviara la llave maestra de la base a Meta creyendo que es un token
 * de Instagram. El prefijo ata cada referencia a su plataforma.
 */
export const PREFIJOS_DE_CREDENCIAL = ['META_TOKEN_', 'TIKTOK_TOKEN_', 'YOUTUBE_TOKEN_'] as const

/** Nombres que nunca son una credencial de plataforma, por si un prefijo se ampliara. */
const RESERVADAS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'TOKEN_ENCRYPTION_KEY',
  'CRON_SECRET',
  'META_APP_SECRET',
  'META_WEBHOOK_VERIFY_TOKEN',
  'GOOGLE_SERVICE_ACCOUNT_KEY',
  'YOUTUBE_CLIENT_SECRET',
]

export function referenciaValida(referencia: string): boolean {
  if (RESERVADAS.includes(referencia)) return false
  if (!/^[A-Z][A-Z0-9_]{3,63}$/.test(referencia)) return false
  return PREFIJOS_DE_CREDENCIAL.some((prefijo) => referencia.startsWith(prefijo))
}

export function motivoDeReferenciaInvalida(referencia: string): string {
  if (RESERVADAS.includes(referencia)) {
    return `${referencia} guarda un secreto del sistema y no es una credencial de plataforma`
  }
  if (!/^[A-Z][A-Z0-9_]{3,63}$/.test(referencia)) {
    return 'La referencia va como nombre de variable: mayúsculas, números y guion bajo'
  }
  return `La referencia empieza por ${PREFIJOS_DE_CREDENCIAL.join(', ')}`
}

/**
 * Destinos a los que el redirector puede mandar a una persona.
 *
 * El enlace corto lleva el dominio de SaleADS, así que un destino equivocado
 * convertiría ese dominio en trampolín hacia cualquier parte. La lista deja
 * fuera todo lo que no sea el embudo propio.
 */
export const DOMINIOS_DE_DESTINO = [
  'wa.me',
  'api.whatsapp.com',
  'web.whatsapp.com',
  'bio.saleads.co',
  'saleads.ai',
  'www.saleads.ai',
]

export function destinoPermitido(url: string, dominios: readonly string[] = DOMINIOS_DE_DESTINO): boolean {
  let destino: URL
  try {
    destino = new URL(url)
  } catch {
    return false
  }

  // Solo https: un enlace en claro entrega el destino a quien mire la red.
  if (destino.protocol !== 'https:') return false

  const anfitrion = destino.hostname.toLowerCase()
  return dominios.some((permitido) => anfitrion === permitido || anfitrion.endsWith(`.${permitido}`))
}

/** Compara dos secretos sin que el tiempo de respuesta revele cuánto coincide. */
export function secretoCoincide(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false
  if (recibido.length !== esperado.length) return false

  let diferencia = 0
  for (let i = 0; i < esperado.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i)
  }
  return diferencia === 0
}
