import { deriveCurrentWord, type GameState, type LetterTile, type TileId } from '../game/state.ts'

export function updateSelectionLine(
  container: HTMLElement,
  state: GameState,
  pointer?: { x: number; y: number },
): void {
  const wheel = container.querySelector<HTMLElement>('.letter-wheel')
  const path = container.querySelector<SVGPolylineElement>('.selection-path')
  const tail = container.querySelector<SVGPolylineElement>('.selection-tail')
  if (!wheel || !path || !tail) return
  const bounds = wheel.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  const centers = new Map<string, string>()
  for (const button of wheel.querySelectorAll<HTMLButtonElement>('[data-tile-id]')) {
    const tile = button.getBoundingClientRect()
    centers.set(button.dataset.tileId!, `${(tile.left + tile.width / 2 - bounds.left) / bounds.width * 100},${(tile.top + tile.height / 2 - bounds.top) / bounds.height * 100}`)
  }
  const points = state.selectedTileIds.flatMap(tileId => {
    const center = centers.get(tileId)
    return center ? [center] : []
  })
  path.setAttribute('points', points.join(' '))
  const last = points.at(-1)
  tail.setAttribute('points', pointer && last
    ? `${last} ${(pointer.x - bounds.left) / bounds.width * 100},${(pointer.y - bounds.top) / bounds.height * 100}`
    : '')
}

function createTileElement(
  tile: LetterTile,
  isSelected: boolean,
  onSelectTile: (tileId: TileId) => void,
): HTMLLIElement {
  const item = document.createElement('li')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'letter-tile'
  button.dataset.tileId = tile.id
  button.setAttribute('aria-pressed', String(isSelected))
  button.textContent = tile.letter
  button.setAttribute('aria-label', `Bokstav ${tile.letter}`)
  button.addEventListener('click', () => onSelectTile(tile.id))
  item.append(button)
  return item
}

export function renderLetterTray(
  container: HTMLElement,
  state: GameState,
  onSelectTile: (tileId: TileId) => void,
): void {
  const currentWord = document.createElement('output')
  currentWord.className = 'current-word'
  currentWord.setAttribute('aria-label', 'Valgt ord')
  currentWord.setAttribute('aria-live', 'polite')
  currentWord.textContent = deriveCurrentWord(state).toUpperCase() || '\u00b7 \u00b7 \u00b7'

  const wheel = document.createElement('div')
  wheel.className = 'letter-wheel'
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lines.setAttribute('class', 'selection-lines')
  lines.setAttribute('viewBox', '0 0 100 100')
  lines.setAttribute('preserveAspectRatio', 'none')
  lines.setAttribute('aria-hidden', 'true')
  for (const className of ['selection-path', 'selection-tail']) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    line.setAttribute('class', className)
    line.setAttribute('vector-effect', 'non-scaling-stroke')
    lines.append(line)
  }

  const tray = document.createElement('ul')
  tray.className = 'letter-tray'
  tray.setAttribute('aria-label', 'Bokstavhjul')

  for (const [index, tile] of state.tray.entries()) {
    const element = createTileElement(tile, state.selectedTileIds.includes(tile.id), onSelectTile)
    const angle = index / state.tray.length * Math.PI * 2 - Math.PI / 2
    element.style.left = `${50 + Math.cos(angle) * 35}%`
    element.style.top = `${50 + Math.sin(angle) * 35}%`
    tray.append(element)
  }

  wheel.append(lines, tray)
  container.replaceChildren(currentWord, wheel)
  updateSelectionLine(container, state)
}