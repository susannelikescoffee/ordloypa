import catImageUrl from '../../data/trollesmask.jpg?url'
import dragonImageUrl from '../../data/trolledrag.jpg?url'
import wizardImageUrl from '../../data/trollebams.jpg?url'
import type { AvatarId } from '../game/avatars.ts'

export const avatarImageUrls: Record<AvatarId, string> = {
  wizard: wizardImageUrl,
  dragon: dragonImageUrl,
  cat: catImageUrl,
}