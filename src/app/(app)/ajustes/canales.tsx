'use client'

import { useState } from 'react'
import { ajustarCuenta, registrarCuenta } from '@/app/acciones/cuentas'
import type { CuentaSocial, Marca } from '@/lib/database.types'

export function Canales({
  cuentas,
  marcas,
  puedeAjustar,
}: {
  cuentas: CuentaSocial[]
  marcas: Marca[]
  puedeAjustar: boolean
}) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <div className="space-y-3">
      {aviso ? (
        <p className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</p>
      ) : null}

      {cuentas.map((cuenta) => (
        <form
          key={cuenta.id}
          action={async (datos) => setAviso(await ajustarCuenta(datos))}
          className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 p-3 text-sm"
        >
          <input type="hidden" name="cuentaId" value={cuenta.id} />

          <div className="min-w-40">
            <p className="font-medium">{cuenta.handle}</p>
            <p className="text-xs text-neutral-500">
              {cuenta.red} · {marcas.find((m) => m.id === cuenta.brand_id)?.nombre}
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="activa" defaultChecked={cuenta.activa} disabled={!puedeAjustar} />
            activa
          </label>

          {cuenta.red === 'tiktok' ? (
            <label className="flex items-center gap-2 text-xs" title="Se enciende cuando pasa la auditoría de TikTok">
              <input
                type="checkbox"
                name="publicacionDirecta"
                defaultChecked={cuenta.publicacion_directa}
                disabled={!puedeAjustar}
              />
              publicación directa
            </label>
          ) : (
            <input type="hidden" name="publicacionDirecta" value={cuenta.publicacion_directa ? 'on' : ''} />
          )}

          {cuenta.red === 'youtube' ? (
            <label className="flex items-center gap-2 text-xs">
              cupo diario
              <input
                type="number"
                name="cupo"
                min={1}
                defaultValue={cuenta.cupo_respuestas_dia ?? 150}
                className="w-20 rounded-md border border-neutral-300 px-2 py-1"
                disabled={!puedeAjustar}
              />
            </label>
          ) : null}

          <span className="text-xs text-neutral-500">
            {cuenta.token_expira_at ? `vence ${cuenta.token_expira_at.slice(0, 10)}` : 'sin vencimiento'}
          </span>

          {puedeAjustar ? (
            <button type="submit" className="ml-auto rounded-md border border-neutral-300 px-3 py-1.5 text-xs">
              Guardar
            </button>
          ) : null}
        </form>
      ))}
    </div>
  )
}

export function NuevaCuenta({ marcas }: { marcas: Marca[] }) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)

  return (
    <form
      action={async (datos) => setAviso(await registrarCuenta(datos))}
      className="space-y-3 rounded-lg border border-dashed border-neutral-300 p-4"
    >
      <p className="text-sm font-medium">Conectar un canal</p>
      <div className="grid gap-3 md:grid-cols-3">
        <select name="marcaId" className={ENTRADA} defaultValue={marcas[0]?.id ?? ''}>
          {marcas.map((marca) => (
            <option key={marca.id} value={marca.id}>
              {marca.nombre}
            </option>
          ))}
        </select>
        <select name="red" className={ENTRADA} defaultValue="instagram">
          {['instagram', 'tiktok', 'youtube'].map((red) => (
            <option key={red} value={red}>
              {red}
            </option>
          ))}
        </select>
        <input name="handle" placeholder="@cuenta" required className={ENTRADA} />
        <input name="externalAccountId" placeholder="id en la plataforma" required className={ENTRADA} />
        <input name="credentialRef" placeholder="META_TOKEN_SALEADS" required className={ENTRADA} />
        <input type="date" name="tokenExpiraAt" className={ENTRADA} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white">
          Conectar
        </button>
        {aviso ? (
          <span className={`text-sm ${aviso.ok ? 'text-emerald-700' : 'text-red-700'}`}>{aviso.mensaje}</span>
        ) : null}
      </div>
    </form>
  )
}

const ENTRADA = 'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm'
