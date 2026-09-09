'use client'

import { useState } from 'react'
import { ajustarCuenta, registrarCuenta } from '@/app/acciones/cuentas'
import { Aviso, Campo, ENTRADA, Enviar } from '@/app/formulario'
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
      <Aviso resultado={aviso} />

      {cuentas.map((cuenta) => (
        <form
          key={cuenta.id}
          action={async (datos) => setAviso(await ajustarCuenta(datos))}
          className="flex flex-wrap items-center gap-4 rounded-silk shadow-alzado p-3 text-sm"
          aria-label={`Canal ${cuenta.handle} en ${cuenta.red}`}
        >
          <input type="hidden" name="cuentaId" value={cuenta.id} />

          <div className="min-w-40">
            <p className="font-medium">{cuenta.handle}</p>
            <p className="text-xs text-tinta-3">
              {cuenta.red} · {marcas.find((m) => m.id === cuenta.brand_id)?.nombre}
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="activa" defaultChecked={cuenta.activa} disabled={!puedeAjustar} />
            activa
          </label>

          {cuenta.red === 'tiktok' ? (
            <label
              className="flex items-center gap-2 text-xs"
              title="Se enciende cuando pasa la auditoría de TikTok"
            >
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
                className="w-20 rounded-md shadow-alzado px-2 py-1"
                disabled={!puedeAjustar}
              />
            </label>
          ) : null}

          <span className="text-xs text-tinta-3">
            {cuenta.token_expira_at ? `vence ${cuenta.token_expira_at.slice(0, 10)}` : 'sin vencimiento'}
          </span>

          {puedeAjustar ? (
            <span className="ml-auto">
              <Enviar variante="secundario" haciendo="Guardando">
                Guardar
              </Enviar>
            </span>
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
      className="space-y-3 rounded-silk shadow-hundido p-4"
      aria-label="Conectar un canal"
    >
      <p className="text-sm font-medium">Conectar un canal</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Campo etiqueta="Marca">
          <select name="marcaId" className={ENTRADA} defaultValue={marcas[0]?.id ?? ''}>
            {marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {marca.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Red">
          <select name="red" className={ENTRADA} defaultValue="instagram">
            {['instagram', 'tiktok', 'youtube'].map((red) => (
              <option key={red} value={red}>
                {red}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Handle">
          <input name="handle" placeholder="@cuenta" required className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Id en la plataforma">
          <input name="externalAccountId" required className={ENTRADA} />
        </Campo>
        <Campo
          etiqueta="Referencia de la credencial"
          ayuda="El nombre de la variable de entorno, no el token. Empieza por META_TOKEN_, TIKTOK_TOKEN_ o YOUTUBE_TOKEN_."
        >
          <input name="credentialRef" placeholder="META_TOKEN_SALEADS" required className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Vence el">
          <input type="date" name="tokenExpiraAt" className={ENTRADA} />
        </Campo>
      </div>
      <div className="flex items-center gap-3">
        <Enviar haciendo="Conectando">Conectar</Enviar>
        <Aviso resultado={aviso} />
      </div>
    </form>
  )
}
