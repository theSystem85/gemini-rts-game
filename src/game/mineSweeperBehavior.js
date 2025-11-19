// mineSweeperBehavior.js - Mine Sweeper unit behaviors
import { UNIT_PROPERTIES, TILE_SIZE } from '../config.js'

/**
 * Update Mine Sweeper behaviors - sweeping mode toggle, speed modulation, dust particles
 * @param {Array} units - All game units
 * @param {number} now - Current timestamp
 * @param {object} gameState - Game state for particle emission
 */
export function updateMineSweeperBehavior(units, now, gameState) {
  units.forEach(unit => {
    if (unit.type !== 'mineSweeper') return

    // Check if unit is in sweeping mode (has sweep commands queued)
    const isSweeping = unit.commandQueue && unit.commandQueue.some(cmd => cmd.type === 'sweep' || cmd.type === 'sweepArea')

    // Update sweeping flag and speed
    if (isSweeping && !unit.sweeping) {
      unit.sweeping = true
      unit.speed = unit.sweepingSpeed
    } else if (!isSweeping && unit.sweeping) {
      unit.sweeping = false
      unit.speed = unit.normalSpeed
    }

    // Generate dust particles while sweeping and moving
    if (unit.sweeping && (unit.path && unit.path.length > 0 || unit.moveTarget)) {
      // Emit dust particles at regular intervals
      if (!unit.lastDustEmit || now - unit.lastDustEmit > 100) { // Every 100ms
        const dustParticle = generateSweepDust(unit, now)
        if (dustParticle && gameState) {
          // Use the smoke particle system for dust
          emitDustParticle(gameState, dustParticle)
        }
        unit.lastDustEmit = now
      }
    }
  })
}

/**
 * Emit a dust particle (using smoke particle system with dust-like properties)
 * @param {object} gameState - Game state
 * @param {object} dustData - Dust particle data
 */
function emitDustParticle(gameState, dustData) {
  if (!gameState.smokeParticles) {
    gameState.smokeParticles = []
  }

  // Create a dust particle using the smoke particle structure but with dust-like properties
  const particle = {
    x: dustData.x,
    y: dustData.y,
    vx: dustData.velocity.x,
    vy: dustData.velocity.y - 0.3, // Slight upward drift
    size: dustData.size,
    startTime: dustData.startTime,
    duration: dustData.lifetime,
    alpha: 0.4, // More transparent than smoke
    color: dustData.color // Tan/sandy color for dust
  }

  gameState.smokeParticles.push(particle)
}

/**
 * Activate sweeping mode for Mine Sweeper
 * @param {object} unit - Mine Sweeper unit
 */
export function activateSweepingMode(unit) {
  if (unit.type !== 'mineSweeper') return

  unit.sweeping = true
  unit.speed = unit.sweepingSpeed || UNIT_PROPERTIES.mineSweeper.sweepingSpeed
}

/**
 * Deactivate sweeping mode for Mine Sweeper
 * @param {object} unit - Mine Sweeper unit
 */
export function deactivateSweepingMode(unit) {
  if (unit.type !== 'mineSweeper') return

  unit.sweeping = false
  unit.speed = unit.normalSpeed || UNIT_PROPERTIES.mineSweeper.speed
}

/**
 * Calculate zig-zag sweep path for rectangular area
 * @param {object} area - Area bounds {startX, startY, endX, endY} in tile coordinates
 * @returns {Array} Array of tile coordinates for serpentine path
 */
export function calculateZigZagSweepPath(area) {
  const minX = Math.min(area.startX, area.endX)
  const maxX = Math.max(area.startX, area.endX)
  const minY = Math.min(area.startY, area.endY)
  const maxY = Math.max(area.startY, area.endY)

  const path = []
  let direction = 1 // 1 for left-to-right, -1 for right-to-left

  for (let y = minY; y <= maxY; y++) {
    if (direction === 1) {
      // Left to right
      for (let x = minX; x <= maxX; x++) {
        path.push({ x, y })
      }
    } else {
      // Right to left
      for (let x = maxX; x >= minX; x--) {
        path.push({ x, y })
      }
    }
    direction *= -1 // Reverse direction for next row
  }

  return path
}

/**
 * Calculate sweep path for freeform painted area
 * @param {Set} paintedTiles - Set of painted tile coordinates as "x,y" strings
 * @returns {Array} Array of tile coordinates for sweep path
 */
export function calculateFreeformSweepPath(paintedTiles) {
  if (!paintedTiles || paintedTiles.size === 0) return []

  // Convert Set to array of {x, y} objects
  const tiles = []
  paintedTiles.forEach(key => {
    const [x, y] = key.split(',').map(Number)
    tiles.push({ x, y })
  })

  // Sort tiles to create an efficient path
  // Use a simple approach: sort by Y then X for now
  tiles.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  return tiles
}

/**
 * Generate dust particles in front of Mine Sweeper
 * @param {object} unit - Mine Sweeper unit
 * @param {number} now - Current timestamp
 * @returns {object} Dust particle data
 */
export function generateSweepDust(unit, now) {
  if (!unit.sweeping) return null

  const dustOffsetDistance = TILE_SIZE * 0.8

  // Calculate position in front of unit based on direction
  const dustX = unit.x + TILE_SIZE / 2 + Math.cos(unit.direction) * dustOffsetDistance
  const dustY = unit.y + TILE_SIZE / 2 + Math.sin(unit.direction) * dustOffsetDistance

  return {
    x: dustX,
    y: dustY,
    startTime: now,
    lifetime: 500, // 0.5 seconds
    color: '#D2B48C', // Tan/sandy color
    size: 8,
    velocity: {
      x: Math.cos(unit.direction) * 0.5,
      y: Math.sin(unit.direction) * 0.5
    }
  }
}
