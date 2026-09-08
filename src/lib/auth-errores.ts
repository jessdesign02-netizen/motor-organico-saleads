/**
 * Lo que salió mal al entrar, dicho para la persona que lo lee.
 *
 * El formulario contestaba "El correo o la clave no coinciden" a todo: a una
 * clave mal escrita, a un corte de red, a una cuenta frenada por intentos y a
 * un correo sin confirmar. En los tres últimos casos el mensaje era mentira, y
 * mandaba a la persona a reescribir bien una clave que ya estaba bien.
 *
 * Lo que no se reconoce se dice como lo que es —algo inesperado— en lugar de
 * inventarle una causa.
 */

export type FalloAuth = { message?: string; code?: string; status?: number } | null

export function errorDeEntrada(fallo: FalloAuth): string {
  if (!fallo) return 'No se pudo entrar. Inténtalo otra vez.'

  const codigo = fallo.code ?? ''
  const mensaje = fallo.message ?? ''

  if (codigo === 'invalid_credentials' || /invalid login credentials/i.test(mensaje)) {
    return 'El correo o la clave no coinciden.'
  }
  if (codigo === 'email_not_confirmed' || /email not confirmed/i.test(mensaje)) {
    return 'Falta confirmar el correo. Revisa tu bandeja, incluido el correo no deseado.'
  }
  if (codigo === 'over_request_rate_limit' || fallo.status === 429 || /rate limit|too many/i.test(mensaje)) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
  }
  if (codigo === 'user_banned' || /banned/i.test(mensaje)) {
    return 'Esta cuenta está bloqueada. Pídele a Jess que la reactive.'
  }
  if (codigo === 'weak_password' || /password should be/i.test(mensaje)) {
    return 'La clave es demasiado corta: necesita al menos seis caracteres.'
  }
  if (codigo === 'same_password' || /should be different/i.test(mensaje)) {
    return 'Esa es la clave que ya tenías. Escribe una distinta.'
  }
  // Sin red, el fetch del navegador falla antes de llegar a Supabase.
  if (/fetch|network|failed to fetch/i.test(mensaje)) {
    return 'No hubo conexión con el servidor. Revisa tu internet y vuelve a intentarlo.'
  }
  if (codigo === 'otp_expired' || /expired|invalid.*token/i.test(mensaje)) {
    return 'Ese enlace ya venció. Pide uno nuevo desde "Olvidé mi clave".'
  }

  return `No se pudo completar: ${mensaje || 'error inesperado'}`
}

/**
 * A dónde mandar tras entrar.
 *
 * El proxy guarda en `volver` la ruta que la persona intentaba abrir, y el
 * formulario la ignoraba: quien pinchaba un enlace al chat acababa en la
 * parrilla. Solo se aceptan rutas internas —una URL completa aquí convertiría
 * el login en un trampolín a cualquier sitio.
 */
export function destinoTrasEntrar(volver: string | null | undefined): string {
  if (!volver) return '/dashboard'
  if (!volver.startsWith('/') || volver.startsWith('//')) return '/dashboard'
  if (volver === '/ingresar' || volver.startsWith('/auth')) return '/dashboard'
  return volver
}
