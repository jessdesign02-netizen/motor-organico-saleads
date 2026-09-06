'use client'

import { useState } from 'react'
import { ajustarMarca, cambiarRol, crearMarca } from '@/app/acciones/marcas'
import type { Marca, Perfil, RolApp } from '@/lib/database.types'

const ROLES: RolApp[] = ['editora', 'aprobadora', 'audiovisual', 'observador']

export function Marcas({ marcas, puedeAjustar }: { marcas: Marca[]; puedeAjustar: boolean }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [creando, setCreando] = useState(false)

  return (
    <div className="space-y-3">
      {aviso ? (
        <p className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</p>
      ) : null}

      {marcas.map((marca) => (
        <form
          key={marca.id}
          action={async (datos) => setAviso(await ajustarMarca(datos))}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-3 text-sm"
        >
          <input type="hidden" name="marcaId" value={marca.id} />
          <span className="min-w-28 font-medium">{marca.nombre}</span>
          <input
            name="sheetId"
            defaultValue={marca.sheet_id ?? ''}
            placeholder="id de la hoja"
            className={`${ENTRADA} flex-1`}
            disabled={!puedeAjustar}
          />
          <input
            name="sheetTab"
            defaultValue={marca.sheet_tab}
            placeholder="pestaña"
            className={`${ENTRADA} w-28`}
            disabled={!puedeAjustar}
          />
          <input
            name="whatsappUrl"
            defaultValue={marca.whatsapp_url ?? ''}
            placeholder="https://wa.me/57..."
            className={`${ENTRADA} flex-1`}
            disabled={!puedeAjustar}
          />
          {puedeAjustar ? (
            <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs">
              Guardar
            </button>
          ) : null}
        </form>
      ))}

      {puedeAjustar && !creando ? (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          Agregar una marca
        </button>
      ) : null}

      {creando ? (
        <form
          action={async (datos) => {
            const salida = await crearMarca(datos)
            setAviso(salida)
            if (salida.ok) setCreando(false)
          }}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-3"
        >
          <input name="nombre" placeholder="Nombre" required className={ENTRADA} />
          <input name="slug" placeholder="slug-de-la-marca" required className={ENTRADA} />
          <input name="sheetId" placeholder="id de la hoja" className={ENTRADA} />
          <input name="whatsappUrl" placeholder="https://wa.me/57..." className={`${ENTRADA} flex-1`} />
          <button type="submit" className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white">
            Crear
          </button>
          <button type="button" onClick={() => setCreando(false)} className="text-sm text-neutral-500">
            Cancelar
          </button>
        </form>
      ) : null}
    </div>
  )
}

export function Equipo({
  equipo,
  yo,
  puedeAjustar,
}: {
  equipo: Perfil[]
  yo: string
  puedeAjustar: boolean
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <div className="space-y-2">
      {aviso ? (
        <p className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</p>
      ) : null}

      <ul className="divide-y divide-neutral-100 text-sm">
        {equipo.map((persona) => (
          <li key={persona.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              {persona.nombre ?? persona.email}
              {persona.id === yo ? <span className="ml-2 text-xs text-neutral-400">tú</span> : null}
            </span>

            {puedeAjustar && persona.id !== yo ? (
              <form
                action={async (datos) => setAviso(await cambiarRol(datos))}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="personaId" value={persona.id} />
                <select name="rol" defaultValue={persona.rol} className={`${ENTRADA} text-xs`}>
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
                  Guardar
                </button>
              </form>
            ) : (
              <span className="text-neutral-500">{persona.rol}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const ENTRADA = 'rounded-md border border-neutral-300 px-2 py-1.5 text-sm'
