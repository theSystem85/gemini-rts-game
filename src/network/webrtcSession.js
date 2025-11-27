import { gameState } from '../gameState.js'
import { markPartyControlledByHuman, markPartyControlledByAi } from './multiplayerStore.js'
import { showHostNotification } from './hostNotifications.js'
import { applyRemoteControlSnapshot, releaseRemoteControlSource } from '../input/remoteControlState.js'
import { emitMultiplayerSessionChange } from './multiplayerSessionEvents.js'
import { fetchPendingSessions, postAnswer, postCandidate } from './signalling.js'
import { handleReceivedCommand, startGameStateSync, stopGameStateSync, updateNetworkStats, notifyClientConnected } from './gameCommandSync.js'

const DEFAULT_POLL_INTERVAL_MS = 2000
const DEFAULT_HOST_STATUS_INTERVAL_MS = 1500
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const _AI_FALLBACK_DELAY_MS = 2000 // 2 seconds per spec requirement

// Event type for AI reactivation
export const AI_REACTIVATION_EVENT = 'partyAiReactivated'

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
  emitMultiplayerSessionChange()
}

/**
 * Emit an AI reactivation event so AI controllers can reinitialize
 * @param {string} partyId - The party that has returned to AI control
 */
function emitAiReactivation(partyId) {
  if (typeof document === 'undefined') {
    return
  }
  document.dispatchEvent(new CustomEvent(AI_REACTIVATION_EVENT, {
    detail: { partyId, timestamp: Date.now() }
  }))
}

/**
 * Subscribe to AI reactivation events
 * @param {Function} handler - Callback function receiving the event
 * @returns {Function} Cleanup function to unsubscribe
 */
export function observeAiReactivation(handler) {
  if (typeof document === 'undefined' || typeof handler !== 'function') {
    return () => {}
  }
  document.addEventListener(AI_REACTIVATION_EVENT, handler)
  return () => document.removeEventListener(AI_REACTIVATION_EVENT, handler)
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
      const message = JSON.stringify(payload)
      const byteLength = message.length
      updateNetworkStats(byteLength, 0)
      this.dataChannel.send(message)
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
      console.log('[HostSession] Raw message received from client:', event.data?.substring?.(0, 200) || event.data)
      // Track bytes received
      const byteLength = typeof event.data === 'string' ? event.data.length : event.data.byteLength || 0
      updateNetworkStats(0, byteLength)
      
      let payload = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch (err) {
          console.warn('[HostSession] Failed to parse message as JSON:', err)
          payload = null
        }
      }
      if (payload) {
        console.log('[HostSession] Parsed payload type:', payload.type)
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
      } catch {
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
      // 404 is expected when no client has joined yet - suppress the warning
      if (err?.message?.includes('404')) {
        // No pending sessions yet - this is normal before any client joins
        return
      }
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
      
      // Notify that a new client connected so mapGrid will be sent in snapshots
      notifyClientConnected()
      
      // Start game state synchronization when a player connects
      startGameStateSync()
    } else if (state === SESSION_STATES.DISCONNECTED || state === SESSION_STATES.FAILED) {
      const wasActiveSession = this.activeSession === session
      if (wasActiveSession) {
        this.activeSession = null
      }
      releaseRemoteControlSource(session.sourceId)
      
      // T016: AI fallback on disconnect - flip aiActive to true and emit event
      const previousAlias = session.alias || 'Remote client'
      markPartyControlledByAi(this.partyId)
      
      // Emit AI reactivation event so AI controllers can reinitialize immediately
      emitAiReactivation(this.partyId)
      
      // Show re-activation notification per spec requirement
      showHostNotification(`${previousAlias} disconnected from party ${this.partyId} - AI has resumed control`)
      
      updateGlobalSession({ alias: null, isRemote: false, status: SESSION_STATES.DISCONNECTED })
      session.dispose()
      this.sessions.delete(session.peerId)
      
      // Check if any sessions are still active, if not stop the game state sync
      const hasActiveSessions = Array.from(this.sessions.values()).some(
        s => s.connectionState === SESSION_STATES.CONNECTED
      )
      if (!hasActiveSessions) {
        stopGameStateSync()
      }
      
      // The invite token remains valid - new players can rejoin immediately
      // No need to regenerate tokens on disconnect, only on save/load handover
    }
  }

  _handleControlMessage(session, payload) {
    if (!payload) {
      return
    }
    
    console.log('[Host WebRTC] Received control message:', payload.type, payload)
    
    // Handle game command synchronization messages
    if (payload.type === 'game-command') {
      console.log('[Host WebRTC] Forwarding game-command to handleReceivedCommand')
      handleReceivedCommand(payload, session.sourceId)
      return
    }
    
    // Handle remote control messages
    if (payload.type !== 'remote-control') {
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
