import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cellsFor, createPuzzle, parseDictionary } from '../src/game/puzzle.ts'
import { canMakeWord } from '../src/game/letters.ts'
import {
  clearSelection,
  createInitialGameState,
  deriveCurrentWord,
  deselectTile,
  getRoundStatus,
  giveUp,
  selectTile,
  submitSelectedWord,
  type LetterTile,
} from '../src/game/state.ts'

describe('game state', () => {
  it('creates an initial state with no selection or found words', () => {
    const tray: LetterTile[] = [
      { id: 'k1', letter: 'K' },
      { id: 'a', letter: 'A' },
      { id: 'k2', letter: 'K' },
      { id: 'e', letter: 'E' },
    ]

    expect(createInitialGameState(tray)).toEqual({
      tray,
      selectedTileIds: [],
      foundWords: [],
      givenUp: false,
    })
  })

  it('preserves selection order and supports duplicate letters with distinct IDs', () => {
    const state = createInitialGameState([
      { id: 'k1', letter: 'K' },
      { id: 'a', letter: 'A' },
      { id: 'k2', letter: 'K' },
      { id: 'e', letter: 'E' },
    ])
    const selected = ['k1', 'a', 'k2', 'e'].reduce(selectTile, state)

    expect(selected.selectedTileIds).toEqual(['k1', 'a', 'k2', 'e'])
    expect(deriveCurrentWord(selected)).toBe('kake')
    expect(state.selectedTileIds).toEqual([])
  })

  it('ignores unknown tile IDs and duplicate selections', () => {
    const state = createInitialGameState([{ id: 'tile-1', letter: 'A' }])
    const selected = selectTile(state, 'tile-1')

    expect(selectTile(state, 'missing')).toBe(state)
    expect(selectTile(selected, 'tile-1')).toBe(selected)
    expect(selected.selectedTileIds).toEqual(['tile-1'])
  })

  it('deselects a tile without changing the remaining selection order', () => {
    const state = createInitialGameState([
      { id: 'k1', letter: 'K' },
      { id: 'a', letter: 'A' },
      { id: 'k2', letter: 'K' },
    ])
    const selected = ['k1', 'a', 'k2'].reduce(selectTile, state)
    const updated = deselectTile(selected, 'a')

    expect(updated.selectedTileIds).toEqual(['k1', 'k2'])
    expect(deriveCurrentWord(updated)).toBe('kk')
  })

  it('clears the current selection', () => {
    const state = createInitialGameState([{ id: 'tile-1', letter: 'A' }])
    const selected = selectTile(state, 'tile-1')

    expect(clearSelection(selected).selectedTileIds).toEqual([])
    expect(clearSelection(state)).toBe(state)
  })

  it('normalizes the derived word', () => {
    const state = createInitialGameState([
      { id: 'first', letter: 'A\u030A' },
    ])

    expect(deriveCurrentWord(selectTile(state, 'first'))).toBe('å')
  })

  it('returns no submission when no tiles are selected', () => {
    const state = createInitialGameState([{ id: 'tile-1', letter: 'A' }])

    expect(submitSelectedWord(state)).toBeNull()
    expect(state.selectedTileIds).toEqual([])
    expect(state.foundWords).toEqual([])
  })

  it('returns the selected word as a candidate without changing game state', () => {
    const state = createInitialGameState([
      { id: 'k1', letter: 'K' },
      { id: 'a', letter: 'A' },
      { id: 'k2', letter: 'K' },
      { id: 'e', letter: 'E' },
    ])
    const selected = ['k1', 'a', 'k2', 'e'].reduce(selectTile, state)

    expect(submitSelectedWord(selected)).toBe('kake')
    expect(selected.selectedTileIds).toEqual(['k1', 'a', 'k2', 'e'])
    expect(selected.foundWords).toEqual([])
  })
})

describe('giving up a round', () => {
  it('reveals answers without awarding words or changing Norwegian duplicate tiles', () => {
    const initial = createInitialGameState([
      { id: 'first', letter: 'Å' },
      { id: 'second', letter: 'Å' },
      { id: 'third', letter: 'Ø' },
    ])
    const selected = selectTile({ ...initial, foundWords: ['båt'] }, 'second')
    expect(getRoundStatus(selected, 5)).toBe('active')
    const ended = giveUp(selected, 5)
    expect(getRoundStatus(ended, 5)).toBe('given-up')
    expect(ended.selectedTileIds).toEqual([])
    expect(ended.foundWords).toEqual(['båt'])
    expect(ended.tray).toBe(selected.tray)
    expect(selected.givenUp).toBe(false)
    expect(selected.selectedTileIds).toEqual(['second'])
  })

  it('is idempotent and blocks selection and submission after giving up', () => {
    const ended = giveUp(createInitialGameState([{ id: 'tile', letter: 'Æ' }]), 5)
    expect(giveUp(ended, 5)).toBe(ended)
    expect(selectTile(ended, 'tile')).toBe(ended)
    expect(deselectTile(ended, 'tile')).toBe(ended)
    expect(submitSelectedWord(ended)).toBeNull()
  })

  it('does not replace a solved round with a given-up result', () => {
    const solved = { ...createInitialGameState([]), foundWords: ['båt', 'båten', 'ben', 'bent'] }
    expect(getRoundStatus(solved, 4)).toBe('solved')
    expect(giveUp(solved, 4)).toBe(solved)
  })

  it('starts the next round with no old completion state', () => {
    const ended = giveUp(createInitialGameState([]), 5)
    const next = createInitialGameState(ended.tray)
    expect(next.givenUp).toBe(false)
    expect(next.foundWords).toEqual([])
    expect(getRoundStatus(next, 5)).toBe('active')
    expect(getRoundStatus(next, 0)).toBe('active')
  })
})

describe('dictionary puzzles', () => {
  it('accepts only unmodified Norwegian entries of 3 to 6 letters', () => {
    expect([...parseDictionary('abc\r\nbåt\r\nABC\r\nab\r\nabcdefg\r\na-b\r\n båt\r\nabc')]).toEqual(['abc', 'båt'])
  })

  it('builds connected rounds from the actual source without conflicting crossings', () => {
    const dictionary = parseDictionary(readFileSync(new URL('../data/word-list.txt', import.meta.url), 'utf8'))
    for (let round = 0; round < 20; round++) {
      const puzzle = createPuzzle(dictionary, round)
      expect(puzzle.placements.length).toBeGreaterThanOrEqual(4)
      expect(puzzle.placements.length).toBeLessThanOrEqual(5)
      const occupied = new Map<string, string>()
      puzzle.placements.forEach((placement, index) => {
        expect(dictionary.has(placement.word)).toBe(true)
        expect(canMakeWord(placement.word, puzzle.letters)).toBe(true)
        let crossings = 0
        for (const cell of cellsFor(placement)) {
          const key = `${cell.row},${cell.column}`
          if (occupied.has(key)) {
            expect(occupied.get(key)).toBe(cell.letter)
            crossings++
          }
          occupied.set(key, cell.letter)
        }
        if (index > 0) expect(crossings).toBeGreaterThan(0)
      })
    }
  })

  it('creates 20 distinct, deterministic puzzles for the Easy pilot', () => {
    const dictionary = parseDictionary(readFileSync(new URL('../data/word-list.txt', import.meta.url), 'utf8'))
    const firstPass = Array.from({ length: 20 }, (_, round) => JSON.stringify(createPuzzle(dictionary, round)))
    const secondPass = Array.from({ length: 20 }, (_, round) => JSON.stringify(createPuzzle(dictionary, round)))

    expect(new Set(firstPass).size).toBe(20)
    expect(secondPass).toEqual(firstPass)
  })
})