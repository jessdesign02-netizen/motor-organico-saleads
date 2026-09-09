import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { perfilActual } from '@/lib/sesion'
import { hoyDelEquipo, lunesDe } from '@/lib/dominio/semana'
import { Dato, Encabezado, Etiqueta, Marca, Tarjeta, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { ESTADO_PIEZA, TIPO_AVISO, fechaConDia, hace, hora } from '@/lib/etiquetas'
import { IconoAutomatizaciones, IconoChat, IconoDia, IconoParrilla, IconoResultados } from '../iconos'

export const dynamic = 'force-dynamic'

/**
 * Dashboard.
 *
 * La primera pantalla del día. Responde tres preguntas en este orden: qué sale
 * hoy, qué necesita mi mano, y cómo va la semana. Todo lo demás vive en su
 * sección; aquí solo está lo que cambia una decisión antes del mediodía.
 */
export default async function Dashboard() {
  const supabase = await clienteServidor()
  const perfil = await perfilActual()
  const hoy = hoyDelEquipo()
  const lunes = lunesDe(new Date())

  const [respuestaHoy, respuestaSemana, respuestaAvisos] = await Promise.all([
    supabase
      .from('pieces')
      .select('*')
      .eq('fecha_publicacion', hoy)
      .order('hora_publicacion', { ascending: true }),
    supabase.from('pieces').select('*').eq('semana', lunes),
    supabase
      .from('notices')
      .select('*')
      .is('leido_at', null)
      .order('creado_at', { ascending: false })
      .limit(4),
  ])

  const deHoy = filas(respuestaHoy, 'las piezas de hoy')
  const deLaSemana = filas(respuestaSemana, 'la semana')
  const avisos = filas(respuestaAvisos, 'los avisos')

  const idsSemana = deLaSemana.map((p) => p.id)
  const [{ data: publicaciones }, { data: enlaces }, { data: marcas }] = await Promise.all([
    idsSemana.length ? supabase.from('publications').select('*').in('piece_id', idsSemana) : { data: [] },
    idsSemana.length ? supabase.from('tracked_links').select('*').in('piece_id', idsSemana) : { data: [] },
    supabase.from('brands').select('id, nombre'),
  ])

  const pubIds = (publicaciones ?? []).map((p) => p.id)
  const { data: comentarios } = pubIds.length
    ? await supabase.from('comments').select('*').in('publication_id', pubIds)
    : { data: [] }

  const detectados = (comentarios ?? []).filter((c) => c.keyword_id !== null).length
  const enviados = (comentarios ?? []).filter((c) => c.estado === 'respondido').length
  const pendientes = (comentarios ?? []).filter(
    (c) => c.estado === 'manual_pendiente' || c.estado === 'fallido',
  ).length
  const clics = (enlaces ?? []).reduce((suma, e) => suma + e.clics, 0)

  const listasDeHoy = deHoy.filter((p) => p.estado === 'aprobado')
  const sinAprobar = deLaSemana.filter((p) => p.estado === 'revision' || p.estado === 'borrador').length

  const atajo =
    'flex items-center justify-between gap-3 rounded-silk shadow-alzado bg-arcilla px-4 py-3 text-sm font-medium text-tinta transition-colors hover: hover:bg-arcilla-alta'

  return (
    <div className="space-y-6">
      <Encabezado titulo={`Hola, ${(perfil?.nombre ?? 'equipo').split(' ')[0]}`} bajada={fechaConDia(hoy)} />

      {/* Lo que hay que decidir hoy, antes que cualquier número. */}
      {listasDeHoy.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-silk shadow-alzado bg-arcilla p-6 shadow-alzado">
          <div className="flex items-center gap-4">
            <Marca acento="primario">
              <IconoDia className="size-5" />
            </Marca>
            <div>
              <p className="text-[15px] font-semibold text-tinta">
                {listasDeHoy.length} {listasDeHoy.length === 1 ? 'pieza está lista' : 'piezas están listas'}{' '}
                para salir hoy
              </p>
              <p className="mt-0.5 text-[13px] text-tinta-2">
                Salen a su hora con la automatización encendida. Es el único punto que espera tu decisión.
              </p>
            </div>
          </div>
          <Link
            href="/dia"
            className="rounded-silk bg-tinta px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primario"
          >
            Abrir el día
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato
          etiqueta="Comentarios"
          valor={detectados}
          acento="bien"
          nota={detectados === 0 ? 'ninguno esta semana' : 'con la palabra clave'}
        />
        <Dato
          etiqueta="Mensajes"
          valor={enviados}
          acento="primario"
          nota={
            detectados === 0
              ? 'sin comentarios que responder'
              : `${Math.round((enviados / detectados) * 100)}% de los detectados`
          }
        />
        {/* Sin tasa: los clics son acumulados del enlace y los mensajes son de
 esta semana. Dividirlos daría un número que parece un ratio y no lo es. */}
        <Dato etiqueta="Clics" valor={clics} acento="terciario" nota="acumulado de los enlaces" />
        <Dato
          etiqueta="Pendientes"
          valor={pendientes}
          acento={pendientes > 0 ? 'aviso' : 'neutro'}
          nota={pendientes === 0 ? 'nada que atender' : 'esperan en el chat en vivo'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta
          titulo="Sale hoy"
          bajada={deHoy.length === 0 ? undefined : `${deHoy.length} en la agenda`}
          accion={
            <Link href="/dia" className="text-xs text-tinta-2 underline underline-offset-2 hover:text-tinta">
              Ver el día
            </Link>
          }
          ajustado
        >
          {deHoy.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-3">Nada programado para hoy.</p>
          ) : (
            <ul className="divide-y divide-white/40">
              {deHoy.map((pieza) => (
                <li key={pieza.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-tinta">
                    {hora(pieza.hora_publicacion)}
                  </span>
                  <Link
                    href={`/piezas/${pieza.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-tinta underline-offset-2 hover:underline"
                  >
                    {pieza.tema}
                  </Link>
                  <span className="shrink-0 text-xs text-tinta-3">
                    {(marcas ?? []).find((m) => m.id === pieza.brand_id)?.nombre}
                  </span>
                  <Etiqueta rotulo={ESTADO_PIEZA[pieza.estado]} titulo />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Avisos"
          bajada={avisos.length === 0 ? undefined : 'Lo que salió distinto de lo esperado'}
          accion={
            <Link
              href="/avisos"
              className="text-xs text-tinta-2 underline underline-offset-2 hover:text-tinta"
            >
              Ver todos
            </Link>
          }
          ajustado
        >
          {avisos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-3">Nada sin atender.</p>
          ) : (
            <ul className="divide-y divide-white/40">
              {avisos.map((aviso) => (
                <li key={aviso.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Etiqueta rotulo={TIPO_AVISO[aviso.tipo]} />
                    <span className="text-xs text-tinta-3">{hace(aviso.creado_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-tinta">{aviso.titulo}</p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="La semana" bajada={`${deLaSemana.length} piezas · ${sinAprobar} sin aprobar`}>
        {deLaSemana.length === 0 ? (
          <Vacio>La semana está vacía. La hoja de cálculo se lee sola cada quince minutos.</Vacio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: '/parrilla',
                texto: 'Ver la parrilla',
                icono: IconoParrilla,
                acento: 'primario' as const,
              },
              {
                href: '/chat',
                texto: pendientes > 0 ? `Chat en vivo · ${pendientes}` : 'Chat en vivo',
                icono: IconoChat,
                acento: 'neutro' as const,
              },
              {
                href: '/automatizaciones',
                texto: 'Automatizaciones',
                icono: IconoAutomatizaciones,
                acento: 'terciario' as const,
              },
              { href: '/resultados', texto: 'Resultados', icono: IconoResultados, acento: 'neutro' as const },
            ].map((a) => (
              <Link key={a.href} href={a.href} className={atajo}>
                <span className="flex-1">{a.texto}</span>
                <Marca acento={a.acento} tamano="sm">
                  <a.icono className="size-4" />
                </Marca>
              </Link>
            ))}
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
