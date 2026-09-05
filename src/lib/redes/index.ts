import type { RedSocial } from '@/lib/database.types'
import type { AdaptadorRed } from './tipos'
import { instagram } from './instagram'
import { tiktok } from './tiktok'
import { youtube } from './youtube'

export const adaptadores: Record<RedSocial, AdaptadorRed> = { instagram, tiktok, youtube }

export function adaptadorDe(red: RedSocial): AdaptadorRed {
  return adaptadores[red]
}

export * from './tipos'
