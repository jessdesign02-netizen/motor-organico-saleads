import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { sondearComentarios } from '@/lib/trabajos/escuchar'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }
  return NextResponse.json({ resumen: await sondearComentarios() })
}

export const GET = POST
