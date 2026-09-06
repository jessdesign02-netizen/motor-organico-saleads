import type { RedSocial } from '@/lib/database.types'
import { coincide } from '@/lib/dominio/clave'
import { procesarConTasa, unicoPorClave } from '@/lib/dominio/cola'
import { puedeResponder } from '@/lib/dominio/ventana'
import type { AdaptadorRed, ComentarioEntrante, CredencialCuenta } from '@/lib/redes'

/**
 * Motor de comentarios.
 *
 * Recibe lo que trae el webhook o el sondeo y decide, comentario por comentario,
 * qué pasa con él. Toda la persistencia entra por el puerto `AlmacenMotor`, de
 * modo que las reglas se prueban con 300 comentarios sin tocar la base.
 *
 * Las cuatro barreras de idempotencia, en orden:
 *   1. Repetidos dentro del mismo lote.
 *   2. Comentario ya registrado, por `external_comment_id`.
 *   3. Autor ya atendido en esa publicación.
 *   4. Restricciones únicas de la base, que atrapan la carrera entre el webhook
 *      y el sondeo cuando llegan a la vez.
 */

export type Automatizacion = {
  publicationId: string
  externalPostId: string
  red: RedSocial
  palabra: string
  variantes: string[]
  mensaje: string
  enlace: string
  claveActivaDesde: Date | null
  claveActivaHasta: Date | null
}

export type ResueltoComentario =
  | 'respondido'
  | 'duplicado'
  | 'autor_repetido'
  | 'sin_coincidencia'
  | 'ventana_vencida'
  | 'clave_sin_activar'
  | 'clave_vencida'
  | 'manual_pendiente'
  | 'fallido'

export type DetalleComentario = {
  externalCommentId: string
  resultado: ResueltoComentario
  motivo?: string
}

export type ResumenMotor = {
  recibidos: number
  respondidos: number
  duplicados: number
  sinCoincidencia: number
  aBandejaManual: number
  fallidos: number
  detalle: DetalleComentario[]
}

/** Puerto de persistencia. La implementación real vive en trabajos/almacen.ts. */
export type AlmacenMotor = {
  /**
   * Anota que el envío falló, y devuelve si todavía quedan intentos.
   * La espera creciente vive en la cola: 2, 8 y 30 minutos.
   */
  anotarIntentoFallido: (comentarioId: string, error: string) => Promise<{ quedanIntentos: boolean }>
  /** Registra el comentario. Devuelve false si ya estaba: así el sondeo repetido sale gratis. */
  registrar: (
    publicationId: string,
    comentario: ComentarioEntrante,
    coincidio: boolean,
  ) => Promise<{ nuevo: boolean; comentarioId: string }>
  autorYaAtendido: (publicationId: string, autorExternalId: string | null) => Promise<boolean>
  marcar: (comentarioId: string, estado: ResueltoComentario, motivo?: string) => Promise<void>
  anotarEnvio: (
    comentarioId: string,
    datos: { destinatario: string | null; mensaje: string; estado: 'enviado' | 'fallido'; error?: string },
  ) => Promise<void>
  /** Respuestas ya gastadas hoy en esa red, para respetar el cupo de cuota. */
  respuestasDeHoy: (red: RedSocial) => Promise<number>
}

export type OpcionesMotor = {
  ahora?: Date
  dormir?: (ms: number) => Promise<void>
  reloj?: () => number
}

/** Arma el texto final. El enlace propio va siempre, aunque el mensaje se olvide de él. */
export function componerMensaje(plantilla: string, enlace: string, palabra: string): string {
  const texto = plantilla.replaceAll('{enlace}', enlace).replaceAll('{palabra}', palabra)
  return texto.includes(enlace) ? texto : `${texto}\n${enlace}`
}

export async function procesarComentarios(
  entrantes: readonly ComentarioEntrante[],
  automatizacion: Automatizacion,
  adaptador: AdaptadorRed,
  credencial: CredencialCuenta,
  almacen: AlmacenMotor,
  opciones: OpcionesMotor = {},
): Promise<ResumenMotor> {
  const ahora = opciones.ahora ?? new Date()

  const resumen: ResumenMotor = {
    recibidos: entrantes.length,
    respondidos: 0,
    duplicados: 0,
    sinCoincidencia: 0,
    aBandejaManual: 0,
    fallidos: 0,
    detalle: [],
  }

  const anotar = (externalCommentId: string, resultado: ResueltoComentario, motivo?: string) => {
    resumen.detalle.push(motivo ? { externalCommentId, resultado, motivo } : { externalCommentId, resultado })
    if (resultado === 'respondido') resumen.respondidos++
    else if (resultado === 'duplicado' || resultado === 'autor_repetido') resumen.duplicados++
    else if (resultado === 'sin_coincidencia') resumen.sinCoincidencia++
    else if (resultado === 'manual_pendiente') resumen.aBandejaManual++
    else if (resultado === 'fallido') resumen.fallidos++
    else resumen.aBandejaManual++
  }

  // Barrera 1: el mismo comentario dos veces en el mismo lote.
  const lote = unicoPorClave(entrantes, (c) => c.externalCommentId)
  for (const repetido of entrantes.filter((c) => !lote.includes(c))) {
    anotar(repetido.externalCommentId, 'duplicado', 'repetido dentro del lote')
  }

  // Cupo diario, donde la cuota de la plataforma lo impone.
  // El cupo de la cuenta manda sobre el valor por defecto de la red.
  const cupoDelDia = credencial.cupoRespuestasDia ?? adaptador.cupoDiarioRespuestas
  let cupoRestante = Number.POSITIVE_INFINITY
  if (cupoDelDia !== null && cupoDelDia !== undefined) {
    const gastadas = await almacen.respuestasDeHoy(adaptador.red)
    cupoRestante = Math.max(0, cupoDelDia - gastadas)
  }

  type Pendiente = { comentario: ComentarioEntrante; comentarioId: string }
  const paraResponder: Pendiente[] = []

  /**
   * Autores ya comprometidos en esta pasada. La consulta al almacén solo ve lo
   * que quedó guardado, y el envío ocurre después del recorrido: sin este
   * registro, dos comentarios del mismo autor dentro del mismo lote se
   * encolaban los dos y esa persona recibía dos mensajes. La restricción de la
   * base protege el registro, y aquí se protege el envío.
   */
  const autoresComprometidos = new Set<string>()

  for (const comentario of lote) {
    const encontrado = coincide(comentario.texto, automatizacion.palabra, automatizacion.variantes)

    // Barrera 2: ya registrado en una pasada anterior.
    const { nuevo, comentarioId } = await almacen.registrar(
      automatizacion.publicationId,
      comentario,
      encontrado.coincide,
    )
    if (!nuevo) {
      anotar(comentario.externalCommentId, 'duplicado', 'ya estaba registrado')
      continue
    }

    if (!encontrado.coincide) {
      await almacen.marcar(comentarioId, 'sin_coincidencia')
      anotar(comentario.externalCommentId, 'sin_coincidencia')
      continue
    }

    const permiso = puedeResponder({
      comentarioCreadoEn: comentario.creadoEn,
      claveActivaDesde: automatizacion.claveActivaDesde,
      claveActivaHasta: automatizacion.claveActivaHasta,
      ahora,
    })
    if (!permiso.puede) {
      const estado = permiso.motivo as ResueltoComentario
      // La ventana vencida pasa a la bandeja: la persona todavía puede
      // responderle a mano, y el sistema deja dicho por qué.
      await almacen.marcar(comentarioId, estado, permiso.motivo ?? undefined)
      anotar(comentario.externalCommentId, estado, permiso.motivo ?? undefined)
      continue
    }

    // Barrera 3: ese autor ya recibió su respuesta, en una pasada anterior o
    // unas líneas más arriba dentro de este mismo lote.
    const autor = comentario.autorExternalId
    const yaEnEsteLote = autor !== null && autoresComprometidos.has(autor)
    if (yaEnEsteLote || (await almacen.autorYaAtendido(automatizacion.publicationId, autor))) {
      await almacen.marcar(comentarioId, 'autor_repetido', 'el autor ya recibió respuesta')
      anotar(comentario.externalCommentId, 'autor_repetido')
      continue
    }

    // La red sin API de respuesta entrega el caso a la bandeja manual.
    if (adaptador.responder === null) {
      await almacen.marcar(comentarioId, 'manual_pendiente', 'la red carece de API de respuesta')
      anotar(comentario.externalCommentId, 'manual_pendiente', 'la red carece de API de respuesta')
      continue
    }

    if (cupoRestante <= 0) {
      await almacen.marcar(comentarioId, 'manual_pendiente', 'cupo diario de la plataforma agotado')
      anotar(comentario.externalCommentId, 'manual_pendiente', 'cupo diario agotado')
      continue
    }

    cupoRestante--
    if (autor !== null) autoresComprometidos.add(autor)
    paraResponder.push({ comentario, comentarioId })
  }

  const mensaje = componerMensaje(automatizacion.mensaje, automatizacion.enlace, automatizacion.palabra)
  const responder = adaptador.responder

  if (responder && paraResponder.length > 0) {
    await procesarConTasa(
      paraResponder,
      async ({ comentario, comentarioId }) => {
        let salida
        try {
          salida = await responder(credencial, comentario, mensaje)
        } catch (error) {
          // Un fallo inesperado deja el comentario en la bandeja con su motivo,
          // en lugar de desaparecer del resumen.
          const detalle = error instanceof Error ? error.message : String(error)
          await almacen.marcar(comentarioId, 'fallido', detalle)
          anotar(comentario.externalCommentId, 'fallido', detalle)
          return
        }

        if (salida.estado === 'enviado') {
          await almacen.marcar(comentarioId, 'respondido')
          await almacen.anotarEnvio(comentarioId, {
            destinatario: comentario.autorUsername,
            mensaje,
            estado: 'enviado',
          })
          anotar(comentario.externalCommentId, 'respondido')
          return
        }

        await almacen.anotarEnvio(comentarioId, {
          destinatario: comentario.autorUsername,
          mensaje,
          estado: 'fallido',
          error: salida.error,
        })

        // Un límite de tasa se resuelve solo en minutos, así que el caso vuelve
        // a la cola. Lo que la plataforma rechaza de plano, y lo que agota los
        // tres intentos, pasa a la bandeja en lugar de perderse.
        let destino: ResueltoComentario = 'manual_pendiente'
        if (salida.reintentable) {
          const { quedanIntentos } = await almacen.anotarIntentoFallido(comentarioId, salida.error)
          destino = quedanIntentos ? 'fallido' : 'manual_pendiente'
        }

        await almacen.marcar(comentarioId, destino, salida.error)
        anotar(comentario.externalCommentId, destino, salida.error)
      },
      {
        porSegundo: adaptador.enviosPorSegundo,
        ...(opciones.dormir ? { dormir: opciones.dormir } : {}),
        ...(opciones.reloj ? { ahora: opciones.reloj } : {}),
      },
    )
  }

  return resumen
}
