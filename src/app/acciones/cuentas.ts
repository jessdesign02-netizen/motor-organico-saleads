'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { clienteServidor } from '@/lib/supabase/server'
import { exigirRol } from '@/lib/sesion'
import { motivoDeReferenciaInvalida, referenciaValida } from '@/lib/seguridad'
import { envolver, exigirEscritura, type Respuesta } from './comunes'

/**
 * Fase 2 · gestión de canales.
 *
 * El token vive en una variable de entorno y la base guarda solo su nombre, así
 * que aquí se registra la referencia, nunca el secreto. Las dos casillas que
 * importan son la de publicación directa de TikTok, que se enciende el día que
 * pasa la auditoría, y el cupo diario de respuestas.
 */

export async function registrarCuenta(datos: FormData): Promise<Respuesta> {
  return envolver('Registrar la cuenta', async () => {
    await exigirRol('editora')

    const entrada = z
      .object({
        marcaId: z.string().uuid(),
        red: z.enum(['instagram', 'tiktok', 'youtube']),
        handle: z.string().min(2, 'El handle necesita al menos dos letras'),
        externalAccountId: z.string().min(1, 'Falta el id de la cuenta en la plataforma'),
        // Se valida contra la lista de prefijos de plataforma: una referencia
        // como SUPABASE_SERVICE_ROLE_KEY haría que el sistema enviara la llave
        // maestra de la base a Meta creyendo que es un token de Instagram.
        credentialRef: z.string().superRefine((referencia, control) => {
          if (referenciaValida(referencia)) return
          control.addIssue({ code: 'custom', message: motivoDeReferenciaInvalida(referencia) })
        }),
        tokenExpiraAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      })
      .parse({
        marcaId: datos.get('marcaId'),
        red: datos.get('red'),
        handle: datos.get('handle'),
        externalAccountId: datos.get('externalAccountId'),
        credentialRef: datos.get('credentialRef'),
        tokenExpiraAt: datos.get('tokenExpiraAt') || null,
      })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('social_accounts')
        .upsert(
          {
            brand_id: entrada.marcaId,
            red: entrada.red,
            handle: entrada.handle,
            external_account_id: entrada.externalAccountId,
            credential_ref: entrada.credentialRef,
            token_expira_at: entrada.tokenExpiraAt ? `${entrada.tokenExpiraAt}T23:59:59Z` : null,
            activa: true,
          },
          { onConflict: 'brand_id,red,external_account_id' },
        )
        .select('id'),
      'Registrar la cuenta',
    )

    revalidatePath('/ajustes')
    return `${entrada.handle} conectada en ${entrada.red}`
  })
}

export async function ajustarCuenta(datos: FormData): Promise<Respuesta> {
  return envolver('Ajustar la cuenta', async () => {
    await exigirRol('editora')

    const entrada = z
      .object({
        cuentaId: z.string().uuid(),
        activa: z.boolean(),
        publicacionDirecta: z.boolean(),
        cupo: z.number().int().positive().nullable(),
      })
      .parse({
        cuentaId: datos.get('cuentaId'),
        activa: datos.get('activa') === 'on',
        publicacionDirecta: datos.get('publicacionDirecta') === 'on',
        cupo: datos.get('cupo') ? Number(datos.get('cupo')) : null,
      })

    const supabase = await clienteServidor()
    exigirEscritura(
      await supabase
        .from('social_accounts')
        .update({
          activa: entrada.activa,
          publicacion_directa: entrada.publicacionDirecta,
          cupo_respuestas_dia: entrada.cupo,
        })
        .eq('id', entrada.cuentaId)
        .select('id'),
      'Ajustar la cuenta',
    )

    revalidatePath('/ajustes')
    return 'Canal actualizado'
  })
}
