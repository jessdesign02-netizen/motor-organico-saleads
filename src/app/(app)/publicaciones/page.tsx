import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { Celda, Encabezado, Etiqueta, Tabla, Tarjeta, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { ESTADO_PUBLICACION, RED, hace } from '@/lib/etiquetas'

export const dynamic = 'force-dynamic'

/**
 * Publicaciones.
 *
 * Cada salida de una pieza a una red, con su estado propio. Hasta ahora esto
 * solo se veía dentro del día o repartido en resultados, y el estado por red es
 * justo lo que hay que mirar cuando algo no salió: una pieza puede estar en vivo
 * en Instagram y haber fallado en YouTube.
 */
export default async function Publicaciones() {
  const supabase = await clienteServidor()

  const publicaciones = filas(
    await supabase.from('publications').select('*').order('programado_at', { ascending: false }).limit(150),
    'las publicaciones',
  )

  const piezaIds = [...new Set(publicaciones.map((p) => p.piece_id))]
  const [{ data: piezas }, { data: cuentas }, { data: marcas }] = await Promise.all([
    piezaIds.length ? supabase.from('pieces').select('id, tema, brand_id').in('id', piezaIds) : { data: [] },
    supabase.from('social_accounts').select('id, red, handle, brand_id'),
    supabase.from('brands').select('id, nombre'),
  ])

  const enVivo = publicaciones.filter((p) => p.estado === 'publicado')
  const enCola = publicaciones.filter((p) => p.estado === 'pendiente' || p.estado === 'publicando')
  const fallidas = publicaciones.filter((p) => p.estado === 'fallido')

  const fila = (publicacion: (typeof publicaciones)[number]) => {
    const pieza = (piezas ?? []).find((p) => p.id === publicacion.piece_id)
    const cuenta = (cuentas ?? []).find((c) => c.id === publicacion.social_account_id)
    const marca = (marcas ?? []).find((m) => m.id === pieza?.brand_id)

    return (
      <tr key={publicacion.id} className="align-top">
        <Celda>
          {pieza ? (
            <Link
              href={`/piezas/${pieza.id}`}
              className="font-medium text-tinta underline-offset-2 hover:underline"
            >
              {pieza.tema}
            </Link>
          ) : (
            <span className="text-tinta-3">pieza eliminada</span>
          )}
          <span className="mt-0.5 block text-xs text-tinta-3">{marca?.nombre}</span>
          {publicacion.ultimo_error ? (
            <span className="mt-1 block max-w-md text-xs text-serio">{publicacion.ultimo_error}</span>
          ) : null}
        </Celda>
        <Celda numero apagado>
          {cuenta ? RED[cuenta.red] : '—'}
        </Celda>
        <Celda numero>
          <Etiqueta rotulo={ESTADO_PUBLICACION[publicacion.estado]} titulo />
        </Celda>
        <Celda numero apagado>
          {publicacion.intentos > 1 ? `${publicacion.intentos} intentos` : ''}
        </Celda>
        <Celda numero apagado>
          {hace(publicacion.publicado_at ?? publicacion.programado_at)}
        </Celda>
        <Celda numero>
          {publicacion.permalink ? (
            <a
              href={publicacion.permalink}
              target="_blank"
              rel="noreferrer"
              className="text-tinta-2 underline underline-offset-2 hover:text-tinta"
            >
              Ver
            </a>
          ) : (
            <span className="text-tinta-3">—</span>
          )}
        </Celda>
      </tr>
    )
  }

  const CABECERAS = ['Pieza', 'Red', 'Estado', 'Intentos', 'Cuándo', '']

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Publicaciones"
        bajada={`${enVivo.length} en vivo · ${enCola.length} en cola${fallidas.length > 0 ? ` · ${fallidas.length} no salieron` : ''}`}
      >
        <Link
          href="/dia"
          className="rounded-silk shadow-alzado bg-arcilla px-3.5 py-2 text-sm font-medium text-tinta transition-colors hover:bg-arcilla-alta"
        >
          Panel del día
        </Link>
      </Encabezado>

      {publicaciones.length === 0 ? (
        <Vacio>Todavía no hay salidas. Una pieza genera su publicación cuando se aprueba el día.</Vacio>
      ) : null}

      {/* Lo que falló va primero: es lo único que pide algo de alguien. */}
      {fallidas.length > 0 ? (
        <Tarjeta
          titulo="No salieron"
          bajada="Cada una lleva su error. Tras tres intentos el sistema deja de reintentar y avisa."
          ajustado
        >
          <Tabla cabeceras={CABECERAS}>{fallidas.map(fila)}</Tabla>
        </Tarjeta>
      ) : null}

      {enCola.length > 0 ? (
        <Tarjeta titulo="En cola" bajada="Salen a su hora, sin que nadie las toque." ajustado>
          <Tabla cabeceras={CABECERAS}>{enCola.map(fila)}</Tabla>
        </Tarjeta>
      ) : null}

      {enVivo.length > 0 ? (
        <Tarjeta titulo="En vivo" bajada="Publicadas y escuchando comentarios." ajustado>
          <Tabla cabeceras={CABECERAS}>{enVivo.map(fila)}</Tabla>
        </Tarjeta>
      ) : null}
    </div>
  )
}
