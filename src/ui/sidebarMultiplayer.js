import { listPartyStates, generateInviteForParty } from '../network/multiplayerStore.js'
import { showHostNotification } from '../network/hostNotifications.js'

const PARTY_LIST_ID = 'multiplayerPartyList'
const PARTY_DISPLAY_NAMES = {
  player1: 'Green',
  player2: 'Red',
  player3: 'Blue',
  player4: 'Yellow'
}

let partyListContainer = null

export function initSidebarMultiplayer() {
  partyListContainer = document.getElementById(PARTY_LIST_ID)
  refreshSidebarMultiplayer()
}
import {
  listPartyStates,
  generateInviteForParty,
  getHostInviteStatus,
  setHostInviteStatus
} from '../network/multiplayerStore.js'
import { showHostNotification } from '../network/hostNotifications.js'

const PARTY_LIST_ID = 'multiplayerPartyList'
const PARTY_DISPLAY_NAMES = {
  player1: 'Green',
  player2: 'Red',
  player3: 'Blue',
  player4: 'Yellow'
}

let partyListContainer = null

export function initSidebarMultiplayer() {
  partyListContainer = document.getElementById(PARTY_LIST_ID)
  refreshSidebarMultiplayer()
}

export function refreshSidebarMultiplayer() {
  if (!partyListContainer) {
    return
  }

  partyListContainer.innerHTML = ''
  const partyStates = listPartyStates()
  partyStates.forEach((partyState) => {
    partyListContainer.appendChild(createPartyRow(partyState))
  })
}

function createPartyRow(partyState) {
  const row = document.createElement('div')
  row.className = 'multiplayer-party-row'

  const info = document.createElement('div')
  info.className = 'multiplayer-party-info'

  const dot = document.createElement('span')
  dot.className = 'multiplayer-party-dot'
  dot.style.backgroundColor = partyState.color || '#999'
  info.appendChild(dot)

  const label = document.createElement('span')
  label.className = 'multiplayer-party-label'
  label.textContent = `${getPartyDisplayName(partyState.partyId, partyState.color)}: ${partyState.owner}`
  info.appendChild(label)

  const controls = document.createElement('div')
  controls.className = 'multiplayer-party-controls'

  const status = document.createElement('span')
  status.className = 'multiplayer-party-status'
  status.setAttribute('aria-live', 'polite')
  updateStatusText(status, partyState)
  controls.appendChild(status)

  const inviteButton = document.createElement('button')
  inviteButton.type = 'button'
  inviteButton.className = 'multiplayer-invite-button'
  inviteButton.textContent = 'Invite'
  inviteButton.addEventListener('click', () => handleInviteClick(partyState, inviteButton, status))
  controls.appendChild(inviteButton)

  row.append(info, controls)
  return row
}

function getPartyDisplayName(partyId, color) {
  return PARTY_DISPLAY_NAMES[partyId] || color || 'Party'
}

function formatStatusText(statusKey, partyState) {
  switch (statusKey) {
    case 'generating':
      return 'Generating invite…'
    case 'copied':
      return 'Copied!'
    case 'error':
      return 'Invite failed'
    default: {
      if (partyState.inviteToken) {
        return 'Invite ready'
      }
      return partyState.aiActive ? 'AI control' : 'Available'
    }
  }
}

function updateStatusText(element, partyState) {
  const currentStatus = getHostInviteStatus(partyState.partyId)
  element.textContent = formatStatusText(currentStatus, partyState)
  element.dataset.status = currentStatus
}

async function handleInviteClick(partyState, button, status) {
  const originalText = button.textContent
  button.disabled = true
  button.textContent = 'Generating…'
  status.classList.remove('success')
  setHostInviteStatus(partyState.partyId, 'generating')
  updateStatusText(status, partyState)

  try {
    const { url } = await generateInviteForParty(partyState.partyId)
    status.classList.add('success')
    await tryCopyToClipboard(url)
    showHostNotification('Invite link copied to clipboard')
    button.title = url
    setHostInviteStatus(partyState.partyId, 'copied')
    updateStatusText(status, partyState)
  } catch (error) {
    setHostInviteStatus(partyState.partyId, 'error')
    status.classList.remove('success')
    updateStatusText(status, partyState)
    showHostNotification(`Invite creation failed: ${error?.message || 'unknown error'}`)
  } finally {
    button.disabled = false
    button.textContent = originalText
    setTimeout(() => {
      setHostInviteStatus(partyState.partyId, 'idle')
      updateStatusText(status, partyState)
      status.classList.remove('success')
    }, 2500)
  }
}

async function tryCopyToClipboard(text) {
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn('Clipboard write failed:', err)
    }
  }
  return false
}
