import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { avatarStorageKey, avatars, defaultAvatarId, normalizeAvatarId, readAvatarPreference, saveAvatarPreference } from '../src/game/avatars.ts'

describe('avatar selection', () => {
  it('offers the requested names for all three avatars', () => {
    expect(avatars).toEqual([
      { id: 'wizard', name: 'Flipperwald' },
      { id: 'dragon', name: 'Drogon' },
      { id: 'cat', name: 'Emacs' },
    ])
  })

  it('keeps all illustrations aligned to the shared viewBox and baseline', () => {
    for (const avatar of avatars) {
      const source = readFileSync(new URL(`../src/assets/${avatar.id}.svg`, import.meta.url), 'utf8')
      expect(source).toContain('viewBox="0 0 128 128"')
      expect(source).toContain('<ellipse cx="64" cy="118"')
    }
  })

  it('keeps valid saved selections and defaults invalid values', () => {
    expect(normalizeAvatarId('dragon')).toBe('dragon')
    expect(normalizeAvatarId(null)).toBe(defaultAvatarId)
    expect(normalizeAvatarId('unicorn')).toBe(defaultAvatarId)
  })

  it('reads and saves the same avatar preference safely', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }

    expect(readAvatarPreference(storage)).toBe(defaultAvatarId)
    expect(saveAvatarPreference('dragon', storage)).toBe(true)
    expect(values.get(avatarStorageKey)).toBe('dragon')
    expect(readAvatarPreference(storage)).toBe('dragon')
  })

  it('falls back when avatar storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => { throw new Error('Unavailable') },
      setItem: () => { throw new Error('Unavailable') },
    }

    expect(readAvatarPreference(unavailableStorage)).toBe(defaultAvatarId)
    expect(saveAvatarPreference('cat', unavailableStorage)).toBe(false)
  })
})