import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { Tarjeta, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { AltaRecurso } from './alta'

export const dynamic = 'force-dynamic'

/**
 * Módulo 2 · la biblioteca de recursos.
 * Es acumulativa: todo recurso publicado permanece disponible.
 */
export default async function Recursos() {
  const supabase = await clienteServidor()
  const perfil = await perfilActual()

  const [respuestaRecursos, respuestaMarcas] = await Promise.all([
    supabase.from('resources').select('*').order('creado_at', { ascending: false }),
    supabase.from('brands').select('*').order('nombre'),
  ])
  const recursos = filas(respuestaRecursos, 'la biblioteca')
  const marcas = filas(respuestaMarcas, 'las marcas')

  const puedeCrear = perfil?.rol === 'editora' || perfil?.rol === 'audiovisual'
  const secciones = [...new Set(recursos.map((r) => r.seccion ?? 'Sin sección'))]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Recursos</h1>
        <p className="text-sm text-tinta-3">
          {recursos.length} en la biblioteca. Lo que entra, se queda.
        </p>
      </header>

      {puedeCrear ? <AltaRecurso marcas={marcas ?? []} /> : null}

      {recursos.length === 0 ? <Vacio>La biblioteca está vacía.</Vacio> : null}

      {secciones.map((seccion) => (
        <Tarjeta key={seccion} titulo={seccion}>
          <ul className="divide-y divide-linea">
            {recursos
              .filter((r) => (r.seccion ?? 'Sin sección') === seccion)
              .map((recurso) => (
                <li key={recurso.id} className="flex items-baseline justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <a
                      href={recurso.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {recurso.titulo}
                    </a>
                    {recurso.descripcion ? (
                      <p className="text-xs text-tinta-3">{recurso.descripcion}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-tinta-3">
                    {recurso.tipo} · {marcas.find((m) => m.id === recurso.brand_id)?.nombre}
                  </span>
                </li>
              ))}
          </ul>
        </Tarjeta>
      ))}
    </div>
  )
}
