// unitCombat.js - Handles all unit combat and targeting logic
import { TILE_SIZE, TANK_FIRE_RANGE, TARGETING_SPREAD, TANK_BULLET_SPEED } from '../config.js'
import { playSound } from '../sound.js'
import { triggerExplosion, hasClearShot, findPositionWithClearShot, smoothRotateTowardsAngle, angleDiff } from '../logic.js'
import { findPath, buildOccupancyMap } from '../units.js'

/**
 * Applies targeting spread for tanks and turrets (not rockets)
 */
function applyTargetingSpread(targetX, targetY, projectileType) {
  // Skip spread for rockets to maintain their precision
  if (projectileType === 'rocket') {
    return { x: targetX, y: targetY }
  }
  
  // Apply random spread within TARGETING_SPREAD radius using circular distribution
  const angle = Math.random() * Math.PI * 2
  const distance = Math.random() * TARGETING_SPREAD
  
  const spreadX = targetX + Math.cos(angle) * distance
  const spreadY = targetY + Math.sin(angle) * distance
  
  return {
    x: spreadX,
    y: spreadY
  }
}

/**
 * Updates unit combat behavior including targeting and shooting
 */
export function updateUnitCombat(units, bullets, mapGrid, gameState, now) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)

  units.forEach(unit => {
    // Skip if unit has no combat capabilities
    if (unit.type === 'harvester') return

    // Tesla Coil effect handling
    if (unit.teslaDisabledUntil && now < unit.teslaDisabledUntil) {
      unit.canFire = false
      unit.speedModifier = 0.2 // 70% slow
    } else if (unit.teslaDisabledUntil && now >= unit.teslaDisabledUntil) {
      unit.canFire = true
      unit.speedModifier = 1
      unit.teslaDisabledUntil = null
      unit.teslaSlowUntil = null
      unit.teslaSlowed = false
    }

    // Combat logic for different unit types
    if (unit.type === 'tank' || unit.type === 'tank_v1') {
      updateTankCombat(unit, units, bullets, mapGrid, gameState, now, occupancyMap)
    } else if (unit.type === 'tank-v2') {
      updateTankV2Combat(unit, units, bullets, mapGrid, gameState, now, occupancyMap)
    } else if (unit.type === 'tank-v3') {
      updateTankV3Combat(unit, units, bullets, mapGrid, gameState, now, occupancyMap)
    } else if (unit.type === 'rocketTank') {
      updateRocketTankCombat(unit, units, bullets, mapGrid, gameState, now, occupancyMap)
    }
  })
}

/**
 * Updates standard tank combat
 */
function updateTankCombat(unit, units, bullets, mapGrid, gameState, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2
    
    let targetCenterX, targetCenterY, targetTileX, targetTileY
    
    if (unit.target.tileX !== undefined) {
      // Target is a unit - use pixel coordinates for center, tile coordinates for pathfinding
      targetCenterX = unit.target.x + TILE_SIZE / 2
      targetCenterY = unit.target.y + TILE_SIZE / 2
      targetTileX = unit.target.tileX
      targetTileY = unit.target.tileY
    } else {
      // Target is a building - convert tile coordinates to pixel coordinates for center
      targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
      targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      targetTileX = unit.target.x + Math.floor(unit.target.width / 2)
      targetTileY = unit.target.y + Math.floor(unit.target.height / 2)
    }
    
    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

    // Move towards target if not in range
    if (distance > TANK_FIRE_RANGE * TILE_SIZE) {
      if (!unit.path || unit.path.length === 0) {
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          { x: targetTileX, y: targetTileY },
          mapGrid,
          occupancyMap
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
    } else {
      // In range - prepare to fire
      if (!unit.lastShotTime || now - unit.lastShotTime >= 2000) {
        if (unit.canFire !== false && hasClearShot(unit, unit.target, units, mapGrid)) {
          fireBullet(unit, unit.target, bullets, now, 'bullet')
          unit.lastShotTime = now
        }
      }
    }
  }
}

/**
 * Updates tank-v2 combat with improved targeting
 */
function updateTankV2Combat(unit, units, bullets, mapGrid, gameState, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2
    
    let targetCenterX, targetCenterY, targetTileX, targetTileY
    
    if (unit.target.tileX !== undefined) {
      // Target is a unit - use pixel coordinates for center, tile coordinates for pathfinding
      targetCenterX = unit.target.x + TILE_SIZE / 2
      targetCenterY = unit.target.y + TILE_SIZE / 2
      targetTileX = unit.target.tileX
      targetTileY = unit.target.tileY
    } else {
      // Target is a building - convert tile coordinates to pixel coordinates for center
      targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
      targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      targetTileX = unit.target.x + Math.floor(unit.target.width / 2)
      targetTileY = unit.target.y + Math.floor(unit.target.height / 2)
    }
    
    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

    // Move towards target if not in range
    if (distance > TANK_FIRE_RANGE * TILE_SIZE) {
      if (!unit.path || unit.path.length === 0) {
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          { x: targetTileX, y: targetTileY },
          mapGrid,
          occupancyMap
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
    } else {
      // In range - prepare to fire with spread
      if (!unit.lastShotTime || now - unit.lastShotTime >= 2000) {
        if (unit.canFire !== false && hasClearShot(unit, unit.target, units, mapGrid)) {
          // Apply targeting spread for tank-v2
          const spreadTarget = applyTargetingSpread(targetCenterX, targetCenterY, 'bullet')
          
          const bullet = {
            id: Date.now() + Math.random(),
            x: unitCenterX,
            y: unitCenterY,
            speed: 4,
            baseDamage: 25,
            active: true,
            shooter: unit,
            homing: false,
            targetPosition: { x: spreadTarget.x, y: spreadTarget.y }
          }

          const angle = Math.atan2(spreadTarget.y - unitCenterY, spreadTarget.x - unitCenterX)
          bullet.vx = bullet.speed * Math.cos(angle)
          bullet.vy = bullet.speed * Math.sin(angle)

          bullets.push(bullet)
          playSound('shoot', 0.5)
          unit.lastShotTime = now
        }
      }
    }
  }
}

/**
 * Updates tank-v3 combat with aim-ahead feature
 */
function updateTankV3Combat(unit, units, bullets, mapGrid, gameState, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2
    
    let targetCenterX, targetCenterY, targetTileX, targetTileY
    
    if (unit.target.tileX !== undefined) {
      // Target is a unit - use pixel coordinates for center, tile coordinates for pathfinding
      targetCenterX = unit.target.x + TILE_SIZE / 2
      targetCenterY = unit.target.y + TILE_SIZE / 2
      targetTileX = unit.target.tileX
      targetTileY = unit.target.tileY
    } else {
      // Target is a building - convert tile coordinates to pixel coordinates for center
      targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
      targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      targetTileX = unit.target.x + Math.floor(unit.target.width / 2)
      targetTileY = unit.target.y + Math.floor(unit.target.height / 2)
    }
    
    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

    // Move towards target if not in range
    if (distance > TANK_FIRE_RANGE * TILE_SIZE) {
      if (!unit.path || unit.path.length === 0) {
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          { x: targetTileX, y: targetTileY },
          mapGrid,
          occupancyMap
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
    } else {
      // In range - fire with aim-ahead
      if (!unit.lastShotTime || now - unit.lastShotTime >= 2000) {
        if (unit.canFire !== false && hasClearShot(unit, unit.target, units, mapGrid)) {
          // Calculate aim-ahead position
          let aimX = targetCenterX
          let aimY = targetCenterY

          if (unit.target.lastKnownX !== undefined && unit.target.lastKnownY !== undefined) {
            const targetVelX = targetCenterX - unit.target.lastKnownX
            const targetVelY = targetCenterY - unit.target.lastKnownY
            const bulletSpeed = 4
            const timeToTarget = distance / (bulletSpeed * TILE_SIZE)
            aimX = targetCenterX + targetVelX * timeToTarget * 10
            aimY = targetCenterY + targetVelY * timeToTarget * 10
          }

          // Store current position for next frame's velocity calculation
          unit.target.lastKnownX = targetCenterX
          unit.target.lastKnownY = targetCenterY

          const bullet = {
            id: Date.now() + Math.random(),
            x: unitCenterX,
            y: unitCenterY,
            speed: 4,
            baseDamage: 30,
            active: true,
            shooter: unit,
            homing: false,
            targetPosition: { x: aimX, y: aimY }
          }

          const angle = Math.atan2(aimY - unitCenterY, aimX - unitCenterX)
          bullet.vx = bullet.speed * Math.cos(angle)
          bullet.vy = bullet.speed * Math.sin(angle)

          bullets.push(bullet)
          playSound('shoot', 0.5)
          unit.lastShotTime = now
        }
      }
    }
  }
}

/**
 * Updates rocket tank combat
 */
function updateRocketTankCombat(unit, units, bullets, mapGrid, gameState, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2
    
    let targetCenterX, targetCenterY, targetTileX, targetTileY
    
    if (unit.target.tileX !== undefined) {
      // Target is a unit - use pixel coordinates for center, tile coordinates for pathfinding
      targetCenterX = unit.target.x + TILE_SIZE / 2
      targetCenterY = unit.target.y + TILE_SIZE / 2
      targetTileX = unit.target.tileX
      targetTileY = unit.target.tileY
    } else {
      // Target is a building - convert tile coordinates to pixel coordinates for center
      targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
      targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      targetTileX = unit.target.x + Math.floor(unit.target.width / 2)
      targetTileY = unit.target.y + Math.floor(unit.target.height / 2)
    }
    
    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

    // Move towards target if not in range
    if (distance > TANK_FIRE_RANGE * TILE_SIZE * 1.5) { // Rockets have longer range
      if (!unit.path || unit.path.length === 0) {
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          { x: targetTileX, y: targetTileY },
          mapGrid,
          occupancyMap
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
    } else {
      // In range - fire rockets with burst
      if (!unit.lastShotTime || now - unit.lastShotTime >= 6000) {
        if (unit.canFire !== false) {
          // Fire 3 rockets in quick succession
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              const rocket = {
                id: Date.now() + Math.random(),
                x: unitCenterX,
                y: unitCenterY,
                speed: 3, // Slower rockets
                baseDamage: 10, // Lower damage per rocket
                active: true,
                shooter: unit,
                homing: true,
                target: unit.target,
                startTime: now + (i * 200)
              }
              bullets.push(rocket)
              playSound('shoot_rocket', 0.3)
            }, i * 200)
          }
          unit.lastShotTime = now
        }
      }
    }
  }
}

/**
 * Creates and fires a bullet from a unit
 */
function fireBullet(unit, target, bullets, now, projectileType) {
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2
  
  let targetCenterX, targetCenterY
  
  if (target.tileX !== undefined) {
    // Target is a unit - use pixel coordinates
    targetCenterX = target.x + TILE_SIZE / 2
    targetCenterY = target.y + TILE_SIZE / 2
  } else {
    // Target is a building - convert tile coordinates to pixel coordinates
    targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
    targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
  }

  // Apply targeting spread
  const spreadTarget = applyTargetingSpread(targetCenterX, targetCenterY, projectileType)

  const bullet = {
    id: Date.now() + Math.random(),
    x: unitCenterX,
    y: unitCenterY,
    speed: TANK_BULLET_SPEED,
    baseDamage: unit.type === 'tank-v3' ? 30 : 25,
    active: true,
    shooter: unit,
    homing: false,
    targetPosition: { x: spreadTarget.x, y: spreadTarget.y }
  }

  const angle = Math.atan2(spreadTarget.y - unitCenterY, spreadTarget.x - unitCenterX)
  bullet.vx = bullet.speed * Math.cos(angle)
  bullet.vy = bullet.speed * Math.sin(angle)

  bullets.push(bullet)
  playSound('shoot', 0.5)
}
