import 'server-only'
import { google } from 'googleapis'

/**
 * Lectura de la hoja de cálculo del equipo audiovisual con cuenta de servicio.
 * La hoja se comparte con el correo de la cuenta, en modo lectura.
 */

export type FilaHoja = {
  /** Identidad estable de la fila. Es lo que concilia con sheet_row_id. */
  filaId: string
  valores: Record<string, string>
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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return google.sheets({ version: 'v4', auth })
}

/** Compara encabezados ignorando tildes, mayúsculas y espacios de sobra. */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export async function leerHoja(sheetId: string, pestana: string): Promise<FilaHoja[]> {
  const api = cliente()
  const respuesta = await api.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${pestana}!A1:Z1000`,
  })

  const filas = respuesta.data.values ?? []
  const encabezados = (filas[0] ?? []).map((h) => normalizarEncabezado(String(h)))

  return filas.slice(1).flatMap((fila, indice) => {
    const valores: Record<string, string> = {}
    for (const [columna, encabezado] of encabezados.entries()) {
      if (!encabezado) continue
      valores[encabezado] = String(fila[columna] ?? '').trim()
    }
    // Una fila sin nada útil se descarta aquí, sin llegar al log.
    if (Object.values(valores).every((v) => v === '')) return []
    return [{ filaId: `fila-${indice + 2}`, valores }]
  })
}
