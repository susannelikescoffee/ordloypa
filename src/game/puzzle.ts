import { canMakeWord } from './letters.ts'

export interface Placement {
  word: string
  row: number
  column: number
  direction: 'across' | 'down'
}

export interface Puzzle {
  letters: string
  placements: Placement[]
  rows: number
  columns: number
}

const seeds = ['stein', 'sommer', 'vinter', 'skogen', 'båten', 'katter', 'landet', 'rosene', 'barna', 'benken', 'bildet', 'bilen', 'blader', 'boken', 'byen', 'dagen', 'dragen', 'fuglen', 'hagen', 'helgen']
const familiar = new Set(['stein', 'sti', 'sin', 'sine', 'sein', 'sten', 'sommer', 'mer', 'rom', 'rose', 'roser', 'vinter', 'vin', 'vite', 'tre', 'ren', 'rent', 'skogen', 'skog', 'sko', 'sogn', 'noe', 'båten', 'båt', 'ben', 'bane', 'ban', 'katter', 'katt', 'tak', 'takt', 'kart', 'art', 'landet', 'land', 'den', 'del', 'dal', 'late', 'rosene', 'rose', 'ren', 'ser', 'sene', 'sen'])

export function parseDictionary(text: string): Set<string> {
  return new Set(text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(word => /^[a-zæøå]{3,6}$/.test(word)))
}

export function cellsFor(placement: Placement): { row: number; column: number; letter: string }[] {
  return [...placement.word].map((letter, index) => ({
    row: placement.row + (placement.direction === 'down' ? index : 0),
    column: placement.column + (placement.direction === 'across' ? index : 0),
    letter,
  }))
}

function roundRank(word: string, round: number): number {
  let hash = 2166136261
  for (const character of `${round}:${word}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function fits(candidate: Placement, placed: Placement[]): boolean {
  const occupied = new Map(placed.flatMap(placement => cellsFor(placement).map(cell => [`${cell.row},${cell.column}`, { ...cell, direction: placement.direction }] as const)))
  const vertical = candidate.direction === 'down'
  const rowStep = vertical ? 1 : 0
  const columnStep = vertical ? 0 : 1
  const cells = cellsFor(candidate)
  const end = cells[cells.length - 1]
  if (occupied.has(`${candidate.row - rowStep},${candidate.column - columnStep}`) || occupied.has(`${end.row + rowStep},${end.column + columnStep}`)) return false
  let crossings = 0
  for (const cell of cells) {
    const existing = occupied.get(`${cell.row},${cell.column}`)
    if (existing) {
      if (existing.letter !== cell.letter || existing.direction === candidate.direction) return false
      crossings++
    } else if (occupied.has(`${cell.row + columnStep},${cell.column + rowStep}`) || occupied.has(`${cell.row - columnStep},${cell.column - rowStep}`)) {
      return false
    }
  }
  const allCells = [...occupied.values(), ...cells]
  return crossings > 0 && Math.max(...allCells.map(cell => cell.row)) - Math.min(...allCells.map(cell => cell.row)) < 10 && Math.max(...allCells.map(cell => cell.column)) - Math.min(...allCells.map(cell => cell.column)) < 10
}

export function createPuzzle(dictionary: Set<string>, round = 0): Puzzle {
  for (let attempt = 0; attempt < seeds.length; attempt++) {
    const puzzle = buildPuzzle(seeds[(round + attempt) % seeds.length], dictionary, round)
    if (puzzle) return puzzle
  }
  throw new Error('Ingen tilgjengelige oppgaver i ordlisten.')
}

// Returnerer undefined når frøordet ikke gir et gyldig brett (færre enn 4 ord).
export function buildPuzzle(letters: string, dictionary: Set<string>, round = 0, familiarWords: ReadonlySet<string> = familiar): Puzzle | undefined {
  if (!dictionary.has(letters)) return undefined
  const candidates = [...dictionary].filter(word => word !== letters && canMakeWord(word, letters))
    .sort((first, second) => Number(familiarWords.has(second)) - Number(familiarWords.has(first)) || second.length - first.length || roundRank(first, round) - roundRank(second, round) || first.localeCompare(second, 'nb'))
  const placements: Placement[] = [{ word: letters, row: 0, column: 0, direction: 'across' }]
  for (const word of candidates) {
    let added = false
    for (const existing of [...placements]) {
      for (const crossing of cellsFor(existing)) {
        for (let index = 0; index < word.length; index++) {
          if (word[index] !== crossing.letter) continue
          const direction = existing.direction === 'across' ? 'down' : 'across'
          const candidate: Placement = { word, direction, row: crossing.row - (direction === 'down' ? index : 0), column: crossing.column - (direction === 'across' ? index : 0) }
          if (fits(candidate, placements)) {
            placements.push(candidate)
            added = true
            break
          }
        }
        if (added) break
      }
      if (added) break
    }
    if (placements.length === 5) break
  }
  if (placements.length < 4) return undefined
  const cells = placements.flatMap(cellsFor)
  const minRow = Math.min(...cells.map(cell => cell.row))
  const minColumn = Math.min(...cells.map(cell => cell.column))
  return {
    letters,
    placements: placements.map(placement => ({ ...placement, row: placement.row - minRow, column: placement.column - minColumn })),
    rows: Math.max(...cells.map(cell => cell.row)) - minRow + 1,
    columns: Math.max(...cells.map(cell => cell.column)) - minColumn + 1,
  }
}