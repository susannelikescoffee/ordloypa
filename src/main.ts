import './style.css'
import { createElement, Flag, House, Laugh, Lightbulb, X } from 'lucide'
import dictionaryUrl from '../data/word-list.txt?url'
import { clearSelection, createInitialGameState, deriveCurrentWord, deselectTile, getRoundStatus, giveUp, selectTile } from './game/state.ts'
import { cellsFor, parseDictionary, type Puzzle } from './game/puzzle.ts'
import { loadJokes as loadJokeList, type Joke } from './game/jokes.ts'
import { findTask, levels, TOTAL_TASKS, TOTAL_WORDS } from './game/levels.ts'
import { advanceGameProgress, currentLevelIndex, isGameComplete, isLevelComplete, markTaskSolved, readGameProgress, saveGameProgress, solvedCountInLevel, type GameProgress } from './game/progression.ts'
import { renderLetterTray, updateSelectionLine } from './ui/letterTray.ts'
import { initializeAvatarPicker } from './ui/avatarPicker.ts'
import jokesUrl from '../data/inspection/svenskevitser.txt?url'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root element')

app.innerHTML = `
<main class="game">
  <header class="game-header"><div><span class="eyebrow">ET ORDSPILL</span><h1>Ordløypa</h1></div><div class="game-header-actions"><a class="home-link" href="./" aria-label="Til startsiden" title="Til startsiden"><span id="home-icon" aria-hidden="true"></span><span class="home-tooltip" role="tooltip">Til startsiden</span></a><div id="avatar-picker" class="avatar-picker"><button id="avatar-trigger" class="avatar-trigger" type="button" aria-label="Bytt avatar" aria-expanded="false" aria-controls="avatar-menu"><img id="avatar-current" class="avatar-current" alt=""><span id="avatar-indicator" class="avatar-indicator" aria-hidden="true"></span></button><div id="avatar-menu" class="avatar-menu" hidden><p class="avatar-menu-title">Velg avatar</p><div id="avatar-options" class="avatar-options" role="group" aria-label="Tilgjengelige avatarer"></div></div></div></div></header>
  <div class="round-bar"><span id="round-label">Oppgave 1</span><span id="progress">Laster ordlisten...</span></div>
  <div class="progress-track"><div id="progress-fill"></div></div>
  <section class="puzzle-area" aria-label="Ordkryss"><div id="puzzle-board" class="puzzle-board"></div></section>
  <div id="message" class="message" role="status" aria-live="polite">Laster ordlisten...</div>
  <div class="hint-tools"><div class="help-tool"><button id="hint" type="button" aria-label="Vis bokstav, 3 hint igjen" aria-pressed="false" aria-controls="puzzle-board" disabled><span id="hint-icon" aria-hidden="true"></span><span id="hint-count" aria-hidden="true">3</span></button><span id="hint-label" class="hint-tooltip" role="tooltip">Vis bokstav</span></div><div class="help-tool"><button id="joke" type="button" aria-label="Vis en vits" aria-controls="joke-dialog" disabled><span id="joke-icon" aria-hidden="true"></span></button><span class="hint-tooltip" role="tooltip">Vis en vits</span></div><div class="help-tool"><button id="give-up" type="button" aria-label="Jeg gir opp" aria-controls="puzzle-board" disabled><span id="give-up-icon" aria-hidden="true"></span></button><span class="hint-tooltip" role="tooltip">Jeg gir opp</span></div></div>
  <section class="tray-area" aria-label="Bokstaver"><div id="letter-tray"></div></section>
  <div class="actions"><button id="shuffle" type="button" title="Bland bokstavene" disabled>⇄<span>Bland</span></button></div>
  <footer><span id="streak" class="streak">🔥 0</span><span id="bonus">Bonusord: 0</span><button id="next" type="button" disabled>Neste oppgave →</button></footer>
  <details id="bonus-details" hidden><summary>Bonusord</summary><p id="bonus-words"></p></details>
</main>
<dialog id="joke-dialog" aria-labelledby="joke-title" aria-describedby="joke-text"><h2 id="joke-title"></h2><p id="joke-text"></p><form method="dialog"><button class="primary" type="submit">Tilbake til oppgaven</button></form></dialog>
<dialog id="level-dialog" aria-labelledby="level-title" aria-describedby="level-text"><h2 id="level-title">Gratulerer!</h2><p id="level-text"></p><form method="dialog"><button class="primary" type="submit">Flott!</button></form></dialog>
<dialog id="game-dialog" aria-labelledby="game-title" aria-describedby="game-text"><h2 id="game-title">Du har rundet Ordskogen! 🌲</h2><p id="game-text"></p><form method="dialog"><button class="primary" type="submit">Hurra!</button></form></dialog>
`

document.querySelector('#home-icon')!.replaceChildren(createElement(House, { 'aria-hidden': 'true' }))

const board = document.querySelector<HTMLDivElement>('#puzzle-board')!
const tray = document.querySelector<HTMLDivElement>('#letter-tray')!
const message = document.querySelector<HTMLDivElement>('#message')!
const jokeDialog = document.querySelector<HTMLDialogElement>('#joke-dialog')!
const levelDialog = document.querySelector<HTMLDialogElement>('#level-dialog')!
const gameDialog = document.querySelector<HTMLDialogElement>('#game-dialog')!
initializeAvatarPicker()
let progress: GameProgress = readGameProgress()
let gameComplete = isGameComplete(progress)
let dictionary = new Set<string>()
let jokes: Joke[] = []
let previousJokeIndex = -1
let puzzle: Puzzle | undefined
let state = createInitialGameState([])
let bonusWords = new Set<string>()
let hints = new Set<string>()
let hintsLeft = 3
let hintMode = false
let dragging = false
let dragged = false
let pointerStart = { x: 0, y: 0 }
let pointerPosition: { x: number; y: number } | undefined

function setMessage(text: string, tone: 'neutral' | 'success' | 'error' | 'hint' = 'neutral'): void {
  message.textContent = text
  message.dataset.tone = tone
}

function isRoundActive(): boolean {
  return !gameComplete && !!puzzle && getRoundStatus(state, puzzle.placements.length) === 'active'
}

function render(): void {
  if (!puzzle) return
  const finished = !isRoundActive()
  const occupied = new Map<string, { letter: string; revealed: boolean; number?: number }>()
  puzzle.placements.forEach((placement, index) => {
    cellsFor(placement).forEach((cell, cellIndex) => {
      const key = `${cell.row},${cell.column}`
      const previous = occupied.get(key)
      occupied.set(key, {
        letter: cell.letter,
        revealed: gameComplete || state.givenUp || !!previous?.revealed || state.foundWords.includes(placement.word) || hints.has(key),
        number: previous?.number ?? (cellIndex === 0 ? index + 1 : undefined),
      })
    })
  })
  board.style.setProperty('--columns', String(puzzle.columns))
  board.style.setProperty('--rows', String(puzzle.rows))
  const hasHiddenCells = [...occupied.values()].some(cell => !cell.revealed)
  if (finished || !hasHiddenCells || hintsLeft === 0) hintMode = false
  board.classList.toggle('hint-mode', hintMode)
  board.replaceChildren()
  for (let row = 0; row < puzzle.rows; row++) {
    for (let column = 0; column < puzzle.columns; column++) {
      const cell = occupied.get(`${row},${column}`)
      const selectableHint = !!cell && !cell.revealed && hintMode
      const tile = document.createElement(selectableHint ? 'button' : 'div')
      tile.className = cell ? `puzzle-cell${cell.revealed ? ' revealed' : ''}` : 'empty-cell'
      if (cell) {
        tile.setAttribute('aria-label', cell.revealed ? cell.letter.toUpperCase() : `Tom rute, rad ${row + 1}, kolonne ${column + 1}`)
        if (selectableHint) {
          tile.setAttribute('type', 'button')
          tile.classList.add('hint-target')
          tile.dataset.hintCell = `${row},${column}`
          tile.addEventListener('click', () => {
            if (!isRoundActive() || !hintMode || hintsLeft === 0 || hints.has(`${row},${column}`)) return
            hints.add(`${row},${column}`)
            hintsLeft--
            hintMode = false
            setMessage(`Bokstaven ${cell.letter.toUpperCase()} er avslørt. ${hintsLeft} hjelpebokstaver igjen.`, 'hint')
            render()
            const hintButton = document.querySelector<HTMLButtonElement>('#hint')!
            if (hintButton.disabled) document.querySelector<HTMLButtonElement>('#shuffle')!.focus()
            else hintButton.focus()
          })
        }
        if (cell.number) {
          const number = document.createElement('small')
          number.textContent = String(cell.number)
          tile.append(number)
        }
        const letter = document.createElement('span')
        letter.textContent = cell.revealed ? cell.letter.toUpperCase() : ''
        tile.append(letter)
      }
      board.append(tile)
    }
  }
  renderLetterTray(tray, state, () => {})
  for (const button of tray.querySelectorAll<HTMLButtonElement>('.letter-tile')) button.disabled = finished
  updateSelectionLine(tray, state, pointerPosition)
  const levelIndex = currentLevelIndex(progress)
  const level = levels[levelIndex]
  const solvedTotal = progress.solvedTaskIds.length
  if (gameComplete) setMessage('Du har rundet hele Ordskogen! 🌲', 'success')
  document.querySelector('#progress')!.textContent = gameComplete
    ? `Rundet! ${TOTAL_TASKS}/${TOTAL_TASKS} oppgaver`
    : state.givenUp
      ? `Fasit · ${solvedTotal}/${TOTAL_TASKS} løst`
      : `${state.foundWords.length}/${puzzle.placements.length} ord · ${solvedTotal}/${TOTAL_TASKS} totalt`
  document.querySelector<HTMLElement>('#progress-fill')!.style.width = `${gameComplete ? 100 : state.foundWords.length / puzzle.placements.length * 100}%`
  document.querySelector('#round-label')!.textContent = `Trinn ${levelIndex + 1}/${levels.length}: ${level.name} · ${solvedCountInLevel(progress, levelIndex)}/${level.tasks.length} løst`
  document.querySelector('#bonus')!.textContent = `Bonusord: ${bonusWords.size}`
  const streak = document.querySelector<HTMLElement>('#streak')!
  streak.textContent = `🔥 ${progress.currentStreak} på rad`
  streak.setAttribute('aria-label', `Streak: ${progress.currentStreak} på rad. Beste streak: ${progress.bestStreak}`)
  streak.title = `Beste streak: ${progress.bestStreak}`
  document.querySelector('#hint-count')!.textContent = String(hintsLeft)
  document.querySelector<HTMLButtonElement>('#hint')!.disabled = hintsLeft === 0 || finished || !hasHiddenCells
  document.querySelector('#hint')!.setAttribute('aria-pressed', String(hintMode))
  const hintLabel = hintMode ? 'Avbryt hint' : 'Vis bokstav'
  document.querySelector('#hint-label')!.textContent = hintLabel
  document.querySelector('#hint')!.setAttribute('aria-label', `${hintLabel}, ${hintsLeft} hint igjen`)
  document.querySelector('#hint-icon')!.replaceChildren(createElement(hintMode ? X : Lightbulb, { 'aria-hidden': 'true' }))
  document.querySelector('#joke-icon')!.replaceChildren(createElement(Laugh, { 'aria-hidden': 'true' }))
  document.querySelector('#give-up-icon')!.replaceChildren(createElement(Flag, { 'aria-hidden': 'true' }))
  document.querySelector<HTMLButtonElement>('#give-up')!.disabled = finished
  document.querySelector<HTMLButtonElement>('#shuffle')!.disabled = finished
  const nextButton = document.querySelector<HTMLButtonElement>('#next')!
  nextButton.disabled = !finished || gameComplete
  nextButton.textContent = gameComplete ? 'Spillet er rundet' : 'Neste oppgave →'
  nextButton.classList.toggle('ready', finished && !gameComplete)
  document.querySelector<HTMLElement>('#bonus-details')!.hidden = bonusWords.size === 0
  document.querySelector('#bonus-words')!.textContent = [...bonusWords].join(', ')
}

function startRound(): void {
  const location = findTask(progress.currentTaskId)
  if (!location) return
  puzzle = location.task.puzzle
  state = createInitialGameState([...puzzle.letters].map((letter, index) => ({ id: `tile-${index}`, letter: letter.toUpperCase() })))
  bonusWords = new Set()
  hints = new Set()
  hintsLeft = 3
  hintMode = false
  dragging = false
  dragged = false
  pointerStart = { x: 0, y: 0 }
  pointerPosition = undefined
  setMessage('')
  render()
}

function launchConfetti(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const container = document.createElement('div')
  container.className = 'confetti'
  container.setAttribute('aria-hidden', 'true')
  const colors = ['#286441', '#f2c76b', '#176b70', '#a33449', '#55cdbb']
  for (let index = 0; index < 40; index++) {
    const piece = document.createElement('span')
    piece.className = 'confetti-piece'
    piece.style.left = `${Math.random() * 100}%`
    piece.style.background = colors[index % colors.length]
    piece.style.animationDelay = `${Math.random() * 0.2}s`
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`)
    container.append(piece)
  }
  document.body.append(container)
  window.setTimeout(() => container.remove(), 1100)
}

function celebrateLevel(levelIndex: number): void {
  const level = levels[levelIndex]
  const next = levels[levelIndex + 1]
  document.querySelector('#level-title')!.textContent = `Trinn fullført: ${level.name}!`
  document.querySelector('#level-text')!.textContent = next
    ? `Du har løst alle ${level.tasks.length} oppgavene i ${level.name}. Neste trinn er ${next.name}.`
    : `Du har løst alle ${level.tasks.length} oppgavene i ${level.name}.`
  levelDialog.showModal()
}

function celebrateGame(): void {
  document.querySelector('#game-text')!.textContent = `Du har løst alle ${TOTAL_TASKS} oppgavene og ${TOTAL_WORDS} ord gjennom hele Ordskogen. Beste streak: ${progress.bestStreak}.`
  gameDialog.showModal()
}

function showJoke(): void {
  if (!jokes.length) return
  const availableJokes = jokes.map((_, index) => index).filter(index => index !== previousJokeIndex)
  const jokePool = availableJokes.length ? availableJokes : jokes.map((_, index) => index)
  const jokeIndex = jokePool[Math.floor(Math.random() * jokePool.length)]
  previousJokeIndex = jokeIndex
  const joke = jokes[jokeIndex]
  document.querySelector('#joke-title')!.textContent = joke.title
  document.querySelector('#joke-text')!.textContent = joke.text
  jokeDialog.showModal()
}

function submit(): void {
  if (!puzzle || !isRoundActive()) return
  const word = deriveCurrentWord(state)
  if (!word) return
  let progressSaveFailed = false
  let solvedTask = false
  let justLevelComplete = false
  let justGameComplete = false
  hintMode = false
  if (state.foundWords.includes(word) || bonusWords.has(word)) setMessage('Det ordet har du allerede funnet.')
  else if (!dictionary.has(word)) setMessage(word.length < 3 ? 'Ordet må ha minst 3 bokstaver.' : 'Det ordet finnes ikke i ordlisten.', 'error')
  else if (puzzle.placements.some(placement => placement.word === word)) {
    state = { ...state, foundWords: [...state.foundWords, word] }
    solvedTask = state.foundWords.length === puzzle.placements.length
    if (solvedTask) {
      const levelIndex = currentLevelIndex(progress)
      progress = markTaskSolved(progress, progress.currentTaskId)
      progressSaveFailed = !saveGameProgress(progress)
      justGameComplete = isGameComplete(progress)
      justLevelComplete = !justGameComplete && isLevelComplete(progress, levelIndex)
      gameComplete = justGameComplete
    }
    setMessage(justGameComplete ? 'Du har rundet hele Ordskogen! 🌲' : solvedTask ? 'Flott! Du fant alle ordene.' : `${word.toUpperCase()} er riktig!`, 'success')
  } else {
    bonusWords.add(word)
    setMessage(`${word.toUpperCase()} er et bonusord!`, 'success')
  }
  state = clearSelection(state)
  render()
  if (progressSaveFailed) setMessage('Framgangen kunne ikke lagres på denne enheten. Den kan gå tapt når spillet lukkes.', 'error')
  if (solvedTask) {
    launchConfetti()
    if (justGameComplete) celebrateGame()
    else if (justLevelComplete) celebrateLevel(currentLevelIndex(progress))
  }
}

function choose(tileId: string): void {
  if (!isRoundActive()) return
  if (hintMode) setMessage('')
  hintMode = false
  if (state.selectedTileIds.at(-1) === tileId && !dragging) state = deselectTile(state, tileId)
  else state = selectTile(state, tileId)
  render()
}

tray.addEventListener('pointerdown', event => {
  if (!isRoundActive()) return
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tile-id]')
  if (!button) return
  event.preventDefault()
  choose(button.dataset.tileId!)
  dragging = true
  dragged = false
  pointerStart = { x: event.clientX, y: event.clientY }
  pointerPosition = pointerStart
  updateSelectionLine(tray, state, pointerPosition)
})
document.addEventListener('pointermove', event => {
  if (!dragging) return
  pointerPosition = { x: event.clientX, y: event.clientY }
  if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 12) dragged = true
  const button = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('[data-tile-id]')
  if (button && !state.selectedTileIds.includes(button.dataset.tileId!)) choose(button.dataset.tileId!)
  updateSelectionLine(tray, state, pointerPosition)
})
document.addEventListener('pointerup', () => {
  if (!dragging) return
  dragging = false
  pointerPosition = undefined
  if (dragged) submit()
  else updateSelectionLine(tray, state)
})
document.addEventListener('pointercancel', () => {
  dragging = false
  pointerPosition = undefined
  updateSelectionLine(tray, state)
})
tray.addEventListener('click', event => {
  if (event.detail !== 0) return
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tile-id]')
  if (button) choose(button.dataset.tileId!)
})
function undo(): void {
  if (!isRoundActive()) return
  if (hintMode) setMessage('')
  hintMode = false
  const last = state.selectedTileIds.at(-1)
  if (last) state = deselectTile(state, last)
  render()
}
document.querySelector('#shuffle')!.addEventListener('click', () => {
  if (!isRoundActive()) return
  if (hintMode) setMessage('')
  hintMode = false
  const shuffled = [...state.tray]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  state = { ...clearSelection(state), tray: shuffled }
  render()
})
document.querySelector('#hint')!.addEventListener('click', () => {
  if (!isRoundActive() || hintsLeft === 0) return
  hintMode = !hintMode
  setMessage(hintMode ? 'Velg en tom rute.' : '', hintMode ? 'hint' : 'neutral')
  render()
  if (hintMode) board.querySelector<HTMLButtonElement>('.hint-target')?.focus()
})
document.querySelector('#joke')!.addEventListener('click', showJoke)
board.addEventListener('keydown', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-hint-cell]')
  if (!target || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const [row, column] = target.dataset.hintCell!.split(',').map(Number)
  const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown'
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  const candidates = [...board.querySelectorAll<HTMLButtonElement>('[data-hint-cell]')].map(button => {
    const [nextRow, nextColumn] = button.dataset.hintCell!.split(',').map(Number)
    const primary = vertical ? nextRow - row : nextColumn - column
    const secondary = vertical ? Math.abs(nextColumn - column) : Math.abs(nextRow - row)
    return { button, primary, secondary }
  }).filter(candidate => forward ? candidate.primary > 0 : candidate.primary < 0)
    .sort((first, second) => first.secondary - second.secondary || Math.abs(first.primary) - Math.abs(second.primary))
  candidates[0]?.button.focus()
})
document.querySelector('#give-up')!.addEventListener('click', () => {
  if (!puzzle || !isRoundActive()) return
  if (!window.confirm('Avsløre alle ordene og avslutte oppgaven?')) return
  state = giveUp(state, puzzle.placements.length)
  hintMode = false
  dragging = false
  dragged = false
  pointerPosition = undefined
  setMessage('Alle ordene er avslørt.')
  render()
  document.querySelector<HTMLButtonElement>('#next')!.focus()
})
document.querySelector('#next')!.addEventListener('click', () => {
  if (!puzzle || isRoundActive() || gameComplete) return
  progress = advanceGameProgress(progress, state.givenUp)
  const progressSaved = saveGameProgress(progress)
  gameComplete = isGameComplete(progress)
  startRound()
  if (!progressSaved) setMessage('Framgangen kunne ikke lagres på denne enheten. Den kan gå tapt når spillet lukkes.', 'error')
})
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && event.target.closest('#avatar-picker')) return
  if (jokeDialog.open) return
  if (!isRoundActive()) return
  if (event.target instanceof HTMLElement && event.target.closest('#give-up') && ['Enter', ' '].includes(event.key)) return
  if (hintMode && event.key === 'Escape') {
    hintMode = false
    setMessage('')
    render()
    document.querySelector<HTMLButtonElement>('#hint')!.focus()
    return
  }
  if (event.target instanceof HTMLElement && event.target.closest('[data-hint-cell]') && ['Enter', ' '].includes(event.key)) return
  if (!puzzle || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLButtonElement && (event.key === ' ' || (event.key === 'Enter' && state.selectedTileIds.length === 0)))) return
  if (event.key === 'Enter') { event.preventDefault(); submit() }
  else if (event.key === 'Backspace') { event.preventDefault(); undo() }
  else if (event.key === 'Escape') { state = clearSelection(state); render() }
  else if (/^[a-zæøå]$/i.test(event.key)) {
    const tile = state.tray.find(candidate => candidate.letter.toLowerCase() === event.key.toLowerCase() && !state.selectedTileIds.includes(candidate.id))
    if (tile) choose(tile.id)
  }
})

async function loadJokes(): Promise<void> {
  jokes = await loadJokeList(async () => {
    const response = await fetch(jokesUrl)
    if (!response.ok) throw new Error('Vitsene kunne ikke lastes.')
    return response.text()
  })
  document.querySelector<HTMLButtonElement>('#joke')!.disabled = jokes.length === 0
}

async function loadDictionary(): Promise<void> {
  try {
    const response = await fetch(dictionaryUrl)
    if (!response.ok) throw new Error('Ordlisten kunne ikke lastes.')
    dictionary = parseDictionary(await response.text())
    progress = readGameProgress()
    let progressSaveFailed = false
    if (progress.solvedTaskIds.includes(progress.currentTaskId) && !isGameComplete(progress)) {
      progress = advanceGameProgress(progress)
      progressSaveFailed = !saveGameProgress(progress)
    }
    gameComplete = isGameComplete(progress)
    startRound()
    if (progressSaveFailed) setMessage('Framgangen kunne ikke lagres på denne enheten. Den kan gå tapt når spillet lukkes.', 'error')
    void loadJokes()
  } catch {
    setMessage('Kunne ikke laste oppgaven. ', 'error')
    const retry = document.createElement('button')
    retry.textContent = 'Prøv igjen'
    retry.addEventListener('click', () => void loadDictionary())
    message.append(retry)
  }
}
void loadDictionary()
