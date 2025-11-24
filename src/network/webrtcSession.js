const CONNECTION_STATES = {
  PENDING: 'pending',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
}

const sessionRegistry = new Map()

function buildSessionKey(inviteToken, peerId) {
  return `${inviteToken}:${peerId}`
}

export function createWebRTCSession({ inviteToken, peerId, hostId, partyId, alias, offer }) {
  if (!inviteToken || !peerId) {
    throw new Error('inviteToken and peerId are required to create a WebRTC session')
  }

  const key = buildSessionKey(inviteToken, peerId)
  const session = {
    hostId: hostId || null,
    partyId: partyId || null,
    inviteToken,
    peerId,
    alias: alias || 'Unknown',
    offer: offer || null,
    answer: null,
    iceCandidates: [],
    connectionState: CONNECTION_STATES.PENDING,
    lastHeartbeat: Date.now(),
    createdAt: Date.now()
  }

  sessionRegistry.set(key, session)
  return session
}

export function getWebRTCSession(inviteToken, peerId) {
  return sessionRegistry.get(buildSessionKey(inviteToken, peerId)) || null
}

export function setSessionAnswer(inviteToken, peerId, answer) {
  const session = getWebRTCSession(inviteToken, peerId)
  if (!session) {
    return null
  }

  session.answer = answer
  session.connectionState = CONNECTION_STATES.CONNECTED
  session.lastHeartbeat = Date.now()
  return session
}

export function addSessionIceCandidate(inviteToken, peerId, candidate) {
  const session = getWebRTCSession(inviteToken, peerId)
  if (!session) {
    return null
  }

  session.iceCandidates.push(candidate)
  session.lastHeartbeat = Date.now()
  return session
}

export function updateSessionHeartbeat(inviteToken, peerId) {
  const session = getWebRTCSession(inviteToken, peerId)
  if (!session) {
    return null
  }

  session.lastHeartbeat = Date.now()
  return session
}

export function markSessionDisconnected(inviteToken, peerId) {
  const session = getWebRTCSession(inviteToken, peerId)
  if (!session) {
    return null
  }

  session.connectionState = CONNECTION_STATES.DISCONNECTED
  session.lastHeartbeat = Date.now()
  return session
}

export function destroyWebRTCSession(inviteToken, peerId) {
  return sessionRegistry.delete(buildSessionKey(inviteToken, peerId))
}

export function listSessionsByHost(hostId) {
  return Array.from(sessionRegistry.values()).filter(
    (session) => session.hostId === hostId
  )
}

export function listPendingSessionsForHost(hostId) {
  return listSessionsByHost(hostId).filter(
    (session) => session.connectionState === CONNECTION_STATES.PENDING
  )
}

export const WebRTCConnectionStates = CONNECTION_STATES
