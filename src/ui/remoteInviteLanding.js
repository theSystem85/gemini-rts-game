import { createRemoteConnection, RemoteConnectionStatus } from '../network/remoteConnection.js'

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
    }
  }

  const handleDataChannelOpen = () => {
    hideOverlay(overlay)
    updateStatus(statusElement, 'Connected. Remote controls are live.', false)
  }

  const handleDataChannelClose = () => {
    showOverlay(overlay, statusElement)
    updateStatus(statusElement, 'Connection closed. Enter your alias to retry.', true)
    setFormDisabled(false)
    aliasInput.focus()
  }

  const handleDataChannelMessage = (payload) => {
    if (!payload || payload.type !== 'host-status') {
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
