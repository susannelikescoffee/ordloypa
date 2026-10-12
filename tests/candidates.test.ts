import { describe, expect, it } from 'vitest'
import { buildPuzzle, createPuzzle, parseDictionary, type Puzzle } from '../src/game/puzzle.ts'
import type { WordInfo } from '../scripts/lib/ordbank.ts'
import { type Band, formatReviewSheet, parseBlocklist, selectCandidates, sharesLemma, WORDS_PER_PUZZLE } from '../scripts/lib/candidates.ts'

const info = (entries: Record<string, [string[], number]>): Map<string, WordInfo> =>
  new Map(Object.entries(entries).map(([word, [lemmas, productivity]]) => [word, { lemmas, classes: ['subst'], productivity }]))

function fakePuzzle(seed: string, others: string[]): Puzzle {
  return {
    letters: seed,
    rows: 1,
    columns: seed.length,
    placements: [seed, ...others].map((word, index) => ({ word, row: index, column: 0, direction: 'across' as const })),
  }
}

const bands: Band[] = [
  { name: 'A', seedLength: 5, minProductivity: 10 },
  { name: 'B', seedLength: 5, minProductivity: 1 },
]

describe('blokkliste', () => {
  it('ignorerer kommentarer og tomme linjer og normaliserer store bokstaver', () => {
    const blocked = parseBlocklist('# overskrift\nFaen\n\n  øre  # kommentar\n')
    expect([...blocked].sort()).toEqual(['faen', 'øre'])
  })
})

describe('oppgaver med bøyningsformer', () => {
  it('avviser en oppgave med to former av samme ord', () => {
    const words = info({ stein: [['stein'], 5], steiner: [['stein'], 5], skog: [['skog'], 5] })
    expect(sharesLemma(fakePuzzle('stein', ['steiner']), words)).toBe(true)
    expect(sharesLemma(fakePuzzle('stein', ['skog']), words)).toBe(false)
  })
})

describe('utvelgelse av kandidater', () => {
  const pool = info({
    skogs: [['skogs'], 50], tomme: [['tomme'], 50], blokk: [['blokk'], 50], bøker: [['bøker'], 50],
    aaa: [['aaa'], 50], bbb: [['bbb'], 50], ccc: [['ccc'], 50], ddd: [['ddd'], 50], eee: [['eee'], 50],
    hhh: [['hhh'], 50], iii: [['iii'], 50], jjj: [['jjj'], 50], kkk: [['kkk'], 50],
    rar: [['rar'], 0], rart: [['rar'], 0], bøyd: [['bøyd'], 50], båter: [['båt'], 50],
  })

  const build = (seed: string, available: Set<string>): Puzzle | undefined => {
    const others = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'hhh', 'iii', 'jjj', 'kkk'].filter(word => available.has(word)).slice(0, WORDS_PER_PUZZLE - 1)
    return others.length === WORDS_PER_PUZZLE - 1 ? fakePuzzle(seed, others) : undefined
  }

  it('bruker aldri blokkerte ord, ord med for lav kjenthet eller ord som ikke er grunnform som frøord', () => {
    const result = selectCandidates(pool, { perBand: 1, blocked: new Set(['blokk', 'aaa']), build, bands })
    const used = result.flat().flatMap(candidate => candidate.puzzle.placements.map(placement => placement.word))
    expect(used).not.toContain('blokk')
    expect(used).not.toContain('aaa')
    expect(used).not.toContain('rar')
    expect(result[0]).toHaveLength(1)
  })

  it('gjentar ingen ord på tvers av oppgaver og trinn', () => {
    const result = selectCandidates(pool, { perBand: 2, blocked: new Set(), build, bands })
    const used = result.flat().flatMap(candidate => candidate.puzzle.placements.map(placement => placement.word))
    expect(new Set(used).size).toBe(used.length)
    expect(result.flat().every(candidate => candidate.puzzle.placements.length === WORDS_PER_PUZZLE)).toBe(true)
  })

  it('hopper over frøord som ikke gir en full oppgave', () => {
    const none = selectCandidates(pool, { perBand: 3, blocked: new Set(), build: () => fakePuzzle('skogs', ['aaa']), bands })
    expect(none.flat()).toHaveLength(0)
  })

  it('utelater bøyde former som kryssord, men tillater dem når trinnet ber om det', () => {
    const seen: Record<string, Set<string>> = {}
    const capture = (name: string) => (seed: string, available: Set<string>): Puzzle | undefined => {
      seen[name] = new Set(available)
      return build(seed, available)
    }
    selectCandidates(pool, { perBand: 1, blocked: new Set(), build: capture('strict'), bands: [{ name: 'S', seedLength: 5, minProductivity: 1 }] })
    selectCandidates(pool, { perBand: 1, blocked: new Set(), build: capture('loose'), bands: [{ name: 'L', seedLength: 5, minProductivity: 1, allowInflected: true }] })

    expect(seen.strict.has('bøyd')).toBe(true)
    expect(seen.strict.has('båter')).toBe(false)
    expect(seen.loose.has('båter')).toBe(true)
  })

  it('gir stabile id-er og samme resultat hver gang', () => {
    const first = selectCandidates(pool, { perBand: 1, blocked: new Set(), build, bands })
    const second = selectCandidates(pool, { perBand: 1, blocked: new Set(), build, bands })
    expect(first).toEqual(second)
    expect(first[0][0].id).toBe('T1-01')
  })

  it('lager en lesbar gjennomgangsfil som viser ordene og svakeste ledd', () => {
    const result = selectCandidates(pool, { perBand: 1, blocked: new Set(), build, bands })
    const sheet = formatReviewSheet(result, pool, bands)
    expect(sheet).toContain('== Trinn 1: A ==')
    expect(sheet).toContain('T1-01')
    expect(sheet).toContain('svakeste:')
  })
})

describe('buildPuzzle', () => {
  const dictionary = parseDictionary('stein\nsten\nsein\nsine\nsti\nnei\ntein\ntie\nnes\nise\nsin\nsen')

  it('gir samme oppgave som createPuzzle sin generator, og undefined når frøordet mangler', () => {
    expect(buildPuzzle('hage', dictionary)).toBeUndefined()
    const puzzle = buildPuzzle('stein', dictionary)
    expect(puzzle?.letters).toBe('stein')
    expect(puzzle?.placements.length).toBeGreaterThanOrEqual(4)
  })

  it('bevarer dagens oppførsel for createPuzzle', () => {
    expect(() => createPuzzle(new Set(), 0)).toThrow('Ingen tilgjengelige oppgaver i ordlisten.')
  })
})
