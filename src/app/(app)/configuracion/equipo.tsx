'use client'

import { useState } from 'react'
import { ajustarMarca, cambiarRol, crearMarca, invitar, revocarInvitacion } from '@/app/acciones/marcas'
import { Aviso, Campo, Enviar } from '@/app/formulario'
import type { Invitacion, Marca, Perfil, RolApp } from '@/lib/database.types'
import { ROL, hace } from '@/lib/etiquetas'
import { Etiqueta } from '@/app/ui'

const ROLES: RolApp[] = ['editora', 'aprobadora', 'audiovisual', 'observador']

export function Marcas({ marcas, puedeAjustar }: { marcas: Marca[]; puedeAjustar: boolean }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [creando, setCreando] = useState(false)

  return (
    <div className="space-y-3">
      <Aviso resultado={aviso} />

      {marcas.map((marca) => (
        <form
          key={marca.id}
          action={async (datos) => setAviso(await ajustarMarca(datos))}
          className="flex flex-wrap items-center gap-3 rounded-silk shadow-alzado p-3 text-sm"
        >
          <input type="hidden" name="marcaId" value={marca.id} />
          <span className="min-w-28 font-medium">{marca.nombre}</span>
          <input
            name="sheetId"
            defaultValue={marca.sheet_id ?? ''}
            aria-label={`Id de la hoja de ${marca.nombre}`}
            placeholder="id de la hoja"
            className={`${ENTRADA} flex-1`}
            disabled={!puedeAjustar}
          />
          <input
            name="sheetTab"
            defaultValue={marca.sheet_tab}
            aria-label={`Pestaña de la hoja de ${marca.nombre}`}
            placeholder="pestaña"
            className={`${ENTRADA} w-28`}
            disabled={!puedeAjustar}
          />
          <input
            name="whatsappUrl"
            defaultValue={marca.whatsapp_url ?? ''}
            aria-label={`WhatsApp de ${marca.nombre}`}
            placeholder="https://wa.me/57..."
            className={`${ENTRADA} flex-1`}
            disabled={!puedeAjustar}
          />
          {puedeAjustar ? (
            <Enviar variante="secundario" haciendo="Guardando">
              Guardar
            </Enviar>
          ) : null}
        </form>
      ))}

      {puedeAjustar && !creando ? (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-md shadow-alzado px-3 py-2 text-sm"
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
          className="flex flex-wrap items-center gap-2 rounded-silk shadow-hundido p-3"
        >
          <Campo etiqueta="Nombre">
            <input name="nombre" required className={ENTRADA} />
          </Campo>
          <Campo etiqueta="Slug">
            <input name="slug" placeholder="slug-de-la-marca" required className={ENTRADA} />
          </Campo>
          <Campo etiqueta="Id de la hoja">
            <input name="sheetId" className={ENTRADA} />
          </Campo>
          <Campo etiqueta="WhatsApp">
            <input name="whatsappUrl" placeholder="https://wa.me/57..." className={ENTRADA} />
          </Campo>
          <Enviar haciendo="Creando">Crear</Enviar>
          <button type="button" onClick={() => setCreando(false)} className="text-sm text-tinta-3">
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
      <Aviso resultado={aviso} />

      <ul className="divide-y divide-white/40 text-sm">
        {equipo.map((persona) => (
          <li key={persona.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              {persona.nombre ?? persona.email}
              {persona.id === yo ? <span className="ml-2 text-xs text-tinta-3">tú</span> : null}
            </span>

            {puedeAjustar && persona.id !== yo ? (
              <form
                action={async (datos) => setAviso(await cambiarRol(datos))}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="personaId" value={persona.id} />
                <select
                  name="rol"
                  defaultValue={persona.rol}
                  aria-label={`Rol de ${persona.nombre ?? persona.email}`}
                  className={`${ENTRADA} text-xs`}
                >
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
                <Enviar variante="secundario" haciendo="Guardando">
                  Guardar
                </Enviar>
              </form>
            ) : (
              <span className="text-tinta-3">{persona.rol}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const ENTRADA = 'rounded-md shadow-alzado px-2 py-1.5 text-sm'

/**
 * La lista de invitados.
 *
 * Es lo que decide quién puede entrar: sin fila aquí, el alta falla en la base
 * venga por Google, por clave o por el API de administración. Quitar a alguien
 * no borra su cuenta, le impide volver.
 */
export function Invitaciones({
  invitaciones,
  puedeInvitar,
  yo,
}: {
  invitaciones: Invitacion[]
  puedeInvitar: boolean
  yo: string
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  const pendientes = invitaciones.filter((i) => !i.usada_at)

  return (
    <div className="space-y-3">
      <Aviso resultado={aviso} />

      {puedeInvitar ? (
        <form
          action={async (datos) => setAviso(await invitar(datos))}
          className="flex flex-wrap items-end gap-3 rounded-silk shadow-hundido p-3"
        >
          <div className="min-w-56 flex-1">
            <Campo etiqueta="Correo">
              <input
                type="email"
                name="email"
                required
                placeholder="alguien@saleads.co"
                className={`${ENTRADA} w-full`}
              />
            </Campo>
          </div>
          <Campo etiqueta="Entra como">
            <select name="rol" defaultValue="observador" className={ENTRADA}>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ROL[rol].texto}
                </option>
              ))}
            </select>
          </Campo>
          <Enviar haciendo="Invitando">Invitar</Enviar>
        </form>
      ) : null}

      {invitaciones.length === 0 ? (
        <p className="text-sm text-tinta-3">Todavía nadie está invitado.</p>
      ) : (
        <ul className="divide-y divide-white/40 text-sm">
          {invitaciones.map((invitacion) => (
            <li key={invitacion.email} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-tinta">{invitacion.email}</span>
              <Etiqueta rotulo={ROL[invitacion.rol]} titulo />
              <span className="text-xs text-tinta-3">
                {invitacion.usada_at ? `entró ${hace(invitacion.usada_at)}` : 'no ha entrado'}
              </span>
              {puedeInvitar && invitacion.email !== yo ? (
                <form action={async (datos) => setAviso(await revocarInvitacion(datos))}>
                  <input type="hidden" name="email" value={invitacion.email} />
                  <Enviar variante="peligro" haciendo="Quitando">
                    Quitar
                  </Enviar>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pendientes.length > 0 ? (
        <p className="text-xs text-tinta-3">
          {pendientes.length === 1
            ? 'Una persona invitada aún no ha entrado'
            : `${pendientes.length} personas invitadas aún no han entrado`}
          . Entran solas la primera vez que usen Google o el enlace de clave.
        </p>
      ) : null}
    </div>
  )
}
