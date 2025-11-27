import {
  listPartyStates,
  generateInviteForParty,
  getHostInviteStatus,
  setHostInviteStatus,
  observePartyOwnershipChange
} from '../network/multiplayerStore.js'
import { watchHostInvite, kickPlayer } from '../network/webrtcSession.js'
import { showHostNotification } from '../network/hostNotifications.js'
import { gameState } from '../gameState.js'
import { observeMultiplayerSession } from '../network/multiplayerSessionEvents.js'

const PARTY_LIST_ID = 'multiplayerPartyList'
const PARTY_DISPLAY_NAMES = {
  player1: 'Green',
  player2: 'Red',
  player3: 'Blue',
  player4: 'Yellow'
}

const HOST_CONTROL_BUTTONS = [
  { id: 'pauseBtn', label: 'Start/Pause' },
  { id: 'cheatMenuBtn', label: 'Cheat Console' }
]

let partyListContainer = null
let sessionObserverCleanup = null
let partyOwnershipCleanup = null

export function initSidebarMultiplayer() {
  partyListContainer = document.getElementById(PARTY_LIST_ID)
  refreshSidebarMultiplayer()
  setupHostControlWatcher()
  setupPartyOwnershipWatcher()
  listPartyStates().forEach((partyState) => {
    if (partyState.inviteToken) {
      watchHostInvite({ partyId: partyState.partyId, inviteToken: partyState.inviteToken })
    }
  })
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

function setupPartyOwnershipWatcher() {
  if (partyOwnershipCleanup) {
    partyOwnershipCleanup()
  }
  partyOwnershipCleanup = observePartyOwnershipChange(() => {
    // Refresh the entire party list when any party ownership changes
    refreshSidebarMultiplayer()
  })
}

function setupHostControlWatcher() {
  if (sessionObserverCleanup) {
    sessionObserverCleanup()
  }
  updateHostControlAccessibility(gameState.multiplayerSession)
  sessionObserverCleanup = observeMultiplayerSession((event) => {
    updateHostControlAccessibility(event?.detail)
  })
}

function isLocalClientSession(session = {}) {
  return Boolean(session.isRemote && session.localRole === 'client')
}

function updateHostControlAccessibility(session) {
  HOST_CONTROL_BUTTONS.forEach(({ id, label }) => {
    const button = document.getElementById(id)
    if (!button) {
      return
    }

    if (!button.dataset.originalTitle) {
      button.dataset.originalTitle = button.title || ''
    }

    if (isLocalClientSession(session)) {
      button.disabled = true
      button.classList.add('multiplayer-locked')
      const fallbackTitle = button.dataset.originalTitle || label
      button.title = `${fallbackTitle || label} (host only)`
      button.setAttribute('aria-label', `${label} (host only)`)
      button.dataset.remoteLocked = 'true'
      if (!button.dataset.originalDisplay) {
        button.dataset.originalDisplay = button.style.display || ''
      }
      button.style.display = 'none'
    } else {
      button.disabled = false
      button.classList.remove('multiplayer-locked')
      button.title = button.dataset.originalTitle || label
      button.removeAttribute('aria-label')
      delete button.dataset.remoteLocked
      if (button.dataset.originalDisplay !== undefined) {
        button.style.display = button.dataset.originalDisplay
        delete button.dataset.originalDisplay
      } else {
        button.style.display = ''
      }
    }
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
  
  // Check if a human player is connected (not AI and not the host)
  const isHumanConnected = !partyState.aiActive && partyState.partyId !== gameState.humanPlayer
  
  if (isHumanConnected) {
    // Human player is connected - show empty status and kick button
    status.textContent = ''
    controls.appendChild(status)

    const kickButton = document.createElement('button')
    kickButton.type = 'button'
    kickButton.className = 'multiplayer-invite-button multiplayer-kick-button'
    kickButton.textContent = 'Kick'
    kickButton.addEventListener('click', () => handleKickClick(partyState, kickButton))
    controls.appendChild(kickButton)
  } else {
    // AI controlled or host party - show normal invite flow
    updateStatusText(status, partyState)
    controls.appendChild(status)

    const inviteButton = document.createElement('button')
    inviteButton.type = 'button'
    inviteButton.className = 'multiplayer-invite-button'
    inviteButton.textContent = 'Invite'
    inviteButton.addEventListener('click', () => handleInviteClick(partyState, inviteButton, status))
    controls.appendChild(inviteButton)
  }

  row.append(info, controls)
  return row
}

function getPartyDisplayName(partyId, color) {
  return PARTY_DISPLAY_NAMES[partyId] || color || 'Party'
}

function formatStatusText(statusKey, partyState) {
  switch (statusKey) {
    case 'generating':
      return 'Generating invite...'
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
    watchHostInvite({ partyId: partyState.partyId, inviteToken: partyState.inviteToken })
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

function handleKickClick(partyState, button) {
  button.disabled = true
  button.textContent = 'Kicking…'
  
  // kickPlayer is now async
  kickPlayer(partyState.partyId).then(success => {
    if (!success) {
      showHostNotification(`Failed to kick player from ${partyState.partyId}`)
      button.disabled = false
      button.textContent = 'Kick'
    }
    // If successful, the ownership change event will refresh the sidebar
  }).catch(err => {
    console.warn('Kick failed:', err)
    showHostNotification(`Failed to kick player from ${partyState.partyId}`)
    button.disabled = false
    button.textContent = 'Kick'
  })
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
