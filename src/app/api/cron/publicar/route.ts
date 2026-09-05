import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { publicarPendientes } from '@/lib/trabajos/publicar'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }
  return NextResponse.json({ resumen: await publicarPendientes() })
}

export const GET = POST
