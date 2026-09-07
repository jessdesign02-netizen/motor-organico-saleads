import Link from 'next/link'
import { clienteServidor } from '@/lib/supabase/server'
import { Celda, Encabezado, Etiqueta, Tabla, Tarjeta, Vacio } from '@/app/ui'
import { filas } from '@/lib/consulta'
import { ESTADO_COMENTARIO, RED, hace } from '@/lib/etiquetas'

export const dynamic = 'force-dynamic'

/**
 * Contactos.
 *
 * La gente que ha comentado la palabra clave. No hay una tabla de contactos: se
 * arma desde `comments`, que es donde el motor guarda a cada persona con su
 * identificador de la plataforma.
 *
 * Lo que importa de cada una no es el nombre, es la historia: cuántas veces
 * volvió, en qué piezas, y si recibió su mensaje.
 */
export default async function Contactos() {
  const supabase = await clienteServidor()

  const comentarios = filas(
    await supabase.from('comments').select('*').order('detectado_at', { ascending: false }).limit(500),
    'los contactos',
  )

  const pubIds = [...new Set(comentarios.map((c) => c.publication_id))]
  const { data: publicaciones } = pubIds.length
    ? await supabase.from('publications').select('id, piece_id, social_account_id').in('id', pubIds)
    : { data: [] }

  const piezaIds = [...new Set((publicaciones ?? []).map((p) => p.piece_id))]
  const [{ data: piezas }, { data: cuentas }] = await Promise.all([
    piezaIds.length ? supabase.from('pieces').select('id, tema').in('id', piezaIds) : { data: [] },
    supabase.from('social_accounts').select('id, red'),
  ])

  type Contacto = {
    clave: string
    autor: string
    redes: Set<string>
    comentarios: number
    respondidos: number
    pendientes: number
    piezas: Set<string>
    ultimoAt: string
    ultimoTexto: string
    ultimoEstado: (typeof comentarios)[number]['estado']
    ultimaPiezaId: string | null
  }

  const porPersona = new Map<string, Contacto>()

  for (const comentario of comentarios) {
    const autor = comentario.autor_username ?? comentario.autor_external_id ?? 'sin autor'
    const clave = comentario.autor_external_id ?? autor
    const publicacion = (publicaciones ?? []).find((p) => p.id === comentario.publication_id)
    const pieza = (piezas ?? []).find((p) => p.id === publicacion?.piece_id)
    const cuenta = (cuentas ?? []).find((c) => c.id === publicacion?.social_account_id)

    const existente = porPersona.get(clave)
    if (existente) {
      existente.comentarios++
      if (comentario.estado === 'respondido') existente.respondidos++
      if (comentario.estado === 'manual_pendiente' || comentario.estado === 'fallido') existente.pendientes++
      if (cuenta) existente.redes.add(RED[cuenta.red])
      if (pieza) existente.piezas.add(pieza.tema)
      continue
    }

    // La lista viene ordenada por fecha, así que el primero que se ve es el último que escribió.
    porPersona.set(clave, {
      clave,
      autor,
      redes: new Set(cuenta ? [RED[cuenta.red]] : []),
      comentarios: 1,
      respondidos: comentario.estado === 'respondido' ? 1 : 0,
      pendientes: comentario.estado === 'manual_pendiente' || comentario.estado === 'fallido' ? 1 : 0,
      piezas: new Set(pieza ? [pieza.tema] : []),
      ultimoAt: comentario.detectado_at,
      ultimoTexto: comentario.texto,
      ultimoEstado: comentario.estado,
      ultimaPiezaId: publicacion?.piece_id ?? null,
    })
  }

  const contactos = [...porPersona.values()].sort((a, b) => b.ultimoAt.localeCompare(a.ultimoAt))
  const recurrentes = contactos.filter((c) => c.comentarios > 1).length
  const alcanzados = contactos.filter((c) => c.respondidos > 0).length

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Contactos"
        bajada={
          contactos.length === 0
            ? 'Todavía nadie ha comentado'
            : `${contactos.length} ${contactos.length === 1 ? 'persona' : 'personas'} · ${alcanzados} recibieron su mensaje${
                recurrentes > 0 ? ` · ${recurrentes} volvieron más de una vez` : ''
              }`
        }
      />

      {contactos.length === 0 ? (
        <Vacio>
          Aquí entra cada persona que comenta la palabra clave de una publicación. Se llena solo.
        </Vacio>
      ) : (
        <Tarjeta ajustado>
          <Tabla cabeceras={['Persona', 'Red', 'Último comentario', 'Comentarios', 'Recibió', 'Cuándo']}>
            {contactos.map((contacto) => (
              <tr key={contacto.clave} className="align-top">
                <Celda>
                  <span className="font-medium text-tinta">@{contacto.autor}</span>
                  <span className="mt-0.5 block text-xs text-tinta-3">
                    {contacto.piezas.size} {contacto.piezas.size === 1 ? 'pieza' : 'piezas'}
                  </span>
                </Celda>
                <Celda numero apagado>
                  {[...contacto.redes].join(', ') || '—'}
                </Celda>
                <Celda>
                  <span className="line-clamp-2 max-w-md text-tinta-2">{contacto.ultimoTexto}</span>
                  <span className="mt-1 block">
                    <Etiqueta rotulo={ESTADO_COMENTARIO[contacto.ultimoEstado]} titulo />
                  </span>
                </Celda>
                <Celda numero>{contacto.comentarios}</Celda>
                <Celda numero apagado={contacto.respondidos === 0}>
                  {contacto.respondidos > 0 ? `${contacto.respondidos} mensajes` : 'todavía no'}
                </Celda>
                <Celda numero apagado>
                  {contacto.ultimaPiezaId ? (
                    <Link
                      href={`/piezas/${contacto.ultimaPiezaId}`}
                      className="underline underline-offset-2 hover:text-tinta"
                    >
                      {hace(contacto.ultimoAt)}
                    </Link>
                  ) : (
                    hace(contacto.ultimoAt)
                  )}
                </Celda>
              </tr>
            ))}
          </Tabla>
        </Tarjeta>
      )}
    </div>
  )
}
