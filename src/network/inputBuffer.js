/**
 * Input Buffer System for Deterministic Lockstep
 * 
 * Manages input command buffering to accommodate network latency
 * and ensure all peers process inputs at the same simulation tick.
 */

// Number of ticks to delay local inputs (allows time for network transmission)
export const INPUT_DELAY_TICKS = 3

// Maximum number of ticks to buffer ahead
export const MAX_BUFFER_TICKS = 30

/**
 * Input command structure
 * @typedef {Object} InputCommand
 * @property {number} tick - Simulation tick this input is for
 * @property {string} peerId - Peer that issued the command
 * @property {string} type - Command type (e.g., 'move', 'attack', 'build')
 * @property {Object} payload - Command-specific data
 * @property {number} timestamp - Local timestamp when command was created
 * @property {number} [receivedAt] - Local timestamp when command was received (for remote)
 */

/**
 * Input Buffer class
 * Stores and retrieves input commands organized by simulation tick
 */
export class InputBuffer {
  constructor() {
    // Map of tick -> array of inputs
    this._buffer = new Map()
    
    // Oldest tick still in buffer
    this._oldestTick = 0
    
    // Track confirmed ticks (all inputs received)
    this._confirmedTicks = new Set()
  }

  /**
   * Add an input command for a specific tick
   * @param {number} tick - Simulation tick
   * @param {InputCommand} input - Input command
   */
  addInput(tick, input) {
    if (!this._buffer.has(tick)) {
      this._buffer.set(tick, [])
    }
    
    const tickInputs = this._buffer.get(tick)
    
    // Avoid duplicates (same peerId + type + similar payload)
    const isDuplicate = tickInputs.some(existing => 
      existing.peerId === input.peerId &&
      existing.type === input.type &&
      JSON.stringify(existing.payload) === JSON.stringify(input.payload)
    )
    
    if (!isDuplicate) {
      tickInputs.push(input)
    }
  }

  /**
   * Get all inputs for a specific tick
   * @param {number} tick - Simulation tick
   * @returns {Array<InputCommand>}
   */
  getInputsForTick(tick) {
    return this._buffer.get(tick) || []
  }

  /**
   * Check if we have inputs for a specific tick
   * @param {number} tick - Simulation tick
   * @returns {boolean}
   */
  hasInputsForTick(tick) {
    return this._buffer.has(tick) && this._buffer.get(tick).length > 0
  }

  /**
   * Check if a tick has been confirmed (all expected inputs received)
   * @param {number} tick - Simulation tick
   * @returns {boolean}
   */
  isTickConfirmed(tick) {
    return this._confirmedTicks.has(tick)
  }

  /**
   * Mark a tick as confirmed (all inputs received)
   * @param {number} tick - Simulation tick
   */
  confirmTick(tick) {
    this._confirmedTicks.add(tick)
  }

  /**
   * Clear inputs for ticks before the given tick
   * @param {number} tick - Oldest tick to keep
   */
  clearBefore(tick) {
    for (const [t] of this._buffer) {
      if (t < tick) {
        this._buffer.delete(t)
        this._confirmedTicks.delete(t)
      }
    }
    this._oldestTick = tick
  }

  /**
   * Clear all inputs
   */
  clear() {
    this._buffer.clear()
    this._confirmedTicks.clear()
    this._oldestTick = 0
  }

  /**
   * Get the number of buffered ticks
   * @returns {number}
   */
  getBufferedTickCount() {
    return this._buffer.size
  }

  /**
   * Get the range of ticks in buffer
   * @returns {{min: number, max: number}}
   */
  getTickRange() {
    let min = Infinity
    let max = -Infinity
    
    for (const [tick] of this._buffer) {
      min = Math.min(min, tick)
      max = Math.max(max, tick)
    }
    
    return {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max
    }
  }

  /**
   * Get total number of buffered inputs
   * @returns {number}
   */
  getTotalInputCount() {
    let count = 0
    for (const [, inputs] of this._buffer) {
      count += inputs.length
    }
    return count
  }

  /**
   * Export buffer state for debugging
   * @returns {Object}
   */
  getDebugState() {
    const state = {}
    for (const [tick, inputs] of this._buffer) {
      state[tick] = inputs.map(i => ({
        peerId: i.peerId,
        type: i.type,
        tick: i.tick
      }))
    }
    return state
  }
}

/**
 * Command types for lockstep input synchronization
 */
export const LOCKSTEP_INPUT_TYPES = {
  // Unit commands
  UNIT_MOVE: 'ls-unit-move',
  UNIT_ATTACK: 'ls-unit-attack',
  UNIT_STOP: 'ls-unit-stop',
  UNIT_GUARD: 'ls-unit-guard',
  UNIT_PATROL: 'ls-unit-patrol',
  
  // Building commands
  BUILD_START: 'ls-build-start',
  BUILD_CANCEL: 'ls-build-cancel',
  BUILD_PLACE: 'ls-build-place',
  BUILD_SELL: 'ls-build-sell',
  BUILD_REPAIR: 'ls-build-repair',
  
  // Production commands
  PRODUCE_START: 'ls-produce-start',
  PRODUCE_CANCEL: 'ls-produce-cancel',
  
  // Game control
  GAME_PAUSE: 'ls-game-pause',
  GAME_RESUME: 'ls-game-resume',
  
  // Rally points
  SET_RALLY: 'ls-set-rally',
  
  // Mine operations
  MINE_DEPLOY: 'ls-mine-deploy',
  MINE_SWEEP: 'ls-mine-sweep',
  
  // Special
  NO_OP: 'ls-no-op' // Empty input for tick confirmation
}

/**
 * Create a generic lockstep input command
 * @param {string} type - Input type from LOCKSTEP_INPUT_TYPES
 * @param {Object} data - Input payload data
 * @param {number} tick - Target simulation tick
 * @param {string} peerId - Peer ID issuing the command
 * @returns {InputCommand}
 */
export function createLockstepInput(type, data, tick, peerId) {
  return {
    tick,
    peerId,
    type,
    payload: data,
    timestamp: performance.now(),
    id: `${peerId}-${tick}-${type}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Create a move command
 * @param {Array<string>} unitIds - IDs of units to move
 * @param {number} targetX - Target X coordinate (tiles)
 * @param {number} targetY - Target Y coordinate (tiles)
 * @param {boolean} [queued] - Add to command queue (shift-click)
 * @returns {Object}
 */
export function createMoveInput(unitIds, targetX, targetY, queued = false) {
  return {
    type: LOCKSTEP_INPUT_TYPES.UNIT_MOVE,
    payload: {
      unitIds,
      targetX,
      targetY,
      queued
    }
  }
}

/**
 * Create an attack command
 * @param {Array<string>} unitIds - IDs of attacking units
 * @param {string} targetId - ID of target unit or building
 * @param {string} targetType - 'unit' or 'building'
 * @param {boolean} [queued] - Add to command queue
 * @returns {Object}
 */
export function createAttackInput(unitIds, targetId, targetType, queued = false) {
  return {
    type: LOCKSTEP_INPUT_TYPES.UNIT_ATTACK,
    payload: {
      unitIds,
      targetId,
      targetType,
      queued
    }
  }
}

/**
 * Create a stop command
 * @param {Array<string>} unitIds - IDs of units to stop
 * @returns {Object}
 */
export function createStopInput(unitIds) {
  return {
    type: LOCKSTEP_INPUT_TYPES.UNIT_STOP,
    payload: { unitIds }
  }
}

/**
 * Create a build placement command
 * @param {string} buildingType - Type of building
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @returns {Object}
 */
export function createBuildInput(buildingType, x, y) {
  return {
    type: LOCKSTEP_INPUT_TYPES.BUILD_PLACE,
    payload: {
      buildingType,
      x,
      y
    }
  }
}

/**
 * Create a production start command
 * @param {string} itemType - Type of unit/building to produce
 * @param {string} producerType - 'unit' or 'building'
 * @returns {Object}
 */
export function createProduceInput(itemType, producerType) {
  return {
    type: LOCKSTEP_INPUT_TYPES.PRODUCE_START,
    payload: {
      itemType,
      producerType
    }
  }
}

/**
 * Create a sell building command
 * @param {string} buildingId - ID of building to sell
 * @returns {Object}
 */
export function createSellInput(buildingId) {
  return {
    type: LOCKSTEP_INPUT_TYPES.BUILD_SELL,
    payload: { buildingId }
  }
}

/**
 * Create a no-op input for tick confirmation
 * @returns {Object}
 */
export function createNoOpInput() {
  return {
    type: LOCKSTEP_INPUT_TYPES.NO_OP,
    payload: {}
  }
}

/**
 * Create a game pause/resume command
 * @param {boolean} paused - Whether to pause
 * @returns {Object}
 */
export function createPauseInput(paused) {
  return {
    type: paused ? LOCKSTEP_INPUT_TYPES.GAME_PAUSE : LOCKSTEP_INPUT_TYPES.GAME_RESUME,
    payload: { paused }
  }
}

/**
 * Serialize an input command for network transmission
 * @param {InputCommand} input - Input to serialize
 * @returns {string} JSON string
 */
export function serializeInput(input) {
  return JSON.stringify(input)
}

/**
 * Deserialize an input command from network
 * @param {string} data - JSON string
 * @returns {InputCommand|null}
 */
export function deserializeInput(data) {
  try {
    return JSON.parse(data)
  } catch (e) {
    window.logger?.warn('[InputBuffer] Failed to deserialize input:', e)
    return null
  }
}
