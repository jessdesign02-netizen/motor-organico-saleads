import 'server-only'
import { clienteAdmin } from '@/lib/supabase/admin'
import type { TipoAviso } from '@/lib/database.types'

/**
 * Avisos internos.
 *
 * Cada aviso lleva una clave propia, y la restricción única de la base impide
 * que el cron repita el mismo asunto en cada corrida. Lo que cambia entre
 * corridas es lo que genera un aviso nuevo.
 */

export async function avisar(aviso: {
  tipo: TipoAviso
  clave: string
  titulo: string
  detalle?: string
  brandId?: string | null
  pieceId?: string | null
}): Promise<void> {
  const supabase = clienteAdmin()
  await supabase.from('notices').insert({
    tipo: aviso.tipo,
    clave: aviso.clave,
    titulo: aviso.titulo,
    detalle: aviso.detalle ?? null,
    brand_id: aviso.brandId ?? null,
    piece_id: aviso.pieceId ?? null,
  })
  // El choque de clave significa que el aviso ya existe, que es justo lo que se
  // busca. No hay nada que reportar.
}

/** Regla 9 · toda credencial próxima a expirar avisa con anticipación. */
export async function avisarTokensPorVencer(diasDeAnticipacion = 7): Promise<number> {
  const supabase = clienteAdmin()
  const corte = new Date(Date.now() + diasDeAnticipacion * 86_400_000).toISOString()

  const { data: cuentas } = await supabase
    .from('social_accounts')
    .select('id, handle, red, brand_id, token_expira_at')
    .eq('activa', true)
    .not('token_expira_at', 'is', null)
    .lt('token_expira_at', corte)

  for (const cuenta of cuentas ?? []) {
    const dia = cuenta.token_expira_at?.slice(0, 10) ?? 'pronto'
    await avisar({
      tipo: 'token_por_vencer',
      // La clave incluye el día, así que un token renovado deja de avisar y uno
      // que vuelve a acercarse genera su propio aviso.
      clave: `token:${cuenta.id}:${dia}`,
      titulo: `El acceso de ${cuenta.handle} vence el ${dia}`,
      detalle: `Renueva el token de ${cuenta.red} antes de esa fecha para que la cuenta siga publicando.`,
      brandId: cuenta.brand_id,
    })
  }

  return (cuentas ?? []).length
}
