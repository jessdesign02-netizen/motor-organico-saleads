import { NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/guardia'
import { sincronizarTodo } from '@/lib/trabajos/sincronizar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(peticion: Request) {
  if (!cronAutorizado(peticion)) {
    return NextResponse.json({ error: 'sin autorización' }, { status: 401 })
  }
  return NextResponse.json({ resumen: await sincronizarTodo() })
}

export const GET = POST
