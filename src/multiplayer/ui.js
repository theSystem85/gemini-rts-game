import {
  listPartyIds,
  getPartyDisplayName,
  isHost,
  markPartyAsAI,
  markPartyAsHuman
} from './partyRegistry.js'
import {
  generateInviteLink,
  getInviteState,
  initializeHostNetworking,
  maybeJoinFromInvite,
  notifyParty
} from './webrtcManager.js'
import { showNotification } from '../ui/notifications.js'

function createPartyRow(partyId) {
  const row = document.createElement('div')
  row.className = 'party-row'
  row.dataset.partyId = partyId

  const label = document.createElement('div')
  label.className = 'party-row__label'

  const title = document.createElement('div')
  title.className = 'party-row__title'
  title.textContent = getPartyDisplayName(partyId)

  const subtitle = document.createElement('div')
  subtitle.className = 'party-row__subtitle'
  label.append(title, subtitle)

  const button = document.createElement('button')
  button.className = 'party-row__button'
  button.textContent = 'Invite'
  button.type = 'button'

  row.append(label, button)
  return row
}

function syncPartyRow(row, state) {
  const partyId = row.dataset.partyId
  const subtitle = row.querySelector('.party-row__subtitle')
  const button = row.querySelector('.party-row__button')

  const { assignment, invite } = (state || getInviteState()).find(entry => entry.partyId === partyId) || {}

  if (assignment?.controlledByHuman) {
    subtitle.textContent = assignment.alias ? `Controlled by ${assignment.alias}` : 'Controlled by human'
    button.textContent = 'Revoke'
    button.disabled = false
    button.onclick = () => {
      markPartyAsAI(partyId)
      syncPartyList()
      showNotification(`${getPartyDisplayName(partyId)} returned to AI control`)
      notifyParty(partyId, 'Host reclaimed control of your party.')
    }
  } else if (invite) {
    subtitle.textContent = 'Invite pending'
    button.textContent = 'Invite sent'
    button.disabled = true
    button.onclick = null
  } else {
    subtitle.textContent = 'AI Controlled'
    button.textContent = 'Invite'
    button.disabled = false
    button.onclick = async function handleInviteClick() {
      let link
      try {
        link = await generateInviteLink(partyId)
        await navigator.clipboard.writeText(link)
        subtitle.textContent = 'Invite copied to clipboard'
        button.disabled = true
        setTimeout(() => {
          button.disabled = false
          syncPartyRow(row)
        }, 4000)
      } catch (err) {
        subtitle.textContent = 'Invite link unavailable, see console'
        console.warn('Failed to copy invite link', err)
        showNotification('Unable to create invite link. Please try again in a moment.')
        try {
          if (!link) {
            link = await generateInviteLink(partyId)
          }
          console.log('Invite link:', link)
        } catch (linkErr) {
          console.warn('Unable to generate invite link for logging', linkErr)
        }
      }
    }
  }
}

function syncPartyList() {
  const container = document.getElementById('multiplayerParties')
  if (!container) return
  const parties = listPartyIds()
  const existing = new Map(Array.from(container.children).map(child => [child.dataset.partyId, child]))
  const state = getInviteState()
  parties.forEach(partyId => {
    let row = existing.get(partyId)
    if (!row) {
      row = createPartyRow(partyId)
      container.appendChild(row)
    }
    syncPartyRow(row, state)
    existing.delete(partyId)
  })
  existing.forEach(row => row.remove())
}

export async function initializeMultiplayerUI() {
  const container = document.getElementById('multiplayerParties')
  if (!container) return
  if (isHost()) {
    const { sessionId } = initializeHostNetworking()
    container.dataset.sessionId = sessionId
  }
  syncPartyList()
  const joinInfo = await maybeJoinFromInvite((info) => {
    showNotification(`Connected as ${info.alias}`)
  })
  if (joinInfo) {
    const containerTitle = document.createElement('div')
    containerTitle.className = 'party-row__subtitle'
    containerTitle.textContent = `Connected to host session ${joinInfo.sessionId.slice(0, 8)}`
    container.prepend(containerTitle)
    markPartyAsHuman(joinInfo.partyId, joinInfo.alias, joinInfo.connectionId)
  }

  const playerInput = document.getElementById('playerCount')
  if (playerInput && isHost()) {
    playerInput.addEventListener('change', () => {
      setTimeout(syncPartyList, 50)
    })
  }

  window.addEventListener('multiplayer:state', syncPartyList)
  setInterval(syncPartyList, 5000)
}
