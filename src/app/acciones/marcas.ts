'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/server'
import { exigirRol } from '@/lib/sesion'
import { COLUMNAS_POR_DEFECTO } from '@/lib/dominio/ingesta'
import { esquemaMarca, esquemaRol } from './esquemas'
import { envolver, exigirEscritura, type Respuesta } from './comunes'

/**
 * Alta y ajuste de marcas desde la app.
 *
 * Hasta ahora las marcas se creaban a mano en la base, y eso dejaba el arranque
 * dependiendo de alguien con acceso al SQL.
 */


export async function crearMarca(datos: FormData): Promise<Respuesta> {
  return envolver('Crear la marca', async () => {
    await exigirRol('editora')

    const entrada = esquemaMarca.parse({
      nombre: datos.get('nombre'),
      slug: datos.get('slug'),
      sheetId: datos.get('sheetId') || undefined,
      sheetTab: datos.get('sheetTab') || undefined,
      whatsappUrl: datos.get('whatsappUrl') || '',
    })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('brands')
        .insert({
          nombre: entrada.nombre,
          slug: entrada.slug,
          sheet_id: entrada.sheetId ?? null,
          sheet_tab: entrada.sheetTab || 'Hoja 1',
          whatsapp_url: entrada.whatsappUrl || null,
          // Arranca con los encabezados que ya usa el equipo. Se ajustan después.
          mapa_columnas: COLUMNAS_POR_DEFECTO,
        })
        .select('id'),
      'Crear la marca',
    )

    revalidatePath('/configuracion')
    revalidatePath('/parrilla')
    return `Marca ${entrada.nombre} creada`
  })
}

export async function ajustarMarca(datos: FormData): Promise<Respuesta> {
  return envolver('Ajustar la marca', async () => {
    await exigirRol('editora')

    const entrada = z
      .object({
        marcaId: z.string().uuid(),
        sheetId: z.string().optional(),
        sheetTab: z.string().optional(),
        whatsappUrl: z.string().url().optional().or(z.literal('')),
      })
      .parse({
        marcaId: datos.get('marcaId'),
        sheetId: datos.get('sheetId') || undefined,
        sheetTab: datos.get('sheetTab') || undefined,
        whatsappUrl: datos.get('whatsappUrl') || '',
      })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('brands')
        .update({
          sheet_id: entrada.sheetId ?? null,
          sheet_tab: entrada.sheetTab || 'Hoja 1',
          whatsapp_url: entrada.whatsappUrl || null,
        })
        .eq('id', entrada.marcaId)
        .select('id'),
      'Ajustar la marca',
    )

    revalidatePath('/configuracion')
    return 'Marca actualizada'
  })
}

/** El rol de cada persona. Solo la editora lo cambia, y nunca el suyo propio. */
export async function cambiarRol(datos: FormData): Promise<Respuesta> {
  return envolver('Cambiar el rol', async () => {
    const perfil = await exigirRol('editora')

    const entrada = esquemaRol.parse({
      personaId: datos.get('personaId'),
      rol: datos.get('rol'),
    })

    if (entrada.personaId === perfil.id) {
      throw new Error('Tu propio rol lo cambia otra editora, para que el sistema nunca se quede sin una')
    }

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('profiles')
        .update({ rol: entrada.rol })
        .eq('id', entrada.personaId)
        .select('id'),
      'Cambiar el rol',
    )

    revalidatePath('/configuracion')
    return `Rol actualizado a ${entrada.rol}`
  })
}

/**
 * Invitar a alguien.
 *
 * Sin fila en `invitaciones` el alta de usuario falla en la base, así que esto
 * no es un correo de cortesía: es lo que permite entrar. La persona se crea
 * sola la primera vez que use Google o el enlace de clave, con el rol que se
 * le puso aquí.
 */
export async function invitar(datos: FormData): Promise<Respuesta> {
  return envolver('Invitar', async () => {
    await exigirRol('editora')

    const entrada = z
      .object({
        email: z.string().email('Escribe un correo completo'),
        rol: z.enum(['editora', 'aprobadora', 'audiovisual', 'observador']),
      })
      .parse({ email: datos.get('email'), rol: datos.get('rol') })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('invitaciones')
        // Reinvitar a alguien cambia su rol en lugar de fallar por duplicado.
        .upsert({ email: entrada.email.trim().toLowerCase(), rol: entrada.rol }, { onConflict: 'email' })
        .select('email'),
      'Invitar',
    )

    revalidatePath('/configuracion')
    return `${entrada.email} puede entrar como ${entrada.rol}`
  })
}

/** Quitar a alguien de la lista. No borra su cuenta: le impide volver a entrar. */
export async function revocarInvitacion(datos: FormData): Promise<Respuesta> {
  return envolver('Quitar la invitación', async () => {
    const perfil = await exigirRol('editora')

    const { email } = z
      .object({ email: z.string().email() })
      .parse({ email: datos.get('email') })

    if (email.toLowerCase() === perfil.email?.toLowerCase()) {
      throw new Error('No puedes quitarte a ti misma de la lista')
    }

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase.from('invitaciones').delete().eq('email', email.toLowerCase()).select('email'),
      'Quitar la invitación',
    )

    revalidatePath('/configuracion')
    return `${email} ya no puede entrar`
  })
}
