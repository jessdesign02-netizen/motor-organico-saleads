'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/server'
import { exigirSesion } from '@/lib/sesion'
import { envolver, exigirEscritura, type Respuesta } from './comunes'

export async function marcarAvisoLeido(datos: FormData): Promise<Respuesta> {
  return envolver('Marcar el aviso', async () => {
    await exigirSesion()
    const { avisoId } = z.object({ avisoId: z.string().uuid() }).parse({ avisoId: datos.get('avisoId') })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('notices')
        .update({ leido_at: new Date().toISOString() })
        .eq('id', avisoId)
        .select('id'),
      'Marcar el aviso',
    )

    revalidatePath('/avisos')
    return 'Aviso archivado'
  })
}

export async function marcarTodosLeidos(): Promise<Respuesta> {
  return envolver('Archivar los avisos', async () => {
    await exigirSesion()
    const supabase = await clienteServidor()

    const { data } = await supabase
      .from('notices')
      .update({ leido_at: new Date().toISOString() })
      .is('leido_at', null)
      .select('id')

    revalidatePath('/avisos')
    const cuantos = (data ?? []).length
    return cuantos === 0 ? 'No quedaba nada pendiente' : `${cuantos} avisos archivados`
  })
}
