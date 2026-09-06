import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { prepararVideosProximos } from '@/lib/trabajos/video'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }
  return NextResponse.json({ resumen: await prepararVideosProximos() })
}

export const GET = POST
