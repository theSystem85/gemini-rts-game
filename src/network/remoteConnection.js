import { gameState } from '../gameState.js'
import { generateRandomId } from './multiplayerStore.js'
import { emitMultiplayerSessionChange } from './multiplayerSessionEvents.js'
import { handleReceivedCommand } from './gameCommandSync.js'
import {
  postOffer,
  postCandidate,
  fetchSessionStatus
} from './signalling.js'

const DEFAULT_POLL_INTERVAL_MS = 2500
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export const RemoteConnectionStatus = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected'
}

let activeRemoteConnection = null

function normalizeAlias(alias = '') {
  const trimmed = alias.trim()
  if (!trimmed) {
    throw new Error('Remote alias is required')
  }
  return trimmed
}

function updateSessionState(updates) {
  gameState.multiplayerSession = {
    ...gameState.multiplayerSession,
    ...updates
  }
  emitMultiplayerSessionChange()
}

class RemoteConnection {
  constructor({ inviteToken, alias, rtcConfig = {}, pollInterval = DEFAULT_POLL_INTERVAL_MS, onStatusChange, onDataChannelOpen, onDataChannelMessage, onDataChannelClose }) {
    if (!inviteToken) {
      throw new Error('Invite token is required for remote connection')
    }

    this.inviteToken = inviteToken
    this.alias = normalizeAlias(alias)
    this.pollInterval = pollInterval
    this.onStatusChange = typeof onStatusChange === 'function' ? onStatusChange : () => {}
    this.onDataChannelOpen = typeof onDataChannelOpen === 'function' ? onDataChannelOpen : () => {}
    this.onDataChannelMessage = typeof onDataChannelMessage === 'function' ? onDataChannelMessage : () => {}
    this.onDataChannelClose = typeof onDataChannelClose === 'function' ? onDataChannelClose : () => {}
    this.rtcConfig = {
      ...rtcConfig,
      iceServers: rtcConfig?.iceServers || DEFAULT_ICE_SERVERS
    }

    this.connectionState = RemoteConnectionStatus.IDLE
    this.peerId = null
    this.pc = null
    this.dataChannel = null
    this.pollHandle = null
    this.pollActive = false
    this.remoteCandidateIndex = 0
    this.pendingRemoteCandidates = []
    this.answerApplied = false
    this.pollErrorCount = 0
  }

  async start() {
    if (this.connectionState !== RemoteConnectionStatus.IDLE) {
      return this
    }

    this.peerId = generateRandomId('peer')
    this.pc = new RTCPeerConnection(this.rtcConfig)
    this._preconfigurePeerConnection()
    this._updateStatus(RemoteConnectionStatus.CONNECTING)
    this._attachDataChannel()

    await this._publishOffer()
    this._beginPolling()
    return this
  }

  async stop() {
    this._stopPolling()
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    this._updateStatus(RemoteConnectionStatus.DISCONNECTED)
    updateSessionState({ isRemote: false, inviteToken: null, alias: null, connectedAt: null })
    activeRemoteConnection = null
  }

  send(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data))
      } catch (err) {
        console.warn('Failed to send remote data:', err)
      }
    }
  }

  _preconfigurePeerConnection() {
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
        candidate: JSON.stringify(event.candidate)
      }).catch((err) => {
        console.warn('Failed to send ICE candidate to STUN helper:', err)
      })
    })

    this.pc.addEventListener('connectionstatechange', () => {
      if (!this.pc) {
        return
      }
      const state = this.pc.connectionState
      if (state === 'connected') {
        this._updateStatus(RemoteConnectionStatus.CONNECTED)
        updateSessionState({ connectedAt: Date.now() })
      } else if (state === 'failed') {
        this._updateStatus(RemoteConnectionStatus.FAILED)
      } else if (state === 'disconnected' || state === 'closed') {
        if (this.connectionState === RemoteConnectionStatus.CONNECTED) {
          this._updateStatus(RemoteConnectionStatus.DISCONNECTED)
        }
        this._stopPolling()
      }
    })
  }

  _attachDataChannel() {
    if (!this.pc) {
      return
    }

    this.dataChannel = this.pc.createDataChannel('remote-control')
    this.dataChannel.addEventListener('open', () => {
      this.onDataChannelOpen()
    })
    this.dataChannel.addEventListener('message', (event) => {
      this.onDataChannelMessage(event.data)
    })
    this.dataChannel.addEventListener('close', () => {
      this.onDataChannelClose()
    })
  }

  async _publishOffer() {
    if (!this.pc) {
      throw new Error('Peer connection unavailable when publishing offer')
    }

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    await postOffer({
      inviteToken: this.inviteToken,
      alias: this.alias,
      peerId: this.peerId,
      offer: JSON.stringify(offer)
    })

    updateSessionState({
      isRemote: true,
      alias: this.alias,
      inviteToken: this.inviteToken,
      status: RemoteConnectionStatus.CONNECTING,
      connectedAt: null,
      localRole: 'client'
    })
  }

  _beginPolling() {
    this.pollActive = true
    const tick = async () => {
      if (!this.pollActive) {
        return
      }

      try {
        await this._synchronizeSession()
        this.pollErrorCount = 0
      } catch (err) {
        this.pollErrorCount += 1
        console.warn('Remote session polling failed:', err)
        if (this.pollErrorCount >= 3) {
          this._updateStatus(RemoteConnectionStatus.FAILED)
          this._stopPolling()
          return
        }
      }

      if (this.pollActive) {
        this.pollHandle = setTimeout(tick, this.pollInterval)
      }
    }

    tick()
  }

  _stopPolling() {
    this.pollActive = false
    if (this.pollHandle) {
      clearTimeout(this.pollHandle)
      this.pollHandle = null
    }
  }

  async _synchronizeSession() {
    if (!this.peerId) {
      return
    }

    const payload = await fetchSessionStatus(this.inviteToken, this.peerId)
    if (payload.answer && !this.answerApplied) {
      try {
        const answer = typeof payload.answer === 'string' ? JSON.parse(payload.answer) : payload.answer
        if (answer) {
          await this.pc.setRemoteDescription(answer)
          this.answerApplied = true
          this._processPendingCandidates()
        }
      } catch (err) {
        console.warn('Failed to apply remote answer:', err)
      }
    }

    const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
    for (let i = this.remoteCandidateIndex; i < candidates.length; i += 1) {
      const candidateValue = candidates[i]
      const parsed = typeof candidateValue === 'string' ? JSON.parse(candidateValue) : candidateValue
      this.remoteCandidateIndex += 1
      await this._safeAddRemoteCandidate(parsed)
    }
  }

  async _safeAddRemoteCandidate(candidate) {
    if (!candidate || !this.pc) {
      return
    }

    if (!candidate.sdpMid && candidate.sdpMLineIndex == null) {
      console.warn('Skipping ICE candidate without sdpMid/mLineIndex', candidate)
      return
    }

    await this._addRemoteCandidate(candidate)
  }

  async _addRemoteCandidate(candidate) {
    if (!candidate || !this.pc) {
      return
    }

    if (!this.answerApplied) {
      this.pendingRemoteCandidates.push(candidate)
      return
    }

    try {
      await this.pc.addIceCandidate(candidate)
    } catch (err) {
      console.warn('Failed to add ICE candidate to peer connection:', err)
    }
  }

  _processPendingCandidates() {
    if (!this.pendingRemoteCandidates.length) {
      return
    }

    this.pendingRemoteCandidates.forEach((candidate) => {
      if (!candidate.sdpMid && candidate.sdpMLineIndex == null) {
        console.warn('Skipping queued ICE candidate without sdpMid/mLineIndex', candidate)
        return
      }
      this.pc.addIceCandidate(candidate).catch((err) => {
        console.warn('Failed to add queued ICE candidate:', err)
      })
    })
    this.pendingRemoteCandidates = []
  }

  _updateStatus(status) {
    if (this.connectionState === status) {
      return
    }
    this.connectionState = status
    this.onStatusChange(status)
    updateSessionState({ status })
  }
}

export function createRemoteConnection(options) {
  if (activeRemoteConnection) {
    activeRemoteConnection.stop()
  }
  activeRemoteConnection = new RemoteConnection(options)
  return activeRemoteConnection
}

export function getActiveRemoteConnection() {
  return activeRemoteConnection
}
