// mineSweeperBehavior.js - Mine Sweeper unit behaviors
import { UNIT_PROPERTIES } from '../config.js'

/**
 * Update Mine Sweeper behaviors - sweeping mode toggle, speed modulation, dust emission
 * @param {Array} units - All game units
 * @param {Object} gameState - Game state object
 * @param {number} now - Current timestamp
 */
export function updateMineSweeperBehavior(units, gameState, now) {
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

    // Generate dust if sweeping and moving
    if (unit.sweeping && (unit.velocityX !== 0 || unit.velocityY !== 0)) {
      // Limit dust emission rate (e.g., every 100ms)
      if (!unit.lastDustTime || now - unit.lastDustTime > 100) {
        const dust = generateSweepDust(unit, now)
        if (dust) {
          if (!gameState.dustParticles) gameState.dustParticles = []
          gameState.dustParticles.push(dust)
          unit.lastDustTime = now
        }
      }
    }
  })
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

  const TILE_SIZE = 32 // Should import from config but avoiding circular dependency
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
