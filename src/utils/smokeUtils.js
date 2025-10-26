// smokeUtils.js
// Utility functions for creating smoke particle effects used by units and buildings
import {
  MAX_SMOKE_PARTICLES,
  SMOKE_PARTICLE_LIFETIME,
  SMOKE_PARTICLE_SIZE
} from '../config.js'

const spread = 4

function ensureSmokeCollections(gameState) {
  if (!Array.isArray(gameState.smokeParticles)) {
    gameState.smokeParticles = []
  }
  if (!Array.isArray(gameState.smokeParticlePool)) {
    gameState.smokeParticlePool = []
  }
}

function recycleParticleInstance(gameState, particle) {
  if (!particle) {
    return
  }

  // Reset mutable fields to reduce stale data when reusing the particle
  particle.originalSize = undefined
  particle.alpha = 0
  particle.size = 0

  gameState.smokeParticlePool.push(particle)
}

export function removeSmokeParticle(gameState, index) {
  ensureSmokeCollections(gameState)

  if (index < 0 || index >= gameState.smokeParticles.length) {
    return
  }

  const [particle] = gameState.smokeParticles.splice(index, 1)
  recycleParticleInstance(gameState, particle)
}

export function enforceSmokeParticleCapacity(gameState) {
  ensureSmokeCollections(gameState)

  while (gameState.smokeParticles.length > MAX_SMOKE_PARTICLES) {
    removeSmokeParticle(gameState, 0)
  }
}

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
  ensureSmokeCollections(gameState)

  if (!Number.isFinite(count) || count <= 0) {
    return
  }

  // Make sure we never exceed the configured cap by recycling the oldest particles
  for (let i = 0; i < count; i++) {
    if (gameState.smokeParticles.length >= MAX_SMOKE_PARTICLES) {
      removeSmokeParticle(gameState, 0)
    }

    if (gameState.smokeParticles.length >= MAX_SMOKE_PARTICLES) {
      break
    }

    const particle = gameState.smokeParticlePool.pop() || {}

    particle.x = x + (Math.random() - 0.5) * spread
    particle.y = y + (Math.random() - 0.5) * spread
    particle.vx = (Math.random() - 0.5) * 0.2
    particle.vy = -0.6 + Math.random() * -0.2 // Increased upward velocity for higher flight
    particle.size = SMOKE_PARTICLE_SIZE + Math.random() * 2
    particle.startTime = now
    particle.duration = SMOKE_PARTICLE_LIFETIME + Math.random() * 500 // Increased random duration variation
    particle.alpha = 0.7 + Math.random() * 0.2

    gameState.smokeParticles.push(particle)
  }
}
