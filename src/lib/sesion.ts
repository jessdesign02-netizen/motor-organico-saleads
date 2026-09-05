import 'server-only'
import { redirect } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/server'
import type { Perfil, RolApp } from '@/lib/database.types'

/**
 * La sesión con su rol. Toda Server Action arranca por aquí: la interfaz puede
 * ocultar un botón, y eso no es una barrera.
 */
export async function perfilActual(): Promise<Perfil | null> {
  const supabase = await clienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data ?? null
}

export async function exigirSesion(): Promise<Perfil> {
  const perfil = await perfilActual()
  if (!perfil) redirect('/ingresar')
  return perfil
}

export async function exigirRol(...roles: RolApp[]): Promise<Perfil> {
  const perfil = await exigirSesion()
  if (!roles.includes(perfil.rol)) {
    throw new Error(`Esta acción es de ${roles.join(' o ')}, y tu rol es ${perfil.rol}`)
  }
  return perfil
}

export const PUEDE_EDITAR: RolApp[] = ['editora', 'audiovisual']
export const PUEDE_APROBAR: RolApp[] = ['editora', 'aprobadora']
