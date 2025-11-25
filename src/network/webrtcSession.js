import { gameState } from '../gameState.js'
import { markPartyControlledByHuman, markPartyControlledByAi } from './multiplayerStore.js'
import { showHostNotification } from './hostNotifications.js'
import { applyRemoteControlSnapshot, releaseRemoteControlSource } from '../input/remoteControlState.js'
import { fetchPendingSessions, postAnswer, postCandidate } from './signalling.js'

const DEFAULT_POLL_INTERVAL_MS = 2000
const DEFAULT_HOST_STATUS_INTERVAL_MS = 1500
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

const SESSION_STATES = {
  PENDING: 'pending',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
}

function updateGlobalSession(updates) {
  gameState.multiplayerSession = {
    ...gameState.multiplayerSession,
    ...updates
  }
}

class HostSession {
  constructor({ inviteToken, peerId, alias, partyId, rtcConfig, onStateChange, onControlMessage }) {
    this.inviteToken = inviteToken
    this.peerId = peerId
    this.alias = alias || 'Remote'
    this.partyId = partyId
    this.sourceId = `remote-${partyId}-${peerId}`
    this.connectionState = SESSION_STATES.PENDING
    this.candidateCursor = 0
    this.pendingCandidates = []
    this.answerSent = false
    this.dataChannel = null
    this.pc = new RTCPeerConnection(rtcConfig)
    this.onStateChange = onStateChange
    this.onControlMessage = onControlMessage
    this._setupPeerConnection()
  }

  async answerOffer(offerPayload) {
    if (!this.pc || this.answerSent || !offerPayload) {
      return
    }

    const offer = typeof offerPayload === 'string' ? JSON.parse(offerPayload) : offerPayload
    await this.pc.setRemoteDescription(offer)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    await postAnswer({
      inviteToken: this.inviteToken,
      peerId: this.peerId,
      answer: JSON.stringify(answer)
    })
    this.answerSent = true
    this._flushPendingCandidates()
  }

  processCandidateEntries(entries) {
    if (!Array.isArray(entries) || !this.pc) {
      return
    }
    for (let i = this.candidateCursor; i < entries.length; i += 1) {
      const entry = this._normalizeCandidateEntry(entries[i])
      this.candidateCursor = i + 1
      if (!entry || entry.origin !== 'peer') {
        continue
      }
      this._addIceCandidate(entry.candidate)
    }
  }

  sendHostStatus(payload) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return
    }
    try {
      this.dataChannel.send(JSON.stringify(payload))
    } catch (err) {
      console.warn('Failed to send host status message:', err)
    }
  }

  dispose() {
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
  }

  _setupPeerConnection() {
    if (!this.pc) {
      return
    }

    this.pc.addEventListener('icecandidate', (event) => {
      if (!event.candidate) {
        return
      }
      postCandidate({
        inviteToken: this.inviteToken,
        peerId: this.peerId,
        candidate: JSON.stringify(event.candidate),
        origin: 'host'
      }).catch((err) => {
        console.warn('Failed to post host ICE candidate:', err)
      })
    })

    this.pc.addEventListener('connectionstatechange', () => {
      if (!this.pc) {
        return
      }
      const state = this.pc.connectionState
      let normalized = SESSION_STATES.PENDING
      if (state === 'connected') {
        normalized = SESSION_STATES.CONNECTED
      } else if (state === 'disconnected') {
        normalized = SESSION_STATES.DISCONNECTED
      } else if (state === 'failed' || state === 'closed') {
        normalized = SESSION_STATES.FAILED
      }
      if (this.connectionState !== normalized) {
        this.connectionState = normalized
        this.onStateChange?.(this, normalized)
      }
    })

    this.pc.addEventListener('datachannel', (event) => {
      this._attachDataChannel(event.channel)
    })
  }

  _attachDataChannel(channel) {
    if (!channel) {
      return
    }
    this.dataChannel = channel
    this.dataChannel.addEventListener('message', (event) => {
      let payload = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch (err) {
          payload = null
        }
      }
      if (payload) {
        this.onControlMessage?.(this, payload)
      }
    })
    this.dataChannel.addEventListener('close', () => {
      this.onStateChange?.(this, SESSION_STATES.DISCONNECTED)
    })
  }

  _addIceCandidate(candidate) {
    if (!candidate || !this.pc) {
      return
    }

    if (!this.answerSent) {
      this.pendingCandidates.push(candidate)
      return
    }
    this.pc.addIceCandidate(candidate).catch((err) => {
      console.warn('Failed to add ICE candidate to host session:', err)
    })
  }

  _flushPendingCandidates() {
    if (!this.pendingCandidates.length || !this.pc) {
      return
    }
    this.pendingCandidates.forEach((candidate) => {
      this.pc.addIceCandidate(candidate).catch((err) => {
        console.warn('Failed to add queued host ICE candidate:', err)
      })
    })
    this.pendingCandidates = []
  }

  _normalizeCandidateEntry(entry) {
    if (!entry) {
      return null
    }
    if (typeof entry === 'string') {
      try {
        return {
          candidate: JSON.parse(entry),
          origin: 'peer'
        }
      } catch (err) {
        return null
      }
    }
    const candidatePayload = typeof entry.candidate === 'string' ? JSON.parse(entry.candidate) : entry.candidate
    return {
      candidate: candidatePayload,
      origin: entry.origin || 'peer'
    }
  }
}

class HostInviteMonitor {
  constructor({ partyId, inviteToken, rtcConfig = {}, pollInterval = DEFAULT_POLL_INTERVAL_MS }) {
    this.partyId = partyId
    this.inviteToken = inviteToken
    this.rtcConfig = {
      iceServers: rtcConfig?.iceServers || DEFAULT_ICE_SERVERS
    }
    this.pollInterval = pollInterval
    this.sessions = new Map()
    this.pollHandle = null
    this.statusHandle = null
    this.running = false
    this.activeSession = null
  }

  start() {
    if (this.running || !this.inviteToken) {
      return
    }
    this.running = true
    this._schedulePoll()
    this._startStatusBroadcast()
  }

  stop() {
    this.running = false
    this._stopPolling()
    this._stopStatusBroadcast()
    this.sessions.forEach((session) => {
      session.dispose()
      releaseRemoteControlSource(session.sourceId)
    })
    this.sessions.clear()
    this.activeSession = null
    updateGlobalSession({ status: SESSION_STATES.DISCONNECTED, isRemote: false, alias: null })
  }

  setInviteToken(token) {
    if (this.inviteToken === token) {
      return
    }
    this.stop()
    this.inviteToken = token
    if (token) {
      this.start()
    }
  }

  _schedulePoll() {
    const tick = async () => {
      if (!this.running) {
        return
      }
      await this._pollSessions()
      if (this.running) {
        this.pollHandle = setTimeout(tick, this.pollInterval)
      }
    }
    tick()
  }

  _stopPolling() {
    if (this.pollHandle) {
      clearTimeout(this.pollHandle)
      this.pollHandle = null
    }
  }

  async _pollSessions() {
    if (!this.inviteToken) {
      return
    }
    try {
      const entries = await fetchPendingSessions(this.inviteToken)
      entries.forEach((entry) => this._processEntry(entry))
    } catch (err) {
      console.warn('Host polling failed:', err)
    }
  }

  _processEntry(entry) {
    if (!entry || !entry.peerId || !entry.offer) {
      return
    }
    let session = this.sessions.get(entry.peerId)
    if (!session) {
      session = new HostSession({
        inviteToken: this.inviteToken,
        peerId: entry.peerId,
        alias: entry.alias,
        partyId: this.partyId,
        rtcConfig: this.rtcConfig,
        onStateChange: (s, state) => this._handleSessionState(s, state),
        onControlMessage: (s, payload) => this._handleControlMessage(s, payload)
      })
      this.sessions.set(entry.peerId, session)
      session.answerOffer(entry.offer).catch((err) => {
        console.warn('Failed to answer remote offer:', err)
      })
    } else if (entry.alias && entry.alias !== session.alias) {
      session.alias = entry.alias
    }
    session.processCandidateEntries(entry.candidates)
  }

  _handleSessionState(session, state) {
    if (state === SESSION_STATES.CONNECTED) {
      this.activeSession = session
      markPartyControlledByHuman(this.partyId, session.alias)
      showHostNotification(`${session.alias || 'Remote client'} connected to party ${this.partyId}`)
      updateGlobalSession({
        isRemote: true,
        alias: session.alias,
        inviteToken: this.inviteToken,
        status: SESSION_STATES.CONNECTED,
        connectedAt: Date.now()
      })
    } else if (state === SESSION_STATES.DISCONNECTED || state === SESSION_STATES.FAILED) {
      if (this.activeSession === session) {
        this.activeSession = null
      }
      releaseRemoteControlSource(session.sourceId)
      markPartyControlledByAi(this.partyId)
      showHostNotification(`Remote session for party ${this.partyId} ended`)
      updateGlobalSession({ alias: null, isRemote: false, status: SESSION_STATES.DISCONNECTED })
      session.dispose()
      this.sessions.delete(session.peerId)
    }
  }

  _handleControlMessage(session, payload) {
    if (!payload || payload.type !== 'remote-control') {
      return
    }
    applyRemoteControlSnapshot(session.sourceId, payload)
  }

  _startStatusBroadcast() {
    this.statusHandle = setInterval(() => {
      const running = !gameState.gamePaused
      const payload = {
        type: 'host-status',
        running,
        paused: gameState.gamePaused,
        started: Boolean(gameState.gameStarted),
        timestamp: Date.now()
      }
      this.sessions.forEach((session) => session.sendHostStatus(payload))
    }, DEFAULT_HOST_STATUS_INTERVAL_MS)
  }

  _stopStatusBroadcast() {
    if (this.statusHandle) {
      clearInterval(this.statusHandle)
      this.statusHandle = null
    }
  }
}

const inviteMonitors = new Map()

export function watchHostInvite({ partyId, inviteToken }) {
  if (!partyId) {
    return null
  }
  if (!inviteToken) {
    const existing = inviteMonitors.get(partyId)
    if (existing) {
      existing.stop()
      inviteMonitors.delete(partyId)
    }
    return null
  }

  let monitor = inviteMonitors.get(partyId)
  if (monitor) {
    monitor.setInviteToken(inviteToken)
    return monitor
  }

  monitor = new HostInviteMonitor({ partyId, inviteToken })
  inviteMonitors.set(partyId, monitor)
  monitor.start()
  return monitor
}

export function stopHostInvite(partyId) {
  const monitor = inviteMonitors.get(partyId)
  if (monitor) {
    monitor.stop()
    inviteMonitors.delete(partyId)
  }
}

export function getActiveHostMonitor(partyId) {
  return inviteMonitors.get(partyId) || null
}
