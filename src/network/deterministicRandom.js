/**
 * Deterministic Random Number Generator (PRNG) for Lockstep Networking
 *
 * This module provides a seedable, deterministic random number generator
 * that can be shared across all peers in a multiplayer session to ensure
 * identical simulation results.
 *
 * Based on the Mulberry32 algorithm for high-quality, fast PRNG.
 */

/**
 * Mulberry32 PRNG - Fast, high-quality 32-bit PRNG
 * @param {number} seed - Initial seed value
 * @returns {function} Random number generator function returning [0, 1)
 */
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/**
 * Deterministic Random Number Generator class
 * Provides a drop-in replacement for gameRandom() that is seedable and reproducible
 */
class DeterministicRNG {
  constructor() {
    this._seed = 1
    this._generator = mulberry32(this._seed)
    this._callCount = 0
    this._enabled = false // Start disabled, use gameRandom by default
  }

  /**
   * Set the seed for the PRNG
   * @param {number|string} seed - Seed value (string will be hashed to number)
   */
  setSeed(seed) {
    if (typeof seed === 'string') {
      // Hash string to number using djb2 algorithm
      let hash = 5381
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) + hash) + seed.charCodeAt(i)
        hash = hash & hash // Convert to 32-bit integer
      }
      this._seed = Math.abs(hash)
    } else {
      this._seed = Math.abs(Math.floor(seed)) || 1
    }
    this._generator = mulberry32(this._seed)
    this._callCount = 0
  }

  /**
   * Get the current seed
   * @returns {number}
   */
  getSeed() {
    return this._seed
  }

  /**
   * Get the number of random calls made since last seed
   * Used for debugging and sync verification
   * @returns {number}
   */
  getCallCount() {
    return this._callCount
  }

  /**
   * Enable deterministic mode (use seeded PRNG instead of Math.random)
   */
  enable() {
    this._enabled = true
    window.logger?.('[DeterministicRNG] Enabled with seed:', this._seed)
  }

  /**
   * Disable deterministic mode (revert to Math.random)
   */
  disable() {
    this._enabled = false
    window.logger?.('[DeterministicRNG] Disabled')
  }

  /**
   * Check if deterministic mode is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this._enabled
  }

  /**
   * Generate a random number in [0, 1)
   * @returns {number}
   */
  random() {
    if (!this._enabled) {
      return Math.random()
    }
    this._callCount++
    return this._generator()
  }

  /**
   * Generate a random integer in [min, max] (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min
  }

  /**
   * Generate a random float in [min, max)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  randomFloat(min, max) {
    return this.random() * (max - min) + min
  }

  /**
   * Pick a random element from an array
   * @param {Array} array - Array to pick from
   * @returns {*} Random element or undefined if array is empty
   */
  randomElement(array) {
    if (!array || array.length === 0) return undefined
    return array[Math.floor(this.random() * array.length)]
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} The same array, shuffled
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  /**
   * Generate a random boolean with given probability
   * @param {number} probability - Probability of true (0-1, default 0.5)
   * @returns {boolean}
   */
  randomBool(probability = 0.5) {
    return this.random() < probability
  }

  /**
   * Reset the generator to initial state with current seed
   */
  reset() {
    this._generator = mulberry32(this._seed)
    this._callCount = 0
  }

  /**
   * Create a snapshot of the current RNG state for sync verification
   * @returns {Object}
   */
  getState() {
    return {
      seed: this._seed,
      callCount: this._callCount,
      enabled: this._enabled
    }
  }

  /**
   * Restore RNG state from a snapshot
   * @param {Object} state - State snapshot
   */
  setState(state) {
    if (state.seed !== undefined) {
      this.setSeed(state.seed)
    }
    if (state.enabled !== undefined) {
      this._enabled = state.enabled
    }
    // Fast-forward to the same call count
    if (state.callCount !== undefined && state.callCount > 0) {
      for (let i = 0; i < state.callCount; i++) {
        this._generator()
      }
      this._callCount = state.callCount
    }
  }
}

// Global singleton instance for the entire game
export const deterministicRNG = new DeterministicRNG()

// Export utility functions that use the global instance
export const random = () => deterministicRNG.random()
export const randomInt = (min, max) => deterministicRNG.randomInt(min, max)
export const randomFloat = (min, max) => deterministicRNG.randomFloat(min, max)
export const randomElement = (array) => deterministicRNG.randomElement(array)
export const shuffle = (array) => deterministicRNG.shuffle(array)
export const randomBool = (probability) => deterministicRNG.randomBool(probability)

/**
 * Initialize the PRNG for a multiplayer session
 * @param {string|number} sessionSeed - Seed shared by all peers
 * @param {boolean} enableDeterminism - Whether to enable deterministic mode
 */
export function initializeSessionRNG(sessionSeed, enableDeterminism = true) {
  deterministicRNG.setSeed(sessionSeed)
  if (enableDeterminism) {
    deterministicRNG.enable()
  }
  return deterministicRNG
}

/**
 * Reset the PRNG for a new tick/frame in lockstep mode
 * This ensures all peers start each tick with synchronized RNG state
 * @param {number} tickNumber - Current simulation tick
 */
export function syncRNGForTick(tickNumber) {
  // Combine session seed with tick number for deterministic per-tick randomness
  const tickSeed = deterministicRNG.getSeed() + tickNumber
  deterministicRNG._generator = mulberry32(tickSeed)
  deterministicRNG._callCount = 0
}
