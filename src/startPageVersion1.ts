import './startPageVersion1.css'
import { ArrowRight, createElement } from 'lucide'
import { archiveAvatarImageUrls } from './ui/avatarAssetsVersion1.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root element')

app.innerHTML = `
<div class="start-screen">
  <header class="start-header">
    <div class="start-brand"><span class="start-eyebrow">ET ORDSPILL</span><h1>Ordløypa</h1></div>
    <span class="start-world">Ordskogen våkner</span>
  </header>
  <main class="start-main">
    <p class="start-instruction">Velg din følgesvenn</p>
    <div id="start-avatar-choices" class="start-avatar-choices" role="group" aria-label="Velg avatar"></div>
    <figure id="start-avatar-stage" class="start-avatar-stage" role="img" aria-label="">
      <img id="start-avatar-image" class="start-avatar-image" src="" alt="" fetchpriority="high">
    </figure>
    <a class="start-game-button" href="./game.html"><span>Spill nå</span><span id="start-game-icon" aria-hidden="true"></span></a>
  </main>
</div>
`

document.querySelector('#start-game-icon')!.replaceChildren(createElement(ArrowRight, { 'aria-hidden': 'true' }))

const archivedAvatars = [
  { id: 'wizard', name: 'Trollmann' },
  { id: 'dragon', name: 'Drage' },
  { id: 'cat', name: 'Katt' },
] as const
type ArchivedAvatarId = typeof archivedAvatars[number]['id']
const storageKey = 'susannes-ordspill.avatar'
const choiceGroup = document.querySelector<HTMLDivElement>('#start-avatar-choices')!
const avatarStage = document.querySelector<HTMLElement>('#start-avatar-stage')!
const avatarImage = document.querySelector<HTMLImageElement>('#start-avatar-image')!

function readArchivedAvatar(): ArchivedAvatarId {
  try {
    const savedId = window.localStorage.getItem(storageKey)
    return archivedAvatars.find(avatar => avatar.id === savedId)?.id ?? 'wizard'
  } catch {
    return 'wizard'
  }
}

let selectedId = readArchivedAvatar()

function renderAvatar(): void {
  const selected = archivedAvatars.find(avatar => avatar.id === selectedId)!
  avatarImage.src = archiveAvatarImageUrls[selectedId]
  avatarImage.alt = ''
  avatarStage.setAttribute('aria-label', `${selected.name}, valgt avatar`)
  for (const choice of choiceGroup.querySelectorAll<HTMLButtonElement>('[data-avatar-id]')) {
    choice.setAttribute('aria-pressed', String(choice.dataset.avatarId === selectedId))
  }
}

for (const avatar of archivedAvatars) {
  const choice = document.createElement('button')
  choice.type = 'button'
  choice.className = 'start-avatar-choice'
  choice.dataset.avatarId = avatar.id
  choice.setAttribute('aria-pressed', 'false')
  choice.setAttribute('aria-label', avatar.name)

  const image = document.createElement('img')
  image.src = archiveAvatarImageUrls[avatar.id]
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')

  const label = document.createElement('span')
  label.textContent = avatar.name
  choice.append(image, label)
  choice.addEventListener('click', () => {
    selectedId = avatar.id
    try {
      window.localStorage.setItem(storageKey, selectedId)
    } catch {}
    renderAvatar()
  })
  choiceGroup.append(choice)
}

renderAvatar()