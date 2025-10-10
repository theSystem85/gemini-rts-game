/* global crypto, RTCPeerConnection, RTCIceCandidate */

import { gameState } from '../gameState.js'
import {
  ensureHostParty,
  getPartyAssignment,
  getPartyDisplayName,
  listPartyIds,
  markPartyAsAI,
  markPartyAsHuman,
  registerConnection,
  clearConnection,
  updatePartyAlias,
  updateConnectionHeartbeat,
  isHost,
  normalizePartyId
} from './partyRegistry.js'
import { createSignalingChannel, postSignal, signalService } from './signalingChannel.js'
import { showNotification } from '../ui/notifications.js'

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302'] }]

function generateId() {
  return crypto.randomUUID()
}

function notifyUIUpdate() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new window.Event('multiplayer:state'))
  }
}

async function getInviteFromUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const inviteId = params.get('invite')
  if (!inviteId) return null
  try {
    const response = await fetch(`${signalService.http}/api/invites/${inviteId}`)
    if (!response.ok) {
      showNotification('Invite is no longer available.')
      return null
    }
    const details = await response.json()
    if (!details.sessionId || !details.partyId) {
      showNotification('Invite is invalid.')
      return null
    }
    return {
      sessionId: details.sessionId,
      partyId: normalizePartyId(details.partyId),
      inviteId
    }
  } catch (err) {
    console.warn('Failed to read invite details', err)
    showNotification('Unable to reach multiplayer service.')
    return null
  }
}

function ensureMultiplayerState() {
  gameState.multiplayer = gameState.multiplayer || {}
  gameState.multiplayer.connections = gameState.multiplayer.connections || {}
  gameState.multiplayer.invites = gameState.multiplayer.invites || {}
  gameState.multiplayer.partyAliases = gameState.multiplayer.partyAliases || {}
  gameState.multiplayer.partyAssignments = gameState.multiplayer.partyAssignments || {}
}

function setHostSession(sessionId) {
  ensureMultiplayerState()
  gameState.multiplayer.sessionId = sessionId
  gameState.multiplayer.isHost = true
  ensureHostParty(gameState.multiplayer.hostPlayerId || 'player1', 'Host')
}

function ensureSession() {
  ensureMultiplayerState()
  if (gameState.multiplayer.sessionId) return gameState.multiplayer.sessionId
  const sessionId = generateId()
  setHostSession(sessionId)
  return sessionId
}

async function createInvite(partyId) {
  ensureMultiplayerState()
  const sessionId = ensureSession()
  const url = `${signalService.http}/api/invites`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, partyId })
  })
  if (!response.ok) {
    throw new Error('Failed to create invite on server')
  }
  const payload = await response.json()
  if (!payload || !payload.inviteId) {
    throw new Error('Server did not return invite identifier')
  }
  const invite = {
    inviteId: payload.inviteId,
    createdAt: Date.now()
  }
  gameState.multiplayer.invites[partyId] = invite
  return { inviteId: payload.inviteId, sessionId }
}

function validateInvite(partyId, inviteId) {
  ensureMultiplayerState()
  const invite = gameState.multiplayer.invites[partyId]
  if (!invite) return false
  return invite.inviteId === inviteId
}

function makePeerConnection(connectionId, partyId, isClient) {
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  peer._connectionId = connectionId
  peer._partyId = partyId
  peer._isClient = isClient
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed' || peer.connectionState === 'closed') {
      clearConnection(connectionId)
      markPartyAsAI(partyId)
      notifyUIUpdate()
    }
  }
  peer.oniceconnectionstatechange = () => {
    if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
      clearConnection(connectionId)
      markPartyAsAI(partyId)
      notifyUIUpdate()
    }
  }
  return peer
}

function createDataChannel(peer, label, handler) {
  const channel = peer.createDataChannel(label)
  channel.onmessage = handler
  channel.onopen = () => {
    channel.send(JSON.stringify({ type: 'hello', ts: Date.now() }))
  }
  channel.onclose = () => {
    if (peer._connectionId) clearConnection(peer._connectionId)
  }
  return channel
}

function handleIncomingChannel(event) {
  const channel = event.channel
  channel.onmessage = (messageEvent) => {
    try {
      const payload = JSON.parse(messageEvent.data)
      if (payload.type === 'heartbeat' && event.target._connectionId) {
        updateConnectionHeartbeat(event.target._connectionId)
      }
    } catch (err) {
      console.warn('Failed to process incoming data channel message', err)
    }
  }
}

async function hostHandleJoinRequest(sessionId, payload) {
  const { partyId, inviteId, alias, connectionId } = payload
  if (!validateInvite(partyId, inviteId)) {
    postSignal(sessionId, { type: 'invite-invalid', partyId, inviteId, connectionId })
    return
  }

  const peer = makePeerConnection(connectionId, partyId, false)
  peer.ondatachannel = handleIncomingChannel
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      postSignal(sessionId, {
        type: 'ice-candidate',
        connectionId,
        candidate: event.candidate
      })
    }
  }

  const dataChannel = createDataChannel(peer, 'commands', () => {})
  registerConnection(connectionId, { partyId, alias, peer, channel: dataChannel })

  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)

  postSignal(sessionId, {
    type: 'offer',
    partyId,
    alias,
    inviteId,
    connectionId,
    sdp: offer.sdp
  })
}

async function clientHandleOffer(sessionId, payload, joinInfo) {
  const { sdp, connectionId, partyId } = payload
  const peer = makePeerConnection(connectionId, partyId, true)
  joinInfo.peer = peer
  const channelPromise = new Promise(resolve => {
    peer.ondatachannel = (event) => {
      const channel = event.channel
      channel.onopen = () => {
        resolve(channel)
        channel.send(JSON.stringify({ type: 'joined', alias: joinInfo.alias }))
      }
      channel.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data)
          if (data.type === 'notify' && data.message) {
            showNotification(data.message)
          }
        } catch (err) {
          console.warn('Failed to parse host message', err)
        }
      }
    }
  })

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      postSignal(sessionId, {
        type: 'ice-candidate',
        connectionId,
        candidate: event.candidate
      })
    }
  }

  await peer.setRemoteDescription({ type: 'offer', sdp })
  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer)

  const channel = await channelPromise
  channel._connectionId = connectionId

  postSignal(sessionId, {
    type: 'answer',
    partyId,
    inviteId: joinInfo.inviteId,
    connectionId,
    sdp: answer.sdp,
    alias: joinInfo.alias
  })

  setInterval(() => {
    if (channel.readyState === 'open') {
      channel.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }))
    }
  }, 2500)
}

function hostHandleAnswer(sessionId, payload) {
  const { connectionId, sdp, alias, partyId } = payload
  const connection = gameState.multiplayer.connections[connectionId]
  if (!connection) return
  const { peer } = connection
  peer.setRemoteDescription({ type: 'answer', sdp })
  markPartyAsHuman(partyId, alias, connectionId)
  showNotification(`${getPartyDisplayName(partyId)} joined as ${alias}`)
  notifyUIUpdate()
  postSignal(sessionId, {
    type: 'acknowledge',
    partyId,
    connectionId
  })
}

function hostHandleIceCandidate(payload) {
  const { connectionId, candidate } = payload
  const connection = gameState.multiplayer.connections[connectionId]
  if (!connection) return
  connection.peer.addIceCandidate(new RTCIceCandidate(candidate))
}

function clientHandleIceCandidate(peer, candidate) {
  peer.addIceCandidate(new RTCIceCandidate(candidate))
}

export function initializeHostNetworking() {
  const sessionId = ensureSession()
  const handler = async function onHostSignal({ data }) {
    if (!data) return
    switch (data.type) {
      case 'join-request':
        await hostHandleJoinRequest(sessionId, data)
        break
      case 'answer':
        hostHandleAnswer(sessionId, data)
        break
      case 'ice-candidate':
        hostHandleIceCandidate(data)
        break
      default:
        break
    }
  }
  const channel = createSignalingChannel(sessionId, handler)
  return { sessionId, channel }
}

export async function generateInviteLink(partyId) {
  const { inviteId } = await createInvite(partyId)
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('invite', inviteId)
  return url.toString()
}

function showJoinOverlay({ partyId, sessionId }) {
  return new Promise((resolve, reject) => {
    const overlay = document.getElementById('joinOverlay')
    const description = document.getElementById('joinOverlayDescription')
    const input = document.getElementById('joinOverlayName')
    const confirm = document.getElementById('joinOverlayConfirm')
    const cancel = document.getElementById('joinOverlayCancel')
    overlay.hidden = false
    description.textContent = `Joining ${partyId.replace('player', 'Party ')} in session ${sessionId.slice(0, 8)}…`
    input.value = ''
    input.focus()

    const handleConfirm = () => {
      const alias = input.value.trim().slice(0, 24)
      if (!alias) {
        input.focus()
        return
      }
      cleanup()
      resolve(alias)
    }
    const handleCancel = () => {
      cleanup()
      reject(new Error('cancelled'))
    }

    function cleanup() {
      confirm.removeEventListener('click', handleConfirm)
      cancel.removeEventListener('click', handleCancel)
      overlay.hidden = true
    }

    confirm.addEventListener('click', handleConfirm)
    cancel.addEventListener('click', handleCancel)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleConfirm()
      }
    }, { once: true })
  })
}

export async function maybeJoinFromInvite(onConnected) {
  const joinInfo = await getInviteFromUrl()
  if (!joinInfo) return null
  gameState.multiplayer = gameState.multiplayer || {}
  gameState.multiplayer.isHost = false
  const alias = await showJoinOverlay(joinInfo).catch(() => null)
  if (!alias) return null
  joinInfo.alias = alias
  createSignalingChannel(joinInfo.sessionId, async function onClientSignal({ data }) {
    if (!data) return
    if (data.type === 'offer' && data.connectionId === joinInfo.connectionId) return
    if (data.type === 'offer' && data.inviteId === joinInfo.inviteId && data.partyId === joinInfo.partyId) {
      joinInfo.connectionId = data.connectionId
      await clientHandleOffer(joinInfo.sessionId, data, joinInfo)
      if (typeof onConnected === 'function') {
        onConnected(joinInfo)
      }
    } else if (data.type === 'invite-invalid' && data.inviteId === joinInfo.inviteId) {
      showNotification('Invite is no longer valid.')
    } else if (data.type === 'ice-candidate' && joinInfo.peer) {
      clientHandleIceCandidate(joinInfo.peer, data.candidate)
    }
  })
  const connectionId = generateId()
  joinInfo.connectionId = connectionId
  postSignal(joinInfo.sessionId, {
    type: 'join-request',
    partyId: joinInfo.partyId,
    inviteId: joinInfo.inviteId,
    alias,
    connectionId
  })
  return joinInfo
}

export function broadcastToConnection(connectionId, message) {
  const connection = gameState.multiplayer.connections[connectionId]
  if (!connection || !connection.channel) return
  if (connection.channel.readyState === 'open') {
    connection.channel.send(JSON.stringify(message))
  }
}

export function notifyParty(partyId, message) {
  const assignment = getPartyAssignment(partyId)
  if (!assignment || !assignment.connectionId) return
  broadcastToConnection(assignment.connectionId, {
    type: 'notify',
    message
  })
}

export function sharePartyAlias(partyId, alias) {
  updatePartyAlias(partyId, alias)
  if (isHost()) {
    notifyParty(partyId, `Alias updated to ${alias}`)
  }
}

export function getInviteState() {
  ensureMultiplayerState()
  const parties = listPartyIds()
  return parties.map(partyId => ({
    partyId,
    assignment: getPartyAssignment(partyId),
    invite: gameState.multiplayer.invites[partyId] || null
  }))
}
