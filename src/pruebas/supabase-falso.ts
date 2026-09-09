/**
 * Doble en memoria del cliente de Supabase.
 *
 * Los trabajos programados son la última capa sin pruebas: publicar, sincronizar,
 * preparar el video, sondear y reintentar. Todos hablan con la base, y sin un
 * doble había que elegir entre no probarlos o levantar Postgres para cada caso.
 *
 * Cubre lo que el código usa de verdad, y falla ruidosamente ante lo que no
 * conoce: un doble que devuelve vacío ante una consulta que no entiende haría
 * pasar pruebas que no prueban nada.
 */

type Fila = Record<string, unknown>
type Filtro = (fila: Fila) => boolean

export type TablasFalsas = Record<string, Fila[]>

/**
 * Las restricciones únicas que la base sí tiene. Sin ellas, el doble aceptaría
 * escrituras que en producción revientan, y las pruebas darían por bueno lo que
 * no lo es.
 */
const UNICOS: Record<string, string[][]> = {
  comments: [['publication_id', 'external_comment_id']],
  publications: [['piece_id', 'social_account_id']],
  pieces: [['brand_id', 'sheet_row_id']],
  keywords: [['piece_id']],
  dm_templates: [['piece_id']],
  tracked_links: [['piece_id'], ['slug']],
  notices: [['clave']],
}

function comparar(valor: unknown, esperado: unknown): boolean {
  if (valor instanceof Date) return valor.toISOString() === esperado
  return valor === esperado
}

class Consulta implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number }> {
  private filtros: Filtro[] = []
  private orden: { campo: string; ascendente: boolean } | null = null
  private tope: number | null = null
  private modo: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Fila[] = []
  private conflicto: string[] = []
  private unico = false
  private contar = false

  constructor(
    private tablas: TablasFalsas,
    private tabla: string,
    private registro: string[],
  ) {}

  private get filas(): Fila[] {
    const existentes = this.tablas[this.tabla]
    if (existentes) return existentes
    const nuevas: Fila[] = []
    this.tablas[this.tabla] = nuevas
    return nuevas
  }

  private seleccionadas(): Fila[] {
    let salida = this.filas.filter((fila) => this.filtros.every((f) => f(fila)))
    if (this.orden) {
      const { campo, ascendente } = this.orden
      salida = [...salida].sort((a, b) => {
        const izquierda = String(a[campo] ?? '')
        const derecha = String(b[campo] ?? '')
        return ascendente ? izquierda.localeCompare(derecha) : derecha.localeCompare(izquierda)
      })
    }
    if (this.tope !== null) salida = salida.slice(0, this.tope)
    return salida
  }

  select(_campos?: string, opciones?: { count?: string; head?: boolean }) {
    if (opciones?.count) this.contar = true
    if (this.modo === 'select') this.modo = 'select'
    return this
  }

  insert(datos: Fila | Fila[]) {
    this.modo = 'insert'
    this.payload = Array.isArray(datos) ? datos : [datos]
    return this
  }

  update(datos: Fila) {
    this.modo = 'update'
    this.payload = [datos]
    return this
  }

  upsert(datos: Fila | Fila[], opciones?: { onConflict?: string }) {
    this.modo = 'upsert'
    this.payload = Array.isArray(datos) ? datos : [datos]
    this.conflicto = opciones?.onConflict?.split(',').map((c) => c.trim()) ?? []
    return this
  }

  delete() {
    this.modo = 'delete'
    return this
  }

  eq(campo: string, valor: unknown) {
    this.filtros.push((fila) => comparar(fila[campo], valor))
    return this
  }

  neq(campo: string, valor: unknown) {
    this.filtros.push((fila) => !comparar(fila[campo], valor))
    return this
  }

  in(campo: string, valores: readonly unknown[]) {
    this.filtros.push((fila) => valores.some((v) => comparar(fila[campo], v)))
    return this
  }

  is(campo: string, valor: null) {
    this.filtros.push((fila) => (fila[campo] ?? null) === valor)
    return this
  }

  not(campo: string, operador: string, valor: unknown) {
    if (operador !== 'is') throw new Error(`El doble no conoce not.${operador}`)
    this.filtros.push((fila) => (fila[campo] ?? null) !== valor)
    return this
  }

  lt(campo: string, valor: string) {
    this.filtros.push((fila) => fila[campo] !== null && String(fila[campo]) < valor)
    return this
  }

  lte(campo: string, valor: string) {
    this.filtros.push((fila) => fila[campo] !== null && String(fila[campo]) <= valor)
    return this
  }

  gte(campo: string, valor: string) {
    this.filtros.push((fila) => fila[campo] !== null && String(fila[campo]) >= valor)
    return this
  }

  order(campo: string, opciones?: { ascending?: boolean }) {
    this.orden = { campo, ascendente: opciones?.ascending ?? true }
    return this
  }

  limit(cuantas: number) {
    this.tope = cuantas
    return this
  }

  single() {
    this.unico = true
    return this
  }

  maybeSingle() {
    this.unico = true
    return this
  }

  private ejecutar() {
    this.registro.push(`${this.modo} ${this.tabla}`)

    if (this.modo === 'insert' || this.modo === 'upsert') {
      const escritas: Fila[] = []
      for (const nueva of this.payload) {
        const fila: Fila = { id: nueva['id'] ?? `id-${this.filas.length + 1}`, ...nueva }

        if (this.modo === 'upsert' && this.conflicto.length > 0) {
          const existente = this.filas.find((f) => this.conflicto.every((c) => comparar(f[c], fila[c])))
          if (existente) {
            Object.assign(existente, fila, { id: existente['id'] })
            escritas.push(existente)
            continue
          }
        }

        const choque = (UNICOS[this.tabla] ?? []).find(
          (llave) =>
            llave.every((campo) => fila[campo] !== undefined && fila[campo] !== null) &&
            this.filas.some((f) => llave.every((campo) => comparar(f[campo], fila[campo]))),
        )
        if (choque) {
          return {
            data: null,
            error: { message: `duplicate key value violates unique constraint (${choque.join(', ')})` },
          }
        }

        this.filas.push(fila)
        escritas.push(fila)
      }
      return { data: this.unico ? (escritas[0] ?? null) : escritas, error: null }
    }

    if (this.modo === 'update') {
      const objetivo = this.seleccionadas()
      for (const fila of objetivo) Object.assign(fila, this.payload[0])
      return { data: this.unico ? (objetivo[0] ?? null) : objetivo, error: null }
    }

    if (this.modo === 'delete') {
      const objetivo = this.seleccionadas()
      this.tablas[this.tabla] = this.filas.filter((f) => !objetivo.includes(f))
      return { data: objetivo, error: null }
    }

    const salida = this.seleccionadas()
    if (this.contar) return { data: null, error: null, count: salida.length }
    if (this.unico) {
      return salida[0]
        ? { data: salida[0], error: null }
        : { data: null, error: { message: 'no se encontró la fila' } }
    }
    return { data: salida, error: null }
  }

  then<R1 = unknown, R2 = never>(
    alListo?:
      | ((valor: {
          data: unknown
          error: { message: string } | null
          count?: number
        }) => R1 | PromiseLike<R1>)
      | null,
    alFallar?: ((razon: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.ejecutar()).then(alListo, alFallar)
  }
}

export type SupabaseFalso = {
  from: (tabla: string) => Consulta
  storage: {
    from: (bucket: string) => {
      upload: (ruta: string, contenido: unknown, opciones?: unknown) => Promise<{ error: null }>
      remove: (rutas: string[]) => Promise<{ error: null }>
    }
  }
  /** Cada operación ejecutada, para poder afirmar cuántas consultas se hicieron. */
  registro: string[]
  tablas: TablasFalsas
  archivos: Map<string, unknown>
}

export function crearSupabaseFalso(tablas: TablasFalsas = {}): SupabaseFalso {
  const registro: string[] = []
  const archivos = new Map<string, unknown>()

  return {
    tablas,
    registro,
    archivos,
    from: (tabla: string) => new Consulta(tablas, tabla, registro),
    storage: {
      from: (bucket: string) => ({
        async upload(ruta: string, contenido: unknown) {
          registro.push(`upload ${bucket}/${ruta}`)
          archivos.set(`${bucket}/${ruta}`, contenido)
          return { error: null }
        },
        async remove(rutas: string[]) {
          for (const ruta of rutas) {
            registro.push(`remove ${bucket}/${ruta}`)
            archivos.delete(`${bucket}/${ruta}`)
          }
          return { error: null }
        },
      }),
    },
  }
}
