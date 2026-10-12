import { ChevronDown, createElement } from 'lucide'
import { avatars, readAvatarPreference, saveAvatarPreference } from '../game/avatars.ts'
import { avatarImageUrls } from './avatarAssets.ts'

export function initializeAvatarPicker(): void {
  const picker = document.querySelector<HTMLDivElement>('#avatar-picker')!
  const trigger = document.querySelector<HTMLButtonElement>('#avatar-trigger')!
  const currentImage = document.querySelector<HTMLImageElement>('#avatar-current')!
  const menu = document.querySelector<HTMLDivElement>('#avatar-menu')!
  const options = document.querySelector<HTMLDivElement>('#avatar-options')!
  const indicator = document.querySelector<HTMLSpanElement>('#avatar-indicator')!
  let selectedId = readAvatarPreference()

  indicator.replaceChildren(createElement(ChevronDown, { 'aria-hidden': 'true' }))

  function closeMenu(returnFocus: boolean): void {
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    if (returnFocus) trigger.focus()
  }

  function renderSelection(): void {
    const selected = avatars.find(avatar => avatar.id === selectedId)!
    currentImage.src = avatarImageUrls[selectedId]
    currentImage.dataset.avatar = selectedId
    trigger.setAttribute('aria-label', `Bytt avatar. Valgt: ${selected.name}`)
    trigger.title = `Bytt avatar. Valgt: ${selected.name}`
    for (const option of options.querySelectorAll<HTMLButtonElement>('[data-avatar-id]')) {
      option.setAttribute('aria-pressed', String(option.dataset.avatarId === selectedId))
    }
  }

  for (const avatar of avatars) {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = 'avatar-option'
    option.dataset.avatarId = avatar.id
    option.setAttribute('aria-label', avatar.name)
    option.setAttribute('aria-pressed', 'false')

    const image = document.createElement('img')
    image.src = avatarImageUrls[avatar.id]
    image.dataset.avatarId = avatar.id
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.textContent = avatar.name
    option.append(image, label)
    option.addEventListener('click', () => {
      selectedId = avatar.id
      saveAvatarPreference(selectedId)
      renderSelection()
      closeMenu(true)
    })
    options.append(option)
  }

  trigger.addEventListener('click', () => {
    const opening = menu.hidden
    menu.hidden = !opening
    trigger.setAttribute('aria-expanded', String(opening))
  })

  picker.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || menu.hidden) return
    event.preventDefault()
    event.stopPropagation()
    closeMenu(true)
  })

  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && !picker.contains(event.target)) closeMenu(false)
  })

  document.addEventListener('focusin', event => {
    if (event.target instanceof Node && !picker.contains(event.target)) closeMenu(false)
  })

  renderSelection()
}