import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { limpiarCopiasVencidas } from '@/lib/trabajos/video'

export const dynamic = 'force-dynamic'

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }
  return NextResponse.json({ copiasBorradas: await limpiarCopiasVencidas() })
}

export const GET = POST
