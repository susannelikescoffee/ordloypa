import { createHash } from 'node:crypto'
import type { Puzzle } from '../../src/game/puzzle.ts'
import type { WordInfo } from './ordbank.ts'
import type { Band, Candidate } from './candidates.ts'

export const LEVEL_MANIFEST_VERSION = 1

export interface LevelTask {
  id: string
  puzzle: Puzzle
}

export interface Level {
  band: number
  name: string
  seedLength: number
  tasks: LevelTask[]
}

export interface LevelManifest {
  version: number
  wordsPerTask: number
  levels: Level[]
}

// Innholdsbasert, stabil ID: avhenger kun av de fem ordene, uavhengig av rekkefølge og brettlayout.
export function taskId(puzzle: Puzzle): string {
  const words = puzzle.placements.map(placement => placement.word).slice().sort((first, second) => first.localeCompare(second, 'nb'))
  return createHash('sha256').update(words.join(',')).digest('hex').slice(0, 10)
}

// Fryser de mest gjenkjennelige oppgavene fra de gjennomgåtte kandidatene.
// Kjenthet måles på det SVAKESTE ordet i oppgaven (max-min), så alle fem ordene er vanlige.
// Frøord på deprioriteringslisten (ukjente for barn, flagget i gjennomgang) havner sist.
// Likhet brytes av opprinnelig rekkefølge, slik at utvalget er deterministisk.
export function selectFrozen(
  candidates: readonly (readonly Candidate[])[],
  info: ReadonlyMap<string, WordInfo>,
  perBand: number,
  deprioritize: ReadonlySet<string> = new Set(),
): Candidate[][] {
  const weakest = (candidate: Candidate) =>
    Math.min(...candidate.puzzle.placements.map(placement => info.get(placement.word)?.productivity ?? 0))
  return candidates.map(group =>
    group
      .map((candidate, index) => ({ candidate, index }))
      .sort((first, second) =>
        Number(deprioritize.has(first.candidate.puzzle.letters)) - Number(deprioritize.has(second.candidate.puzzle.letters)) ||
        weakest(second.candidate) - weakest(first.candidate) ||
        first.index - second.index)
      .slice(0, perBand)
      .map(entry => entry.candidate),
  )
}

export function buildManifest(frozen: readonly (readonly Candidate[])[], bands: readonly Band[], wordsPerTask: number): LevelManifest {
  return {
    version: LEVEL_MANIFEST_VERSION,
    wordsPerTask,
    levels: frozen.map((group, bandIndex) => ({
      band: bandIndex + 1,
      name: bands[bandIndex].name,
      seedLength: bands[bandIndex].seedLength,
      tasks: group.map(candidate => ({ id: taskId(candidate.puzzle), puzzle: candidate.puzzle })),
    })),
  }
}
