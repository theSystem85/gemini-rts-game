import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import '../setup.js'

vi.mock('../../src/gameState.js', () => ({
  gameState: {
    multiplayerSession: {
      status: 'idle',
      alias: null,
      inviteToken: null,
      isRemote: false
    }
  }
}))

vi.mock('../../src/network/multiplayerStore.js', () => ({
  generateRandomId: vi.fn(() => 'peer-1')
}))

vi.mock('../../src/network/multiplayerSessionEvents.js', () => ({
  emitMultiplayerSessionChange: vi.fn()
}))

vi.mock('../../src/network/gameCommandSync.js', () => ({
  updateNetworkStats: vi.fn()
}))

vi.mock('../../src/network/signalling.js', () => ({
  postOffer: vi.fn().mockResolvedValue(),
  postCandidate: vi.fn().mockResolvedValue(),
  fetchSessionStatus: vi.fn()
}))

import {
  createRemoteConnection,
  getActiveRemoteConnection,
  RemoteConnectionStatus
} from '../../src/network/remoteConnection.js'
import { gameState } from '../../src/gameState.js'
import { generateRandomId } from '../../src/network/multiplayerStore.js'
import { emitMultiplayerSessionChange } from '../../src/network/multiplayerSessionEvents.js'
import { updateNetworkStats } from '../../src/network/gameCommandSync.js'
import { fetchSessionStatus, postCandidate, postOffer } from '../../src/network/signalling.js'

class MockRTCDataChannel {
  constructor() {
    this.readyState = 'connecting'
    this.listeners = {}
    this.send = vi.fn()
    this.close = vi.fn(() => {
      this.readyState = 'closed'
      this.trigger('close')
    })
  }

  addEventListener(event, callback) {
    this.listeners[event] = callback
  }

  trigger(event, payload) {
    if (this.listeners[event]) {
      this.listeners[event](payload)
    }
  }
}

class MockRTCPeerConnection {
  constructor(config) {
    this.config = config
    this.listeners = {}
    this.connectionState = 'new'
    this.dataChannel = new MockRTCDataChannel()
    this.createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'fake-sdp' })
    this.setLocalDescription = vi.fn().mockResolvedValue()
    this.setRemoteDescription = vi.fn().mockResolvedValue()
    this.addIceCandidate = vi.fn().mockResolvedValue()
    this.createDataChannel = vi.fn().mockReturnValue(this.dataChannel)
    this.close = vi.fn()
  }

  addEventListener(event, callback) {
    this.listeners[event] = callback
  }

  trigger(event, payload) {
    if (this.listeners[event]) {
      this.listeners[event](payload)
    }
  }
}

const createConnection = (overrides = {}) => {
  return createRemoteConnection({
    inviteToken: 'invite-123',
    alias: '  Player One  ',
    ...overrides
  })
}

describe('remoteConnection (peerConnection task)', () => {
  beforeEach(() => {
    globalThis.RTCPeerConnection = MockRTCPeerConnection
    gameState.multiplayerSession = {
      status: 'idle',
      alias: null,
      inviteToken: null,
      isRemote: false
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires an invite token and trims the alias', () => {
    expect(() => createRemoteConnection({ alias: 'Player' })).toThrow('Invite token is required')

    const connection = createConnection()
    expect(connection.alias).toBe('Player One')
    expect(connection.connectionState).toBe(RemoteConnectionStatus.IDLE)
  })

  it('starts a connection and publishes the offer', async() => {
    const onStatusChange = vi.fn()
    const onDataChannelOpen = vi.fn()

    const connection = createConnection({ onStatusChange, onDataChannelOpen })
    await connection.start()

    expect(generateRandomId).toHaveBeenCalledWith('peer')
    expect(postOffer).toHaveBeenCalledWith({
      inviteToken: 'invite-123',
      alias: 'Player One',
      peerId: 'peer-1',
      offer: JSON.stringify({ type: 'offer', sdp: 'fake-sdp' })
    })
    expect(connection.connectionState).toBe(RemoteConnectionStatus.CONNECTING)
    expect(onStatusChange).toHaveBeenCalledWith(RemoteConnectionStatus.CONNECTING)

    connection.dataChannel.trigger('open')
    expect(onDataChannelOpen).toHaveBeenCalled()

    expect(gameState.multiplayerSession).toMatchObject({
      status: RemoteConnectionStatus.CONNECTING,
      alias: 'Player One',
      inviteToken: 'invite-123',
      isRemote: true,
      localRole: 'client'
    })
    expect(emitMultiplayerSessionChange).toHaveBeenCalled()
  })

  it('sends payloads over an open data channel and tracks bytes', () => {
    const connection = createConnection()
    connection.dataChannel = new MockRTCDataChannel()
    connection.dataChannel.readyState = 'open'

    connection.send({ action: 'ping' })
    expect(connection.dataChannel.send).toHaveBeenCalledWith('{"action":"ping"}')
    expect(updateNetworkStats).toHaveBeenCalledWith('{"action":"ping"}'.length, 0)

    connection.send('hello')
    expect(connection.dataChannel.send).toHaveBeenCalledWith('hello')
    expect(updateNetworkStats).toHaveBeenCalledWith('hello'.length, 0)
  })

  it('applies answers and processes remote candidates', async() => {
    const connection = createConnection()
    connection.peerId = 'peer-1'
    connection.pc = new MockRTCPeerConnection()
    connection.pendingRemoteCandidates = [{ sdpMid: '0', sdpMLineIndex: 0 }]

    fetchSessionStatus.mockResolvedValue({
      answer: JSON.stringify({ type: 'answer', sdp: 'remote-sdp' }),
      candidates: [
        { candidate: JSON.stringify({ sdpMid: '0', sdpMLineIndex: 0 }), origin: 'peer' },
        { candidate: JSON.stringify({ sdpMid: '0', sdpMLineIndex: 0 }), origin: 'host' },
        { candidate: JSON.stringify({}), origin: 'host' }
      ]
    })

    await connection._synchronizeSession()

    expect(connection.pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'remote-sdp' })
    expect(connection.answerApplied).toBe(true)
    expect(connection.pc.addIceCandidate).toHaveBeenCalledTimes(2)
  })

  it('posts ICE candidates and updates status on connection state changes', () => {
    const connection = createConnection()
    connection.peerId = 'peer-1'
    connection.pc = new MockRTCPeerConnection()

    connection._preconfigurePeerConnection()

    connection.pc.trigger('icecandidate', { candidate: { candidate: 'ice' } })
    expect(postCandidate).toHaveBeenCalledWith({
      inviteToken: 'invite-123',
      peerId: 'peer-1',
      candidate: JSON.stringify({ candidate: 'ice' })
    })

    connection.pc.connectionState = 'connected'
    connection.pc.trigger('connectionstatechange')
    expect(connection.connectionState).toBe(RemoteConnectionStatus.CONNECTED)
    expect(gameState.multiplayerSession.connectedAt).toEqual(expect.any(Number))

    connection.pc.connectionState = 'failed'
    connection.pc.trigger('connectionstatechange')
    expect(connection.connectionState).toBe(RemoteConnectionStatus.FAILED)
  })

  it('stops connections and clears the active instance', async() => {
    const connection = createConnection()
    connection.dataChannel = new MockRTCDataChannel()
    connection.pc = new MockRTCPeerConnection()

    await connection.stop()

    expect(connection.dataChannel).toBeNull()
    expect(connection.pc).toBeNull()
    expect(getActiveRemoteConnection()).toBeNull()
    expect(gameState.multiplayerSession).toMatchObject({
      isRemote: false,
      inviteToken: null,
      alias: null,
      connectedAt: null
    })
  })

  it('stops polling after repeated synchronization failures', async() => {
    vi.useFakeTimers()
    const connection = createConnection({ pollInterval: 100 })
    connection._synchronizeSession = vi.fn().mockRejectedValue(new Error('fail'))
    connection.maxSyncFailures = 3 // Ensure it stops after 3 failures

    connection._beginPolling()

    // Advance timers incrementally to process multiple polling iterations
    // instead of using runAllTimersAsync which can hang on recursive timers
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(200)
    }

    expect(connection.connectionState).toBe(RemoteConnectionStatus.FAILED)
    expect(connection.pollActive).toBe(false)

    vi.useRealTimers()
  })
})
