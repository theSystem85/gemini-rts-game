/**
 * Game Random Utilities
 *
 * This module provides random number generation functions for use throughout
 * the game. In single-player mode, it uses standard gameRandom(). In
 * multiplayer lockstep mode, it uses the deterministic PRNG to ensure
 * all peers get identical random sequences.
 *
 * IMPORTANT: All game logic that needs randomness should import from this
 * module rather than using gameRandom() directly.
 */

import { deterministicRNG, random, randomInt, randomFloat, randomElement, shuffle, randomBool } from '../network/deterministicRandom.js'

/**
 * Get a random number in [0, 1)
 * Uses deterministic PRNG when in lockstep mode, gameRandom() otherwise
 * @returns {number}
 */
export function gameRandom() {
  return random()
}

/**
 * Get a random integer in [min, max] (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function gameRandomInt(min, max) {
  return randomInt(min, max)
}

/**
 * Get a random float in [min, max)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number}
 */
export function gameRandomFloat(min, max) {
  return randomFloat(min, max)
}

/**
 * Pick a random element from an array
 * @param {Array} array - Array to pick from
 * @returns {*} Random element or undefined if array is empty
 */
export function gameRandomElement(array) {
  return randomElement(array)
}

/**
 * Shuffle an array in place
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array, shuffled
 */
export function gameShuffle(array) {
  return shuffle(array)
}

/**
 * Get a random boolean with given probability
 * @param {number} [probability=0.5] - Probability of true (0-1)
 * @returns {boolean}
 */
export function gameRandomBool(probability = 0.5) {
  return randomBool(probability)
}

/**
 * Check if deterministic mode is enabled
 * @returns {boolean}
 */
export function isDeterministicModeEnabled() {
  return deterministicRNG.isEnabled()
}

/**
 * Get current RNG state for debugging
 * @returns {Object}
 */
export function getRNGState() {
  return deterministicRNG.getState()
}

// Re-export the deterministic RNG instance for advanced usage
export { deterministicRNG }

// Compatibility aliases for code that uses gameRandom style naming
export const random2 = gameRandom // Alias to avoid confusion with built-in
export const randInt = gameRandomInt
export const randFloat = gameRandomFloat
export const randElement = gameRandomElement
export const randBool = gameRandomBool
