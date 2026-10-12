import { normalize } from './letters.ts'

export type TileId = string

export interface LetterTile {
  id: TileId
  letter: string
}

export interface GameState {
  tray: LetterTile[]
  selectedTileIds: TileId[]
  foundWords: string[]
  givenUp: boolean
}

export function createInitialGameState(tray: LetterTile[]): GameState {
  return {
    tray: [...tray],
    selectedTileIds: [],
    foundWords: [],
    givenUp: false,
  }
}

export function getRoundStatus(state: GameState, wordCount: number): 'active' | 'solved' | 'given-up' {
  if (state.givenUp) return 'given-up'
  return wordCount > 0 && state.foundWords.length === wordCount ? 'solved' : 'active'
}

export function giveUp(state: GameState, wordCount: number): GameState {
  if (getRoundStatus(state, wordCount) !== 'active') return state
  return { ...state, givenUp: true, selectedTileIds: [] }
}

export function selectTile(state: GameState, tileId: TileId): GameState {
  // Ignore unknown tiles and tiles that are already selected.
  if (state.givenUp || !state.tray.some((tile) => tile.id === tileId) || state.selectedTileIds.includes(tileId)) {
    return state
  }

  return { ...state, selectedTileIds: [...state.selectedTileIds, tileId] }
}

export function deselectTile(state: GameState, tileId: TileId): GameState {
  if (state.givenUp || !state.selectedTileIds.includes(tileId)) return state

  return {
    ...state,
    selectedTileIds: state.selectedTileIds.filter((selectedId) => selectedId !== tileId),
  }
}

export function clearSelection(state: GameState): GameState {
  if (state.selectedTileIds.length === 0) return state

  return { ...state, selectedTileIds: [] }
}

export function deriveCurrentWord(state: GameState): string {
  const letters = state.selectedTileIds.flatMap((tileId) => {
    const tile = state.tray.find((candidate) => candidate.id === tileId)
    return tile ? [tile.letter] : []
  })

  return normalize(letters.join(''))
}

export function submitSelectedWord(state: GameState): string | null {
  if (state.givenUp || state.selectedTileIds.length === 0) return null

  return deriveCurrentWord(state)
}