export const avatars = [
  { id: 'wizard', name: 'Flipperwald' },
  { id: 'dragon', name: 'Drogon' },
  { id: 'cat', name: 'Emacs' },
] as const

export type AvatarId = typeof avatars[number]['id']

export const defaultAvatarId: AvatarId = 'wizard'
export const avatarStorageKey = 'susannes-ordspill.avatar'

type AvatarStorage = Pick<Storage, 'getItem' | 'setItem'>

export function normalizeAvatarId(value: string | null): AvatarId {
  return avatars.find(avatar => avatar.id === value)?.id ?? defaultAvatarId
}

export function readAvatarPreference(storage?: AvatarStorage): AvatarId {
  try {
    return normalizeAvatarId((storage ?? window.localStorage).getItem(avatarStorageKey))
  } catch {
    return defaultAvatarId
  }
}

export function saveAvatarPreference(avatarId: AvatarId, storage?: AvatarStorage): boolean {
  try {
    ;(storage ?? window.localStorage).setItem(avatarStorageKey, avatarId)
    return true
  } catch {
    return false
  }
}