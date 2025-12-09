/**
 * Deterministic Lockstep Manager
 * 
 * Coordinates the lockstep simulation between peers in a multiplayer session.
 * All peers run identical simulations driven by shared input commands,
 * verified by periodic state hash comparisons.
 */

import { gameState } from '../gameState.js'
import { deterministicRNG, initializeSessionRNG, syncRNGForTick } from './deterministicRandom.js'
import { InputBuffer, INPUT_DELAY_TICKS } from './inputBuffer.js'
import { computeStateHash, compareHashes } from './stateHash.js'

// Lockstep configuration
export const LOCKSTEP_CONFIG = {
  // Simulation tick rate in Hz (ticks per second)
  TICK_RATE: 20,
  
  // Maximum ticks that can be simulated in one frame (catch-up limit)
  MAX_TICKS_PER_FRAME: 5,
  
  // How often to exchange state hashes (in ticks)
  HASH_EXCHANGE_INTERVAL: 10,
  
  // Maximum tick difference allowed before triggering resync
  MAX_TICK_DRIFT: 3,
  
  // Number of ticks to keep in history for rollback
  HISTORY_LENGTH: 60,
  
  // Timeout for waiting on remote inputs (ms)
  INPUT_TIMEOUT_MS: 500
}

// Calculate milliseconds per tick
export const MS_PER_TICK = 1000 / LOCKSTEP_CONFIG.TICK_RATE

/**
 * Lockstep state for a peer
 */
class PeerLockstepState {
  constructor(peerId) {
    this.peerId = peerId
    this.lastConfirmedTick = 0
    this.lastReceivedTick = 0
    this.lastHashTick = 0
    this.lastHash = null
    this.inputBuffer = new InputBuffer()
    this.latencyMs = 0
    this.isConnected = true
    this.isDesynced = false
  }
}

/**
 * Lockstep Manager class
 * Manages deterministic simulation synchronization between peers
 */
class LockstepManager {
  constructor() {
    // Current simulation tick
    this._currentTick = 0
    
    // Target tick based on elapsed time
    this._targetTick = 0
    
    // Last time we updated ticks
    this._lastTickTime = 0
    
    // Time accumulator for sub-tick timing
    this._accumulator = 0
    
    // Whether lockstep mode is enabled
    this._enabled = false
    
    // Session seed for deterministic RNG
    this._sessionSeed = null
    
    // Local peer ID
    this._localPeerId = null
    
    // Map of peer states
    this._peers = new Map()
    
    // Local input buffer
    this._localInputBuffer = new InputBuffer()
    
    // State history for rollback (circular buffer)
    this._stateHistory = []
    this._historyIndex = 0
    
    // Hash exchange tracking
    this._lastHashExchangeTick = 0
    this._pendingHashComparisons = new Map()
    
    // Callbacks
    this._onInputReceived = null
    this._onDesyncDetected = null
    this._onTickAdvanced = null
    
    // Statistics
    this._stats = {
      totalTicks: 0,
      rollbackCount: 0,
      desyncCount: 0,
      avgTickLatency: 0
    }
  }

  /**
   * Initialize lockstep for a multiplayer session
   * @param {string} sessionSeed - Shared seed for deterministic RNG
   * @param {string} localPeerId - Local peer identifier
   * @param {Array<string>} peerIds - All peer IDs in the session
   */
  initialize(sessionSeed, localPeerId, peerIds = []) {
    this._sessionSeed = sessionSeed
    this._localPeerId = localPeerId
    this._currentTick = 0
    this._targetTick = 0
    this._lastTickTime = performance.now()
    this._accumulator = 0
    
    // Initialize deterministic RNG
    initializeSessionRNG(sessionSeed, true)
    
    // Initialize peer states
    this._peers.clear()
    peerIds.forEach(peerId => {
      if (peerId !== localPeerId) {
        this._peers.set(peerId, new PeerLockstepState(peerId))
      }
    })
    
    // Clear history
    this._stateHistory = []
    this._historyIndex = 0
    
    // Reset stats
    this._stats = {
      totalTicks: 0,
      rollbackCount: 0,
      desyncCount: 0,
      avgTickLatency: 0
    }
    
    window.logger?.('[LockstepManager] Initialized with seed:', sessionSeed, 'peers:', peerIds)
  }

  /**
   * Enable lockstep mode
   */
  enable() {
    this._enabled = true
    this._lastTickTime = performance.now()
    deterministicRNG.enable()
    window.logger?.('[LockstepManager] Enabled')
  }

  /**
   * Disable lockstep mode
   */
  disable() {
    this._enabled = false
    deterministicRNG.disable()
    window.logger?.('[LockstepManager] Disabled')
  }

  /**
   * Check if lockstep mode is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this._enabled
  }

  /**
   * Get current simulation tick
   * @returns {number}
   */
  getCurrentTick() {
    return this._currentTick
  }

  /**
   * Advance to the next tick
   * Called after processing a tick from external game loop
   */
  advanceTick() {
    this._currentTick++
    this._stats.totalTicks++
  }

  /**
   * Queue a local input command for the current tick + input delay
   * @param {Object} command - Input command to queue
   */
  queueLocalInput(command) {
    const targetTick = this._currentTick + INPUT_DELAY_TICKS
    this._localInputBuffer.addInput(targetTick, {
      ...command,
      tick: targetTick,
      peerId: this._localPeerId,
      timestamp: performance.now()
    })
    
    // Broadcast to peers
    this._broadcastInput(targetTick, command)
  }

  /**
   * Receive an input command from a remote peer
   * @param {string} peerId - Peer that sent the input
   * @param {number} tick - Tick the input is for
   * @param {Object} command - The input command
   */
  receiveRemoteInput(peerId, tick, command) {
    const peer = this._peers.get(peerId)
    if (!peer) {
      window.logger?.warn('[LockstepManager] Received input from unknown peer:', peerId)
      return
    }
    
    peer.inputBuffer.addInput(tick, {
      ...command,
      tick,
      peerId,
      receivedAt: performance.now()
    })
    peer.lastReceivedTick = Math.max(peer.lastReceivedTick, tick)
    
    if (this._onInputReceived) {
      this._onInputReceived(peerId, tick, command)
    }
  }

  /**
   * Receive a state hash from a remote peer for verification
   * @param {string} peerId - Peer that sent the hash
   * @param {number} tick - Tick the hash is for
   * @param {string} hash - The state hash
   */
  receiveRemoteHash(peerId, tick, hash) {
    const peer = this._peers.get(peerId)
    if (!peer) return
    
    peer.lastHashTick = tick
    peer.lastHash = hash
    
    // Compare with our hash for this tick
    this._verifyHashForTick(tick, peerId, hash)
  }

  /**
   * Get all inputs for a specific tick
   * @param {number} tick - Tick to get inputs for
   * @returns {Array<Object>} All inputs for the tick from all peers
   */
  getInputsForTick(tick) {
    return this._collectInputsForTick(tick)
  }

  /**
   * Update the lockstep simulation - call this from the game loop
   * @param {number} timestamp - Current timestamp (performance.now())
   * @returns {Array<Object>} Inputs to process for current tick
   */
  update(timestamp) {
    if (!this._enabled) {
      return []
    }
    
    const now = timestamp || performance.now()
    const elapsed = now - this._lastTickTime
    this._lastTickTime = now
    
    // Accumulate time
    this._accumulator += elapsed
    
    // Calculate how many ticks we should advance
    const ticksToProcess = Math.min(
      Math.floor(this._accumulator / MS_PER_TICK),
      LOCKSTEP_CONFIG.MAX_TICKS_PER_FRAME
    )
    
    // Collect all inputs for ticks we're about to process
    const inputsToProcess = []
    
    for (let i = 0; i < ticksToProcess; i++) {
      // Check if we have all required inputs for this tick
      if (!this._canAdvanceTick()) {
        // Wait for inputs from other peers
        break
      }
      
      // Collect inputs for this tick
      const tickInputs = this._collectInputsForTick(this._currentTick)
      inputsToProcess.push(...tickInputs)
      
      // Sync RNG for this tick
      syncRNGForTick(this._currentTick)
      
      // Save state for potential rollback
      this._saveStateSnapshot()
      
      // Advance tick
      this._currentTick++
      this._accumulator -= MS_PER_TICK
      this._stats.totalTicks++
      
      // Check if we need to exchange hashes
      if (this._currentTick - this._lastHashExchangeTick >= LOCKSTEP_CONFIG.HASH_EXCHANGE_INTERVAL) {
        this._exchangeHash()
        this._lastHashExchangeTick = this._currentTick
      }
      
      if (this._onTickAdvanced) {
        this._onTickAdvanced(this._currentTick)
      }
    }
    
    return inputsToProcess
  }

  /**
   * Check if we have all inputs needed to advance to the next tick
   * @returns {boolean}
   */
  _canAdvanceTick() {
    // In single player or as host without clients, always can advance
    if (this._peers.size === 0) {
      return true
    }
    
    const requiredTick = this._currentTick
    
    // Check all peers have sent inputs for the required tick
    for (const [, peer] of this._peers) {
      if (!peer.isConnected) continue
      
      // Check if we have input from this peer for the required tick
      // Note: Missing input is OK if peer confirmed they had no input
      if (peer.lastReceivedTick < requiredTick - INPUT_DELAY_TICKS) {
        // Peer is too far behind - they might be lagging
        return false
      }
    }
    
    return true
  }

  /**
   * Collect all inputs for a specific tick
   * @param {number} tick - Tick to collect inputs for
   * @returns {Array<Object>}
   */
  _collectInputsForTick(tick) {
    const inputs = []
    
    // Get local inputs
    const localInputs = this._localInputBuffer.getInputsForTick(tick)
    inputs.push(...localInputs)
    
    // Get remote inputs
    for (const [, peer] of this._peers) {
      const peerInputs = peer.inputBuffer.getInputsForTick(tick)
      inputs.push(...peerInputs)
    }
    
    // Sort by peer ID for deterministic ordering
    inputs.sort((a, b) => (a.peerId || '').localeCompare(b.peerId || ''))
    
    return inputs
  }

  /**
   * Broadcast local input to all peers
   * @param {number} tick - Tick the input is for
   * @param {Object} command - The input command
   */
  _broadcastInput(tick, command) {
    // This would be called by gameCommandSync to send to peers
    // Implemented as a callback to avoid circular dependency
    if (typeof this._onBroadcastInput === 'function') {
      this._onBroadcastInput(tick, command)
    }
  }

  /**
   * Exchange state hash with peers
   */
  _exchangeHash() {
    const hash = computeStateHash(gameState, this._currentTick)
    
    // Store our hash
    this._pendingHashComparisons.set(this._currentTick, {
      localHash: hash,
      peerHashes: new Map(),
      tick: this._currentTick
    })
    
    // Broadcast to peers
    if (typeof this._onBroadcastHash === 'function') {
      this._onBroadcastHash(this._currentTick, hash)
    }
  }

  /**
   * Verify a received hash against our local state
   * @param {number} tick - Tick the hash is for
   * @param {string} peerId - Peer that sent the hash
   * @param {string} remoteHash - The received hash
   */
  _verifyHashForTick(tick, peerId, remoteHash) {
    const comparison = this._pendingHashComparisons.get(tick)
    if (!comparison) {
      // We don't have a hash for this tick yet - might be behind
      return
    }
    
    comparison.peerHashes.set(peerId, remoteHash)
    
    // Check if hash matches
    if (!compareHashes(comparison.localHash, remoteHash)) {
      window.logger?.warn('[LockstepManager] Hash mismatch at tick', tick, 
        'local:', comparison.localHash, 'peer:', peerId, 'remote:', remoteHash)
      
      this._stats.desyncCount++
      
      const peer = this._peers.get(peerId)
      if (peer) {
        peer.isDesynced = true
      }
      
      if (this._onDesyncDetected) {
        this._onDesyncDetected(tick, peerId, comparison.localHash, remoteHash)
      }
    } else {
      // Hashes match - peer is in sync
      const peer = this._peers.get(peerId)
      if (peer) {
        peer.isDesynced = false
        peer.lastConfirmedTick = tick
      }
    }
    
    // Clean up old comparisons
    for (const [t] of this._pendingHashComparisons) {
      if (t < tick - LOCKSTEP_CONFIG.HISTORY_LENGTH) {
        this._pendingHashComparisons.delete(t)
      }
    }
  }

  /**
   * Save a snapshot of current state for potential rollback
   */
  _saveStateSnapshot() {
    const snapshot = {
      tick: this._currentTick,
      rngState: deterministicRNG.getState(),
      // Note: Full state serialization would be expensive
      // For now we just track tick and RNG state
      // Full rollback would need to serialize entire gameState
      timestamp: performance.now()
    }
    
    // Circular buffer
    this._stateHistory[this._historyIndex] = snapshot
    this._historyIndex = (this._historyIndex + 1) % LOCKSTEP_CONFIG.HISTORY_LENGTH
  }

  /**
   * Rollback to a previous tick (expensive operation)
   * @param {number} tick - Tick to rollback to
   * @returns {boolean} Success
   */
  rollbackToTick(tick) {
    // Find the snapshot for the requested tick
    const snapshot = this._stateHistory.find(s => s && s.tick === tick)
    if (!snapshot) {
      window.logger?.warn('[LockstepManager] Cannot rollback to tick', tick, '- snapshot not found')
      return false
    }
    
    // Restore RNG state
    deterministicRNG.setState(snapshot.rngState)
    
    // Reset tick
    this._currentTick = tick
    
    this._stats.rollbackCount++
    
    window.logger?.('[LockstepManager] Rolled back to tick', tick)
    
    // Note: Full state rollback would need to restore entire gameState
    // This is a placeholder - full implementation would need state serialization
    
    return true
  }

  /**
   * Add a peer to the session
   * @param {string} peerId - Peer identifier
   */
  addPeer(peerId) {
    if (!this._peers.has(peerId)) {
      this._peers.set(peerId, new PeerLockstepState(peerId))
      window.logger?.('[LockstepManager] Added peer:', peerId)
    }
  }

  /**
   * Remove a peer from the session
   * @param {string} peerId - Peer identifier
   */
  removePeer(peerId) {
    this._peers.delete(peerId)
    window.logger?.('[LockstepManager] Removed peer:', peerId)
  }

  /**
   * Mark a peer as disconnected
   * @param {string} peerId - Peer identifier
   */
  peerDisconnected(peerId) {
    const peer = this._peers.get(peerId)
    if (peer) {
      peer.isConnected = false
    }
  }

  /**
   * Mark a peer as reconnected
   * @param {string} peerId - Peer identifier
   */
  peerReconnected(peerId) {
    const peer = this._peers.get(peerId)
    if (peer) {
      peer.isConnected = true
    }
  }

  /**
   * Get statistics about lockstep synchronization
   * @returns {Object}
   */
  getStats() {
    return {
      ...this._stats,
      currentTick: this._currentTick,
      peerCount: this._peers.size,
      enabled: this._enabled,
      rngCallCount: deterministicRNG.getCallCount()
    }
  }

  /**
   * Get peer states for debugging
   * @returns {Array<Object>}
   */
  getPeerStates() {
    return Array.from(this._peers.entries()).map(([id, peer]) => ({
      peerId: id,
      lastConfirmedTick: peer.lastConfirmedTick,
      lastReceivedTick: peer.lastReceivedTick,
      isConnected: peer.isConnected,
      isDesynced: peer.isDesynced,
      latencyMs: peer.latencyMs
    }))
  }

  /**
   * Set callback for input broadcast
   * @param {function} callback - (tick, command) => void
   */
  setOnBroadcastInput(callback) {
    this._onBroadcastInput = callback
  }

  /**
   * Set callback for hash broadcast
   * @param {function} callback - (tick, hash) => void
   */
  setOnBroadcastHash(callback) {
    this._onBroadcastHash = callback
  }

  /**
   * Set callback for desync detection
   * @param {function} callback - (tick, peerId, localHash, remoteHash) => void
   */
  setOnDesyncDetected(callback) {
    this._onDesyncDetected = callback
  }

  /**
   * Set callback for tick advance
   * @param {function} callback - (tick) => void
   */
  setOnTickAdvanced(callback) {
    this._onTickAdvanced = callback
  }

  /**
   * Set callback for input received
   * @param {function} callback - (peerId, tick, command) => void
   */
  setOnInputReceived(callback) {
    this._onInputReceived = callback
  }
}

// Global singleton instance
export const lockstepManager = new LockstepManager()
