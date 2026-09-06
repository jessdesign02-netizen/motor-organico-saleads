import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { reintentarMensajes, sondearComentarios } from '@/lib/trabajos/escuchar'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }

  // El sondeo respalda al webhook, y el reintento recoge lo que la plataforma
  // rechazó por límite de tasa. Los dos caminos entran por la misma puerta del
  // motor, así que la idempotencia los cubre igual.
  const [sondeo, reintentos] = await Promise.all([sondearComentarios(), reintentarMensajes()])

  return NextResponse.json({ sondeo, reintentos })
}

export const GET = POST
