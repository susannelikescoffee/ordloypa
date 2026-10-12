import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadJokes, parseJokes } from '../src/game/jokes.ts'

describe('jokes', () => {
  it('splits entries at asterisk markers and preserves multi-line text', () => {
    expect(parseJokes('ignored\n* Ubåten: Hvorfor har den vinduer?\nFor fiskene.\n* Lyset: Hvorfor?\nDet er enklere.')).toEqual([
      { title: 'Ubåten', text: 'Hvorfor har den vinduer?\nFor fiskene.' },
      { title: 'Lyset', text: 'Hvorfor?\nDet er enklere.' },
    ])
  })

  it('parses the supplied joke file', () => {
    const source = readFileSync(new URL('../data/inspection/svenskevitser.txt', import.meta.url), 'utf8')
    const jokes = parseJokes(source)

    expect(jokes.length).toBeGreaterThan(0)
    expect(jokes[0]).toEqual({
      title: 'Ubåten',
      text: 'Hvorfor har den svenske ubåten vinduer?\nFor at fiskene skal få kikke inn.',
    })
  })

  it('returns no jokes when the optional joke source fails', async () => {
    await expect(loadJokes(async () => { throw new Error('Unavailable') })).resolves.toEqual([])
  })

  it('returns no jokes when the optional source is empty', async () => {
    await expect(loadJokes(async () => '')).resolves.toEqual([])
  })
})