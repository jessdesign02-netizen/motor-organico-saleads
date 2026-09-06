import { notFound } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { Etiqueta, Tarjeta } from '@/app/ui'
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
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{pieza.tema}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {marca?.nombre} · {pieza.fecha_publicacion ?? 'sin fecha'} {pieza.hora_publicacion ?? ''}
          </p>
        </div>
        <Etiqueta>{pieza.estado}</Etiqueta>
      </header>

      {faltan.length > 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Para poder programarse le falta: {faltan.join(', ')}.
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
          <p className="text-sm text-neutral-500">Todavía sin decisiones registradas.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(aprobaciones ?? []).map((registro) => (
              <li key={registro.id} className="flex gap-3">
                <span className="font-medium">{registro.accion}</span>
                <span className="text-neutral-500">{registro.creado_at.slice(0, 16).replace('T', ' ')}</span>
                {registro.comentario ? <span className="text-neutral-700">{registro.comentario}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  )
}
