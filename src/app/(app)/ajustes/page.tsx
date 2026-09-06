import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { Tarjeta, Vacio } from '@/app/ui'
import { Canales, NuevaCuenta } from './canales'

export const dynamic = 'force-dynamic'

export default async function Ajustes() {
  const perfil = await perfilActual()
  const supabase = await clienteServidor()

  const [{ data: marcas }, { data: cuentas }, { data: equipo }] = await Promise.all([
    supabase.from('brands').select('*').order('nombre'),
    supabase.from('social_accounts').select('*').order('red'),
    supabase.from('profiles').select('*').order('rol'),
  ])

  const esEditora = perfil?.rol === 'editora'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-neutral-500">Canales, equipo y el estado de cada acceso</p>
      </header>

      <Tarjeta titulo="Canales">
        {(cuentas ?? []).length === 0 ? (
          <Vacio>Sin canales conectados todavía.</Vacio>
        ) : (
          <Canales
            cuentas={cuentas ?? []}
            marcas={marcas ?? []}
            puedeAjustar={esEditora}
          />
        )}
      </Tarjeta>

      {esEditora && (marcas ?? []).length > 0 ? <NuevaCuenta marcas={marcas ?? []} /> : null}

      <Tarjeta titulo="Equipo">
        <ul className="divide-y divide-neutral-100 text-sm">
          {(equipo ?? []).map((persona) => (
            <li key={persona.id} className="flex justify-between py-2">
              <span>{persona.nombre ?? persona.email}</span>
              <span className="text-neutral-500">{persona.rol}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Cómo se guardan las credenciales">
        <p className="text-sm text-neutral-600">
          El token vive en una variable de entorno, y la base guarda solo el nombre de esa variable. Así el secreto
          queda fuera de la base de datos y fuera del navegador. Para la cuenta con referencia{' '}
          <code className="rounded bg-neutral-100 px-1">META_TOKEN_SALEADS</code>, el token va en esa variable y el id
          de la Página en <code className="rounded bg-neutral-100 px-1">META_TOKEN_SALEADS_PAGE_ID</code>.
        </p>
      </Tarjeta>
    </div>
  )
}
