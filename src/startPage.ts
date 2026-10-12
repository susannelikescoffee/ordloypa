import './startPage.css'
import { ArrowRight, createElement } from 'lucide'
import { avatars, readAvatarPreference, saveAvatarPreference, type AvatarId } from './game/avatars.ts'
import { avatarImageUrls } from './ui/avatarAssets.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app root element')

app.innerHTML = `
<div class="start-screen">
  <header class="start-header">
    <div class="start-brand"><span class="start-eyebrow">ET ORDSPILL</span><h1>Ordløypa</h1></div>
    <nav class="start-nav" aria-label="Hovedmeny"><span class="start-world">Ordskogen våkner</span><a class="start-archive-link" href="./start_versjon1.html">Tidligere versjoner</a></nav>
  </header>
  <main class="start-main">
    <div class="start-controls">
      <p class="start-instruction">Velg din følgesvenn</p>
      <div id="start-avatar-choices" class="start-avatar-choices" role="group" aria-label="Velg avatar"></div>
      <a class="start-game-button" href="./game.html"><span>Spill nå</span><span id="start-game-icon" aria-hidden="true"></span></a>
    </div>
    <figure id="start-avatar-stage" class="start-avatar-stage" role="img" aria-label="">
      <img id="start-avatar-image" class="start-avatar-image" src="" alt="" fetchpriority="high">
    </figure>
  </main>
</div>
`

document.querySelector('#start-game-icon')!.replaceChildren(createElement(ArrowRight, { 'aria-hidden': 'true' }))

const choiceGroup = document.querySelector<HTMLDivElement>('#start-avatar-choices')!
const avatarStage = document.querySelector<HTMLElement>('#start-avatar-stage')!
const avatarImage = document.querySelector<HTMLImageElement>('#start-avatar-image')!
let selectedId = readAvatarPreference()

function renderAvatar(): void {
  const selected = avatars.find(avatar => avatar.id === selectedId)!
  avatarImage.src = avatarImageUrls[selectedId]
  avatarImage.alt = ''
  avatarStage.setAttribute('aria-label', `${selected.name}, valgt avatar`)
  avatarStage.dataset.avatar = selectedId
  for (const choice of choiceGroup.querySelectorAll<HTMLButtonElement>('[data-avatar-id]')) {
    choice.setAttribute('aria-pressed', String(choice.dataset.avatarId === selectedId))
  }
}

for (const avatar of avatars) {
  const choice = document.createElement('button')
  choice.type = 'button'
  choice.className = 'start-avatar-choice'
  choice.dataset.avatarId = avatar.id
  choice.setAttribute('aria-pressed', 'false')
  choice.setAttribute('aria-label', avatar.name)

  const image = document.createElement('img')
  image.src = avatarImageUrls[avatar.id]
  image.dataset.avatarId = avatar.id
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')

  const label = document.createElement('span')
  label.textContent = avatar.name
  choice.append(image, label)
  choice.addEventListener('click', () => {
    selectedId = avatar.id as AvatarId
    saveAvatarPreference(selectedId)
    renderAvatar()
  })
  choiceGroup.append(choice)
}

renderAvatar()