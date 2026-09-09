import Link from 'next/link'
import { notFound } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { Encabezado, Etiqueta, Tarjeta } from '@/app/ui'
import { ESTADO_PIEZA, enumerar, fechaLarga, hace, hora } from '@/lib/etiquetas'
import { Editor } from './editor'
import { CambioDeHoja } from './hoja'

export const dynamic = 'force-dynamic'

export default async function DetallePieza({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await clienteServidor()
  const perfil = await perfilActual()

  const { data: pieza } = await supabase.from('pieces').select('*').eq('id', id).maybeSingle()
  if (!pieza) notFound()

  const [{ data: clave }, { data: plantilla }, { data: enlace }, { data: recursos }, { data: aprobaciones }] =
    await Promise.all([
      supabase.from('keywords').select('*').eq('piece_id', id).maybeSingle(),
      supabase.from('dm_templates').select('*').eq('piece_id', id).maybeSingle(),
      supabase.from('tracked_links').select('*').eq('piece_id', id).maybeSingle(),
      supabase.from('resources').select('*').eq('brand_id', pieza.brand_id).eq('activo', true),
      supabase.from('approvals').select('*').eq('piece_id', id).order('creado_at', { ascending: false }),
    ])

  const { data: marca } = await supabase.from('brands').select('*').eq('id', pieza.brand_id).single()

  const faltan: string[] = []
  if (!pieza.fecha_publicacion) faltan.push('fecha de publicación')
  if (!pieza.hora_publicacion) faltan.push('hora')
  if (!pieza.drive_url) faltan.push('video')
  if (!clave) faltan.push('palabra clave')
  if (!plantilla) faltan.push('mensaje directo')
  if (!enlace) faltan.push('enlace rastreado')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parrilla" className="text-xs text-tinta-2 underline underline-offset-2 hover:text-tinta">
          ← Volver a la parrilla
        </Link>
      </div>

      <Encabezado
        titulo={pieza.tema}
        bajada={[
          marca?.nombre,
          pieza.fecha_publicacion ? fechaLarga(pieza.fecha_publicacion) : 'sin fecha',
          pieza.hora_publicacion ? hora(pieza.hora_publicacion) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <Etiqueta rotulo={ESTADO_PIEZA[pieza.estado]} titulo />
      </Encabezado>

      {faltan.length > 0 ? (
        <p className="rounded-silk bg-arcilla shadow-hundido px-4 py-3 text-sm text-aviso">
          Para poder programarse le falta {enumerar(faltan)}.
        </p>
      ) : null}

      {pieza.video_error ? (
        <p className="rounded-silk bg-arcilla shadow-hundido px-4 py-3 text-sm text-serio">
          El video no se pudo bajar de Drive: {pieza.video_error}
        </p>
      ) : null}

      {pieza.sheet_pendiente ? (
        <CambioDeHoja
          piezaId={pieza.id}
          cambio={pieza.sheet_pendiente}
          actual={{
            tema: pieza.tema,
            hook: pieza.hook,
            drive_url: pieza.drive_url,
            fecha_publicacion: pieza.fecha_publicacion,
            responsable: pieza.responsable,
          }}
          puedeResolver={perfil?.rol === 'editora' || perfil?.rol === 'aprobadora'}
        />
      ) : null}

      <Editor
        pieza={pieza}
        clave={clave ?? null}
        plantilla={plantilla ?? null}
        enlace={enlace ?? null}
        recursos={recursos ?? []}
        whatsapp={marca?.whatsapp_url ?? ''}
        rol={perfil?.rol ?? 'observador'}
      />

      <Tarjeta titulo="Historial de revisión">
        {(aprobaciones ?? []).length === 0 ? (
          <p className="text-sm text-tinta-3">Todavía sin decisiones registradas.</p>
        ) : (
          <ul className="space-y-3">
            {(aprobaciones ?? []).map((registro) => (
              <li key={registro.id} className="flex gap-3 text-sm">
                <Etiqueta
                  rotulo={
                    registro.accion === 'aprobar'
                      ? { texto: 'Aprobada', tono: 'bien' }
                      : { texto: 'Devuelta', tono: 'aviso' }
                  }
                />
                <span className="min-w-0 flex-1">
                  {registro.comentario ? (
                    <span className="text-tinta">{registro.comentario}</span>
                  ) : (
                    <span className="text-tinta-3">Sin comentario</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-tinta-3">{hace(registro.creado_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  )
}
