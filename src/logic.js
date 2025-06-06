// logic.js
import {
  TILE_SIZE
} from './config.js'
import { buildOccupancyMap } from './units.js'
import { playSound } from './sound.js'

export let explosions = [] // Global explosion effects for rocket impacts

// --- Helper Functions ---

// Trigger explosion effect and apply area damage
export function triggerExplosion(x, y, baseDamage, units, factories, shooter, now, _mapGrid) {
  const explosionRadius = TILE_SIZE * 2

  // Add explosion visual effect
  explosions.push({
    x,
    y,
    startTime: now,
    duration: 500,
    maxRadius: explosionRadius
  })
  playSound('explosion', 0.5) // Set explosion sound volume to 0.5

  // Apply damage to nearby units
  units.forEach(unit => {
    const dx = (unit.x + TILE_SIZE / 2) - x
    const dy = (unit.y + TILE_SIZE / 2) - y
    const distance = Math.hypot(dx, dy)

    // Skip the shooter if this was their own bullet
    if (distance < explosionRadius) {
      if (shooter && unit.id === shooter.id) return
      const falloff = 1 - (distance / explosionRadius)
      const damage = Math.round(baseDamage * falloff * 0.5) // Half damage with falloff
      unit.health -= damage
    }
  })

  // Apply damage to nearby factories
  factories.forEach(factory => {
    if (factory.destroyed) return

    const factoryCenterX = (factory.x + factory.width / 2) * TILE_SIZE
    const factoryCenterY = (factory.y + factory.height / 2) * TILE_SIZE
    const dx = factoryCenterX - x
    const dy = factoryCenterY - y
    const distance = Math.hypot(dx, dy)

    if (distance < explosionRadius) {
      const falloff = 1 - (distance / explosionRadius)
      const damage = Math.round(baseDamage * falloff * 0.3) // 30% damage with falloff
      factory.health -= damage
    }
  })
}

export function isAdjacentToFactory(unit, factory) {
  const unitTileX = Math.floor(unit.x / TILE_SIZE)
  const unitTileY = Math.floor(unit.y / TILE_SIZE)

  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (unitTileX === x && unitTileY === y) {
        return true
      }
    }
  }
  return false
}

// Checks if a unit is adjacent to a building (similar to isAdjacentToFactory but for any building)
export function isAdjacentToBuilding(unit, building) {
  const unitTileX = Math.floor(unit.x / TILE_SIZE)
  const unitTileY = Math.floor(unit.y / TILE_SIZE)

  // Check if unit is adjacent to any tile of the building
  for (let y = building.y - 1; y <= building.y + building.height; y++) {
    for (let x = building.x - 1; x <= building.x + building.width; x++) {
      // Skip tiles that are inside the building
      if (x >= building.x && x < building.x + building.width &&
          y >= building.y && y < building.y + building.height) {
        continue
      }

      // Check if unit is on this adjacent tile
      if (unitTileX === x && unitTileY === y) {
        return true
      }
    }
  }

  return false
}

// Visual feedback when a harvester is unloading at a refinery
export function showUnloadingFeedback(_unit, _refinery) {
  // This function would ideally create a visual effect like a small animation
  // or particle effect showing ore unloading at the refinery
  // For now, we'll just log this activity

  // Add any visual effects here in the future
}

export function findClosestOre(unit, mapGrid, targetedOreTiles = {}) {
  // Add validation to prevent undefined unit errors
  if (!unit) {
    console.error('findClosestOre called with undefined unit')
    return null
  }
  
  if (!unit.hasOwnProperty('x') || !unit.hasOwnProperty('y')) {
    console.error('findClosestOre called with unit missing x/y properties:', unit)
    return null
  }
  
  let closest = null
  let closestDist = Infinity
  const candidates = [] // Store all available ore tiles for better distribution
  
  // Calculate unit's tile position from its pixel coordinates
  const unitTileX = Math.floor(unit.x / TILE_SIZE)
  const unitTileY = Math.floor(unit.y / TILE_SIZE)
  
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      if (mapGrid[y][x].type === 'ore') {
        // Skip this ore tile if it's already targeted by another unit
        const tileKey = `${x},${y}`
        if (targetedOreTiles[tileKey] && targetedOreTiles[tileKey] !== unit.id) {
          continue
        }

        const dx = x - unitTileX
        const dy = y - unitTileY
        const dist = Math.hypot(dx, dy)
        
        // Store candidate for potential selection
        candidates.push({ x, y, dist })
        
        if (dist < closestDist) {
          closestDist = dist
          closest = { x, y }
        }
      }
    }
  }
  
  // If we have multiple nearby candidates, add some randomization to prevent clustering
  if (candidates.length > 1) {
    const closeDistance = closestDist * 1.5 // Allow tiles up to 50% further than closest
    const closeCandidates = candidates.filter(c => c.dist <= closeDistance)
    
    if (closeCandidates.length > 1) {
      // Add unit ID based selection to ensure different harvesters pick different tiles
      const unitId = unit.id || Math.floor(Math.random() * 1000) // Fallback to random if no ID
      const unitBasedIndex = unitId % closeCandidates.length
      const selectedCandidate = closeCandidates[unitBasedIndex]
      
      // Extra safety check
      if (selectedCandidate && selectedCandidate.x !== undefined && selectedCandidate.y !== undefined) {
        return { x: selectedCandidate.x, y: selectedCandidate.y }
      }
    }
  }
  
  return closest
}

export function findAdjacentTile(factory, mapGrid) {
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue
      if (!mapGrid[y][x].building) {
        return { x, y }
      }
    }
  }
  return null
}

// Prevent friendly fire by ensuring clear line-of-sight.
// Returns true if no friendly unit (other than shooter and target) is in the bullet's path.
export function hasClearShot(shooter, target, units) {
  const shooterCenter = { x: shooter.x + TILE_SIZE / 2, y: shooter.y + TILE_SIZE / 2 }
  const targetCenter = target.tileX !== undefined
    ? { x: target.x + TILE_SIZE / 2, y: target.y + TILE_SIZE / 2 }
    : { x: target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2, y: target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2 }
  const dx = targetCenter.x - shooterCenter.x
  const dy = targetCenter.y - shooterCenter.y
  const segmentLengthSq = dx * dx + dy * dy
  // Threshold distance that counts as being "in the way"
  const threshold = TILE_SIZE / 2.5

  for (const other of units) {
    // Only check for friendly units that are not the shooter or the intended target.
    if (other === shooter || other === target) continue
    if (other.owner !== shooter.owner) continue
    const otherCenter = { x: other.x + TILE_SIZE / 2, y: other.y + TILE_SIZE / 2 }
    const px = otherCenter.x - shooterCenter.x
    const py = otherCenter.y - shooterCenter.y
    const t = (px * dx + py * dy) / segmentLengthSq
    if (t < 0 || t > 1) continue
    const closestPoint = { x: shooterCenter.x + t * dx, y: shooterCenter.y + t * dy }
    const distToSegment = Math.hypot(otherCenter.x - closestPoint.x, otherCenter.y - closestPoint.y)
    if (distToSegment < threshold) {
      return false
    }
  }
  return true
}

// Add this new function to find a position with a clear line of sight
export function findPositionWithClearShot(unit, target, units, mapGrid) {
  const unitTileX = Math.floor(unit.x / TILE_SIZE)
  const unitTileY = Math.floor(unit.y / TILE_SIZE)

  // Check adjacent tiles in a spiral pattern, including diagonal moves for better positioning
  const directions = [
    { x: 0, y: -1 },  // up
    { x: 1, y: 0 },   // right
    { x: 0, y: 1 },   // down
    { x: -1, y: 0 },  // left
    { x: 1, y: -1 },  // up-right
    { x: 1, y: 1 },   // down-right
    { x: -1, y: 1 },  // down-left
    { x: -1, y: -1 }  // up-left
  ]

  // Create the occupancy map once instead of checking each unit repeatedly
  const occupancyMap = buildOccupancyMap(units, mapGrid)

  // Create a temporary unit copy for testing line of sight
  const testUnit = { ...unit, path: [...(unit.path || [])] }

  let bestPosition = null
  let bestDistance = Infinity

  for (const dir of directions) {
    const testX = unitTileX + dir.x
    const testY = unitTileY + dir.y

    // Check if tile is valid and passable
    if (testX >= 0 && testX < mapGrid[0].length &&
        testY >= 0 && testY < mapGrid.length &&
        !mapGrid[testY][testX].building &&
        mapGrid[testY][testX].type !== 'water') {

      // Check if tile is not occupied using the occupancy map
      if (!occupancyMap[testY][testX]) {
        // Position test unit at this tile to check line of sight
        testUnit.x = testX * TILE_SIZE
        testUnit.y = testY * TILE_SIZE
        testUnit.tileX = testX
        testUnit.tileY = testY

        // Check if there's a clear shot from this position
        if (hasClearShot(testUnit, target, units)) {
          // Calculate distance to current position to find the nearest valid spot
          const distance = Math.hypot(testX - unitTileX, testY - unitTileY)
          if (distance < bestDistance) {
            bestDistance = distance
            bestPosition = { x: testX, y: testY }
          }
        }
      }
    }
  }

  // If we found a position with clear shot, move to it
  if (bestPosition) {
    unit.path = [bestPosition]
    unit.findingClearShot = false
    return true
  }

  // If no clear shot position found nearby, reset the flag
  unit.findingClearShot = false
  return false
}

// Helper function to calculate the smallest difference between two angles
export function angleDiff(angle1, angle2) {
  const diff = Math.abs((angle1 - angle2 + Math.PI) % (2 * Math.PI) - Math.PI)
  return diff
}

// Helper function to smoothly rotate from current angle to target angle
export function smoothRotateTowardsAngle(currentAngle, targetAngle, rotationSpeed) {
  // Normalize angles to be between -PI and PI
  currentAngle = normalizeAngle(currentAngle)
  targetAngle = normalizeAngle(targetAngle)

  // Find the shortest rotation direction
  let angleDiff = targetAngle - currentAngle

  // Ensure we rotate in the shortest direction
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

  // Apply rotation speed
  let nextAngle
  if (Math.abs(angleDiff) < rotationSpeed) {
    nextAngle = targetAngle // If very close, snap to target angle
  } else if (angleDiff > 0) {
    nextAngle = currentAngle + rotationSpeed
  } else {
    nextAngle = currentAngle - rotationSpeed
  }
  // Ensure the returned angle is also normalized
  return normalizeAngle(nextAngle)
}

// Helper function to normalize angle between -PI and PI
export function normalizeAngle(angle) {
  const twoPi = 2 * Math.PI
  // Use a more robust modulo operation
  angle = ((angle % twoPi) + twoPi) % twoPi
  // Bring into range -PI to PI
  if (angle > Math.PI) {
    angle -= twoPi
  }
  return angle
}
