// smokeUtils.js
// Utility functions for creating smoke particle effects used by units and buildings
import { SMOKE_PARTICLE_LIFETIME, SMOKE_PARTICLE_SIZE } from '../config.js'

/**
 * Emit a number of smoke particles at the specified world coordinates.
 * The particles share the common wind logic handled in updateSmokeParticles.
 *
 * @param {Object} gameState - Global game state
 * @param {number} x - World X coordinate for emission center
 * @param {number} y - World Y coordinate for emission center
 * @param {number} now - Current time
 * @param {number} [count=1] - Number of particles to emit
 */
export function emitSmokeParticles(gameState, x, y, now, count = 1) {
  const spread = 4
  for (let i = 0; i < count; i++) {
    gameState.smokeParticles.push({
      x: x + (Math.random() - 0.5) * spread,
      y: y + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.6 + Math.random() * -0.2, // Increased upward velocity for higher flight
      size: SMOKE_PARTICLE_SIZE + Math.random() * 2,
      startTime: now,
      duration: SMOKE_PARTICLE_LIFETIME + Math.random() * 500, // Increased random duration variation
      alpha: 0.7 + Math.random() * 0.2
    })
  }
}
