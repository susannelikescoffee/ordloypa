import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cellsFor, type Puzzle } from '../src/game/puzzle.ts'
import { canMakeWord } from '../src/game/letters.ts'
import type { WordInfo } from '../scripts/lib/ordbank.ts'
import { BANDS, type Candidate } from '../scripts/lib/candidates.ts'
import { buildManifest, type LevelManifest, selectFrozen, taskId } from '../scripts/lib/levels.ts'

const manifest: LevelManifest = JSON.parse(readFileSync(new URL('../data/levels.v1.json', import.meta.url), 'utf8'))

const info = (entries: Record<string, number>): Map<string, WordInfo> =>
  new Map(Object.entries(entries).map(([word, productivity]) => [word, { lemmas: [word], classes: ['subst'], productivity }]))

function fakePuzzle(seed: string, others: string[]): Puzzle {
  return {
    letters: seed,
    rows: 1,
    columns: seed.length,
    placements: [seed, ...others].map((word, index) => ({ word, row: index, column: 0, direction: 'across' as const })),
  }
}

describe('innholdsbasert oppgave-ID', () => {
  it('er uavhengig av rekkefølgen på ordene', () => {
    expect(taskId(fakePuzzle('glass', ['gass', 'salg', 'slag', 'lag'])))
      .toBe(taskId(fakePuzzle('glass', ['lag', 'slag', 'salg', 'gass'])))
  })

  it('endrer seg når et ord byttes ut', () => {
    const before = taskId(fakePuzzle('glass', ['gass', 'salg', 'slag', 'lag']))
    const after = taskId(fakePuzzle('glass', ['gass', 'salg', 'slag', 'sal']))
    expect(before).not.toBe(after)
  })
})

describe('frysing av oppgaver', () => {
  const candidate = (seed: string, others: string[]): Candidate => ({ id: seed, band: 0, puzzle: fakePuzzle(seed, others) })

  it('velger oppgavene med høyest kjenthet på det svakeste ordet', () => {
    const words = info({ topp: 9, tom: 9, mot: 9, mye: 9, lav: 1, lov: 9, vol: 9, ovn: 9 })
    const groups = selectFrozen([[candidate('topp', ['tom', 'mot', 'mye']), candidate('lavvo', ['lav', 'lov', 'vol'])]], words, 1)
    expect(groups[0].map(entry => entry.puzzle.letters)).toEqual(['topp'])
  })

  it('setter deprioriterte frøord sist', () => {
    const words = info({ skolt: 50, kost: 50, stol: 50, sol: 50, glass: 10, gass: 10, salg: 10, slag: 10 })
    const groups = selectFrozen(
      [[candidate('skolt', ['kost', 'stol', 'sol']), candidate('glass', ['gass', 'salg', 'slag'])]],
      words,
      1,
      new Set(['skolt']),
    )
    expect(groups[0].map(entry => entry.puzzle.letters)).toEqual(['glass'])
  })
})

describe('oppbygging av manifest', () => {
  it('nummererer trinn og setter navn fra båndene', () => {
    const candidate = (seed: string): Candidate => ({ id: seed, band: 0, puzzle: fakePuzzle(seed, ['a', 'b', 'c', 'd']) })
    const built = buildManifest([[candidate('glass')], [candidate('kamel')]], BANDS, 5)
    expect(built.levels.map(level => [level.band, level.name])).toEqual([[1, 'Lysning'], [2, 'Skogsti']])
    expect(built.wordsPerTask).toBe(5)
  })
})

describe('frosset manifest (data/levels.v1.json)', () => {
  const allTasks = manifest.levels.flatMap(level => level.tasks)

  it('har 6 trinn med 10 oppgaver hver (300 ord totalt)', () => {
    expect(manifest.levels).toHaveLength(6)
    expect(manifest.levels.every(level => level.tasks.length === 10)).toBe(true)
    expect(allTasks.length * manifest.wordsPerTask).toBe(300)
  })

  it('navngir trinnene i skog-rekkefølge med ikke-synkende frølengde', () => {
    expect(manifest.levels.map(level => level.name)).toEqual(['Lysning', 'Skogsti', 'Ungskog', 'Kratt', 'Villnis', 'Underskog'])
    const lengths = manifest.levels.map(level => level.seedLength)
    expect(lengths).toEqual([...lengths].sort((first, second) => first - second))
  })

  it('har unike, innholdsbaserte ID-er på tvers av hele manifestet', () => {
    const ids = allTasks.map(task => task.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(allTasks.every(task => task.id === taskId(task.puzzle))).toBe(true)
  })

  it('gir hver oppgave fem distinkte ord som kan lages av frøordet', () => {
    for (const task of allTasks) {
      const words = task.puzzle.placements.map(placement => placement.word)
      expect(words).toHaveLength(5)
      expect(new Set(words).size).toBe(5)
      expect(task.puzzle.placements[0].word).toBe(task.puzzle.letters)
      expect(words.every(word => canMakeWord(word, task.puzzle.letters))).toBe(true)
    }
  })

  it('bruker frøord med lengde som passer trinnet og bevarer æ/ø/å', () => {
    for (const level of manifest.levels) {
      for (const task of level.tasks) {
        expect(task.puzzle.letters.length).toBe(level.seedLength)
        expect(task.puzzle.letters).toBe(task.puzzle.letters.normalize('NFC'))
      }
    }
  })

  it('lagrer et gyldig kryssord per oppgave (4–5 ord, konsistente kryssinger)', () => {
    for (const task of allTasks) {
      const placements = task.puzzle.placements
      expect(placements.length).toBeGreaterThanOrEqual(4)
      expect(placements.length).toBeLessThanOrEqual(5)
      const grid = new Map<string, string>()
      placements.forEach((placement, index) => {
        let crosses = index === 0
        for (const cell of cellsFor(placement)) {
          const key = `${cell.row},${cell.column}`
          const existing = grid.get(key)
          if (existing !== undefined) {
            expect(existing).toBe(cell.letter)
            crosses = true
          }
          grid.set(key, cell.letter)
        }
        // Hvert ord etter frøordet må krysse et tidligere plassert ord.
        expect(crosses).toBe(true)
      })
    }
  })

  it('matcher golden snapshot av nivåinnholdet (fanger stille innholdsdrift)', () => {
    const summary = manifest.levels.map(level => ({
      navn: level.name,
      frøord: level.tasks.map(task => task.puzzle.letters),
      ider: level.tasks.map(task => task.id),
    }))
    expect(summary).toMatchSnapshot()
  })
})
