import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { avisarTokensPorVencer } from '@/lib/trabajos/avisos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }
  return NextResponse.json({ cuentasRevisadas: await avisarTokensPorVencer() })
}

export const GET = POST
