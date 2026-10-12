import type { Puzzle } from '../../src/game/puzzle.ts'
import type { WordInfo } from './ordbank.ts'

export const WORDS_PER_PUZZLE = 5

export interface Band {
  name: string
  seedLength: number
  // Minste kjenthet (antall sammensatte ord) for alle ord i oppgaven, inkludert frøordet.
  minProductivity: number
  // Bøyde former (steiner, aksa) er som standard utelatt. Sett til true for å gjøre trinnet vanskeligere.
  allowInflected?: boolean
}

export const BANDS: readonly Band[] = [
  { name: 'Lysning', seedLength: 5, minProductivity: 50 },
  { name: 'Skogsti', seedLength: 5, minProductivity: 20 },
  { name: 'Ungskog', seedLength: 5, minProductivity: 10 },
  { name: 'Kratt', seedLength: 6, minProductivity: 10 },
  { name: 'Villnis', seedLength: 6, minProductivity: 5 },
  { name: 'Underskog', seedLength: 6, minProductivity: 2 },
]

export interface Candidate {
  id: string
  band: number
  puzzle: Puzzle
}

export interface SelectOptions {
  perBand: number
  blocked: ReadonlySet<string>
  build: (seed: string, pool: Set<string>) => Puzzle | undefined
  bands?: readonly Band[]
}

function rank(word: string): number {
  let hash = 2166136261
  for (const character of word) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function parseBlocklist(text: string): Set<string> {
  const words = text.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => line.replace(/#.*/, '').trim().normalize('NFC').toLowerCase())
    .filter(Boolean)
  return new Set(words)
}

// To bøyningsformer av samme ord (stein/steiner) i én oppgave er kjedelig for spilleren.
export function sharesLemma(puzzle: Puzzle, info: ReadonlyMap<string, WordInfo>): boolean {
  const seen = new Set<string>()
  for (const { word } of puzzle.placements) {
    const lemmas = info.get(word)?.lemmas ?? [word]
    if (lemmas.some(lemma => seen.has(lemma))) return true
    lemmas.forEach(lemma => seen.add(lemma))
  }
  return false
}

// Velger kandidater per trinn. Ingen ord gjentas på tvers av trinnene, så alle utvalgte oppgaver kan kombineres fritt.
export function selectCandidates(info: ReadonlyMap<string, WordInfo>, options: SelectOptions): Candidate[][] {
  const used = new Set<string>()
  return (options.bands ?? BANDS).map((band, bandIndex) => {
    const available = new Set<string>()
    for (const [word, details] of info) {
      if (!options.blocked.has(word) && !used.has(word) && details.productivity >= band.minProductivity && (band.allowInflected || details.lemmas.includes(word))) available.add(word)
    }
    const seeds = [...available]
      .filter(word => word.length === band.seedLength && info.get(word)!.lemmas.includes(word))
      .sort((first, second) => rank(first) - rank(second) || first.localeCompare(second, 'nb'))

    const chosen: Candidate[] = []
    for (const seed of seeds) {
      if (chosen.length === options.perBand) break
      if (!available.has(seed)) continue
      const puzzle = options.build(seed, available)
      if (!puzzle || puzzle.placements.length !== WORDS_PER_PUZZLE || sharesLemma(puzzle, info)) continue
      for (const { word } of puzzle.placements) {
        available.delete(word)
        used.add(word)
      }
      chosen.push({ id: `T${bandIndex + 1}-${String(chosen.length + 1).padStart(2, '0')}`, band: bandIndex, puzzle })
    }
    return chosen
  })
}

export function formatReviewSheet(candidates: readonly (readonly Candidate[])[], info: ReadonlyMap<string, WordInfo>, bands: readonly Band[] = BANDS): string {
  const lines = [
    'KANDIDATER TIL GJENNOMGANG – Ordskogen',
    '',
    'Generert av: npm run levels:candidates  (ikke rediger denne filen for hånd)',
    '',
    'Slik gjør dere gjennomgangen (Susanne og Nuffa):',
    '  1. Les hver oppgave. Er noe ord upassende, for ukjent eller rart, legg ordet på en egen linje i',
    '     data/curation/blokkliste.txt. Ordet brukes da aldri, verken som frøord eller kryssord.',
    '  2. Kjør npm run levels:candidates på nytt. Oppgaver med blokkerte ord erstattes automatisk.',
    '  3. Gjenta til minst 10 oppgaver per trinn ser bra ut. Merk dere hvilke dere vil ha med.',
    '',
    'Kjenthet = hvor mange sammensatte ord ordet inngår i (skog -> skogsti, skogbrann ...). Høyt tall = vanlig ord.',
    'Hver oppgave har 5 ord, og ingen ord gjentas i noen oppgave under noe trinn.',
    '',
  ]
  const productivity = (word: string) => info.get(word)?.productivity ?? 0
  candidates.forEach((group, bandIndex) => {
    const band = bands[bandIndex]
    lines.push(`== Trinn ${bandIndex + 1}: ${band.name} == (frøord på ${band.seedLength} bokstaver, alle ord har kjenthet ${band.minProductivity} eller mer, ${group.length} kandidater)`)
    for (const { id, puzzle } of group) {
      const [seed, ...others] = puzzle.placements.map(placement => placement.word)
      const weakest = [seed, ...others].reduce((low, word) => (productivity(word) < productivity(low) ? word : low))
      lines.push(`${id}  ${seed.toUpperCase().padEnd(8)}  ${others.join(', ').padEnd(28)}  svakeste: ${weakest} (${productivity(weakest)})`)
    }
    lines.push('')
  })
  return lines.join('\n')
}
