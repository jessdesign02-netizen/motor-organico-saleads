'use client'

import { useState } from 'react'
import { generarVariantes, normalizar } from '@/lib/dominio/clave'
import { enviarARevision, guardarAutomatizacion, guardarPieza, resolverPieza } from '@/app/acciones/piezas'
import { guardarCaptionsPorRed } from '@/app/acciones/parrilla'
import type {
  EnlaceRastreado,
  PalabraClave,
  Pieza,
  PlantillaDm,
  Recurso,
  RedSocial,
  RolApp,
} from '@/lib/database.types'
import { Tarjeta } from '@/app/ui'
import { Aviso, Campo, ENTRADA, Enviar } from '@/app/formulario'

type Props = {
  pieza: Pieza
  clave: PalabraClave | null
  plantilla: PlantillaDm | null
  enlace: EnlaceRastreado | null
  recursos: Recurso[]
  whatsapp: string
  rol: RolApp
}

export function Editor({ pieza, clave, plantilla, enlace, recursos, whatsapp, rol }: Props) {
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null)
  const [palabra, setPalabra] = useState(clave?.palabra ?? '')
  const [red, setRed] = useState<RedSocial>('instagram')

  const puedeEditar = rol === 'editora' || rol === 'audiovisual'
  const puedeAutomatizar = rol === 'editora'
  const puedeResolver = rol === 'editora' || rol === 'aprobadora'

  const propuestas = palabra.trim() === '' ? [] : generarVariantes(palabra)

  async function correr(accion: (datos: FormData) => Promise<{ ok: boolean; mensaje: string }>, datos: FormData) {
    setAviso(await accion(datos))
  }

  return (
    <div className="space-y-4">
      <Aviso resultado={aviso} />

      <Tarjeta titulo="Contenido">
        <form action={(datos) => correr(guardarPieza, datos)} className="space-y-3" aria-label="Contenido de la pieza">
          <input type="hidden" name="piezaId" value={pieza.id} />

          <Campo etiqueta="Tema">
            <input name="tema" defaultValue={pieza.tema} required className={ENTRADA} disabled={!puedeEditar} />
          </Campo>

          <Campo etiqueta="Hook">
            <input name="hook" defaultValue={pieza.hook ?? ''} className={ENTRADA} disabled={!puedeEditar} />
          </Campo>

          <Campo etiqueta="Caption">
            <textarea
              name="captionBase"
              defaultValue={pieza.caption_base ?? ''}
              rows={6}
              className={ENTRADA}
              disabled={!puedeEditar}
            />
          </Campo>

          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="Fecha">
              <input
                type="date"
                name="fecha"
                defaultValue={pieza.fecha_publicacion ?? ''}
                className={ENTRADA}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo etiqueta="Hora (Bogotá)">
              <input
                type="time"
                name="hora"
                defaultValue={pieza.hora_publicacion?.slice(0, 5) ?? ''}
                className={ENTRADA}
                disabled={!puedeEditar}
              />
            </Campo>
            <Campo etiqueta="Recurso que se entrega">
              <select name="recursoId" defaultValue={pieza.resource_id ?? ''} className={ENTRADA} disabled={!puedeEditar}>
                <option value="">sin recurso</option>
                {recursos.map((recurso) => (
                  <option key={recurso.id} value={recurso.id}>
                    {recurso.titulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {puedeEditar ? <Enviar haciendo="Guardando">Guardar contenido</Enviar> : null}
        </form>

        {pieza.estado === 'borrador' && puedeEditar ? (
          <form action={(datos) => correr(enviarARevision, datos)} className="mt-3 border-t border-linea pt-3">
            <input type="hidden" name="piezaId" value={pieza.id} />
            <Enviar variante="secundario" haciendo="Enviando">
              Enviar a revisión
            </Enviar>
          </form>
        ) : null}
      </Tarjeta>

      <Tarjeta titulo="Caption por red">
        <form action={(datos) => correr(guardarCaptionsPorRed, datos)} className="space-y-3" aria-label="Caption por red">
          <input type="hidden" name="piezaId" value={pieza.id} />

          <div className="flex gap-1" role="tablist" aria-label="Red social">
            {REDES.map((opcion) => (
              <button
                key={opcion}
                type="button"
                role="tab"
                aria-selected={red === opcion}
                onClick={() => setRed(opcion)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  red === opcion ? 'bg-tinta text-superficie' : 'border border-linea-fuerte'
                }`}
              >
                {opcion}
                {pieza.captions_red?.[opcion] ? ' ●' : ''}
              </button>
            ))}
          </div>

          {/* Los tres campos viven a la vez para que el guardado sea uno solo.
              La pestaña decide cuál se ve. */}
          {REDES.map((opcion) => (
            <div key={opcion} className={red === opcion ? 'block' : 'hidden'}>
              <textarea
                name={opcion}
                defaultValue={pieza.captions_red?.[opcion] ?? ''}
                rows={6}
                placeholder={pieza.caption_base ?? 'Vacío hereda el caption base'}
                className={ENTRADA}
                disabled={!puedeEditar}
              />
              <p className="mt-1 text-xs text-tinta-3">
                {LIMITES[opcion]} · vacío hereda el caption base
              </p>
            </div>
          ))}

          {puedeEditar ? <Enviar haciendo="Guardando">Guardar captions por red</Enviar> : null}
        </form>
      </Tarjeta>

      <Tarjeta titulo="Automatización de comentarios">
        <form action={(datos) => correr(guardarAutomatizacion, datos)} className="space-y-3" aria-label="Automatización de comentarios">
          <input type="hidden" name="piezaId" value={pieza.id} />

          <Campo etiqueta="Palabra clave">
            <input
              name="palabra"
              value={palabra}
              onChange={(e) => setPalabra(e.target.value)}
              className={ENTRADA}
              disabled={!puedeAutomatizar}
            />
            {palabra ? (
              <p className="mt-1 text-xs text-tinta-3">Se guarda como {normalizar(palabra)}</p>
            ) : null}
          </Campo>

          <Campo etiqueta="Variantes que también responden">
            <textarea
              name="variantes"
              defaultValue={clave?.variantes.join(', ') ?? ''}
              rows={2}
              placeholder={propuestas.slice(0, 8).join(', ')}
              className={ENTRADA}
              disabled={!puedeAutomatizar}
            />
            <p className="mt-1 text-xs text-tinta-3">
              Vacío deja las que el sistema deriva solo. La coincidencia ya ignora tildes, mayúsculas, signos y
              letras repetidas, así que aquí van las que se escriben distinto de verdad.
            </p>
          </Campo>

          <Campo etiqueta="Mensaje directo">
            <textarea
              name="mensaje"
              defaultValue={plantilla?.mensaje ?? ''}
              rows={4}
              placeholder="Usa {enlace} y {palabra} donde quieras que entren"
              className={ENTRADA}
              disabled={!puedeAutomatizar}
            />
          </Campo>

          <Campo etiqueta="WhatsApp de destino">
            <input
              name="destinoWhatsapp"
              defaultValue={plantilla?.destino_url ?? whatsapp}
              className={ENTRADA}
              disabled={!puedeAutomatizar}
            />
          </Campo>

          {enlace ? (
            <p className="text-xs text-tinta-3">
              Enlace rastreado: /r/{enlace.slug} · {enlace.clics} clics
            </p>
          ) : null}

          {puedeAutomatizar ? <Enviar haciendo="Guardando">Guardar automatización</Enviar> : null}
        </form>
      </Tarjeta>

      {puedeResolver ? (
        <Tarjeta titulo="Revisión">
          <form action={(datos) => correr(resolverPieza, datos)} className="space-y-3" aria-label="Revisión de la pieza">
            <input type="hidden" name="piezaId" value={pieza.id} />
            <Campo etiqueta="Comentario, obligatorio al devolver">
              <input name="comentario" className={ENTRADA} />
            </Campo>
            <div className="flex gap-2">
              <button
                type="submit"
                name="accion"
                value="aprobar"
                className="rounded-md bg-tinta px-3 py-2 text-sm font-medium text-superficie"
              >
                Aprobar
              </button>
              <button
                type="submit"
                name="accion"
                value="devolver"
                className="rounded-md border border-linea-fuerte px-3 py-2 text-sm font-medium"
              >
                Devolver
              </button>
            </div>
          </form>
        </Tarjeta>
      ) : null}
    </div>
  )
}

const REDES: RedSocial[] = ['instagram', 'tiktok', 'youtube']

/** Lo que admite cada red, para que nadie escriba a ciegas. */
const LIMITES: Record<RedSocial, string> = {
  instagram: 'hasta 2.200 caracteres',
  tiktok: 'hasta 2.200 caracteres',
  youtube: 'título de 100 y descripción de 5.000',
}

