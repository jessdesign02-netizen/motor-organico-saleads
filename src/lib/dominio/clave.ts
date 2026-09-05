/**
 * Normalización y coincidencia de palabra clave.
 *
 * Es el corazón del motor de comentarios y la regla 4 de la especificación: la
 * coincidencia funciona con tildes, sin tildes, en minúsculas, en mayúsculas,
 * con letras repetidas y dentro de una frase.
 *
 * La misma regla vive en Postgres, en la función `normalizar_clave`. Las dos
 * hacen lo mismo: mayúsculas, sin tildes, solo letras y números.
 */

/** Mayúsculas, sin tildes, sin nada que no sea letra o número. */
export function normalizar(entrada: string): string {
  return entrada
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
}

/**
 * Colapsa las letras repetidas a una sola: QUIEEEROO queda en QUIERO.
 * Se usa para comparar, y deja intacto lo que la persona escribió.
 */
export function colapsar(entrada: string): string {
  return entrada.replace(/(.)\1+/g, '$1')
}

/**
 * Prepara el texto de un comentario para comparar. Conserva el orden y pierde
 * todo lo que no distingue: emojis, signos, espacios, tildes y mayúsculas.
 */
export function normalizarComentario(texto: string): string {
  return normalizar(texto)
}

/**
 * Genera las formas alternas de una palabra clave. Cubre lo que la gente
 * escribe de verdad: sin tilde, con la última letra repetida, en plural simple
 * y con la letra que se cae al teclear rápido.
 */
export function generarVariantes(palabra: string): string[] {
  const base = normalizar(palabra)
  if (base === '') return []

  const salida = new Set<string>([base])

  // Letra final repetida: GRATISS, GRATISSS.
  const ultima = base.at(-1)
  if (ultima) {
    salida.add(base + ultima)
    salida.add(base + ultima + ultima)
  }

  // Plural y singular simples.
  if (base.endsWith('S')) {
    salida.add(base.slice(0, -1))
  } else {
    salida.add(base + 'S')
  }

  // Una letra caída, para el dedo rápido. Solo desde la tercera posición, para
  // que la variante siga siendo reconocible.
  for (let i = 2; i < base.length; i++) {
    const recortada = base.slice(0, i) + base.slice(i + 1)
    if (recortada.length >= 4) salida.add(recortada)
  }

  salida.delete(base)
  return [...salida].sort()
}

export type ResultadoCoincidencia = {
  coincide: boolean
  /** La forma que disparó la coincidencia, útil para la bitácora. */
  forma: string | null
}

/**
 * Compara el texto de un comentario contra la palabra clave y sus variantes.
 * La coincidencia es por contención: la palabra dentro de una frase larga
 * cuenta, tal como pide el caso especial de la sección 7.
 */
export function coincide(
  textoComentario: string,
  palabra: string,
  variantes: readonly string[] = [],
): ResultadoCoincidencia {
  const texto = normalizarComentario(textoComentario)
  if (texto === '') return { coincide: false, forma: null }

  const formas = [normalizar(palabra), ...variantes.map(normalizar)].filter((f) => f !== '')
  if (formas.length === 0) return { coincide: false, forma: null }

  for (const forma of formas) {
    if (texto.includes(forma)) return { coincide: true, forma }
  }

  // Segunda pasada contra las letras repetidas, en los dos lados: así QUIEEERO
  // encuentra a QUIERO, y QUIERO encuentra a QUIIIERO.
  const textoColapsado = colapsar(texto)
  for (const forma of formas) {
    if (textoColapsado.includes(colapsar(forma))) return { coincide: true, forma }
  }

  return { coincide: false, forma: null }
}
