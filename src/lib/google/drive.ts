import 'server-only'
import { google } from 'googleapis'

/**
 * Descarga del video desde Drive con cuenta de servicio.
 *
 * El equipo audiovisual sube el video a Drive y pega el enlace en la hoja. Ese
 * enlace pide sesión, así que la plataforma no puede descargarlo: el video pasa
 * por aquí y se copia a Storage antes de publicar.
 */

/** Acepta las tres formas en que Drive comparte un archivo. */
export function idDeDrive(enlace: string): string | null {
  const formas = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/open\?id=([a-zA-Z0-9_-]+)/]

  for (const forma of formas) {
    const encontrado = forma.exec(enlace)
    if (encontrado?.[1]) return encontrado[1]
  }

  // Un id suelto, sin envoltura de URL.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(enlace.trim())) return enlace.trim()
  return null
}

function cliente() {
  const correo = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const llave = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!correo || !llave) {
    throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_SERVICE_ACCOUNT_KEY')
  }

  const auth = new google.auth.JWT({
    email: correo,
    key: llave.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  return google.drive({ version: 'v3', auth })
}

export type VideoDeDrive = {
  contenido: Uint8Array
  tipo: string
  nombre: string
  bytes: number
}

export async function descargarDeDrive(enlace: string): Promise<VideoDeDrive> {
  const id = idDeDrive(enlace)
  if (!id) throw new Error(`El enlace de Drive no trae un id reconocible: ${enlace}`)

  const drive = cliente()

  const { data: ficha } = await drive.files.get({
    fileId: id,
    fields: 'name, mimeType, size',
    supportsAllDrives: true,
  })

  if (ficha.mimeType && !ficha.mimeType.startsWith('video/')) {
    throw new Error(`El archivo de Drive es ${ficha.mimeType}, y aquí se espera un video`)
  }

  const respuesta = await drive.files.get(
    { fileId: id, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )

  const contenido = new Uint8Array(respuesta.data as ArrayBuffer)

  return {
    contenido,
    tipo: ficha.mimeType ?? 'video/mp4',
    nombre: ficha.name ?? `${id}.mp4`,
    bytes: contenido.byteLength,
  }
}
