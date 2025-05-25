// logic.js
import {
  TILE_SIZE
} from './config.js'
import { buildOccupancyMap } from './units.js'
import { playSound } from './sound.js'

export let explosions = [] // Global explosion effects for rocket impacts

// --- Helper Functions ---
export function checkBulletCollision(bullet, units, factories, gameState) {
  try {
    // Skip collision with self (building that shot the bullet)
    if (bullet.shooter && bullet.shooter.isBuilding &&
        bullet.x >= bullet.shooter.x * TILE_SIZE &&
        bullet.x <= (bullet.shooter.x + bullet.shooter.width) * TILE_SIZE &&
        bullet.y >= bullet.shooter.y * TILE_SIZE &&
        bullet.y <= (bullet.shooter.y + bullet.shooter.height) * TILE_SIZE) {
      // Bullet is still inside the building that shot it, skip collision
      return null
    }

    // Check collisions with units
    for (const unit of units) {
      // Skip friendly units unless this is a forced attack
      if (unit.owner === bullet.shooter?.owner && !(bullet.shooter?.forcedAttack && bullet.shooter?.target === unit)) continue

      const dx = (unit.x + TILE_SIZE / 2) - bullet.x
      const dy = (unit.y + TILE_SIZE / 2) - bullet.y
      const distance = Math.hypot(dx, dy)

      if (distance < 10) { // 10-pixel threshold for collision
        // Apply randomized damage (0.8x to 1.2x base damage)
        const damageMultiplier = 0.8 + Math.random() * 0.4
        const actualDamage = Math.round(bullet.baseDamage * damageMultiplier)

        // Apply damage reduction from armor if the unit has armor
        if (unit.armor) {
          unit.health -= Math.max(1, Math.round(actualDamage / unit.armor))
        } else {
          unit.health -= actualDamage
        }

        // Play unit lost sound if player unit dies
        if (unit.health <= 0 && unit.owner === 'player') {
          playSound('unitLost', 1.0)
        }

        // If this is a rocket projectile, trigger an explosion
        if (bullet.type === 'rocket') {
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, performance.now(), null)
        }

        return unit
      }
    }

    // Check collisions with buildings
    if (gameState.buildings && gameState.buildings.length > 0) {
      for (const building of gameState.buildings) {
        // Skip friendly buildings unless this is a forced attack
        if (building.owner === bullet.shooter?.owner && !(bullet.shooter?.forcedAttack && bullet.shooter?.target === building)) continue

        // Check if bullet is within building bounds (with small buffer)
        const buildingX = building.x * TILE_SIZE
        const buildingY = building.y * TILE_SIZE
        const buildingWidth = building.width * TILE_SIZE
        const buildingHeight = building.height * TILE_SIZE

        if (bullet.x >= buildingX - 5 && bullet.x <= buildingX + buildingWidth + 5 &&
            bullet.y >= buildingY - 5 && bullet.y <= buildingY + buildingHeight + 5) {

          // Apply damage to building (with randomized multiplier)
          const damageMultiplier = 0.8 + Math.random() * 0.4
          const actualDamage = Math.round(bullet.baseDamage * damageMultiplier)

          // Apply damage reduction from armor if the building has armor
          if (building.armor) {
            building.health -= Math.max(1, Math.round(actualDamage / building.armor))
          } else {
            building.health -= actualDamage
          }

          // Play hit sound
          playSound('bulletHit', 0.5)

          // If this is a rocket projectile, trigger an explosion
          if (bullet.type === 'rocket') {
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, performance.now(), null)
          }

          return building
        }
      }
    }

    // Check collisions with factories
    for (const factory of factories) {
      // Skip friendly factories unless this is a forced attack
      if (factory.id === bullet.shooter?.owner && !(bullet.shooter?.forcedAttack && bullet.shooter?.target === factory)) continue
      if (factory.destroyed) continue

      // Check if bullet is within factory bounds (with small buffer)
      const factoryX = factory.x * TILE_SIZE
      const factoryY = factory.y * TILE_SIZE
      const factoryWidth = factory.width * TILE_SIZE
      const factoryHeight = factory.height * TILE_SIZE

      if (bullet.x >= factoryX - 5 && bullet.x <= factoryX + factoryWidth + 5 &&
          bullet.y >= factoryY - 5 && bullet.y <= factoryY + factoryHeight + 5) {
        factory.health -= bullet.baseDamage
        // Create explosion effect
        if (!explosions) explosions = []

        // Check if factory is destroyed
        if (factory.health <= 0) {
          factory.destroyed = true
          if (factory.id === 'player') {
            gameState.losses++
            gameState.gameOver = true
          } else {
            gameState.wins++
            gameState.gameOver = true
          }
        }
        return factory
      }
    }

    return null
  } catch (error) {
    console.error('Error in checkBulletCollision:', error)
    return null
  }
}

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
  let closest = null
  let closestDist = Infinity
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      if (mapGrid[y][x].type === 'ore') {
        // Skip this ore tile if it's already targeted by another unit
        const tileKey = `${x},${y}`
        if (targetedOreTiles[tileKey] && targetedOreTiles[tileKey] !== unit.id) {
          continue
        }

        const dx = x - unit.tileX
        const dy = y - unit.tileY
        const dist = Math.hypot(dx, dy)
        if (dist < closestDist) {
          closestDist = dist
          closest = { x, y }
        }
      }
    }
  }
  return closest
}

export function findAdjacentTile(factory, mapGrid) {
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue
      if (mapGrid[y][x].type !== 'building') {
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
        mapGrid[testY][testX].type !== 'building' &&
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

// Calculate aim ahead position for moving targets
export function calculateAimAheadPosition(shooter, target, projectileSpeed, gameState) {
  // If target has no velocity or path, just return its current position
  if (!target.path || target.path.length === 0) {
    return {
      x: target.x + TILE_SIZE / 2,
      y: target.y + TILE_SIZE / 2
    }
  }

  // Use calibration factor from gameState if available, otherwise use default 1.0
  const calibrationFactor = gameState && gameState.aimAheadCalibrationFactor !== undefined
    ? gameState.aimAheadCalibrationFactor
    : 1.0

  // Get shooter and target center positions
  const shooterCenterX = shooter.x + TILE_SIZE / 2
  const shooterCenterY = shooter.y + TILE_SIZE / 2

  const targetCenterX = target.x + TILE_SIZE / 2
  const targetCenterY = target.y + TILE_SIZE / 2

  // Calculate target's velocity based on its direction and speed
  let targetVelocityX = 0
  let targetVelocityY = 0

  // If target is moving along a path
  if (target.path && target.path.length > 0) {
    const nextTile = target.path[0]
    const nextTileX = nextTile.x * TILE_SIZE + TILE_SIZE / 2
    const nextTileY = nextTile.y * TILE_SIZE + TILE_SIZE / 2

    const moveDirX = nextTileX - targetCenterX
    const moveDirY = nextTileY - targetCenterY

    // Normalize movement direction
    const moveDist = Math.hypot(moveDirX, moveDirY)
    if (moveDist > 0) {
      const normalizedDirX = moveDirX / moveDist
      const normalizedDirY = moveDirY / moveDist

      // Use target's speed or default to a reasonable value
      const targetSpeed = target.effectiveSpeed || 0.35 // Default speed if not specified

      targetVelocityX = normalizedDirX * targetSpeed * TILE_SIZE
      targetVelocityY = normalizedDirY * targetSpeed * TILE_SIZE
    }
  }

  // Current distance between shooter and target
  const dx = targetCenterX - shooterCenterX
  const dy = targetCenterY - shooterCenterY
  const currentDistance = Math.hypot(dx, dy)

  // Initial time estimate (how long it would take to hit the target at its current position)
  let interceptTime = currentDistance / (projectileSpeed * TILE_SIZE)

  // Iterative solution for better precision (3 iterations usually sufficient)
  for (let i = 0; i < 3; i++) {
    // Predict where target will be after interceptTime
    const futureX = targetCenterX + targetVelocityX * interceptTime * calibrationFactor
    const futureY = targetCenterY + targetVelocityY * interceptTime * calibrationFactor

    // Recalculate distance to future position
    const futureRelativeX = futureX - shooterCenterX
    const futureRelativeY = futureY - shooterCenterY
    const futureDistance = Math.hypot(futureRelativeX, futureRelativeY)

    // Update interceptTime
    interceptTime = futureDistance / (projectileSpeed * TILE_SIZE)
  }

  // Final prediction
  const predictedX = targetCenterX + targetVelocityX * interceptTime * calibrationFactor
  const predictedY = targetCenterY + targetVelocityY * interceptTime * calibrationFactor

  return { x: predictedX, y: predictedY }
}
