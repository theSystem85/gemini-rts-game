import { createRemoteConnection, RemoteConnectionStatus } from '../network/remoteConnection.js'
import { handleReceivedCommand, setClientPartyId, resetClientState, startGameStateSync, stopGameStateSync } from '../network/gameCommandSync.js'
import { parsePartyIdFromToken } from '../network/invites.js'
import { gameState } from '../gameState.js'
import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from '../config.js'

const STATUS_MESSAGES = {
  [RemoteConnectionStatus.IDLE]: 'Awaiting alias submission.',
  [RemoteConnectionStatus.CONNECTING]: 'Connecting to host...',
  [RemoteConnectionStatus.CONNECTED]: 'Connected. Waiting for data channel...',
  [RemoteConnectionStatus.FAILED]: 'Connection failed. Try again.',
  [RemoteConnectionStatus.DISCONNECTED]: 'Disconnected from host.'
}

const DEFAULT_STATUS = 'Enter your alias to claim the invited party.'

function getInviteTokenFromUrl() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const params = new URLSearchParams(window.location.search || '')
    const token = params.get('invite')
    return token ? token.trim() : null
  } catch (err) {
    console.warn('Failed to parse invite token:', err)
    return null
  }
}

function updateStatus(element, message, isError) {
  if (!element) {
    return
  }
  element.textContent = message
  element.classList.toggle('remote-invite-status--error', !!isError)
}

function showOverlay(overlay, statusEl) {
  if (!overlay) {
    return
  }
  overlay.classList.remove('remote-invite-overlay--hidden')
  overlay.setAttribute('aria-hidden', 'false')
  updateStatus(statusEl, DEFAULT_STATUS, false)
}

function hideOverlay(overlay) {
  if (!overlay) {
    return
  }
  overlay.classList.add('remote-invite-overlay--hidden')
  overlay.setAttribute('aria-hidden', 'true')
}

/**
 * Center the camera on the party's construction yard
 * @param {string} partyId - The partyId to center on
 */
function centerCameraOnPartyBase(partyId) {
  if (!partyId) {
    return
  }
  
  // Find the construction yard belonging to this party
  const factory = gameState.buildings?.find(b => 
    b.type === 'constructionYard' && 
    (b.owner === partyId || b.id === partyId)
  ) || gameState.factories?.find(f => 
    f.id === partyId || f.owner === partyId
  )
  
  if (!factory) {
    console.warn('[RemoteInviteLanding] Could not find factory for party:', partyId)
    return
  }
  
  // Calculate pixel position
  const factoryPixelX = factory.x * TILE_SIZE
  const factoryPixelY = factory.y * TILE_SIZE
  
  // Get viewport dimensions
  const gameCanvas = document.getElementById('gameCanvas')
  if (!gameCanvas) {
    return
  }
  
  // Use a reasonable default viewport size if canvas dimensions aren't available
  const viewportWidth = gameCanvas.clientWidth || 800
  const viewportHeight = gameCanvas.clientHeight || 600
  
  // Center the camera on the factory
  gameState.scrollOffset.x = Math.max(0, Math.min(
    factoryPixelX - viewportWidth / 2,
    MAP_TILES_X * TILE_SIZE - viewportWidth
  ))
  gameState.scrollOffset.y = Math.max(0, Math.min(
    factoryPixelY - viewportHeight / 2,
    MAP_TILES_Y * TILE_SIZE - viewportHeight
  ))
  
  console.log('[RemoteInviteLanding] Camera centered on party base:', partyId, 
    'at', factory.x, factory.y, 
    'scroll:', gameState.scrollOffset.x, gameState.scrollOffset.y)
}

export function initRemoteInviteLanding() {
  if (typeof document === 'undefined') {
    return
  }

  const overlay = document.getElementById('remoteInviteLanding')
  const form = document.getElementById('remoteInviteForm')
  const aliasInput = document.getElementById('remoteAliasInput')
  const statusElement = document.getElementById('remoteInviteStatus')
  const tokenText = document.getElementById('remoteInviteTokenText')
  const submitButton = document.getElementById('remoteInviteSubmit')
  const inviteToken = getInviteTokenFromUrl()

  if (!overlay || !form || !aliasInput || !statusElement || !submitButton || !inviteToken) {
    if (overlay) {
      hideOverlay(overlay)
    }
    return
  }

  tokenText.textContent = inviteToken
  showOverlay(overlay, statusElement)
  aliasInput.value = ''
  aliasInput.focus()
  submitButton.disabled = false

  const setFormDisabled = (disabled) => {
    aliasInput.disabled = disabled
    submitButton.disabled = disabled
  }

  const handleStatusChange = (status) => {
    const message = STATUS_MESSAGES[status] || STATUS_MESSAGES[RemoteConnectionStatus.CONNECTING]
    const isError = status === RemoteConnectionStatus.FAILED
    updateStatus(statusElement, message, isError)

    if (status === RemoteConnectionStatus.DISCONNECTED) {
      showOverlay(overlay, statusElement)
      setFormDisabled(false)
      aliasInput.focus()
      // Reset client state on disconnect
      resetClientState()
    }
  }

  // Parse the partyId from the invite token
  const partyId = parsePartyIdFromToken(inviteToken)
  
  const handleDataChannelOpen = () => {
    hideOverlay(overlay)
    updateStatus(statusElement, 'Connected. Remote controls are live.', false)
    
    // Set the client's partyId and humanPlayer when connected
    if (partyId) {
      setClientPartyId(partyId)
      gameState.humanPlayer = partyId
      console.log('[RemoteInviteLanding] Client party set to:', partyId)
      
      // Start client state sync to send updates to host
      startGameStateSync()
      
      // Center camera on the client's base after a short delay to allow state sync
      setTimeout(() => {
        centerCameraOnPartyBase(partyId)
      }, 500)
    }
  }

  const handleDataChannelClose = () => {
    showOverlay(overlay, statusElement)
    updateStatus(statusElement, 'Connection closed. Enter your alias to retry.', true)
    setFormDisabled(false)
    aliasInput.focus()
    // Stop client state sync and reset client state on disconnect
    stopGameStateSync()
    resetClientState()
  }

  const handleDataChannelMessage = (rawPayload) => {
    let payload = rawPayload
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch (err) {
        return
      }
    }
    
    if (!payload) {
      return
    }
    
    // Handle game command synchronization messages
    if (payload.type === 'game-command') {
      handleReceivedCommand(payload, 'host')
      return
    }
    
    // Handle host status messages
    if (payload.type !== 'host-status') {
      return
    }
    const running = Boolean(payload.running)
    const message = running ? 'Host resumed the game.' : 'Host paused the game.'
    updateStatus(statusElement, message, !running)
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const alias = aliasInput.value.trim()
    if (!alias) {
      updateStatus(statusElement, 'Alias is required to join.', true)
      aliasInput.focus()
      return
    }

    setFormDisabled(true)
    updateStatus(statusElement, STATUS_MESSAGES[RemoteConnectionStatus.CONNECTING], false)

    try {
      const connection = createRemoteConnection({
        inviteToken,
        alias,
        onStatusChange: handleStatusChange,
        onDataChannelOpen: handleDataChannelOpen,
        onDataChannelClose: handleDataChannelClose,
        onDataChannelMessage: handleDataChannelMessage
      })
      await connection.start()
    } catch (error) {
      updateStatus(statusElement, error?.message || 'Failed to connect to host.', true)
      setFormDisabled(false)
      aliasInput.focus()
    }
  })
}
