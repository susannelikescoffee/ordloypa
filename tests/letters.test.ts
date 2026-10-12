import { describe, expect, it } from 'vitest'
import { canMakeWord, normalize } from '../src/game/letters.ts'

describe('normalize', () => {
  it('converts uppercase to lowercase', () => {
    expect(normalize('HUS')).toBe('hus')
  })

  it('normalizes Unicode to NFC', () => {
    expect(normalize('A\u030A')).toBe('å')
    expect(normalize('ÆØÅ')).toBe('æøå')
  })
})

describe('canMakeWord', () => {
  it('constructs a word from available tray letters', () => {
    expect(canMakeWord('hus', 'huset')).toBe(true)
  })

  it('returns false when a required letter is missing', () => {
    expect(canMakeWord('hest', 'hus')).toBe(false)
  })

  it('counts repeated letters in the tray', () => {
    expect(canMakeWord('ball', 'ball')).toBe(true)
    expect(canMakeWord('ball', 'bal')).toBe(false)
  })

  it('handles Norwegian letters', () => {
    expect(canMakeWord('æøå', 'åøæ')).toBe(true)
  })

  it('matches uppercase and lowercase letters', () => {
    expect(canMakeWord('HUS', 'hUs')).toBe(true)
  })

  it('matches canonically equivalent NFC and NFD strings', () => {
    expect(canMakeWord('å', 'a\u030A')).toBe(true)
    expect(canMakeWord('e\u0301', 'é')).toBe(true)
  })

  it('constructs an empty word from any tray', () => {
    expect(canMakeWord('', '')).toBe(true)
    expect(canMakeWord('', 'abc')).toBe(true)
  })

  it('returns false when the word needs more copies of a letter', () => {
    expect(canMakeWord('letter', 'leter')).toBe(false)
  })
})