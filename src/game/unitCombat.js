// unitCombat.js - Handles all unit combat and targeting logic
import {
  TILE_SIZE,
  TANK_FIRE_RANGE,
  TANK_BULLET_SPEED,
  TURRET_AIMING_THRESHOLD,
  TANK_V3_BURST,
  ATTACK_PATH_CALC_INTERVAL,
  HOWITZER_RANGE_TILES,
  HOWITZER_MIN_RANGE_TILES,
  HOWITZER_RELOAD_TIME,
  HOWITZER_FIREPOWER,
  HOWITZER_PROJECTILE_SPEED,
  HOWITZER_EXPLOSION_RADIUS_TILES
} from '../config.js'
import { playSound, playPositionalSound } from '../sound.js'
import { hasClearShot, angleDiff } from '../logic.js'
import { findPath } from '../units.js'
import { stopUnitMovement } from './unifiedMovement.js'
import { gameState } from '../gameState.js'
import { updateUnitSpeedModifier } from '../utils.js'
import { getRocketSpawnPoint } from '../rendering/rocketTankImageRenderer.js'
import { logPerformance } from '../performanceUtils.js'

/**
 * Check if the turret is properly aimed at the target
 * @param {Object} unit - Tank unit
 * @param {Object} target - Target to aim at
 * @returns {boolean} True if turret is aimed within threshold
 */
function isTurretAimedAtTarget(unit, target) {
  if (unit.turretDirection === undefined || !target) {
    return false
  }

  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  let targetCenterX, targetCenterY

  if (target.tileX !== undefined) {
    // Target is a unit
    targetCenterX = target.x + TILE_SIZE / 2
    targetCenterY = target.y + TILE_SIZE / 2
  } else {
    // Target is a building
    targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
    targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
  }

  // Calculate the angle to target
  const angleToTarget = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)

  // Check if turret is aimed within the threshold
  const angleDifference = Math.abs(angleDiff(unit.turretDirection, angleToTarget))

  // Tank V3 has better aiming precision
  const aimingThreshold = unit.type === 'tank-v3' ? TURRET_AIMING_THRESHOLD * 0.5 : TURRET_AIMING_THRESHOLD

  return angleDifference <= aimingThreshold
}

/**
 * Enhanced targeting spread with controlled randomness for better accuracy
 */
function applyTargetingSpread(shooterX, shooterY, targetX, targetY, projectileType, unitType = null) {
  // Skip spread for rockets to maintain precision
  if (projectileType === 'rocket') {
    return { x: targetX, y: targetY }
  }

  // Calculate base angle and distance from shooter to target
  const baseAngle = Math.atan2(targetY - shooterY, targetX - shooterX)
  const distance = Math.hypot(targetX - shooterX, targetY - shooterY)

  // Different spread amounts based on unit type
  let maxAngleOffset
  if (unitType === 'tank-v3') {
    maxAngleOffset = 0.009 // about 0.5 degrees - very accurate
  } else if (unitType === 'tank-v2') {
    maxAngleOffset = 0.017 // about 1 degree
  } else {
    maxAngleOffset = 0.035 // about 2 degrees for standard tanks
  }

  const angleOffset = (Math.random() * 2 - 1) * maxAngleOffset
  const finalAngle = baseAngle + angleOffset

  return {
    x: shooterX + Math.cos(finalAngle) * distance,
    y: shooterY + Math.sin(finalAngle) * distance
  }
}

/**
 * Common combat logic helper - handles movement and pathfinding
 */
function handleTankMovement(unit, target, now, occupancyMap, chaseThreshold, mapGrid) {
  // Skip movement handling if unit is retreating (retreat behavior handles movement)
  if (unit.isRetreating) {
    // Still calculate distance for firing decisions
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2

    let targetCenterX, targetCenterY

    if (target.tileX !== undefined) {
      // Target is a unit
      targetCenterX = target.x + TILE_SIZE / 2
      targetCenterY = target.y + TILE_SIZE / 2
    } else {
      // Target is a building
      targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
      targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
    }

    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)
    return { distance, targetCenterX, targetCenterY }
  }

  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  let targetCenterX, targetCenterY, targetTileX, targetTileY

  if (target.tileX !== undefined) {
    // Target is a unit
    targetCenterX = target.x + TILE_SIZE / 2
    targetCenterY = target.y + TILE_SIZE / 2
    targetTileX = target.tileX
    targetTileY = target.tileY
  } else {
    // Target is a building
    targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
    targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
    targetTileX = target.x + Math.floor(target.width / 2)
    targetTileY = target.y + Math.floor(target.height / 2)
  }

  const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

  // Combat movement logic - stop and attack if in range
  // Exception: Don't stop movement if unit is retreating
  const effectiveRange = getEffectiveFireRange(unit)
  if (distance <= effectiveRange && !unit.isRetreating && !unit.remoteControlActive) {
    // In firing range - stop all movement and clear path
    if (unit.path && unit.path.length > 0) {
      unit.path = [] // Clear path to stop movement when in range
      unit.moveTarget = null // Clear movement target when in firing range
    }
    // Force stop using unified movement system
    stopUnitMovement(unit)

  } else if (distance > chaseThreshold && !unit.isRetreating) {
    // Only create new path if attack path cooldown has passed (3 seconds)
    if (!unit.lastAttackPathCalcTime || now - unit.lastAttackPathCalcTime > ATTACK_PATH_CALC_INTERVAL) {
      if (!unit.path || unit.path.length === 0) {
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          { x: targetTileX, y: targetTileY },
          mapGrid,
          occupancyMap
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
          unit.moveTarget = { x: targetTileX, y: targetTileY } // Set movement target for green indicator
          unit.lastAttackPathCalcTime = now
        }
      }
    }
  }

  return { distance, targetCenterX, targetCenterY }
}

// Combat configuration constants
const COMBAT_CONFIG = {
  CHASE_MULTIPLIER: {
    STANDARD: 1.5,
    ROCKET: 1.8
  },
  FIRE_RATES: {
    STANDARD: 4000,  // Doubled from 2000ms to 4000ms
    ROCKET: 12000    // Doubled from 6000ms to 12000ms
  },
  DAMAGE: {
    STANDARD: 25,
    TANK_V3: 30,
    ROCKET: 20
  },
  RANGE_MULTIPLIER: {
    ROCKET: 1.5
  },
  ROCKET_BURST: {
    COUNT: 3,
    DELAY: 200
  },
  TANK_V3_BURST: {
    COUNT: TANK_V3_BURST.COUNT,
    DELAY: TANK_V3_BURST.DELAY
  }
}

/**
 * Common firing logic helper - handles bullet creation
 */
function handleTankFiring(unit, target, bullets, now, fireRate, targetCenterX, targetCenterY, projectileType = 'bullet', units, mapGrid, usePredictiveAiming = false, overrideTarget = null) {
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  // Check crew restrictions for firing
  if (unit.crew && typeof unit.crew === 'object' && !unit.crew.loader) {
    // Tank cannot fire without loader
    return false
  }

  if (!unit.lastShotTime || now - unit.lastShotTime >= fireRate) {
    // Check if turret is properly aimed at the target before firing
    const clearShot = unit.type === 'rocketTank' || unit.type === 'howitzer' || hasClearShot(unit, target, units)
    if (unit.canFire !== false && clearShot && isTurretAimedAtTarget(unit, target)) {
      // Calculate aim position (with predictive aiming if enabled)
      let aimX = overrideTarget ? overrideTarget.x : targetCenterX
      let aimY = overrideTarget ? overrideTarget.y : targetCenterY

      if (!overrideTarget && usePredictiveAiming && target.lastKnownX !== undefined && target.lastKnownY !== undefined) {
        const targetVelX = targetCenterX - target.lastKnownX
        const targetVelY = targetCenterY - target.lastKnownY
        const bulletSpeed = projectileType === 'rocket' ? 3 : TANK_BULLET_SPEED
        const distance = Math.sqrt((targetCenterX - unitCenterX) ** 2 + (targetCenterY - unitCenterY) ** 2)

        // Conservative predictive aiming with velocity damping
        const velocityMagnitude = Math.hypot(targetVelX, targetVelY)
        const dampingFactor = Math.min(1, 20 / (velocityMagnitude + 1)) // Reduce prediction for fast targets
        const baseLead = Math.min(0.3, distance / (bulletSpeed * 100)) // Scale with distance
        const leadFactor = baseLead * dampingFactor

        aimX = targetCenterX + targetVelX * leadFactor
        aimY = targetCenterY + targetVelY * leadFactor
      }

      // Store current position for next frame's velocity calculation (for predictive aiming)
      if (usePredictiveAiming && !overrideTarget) {
        target.lastKnownX = targetCenterX
        target.lastKnownY = targetCenterY
      }

      let finalTarget
      if (overrideTarget) {
        finalTarget = overrideTarget
      } else {
        finalTarget = applyTargetingSpread(unitCenterX, unitCenterY, aimX, aimY, projectileType, unit.type)
      }

      const angle = Math.atan2(finalTarget.y - unitCenterY, finalTarget.x - unitCenterX)

      const isRocketTankRocket = projectileType === 'rocket' && unit.type === 'rocketTank'
      let projectileSpeed = isRocketTankRocket ? 6 : (projectileType === 'rocket' ? 3 : TANK_BULLET_SPEED)
      if (projectileType === 'howitzerShell') {
        projectileSpeed = unit.projectileSpeed || HOWITZER_PROJECTILE_SPEED
      }

      let rocketSpawn = null
      if (isRocketTankRocket) {
        rocketSpawn = getRocketSpawnPoint(unit, unitCenterX, unitCenterY)
      }

      const bullet = {
        id: Date.now() + Math.random(),
        x: isRocketTankRocket ? rocketSpawn.x : unitCenterX,
        y: isRocketTankRocket ? rocketSpawn.y : unitCenterY,
        speed: projectileSpeed,
        baseDamage: getDamageForUnit(unit),
        active: true,
        shooter: unit,
        homing: isRocketTankRocket ? false : (projectileType === 'rocket'),
        target: projectileType === 'rocket' ? target : null,
        targetPosition: { x: finalTarget.x, y: finalTarget.y },
        startTime: now
      }

      if (isRocketTankRocket) {
        const dx = finalTarget.x - rocketSpawn.x
        const dy = finalTarget.y - rocketSpawn.y
        const distance = Math.hypot(dx, dy)
        bullet.ballistic = true
        bullet.startX = rocketSpawn.x
        bullet.startY = rocketSpawn.y
        bullet.targetX = finalTarget.x
        bullet.targetY = finalTarget.y
        bullet.dx = dx
        bullet.dy = dy
        bullet.distance = distance
        bullet.flightDuration = distance / projectileSpeed
        bullet.ballisticDuration = bullet.flightDuration / 2
        bullet.arcHeight = Math.max(50, distance * 0.3)
      } else if (projectileType === 'howitzerShell') {
        const dx = finalTarget.x - unitCenterX
        const dy = finalTarget.y - unitCenterY
        const distance = Math.hypot(dx, dy)
        bullet.parabolic = true
        bullet.startX = bullet.x
        bullet.startY = bullet.y
        bullet.targetX = finalTarget.x
        bullet.targetY = finalTarget.y
        bullet.dx = dx
        bullet.dy = dy
        bullet.distance = distance
        bullet.flightDuration = Math.max(600, distance / projectileSpeed)
        bullet.arcHeight = Math.max(TILE_SIZE * 2, distance * 0.4)
        bullet.targetPosition = { x: finalTarget.x, y: finalTarget.y }
        const explosionTiles = unit.explosionRadiusTiles || HOWITZER_EXPLOSION_RADIUS_TILES
        bullet.explosionRadius = explosionTiles * TILE_SIZE
      } else if (!bullet.homing) {
        bullet.vx = bullet.speed * Math.cos(angle)
        bullet.vy = bullet.speed * Math.sin(angle)
      }

      bullets.push(bullet)
      let soundName = projectileType === 'rocket' ? 'shoot_rocket' : 'shoot'
      let vol = projectileType === 'rocket' ? 0.3 : 0.5
      if (projectileType === 'howitzerShell') {
        soundName = 'shoot_heavy'
        vol = 0.5
      }
      playPositionalSound(soundName, bullet.x, bullet.y, vol)
      unit.lastShotTime = now

      // Trigger recoil and muzzle flash animations
      unit.recoilStartTime = now
      unit.muzzleFlashStartTime = now

      return true
    }
  }
  return false
}

/**
 * Get damage value based on unit type
 */
function getDamageForUnit(unit) {
  if (!unit) return COMBAT_CONFIG.DAMAGE.STANDARD
  let baseDamage
  switch (unit.type) {
    case 'tank-v3':
      baseDamage = COMBAT_CONFIG.DAMAGE.TANK_V3
      break
    case 'rocketTank':
      baseDamage = COMBAT_CONFIG.DAMAGE.ROCKET
      break
    case 'howitzer':
      baseDamage = unit.firepower || HOWITZER_FIREPOWER
      break
    default:
      baseDamage = COMBAT_CONFIG.DAMAGE.STANDARD
      break
  }
  const multiplier = unit.damageMultiplier || 1
  return Math.round(baseDamage * multiplier)
}

/**
 * Handle burst fire for rocket tanks (replaces setTimeout)
 */
function handleRocketBurstFire(unit, target, bullets, now, targetCenterX, targetCenterY, units, mapGrid) {
  if (!unit.burstState) {
    unit.burstState = {
      rocketsToFire: COMBAT_CONFIG.ROCKET_BURST.COUNT,
      lastRocketTime: 0
    }
  }

  // Fire rockets with proper timing in the game loop
  if (unit.burstState.rocketsToFire > 0 &&
        now - unit.burstState.lastRocketTime >= COMBAT_CONFIG.ROCKET_BURST.DELAY) {

    const fired = handleTankFiring(unit, target, bullets, now, 0, targetCenterX, targetCenterY, 'rocket', units, mapGrid, false, null)

    if (fired) {
      unit.burstState.rocketsToFire--
      unit.burstState.lastRocketTime = now

      if (unit.burstState.rocketsToFire <= 0) {
        unit.burstState = null // Reset burst state
        unit.lastShotTime = now // Set cooldown for next burst
        return true // Burst complete
      }
    }
  }

  return false // Burst still in progress or failed
}

/**
 * Handle burst fire for tank V3 (2 bullets per burst)
 */
function handleTankV3BurstFire(unit, target, bullets, now, targetCenterX, targetCenterY, units, mapGrid) {
  if (!unit.burstState) {
    unit.burstState = {
      bulletsToFire: COMBAT_CONFIG.TANK_V3_BURST.COUNT,
      lastBulletTime: 0
    }
  }

  // Fire bullets with proper timing in the game loop
  if (unit.burstState.bulletsToFire > 0 &&
        now - unit.burstState.lastBulletTime >= COMBAT_CONFIG.TANK_V3_BURST.DELAY) {

    // Calculate fresh predictive aim for each shot in the burst
    let aimX = targetCenterX
    let aimY = targetCenterY

    // Apply predictive aiming if we have previous target position data
    if (target.lastKnownX !== undefined && target.lastKnownY !== undefined) {
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      const targetVelX = targetCenterX - target.lastKnownX
      const targetVelY = targetCenterY - target.lastKnownY
      const bulletSpeed = TANK_BULLET_SPEED
      const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

      // Conservative predictive aiming with velocity damping
      // Reduce prediction strength for high velocities to avoid overshooting
      const velocityMagnitude = Math.hypot(targetVelX, targetVelY)
      const dampingFactor = Math.min(1, 20 / (velocityMagnitude + 1)) // Reduce prediction for fast targets
      const baseLead = Math.min(0.3, distance / (bulletSpeed * 100)) // Scale with distance
      const leadFactor = baseLead * dampingFactor

      aimX = targetCenterX + targetVelX * leadFactor
      aimY = targetCenterY + targetVelY * leadFactor
    }

    // Update target position for next frame's velocity calculation
    target.lastKnownX = targetCenterX
    target.lastKnownY = targetCenterY

    // Don't apply targeting spread here - it will be applied in handleTankFiring
    const aimTarget = { x: aimX, y: aimY }

    const fired = handleTankFiring(
      unit,
      target,
      bullets,
      now,
      0,
      targetCenterX,
      targetCenterY,
      'bullet',
      units,
      mapGrid,
      false,
      aimTarget
    )

    if (fired) {
      unit.burstState.bulletsToFire--
      unit.burstState.lastBulletTime = now

      if (unit.burstState.bulletsToFire <= 0) {
        unit.burstState = null // Reset burst state
        unit.lastShotTime = now // Set cooldown for next burst
        return true // Burst complete
      }
    }
  }

  return false // Burst still in progress or failed
}

/**
 * Handle Tesla Coil status effects
 */
function handleTeslaEffects(unit, now) {
  if (unit.teslaDisabledUntil && now < unit.teslaDisabledUntil) {
    unit.canFire = false
    unit.baseSpeedModifier = 0.2 // 80% slow from Tesla
    updateUnitSpeedModifier(unit) // Combine with health modifier
  } else if (unit.teslaDisabledUntil && now >= unit.teslaDisabledUntil) {
    unit.canFire = true
    unit.baseSpeedModifier = 1.0 // Remove Tesla slow effect
    updateUnitSpeedModifier(unit) // Recalculate with health modifier
    unit.teslaDisabledUntil = null
    unit.teslaSlowUntil = null
    unit.teslaSlowed = false
  }
}

/**
 * Process attack queue for units with multiple targets
 */
function processAttackQueue(unit, units, mapGrid) {
  // Don't process attack queue during retreat
  if (unit.isRetreating) {
    return
  }

  // Only process if unit has an attack queue
  if (!unit.attackQueue || unit.attackQueue.length === 0) {
    return
  }

  // Remove any dead targets from the queue first
  unit.attackQueue = unit.attackQueue.filter(target => target && target.health > 0)

  // If queue is now empty, clear everything
  if (unit.attackQueue.length === 0) {
    unit.attackQueue = null
    unit.target = null
    return
  }

  // Helper function to initiate pathfinding to new target
  function setNewTargetWithPath(newTarget) {
    const oldTarget = unit.target
    unit.target = newTarget

    // Only recalculate path if target actually changed and not already moving to it
    if (oldTarget !== newTarget) {
      // Clear existing movement data when switching to new target
      unit.path = []
      unit.moveTarget = null

      // Immediately calculate new path with occupancy map for attack movement
      if (mapGrid) {
        const occupancyMap = gameState.occupancyMap

        // Calculate target position
        let targetTileX, targetTileY
        if (newTarget.tileX !== undefined) {
          targetTileX = Math.floor(newTarget.x / TILE_SIZE)
          targetTileY = Math.floor(newTarget.y / TILE_SIZE)
        } else {
          targetTileX = newTarget.x
          targetTileY = newTarget.y
        }

        // Calculate path to new target
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
    }
  }

  // If current target is dead/invalid or we don't have a target, set the first target from queue
  if (!unit.target || unit.target.health <= 0) {
    setNewTargetWithPath(unit.attackQueue[0])
  }

  // If current target is destroyed and it was in our queue, remove it and advance
  if (unit.target && unit.target.health <= 0) {
    // Remove the destroyed target from queue (it might be the first one)
    unit.attackQueue = unit.attackQueue.filter(target => target.id !== unit.target.id)

    // Set next target if available
    if (unit.attackQueue.length > 0) {
      setNewTargetWithPath(unit.attackQueue[0])
    } else {
      unit.attackQueue = null
      unit.target = null
      // Clear movement data when no more targets
      unit.path = []
      unit.moveTarget = null
    }
  }
}

function updateGuardTargeting(unit, units) {
  if (!unit.guardTarget || unit.isRetreating) return

  const range = getEffectiveFireRange(unit)
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  if (unit.target && unit.target.health > 0) {
    const targetCenterX = unit.target.tileX !== undefined ? unit.target.x + TILE_SIZE / 2 : unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
    const targetCenterY = unit.target.tileY !== undefined ? unit.target.y + TILE_SIZE / 2 : unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
    const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)
    if (dist > range) {
      unit.target = null
    } else {
      return
    }
  }

  let closest = null
  let closestDist = Infinity
  units.forEach(p => {
    if (p.owner !== unit.owner && p.health > 0) {
      const cx = p.x + TILE_SIZE / 2
      const cy = p.y + TILE_SIZE / 2
      const d = Math.hypot(cx - unitCenterX, cy - unitCenterY)
      if (d <= range && d < closestDist) {
        closestDist = d
        closest = p
      }
    }
  })

  if (gameState.buildings) {
    gameState.buildings.forEach(b => {
      if (b.owner !== unit.owner && b.health > 0) {
        const bx = b.x * TILE_SIZE + (b.width * TILE_SIZE) / 2
        const by = b.y * TILE_SIZE + (b.height * TILE_SIZE) / 2
        const d = Math.hypot(bx - unitCenterX, by - unitCenterY)
        if (d <= range && d < closestDist) {
          closestDist = d
          closest = b
        }
      }
    })
  }

  if (closest) {
    unit.target = closest
  }
}

/**
 * Clean up attack group targets that have been destroyed
 */
export function cleanupAttackGroupTargets() {
  if (gameState.attackGroupTargets && gameState.attackGroupTargets.length > 0) {
    gameState.attackGroupTargets = gameState.attackGroupTargets.filter(target =>
      target && target.health > 0
    )
  }
}

/**
 * Updates unit combat behavior including targeting and shooting
 */
export const updateUnitCombat = logPerformance(function updateUnitCombat(units, bullets, mapGrid, gameState, now) {
  const occupancyMap = gameState.occupancyMap

  let combatUnitsCount = 0
  let unitsWithTargets = 0

  units.forEach(unit => {
    // Skip if unit has no combat capabilities
    if (unit.type === 'harvester') return

    combatUnitsCount++
    if (unit.target) {
      unitsWithTargets++
    }

    // Handle status effects
    handleTeslaEffects(unit, now)

    // Process attack queue for units with queued targets
    processAttackQueue(unit, units, mapGrid)

    updateGuardTargeting(unit, units)

    // Combat logic for different unit types
    if (unit.type === 'tank' || unit.type === 'tank_v1') {
      updateTankCombat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'tank-v2') {
      updateTankV2Combat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'tank-v3') {
      updateTankV3Combat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'rocketTank') {
      updateRocketTankCombat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'howitzer') {
      updateHowitzerCombat(unit, units, bullets, mapGrid, now, occupancyMap)
    }
  })
}, false)

/**
 * Updates standard tank combat
 */
function updateTankCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.STANDARD

    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    )

    // Fire if in range and allowed to attack
    // Human player units can always attack, AI units need AI permission
    const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
    const effectiveRange = getEffectiveFireRange(unit)
    if (distance <= effectiveRange && canAttack) {
      const effectiveFireRate = getEffectiveFireRate(unit, COMBAT_CONFIG.FIRE_RATES.STANDARD)
      handleTankFiring(unit, unit.target, bullets, now, effectiveFireRate, targetCenterX, targetCenterY, 'bullet', units, mapGrid, false, null)
    }
  }
}

/**
 * Updates tank-v2 combat with improved targeting and alert mode
 */
function updateTankV2Combat(unit, units, bullets, mapGrid, now, occupancyMap) {
  // Alert mode: automatically scan for targets when no target is assigned
  // Skip alert mode if unit is retreating
  if (unit.alertMode && unit.owner === gameState.humanPlayer && (!unit.target || unit.target.health <= 0) && !unit.isRetreating) {
    const ALERT_SCAN_RANGE = getEffectiveFireRange(unit)
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2

    let closestEnemy = null
    let closestDistance = Infinity

    // Scan for enemy units within range
    units.forEach(potentialTarget => {
      if (potentialTarget.owner !== unit.owner && potentialTarget.health > 0) {
        const targetCenterX = potentialTarget.x + TILE_SIZE / 2
        const targetCenterY = potentialTarget.y + TILE_SIZE / 2
        const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

        if (distance <= ALERT_SCAN_RANGE && distance < closestDistance) {
          closestDistance = distance
          closestEnemy = potentialTarget
        }
      }
    })

    // Also scan for enemy buildings within range
    if (gameState.buildings) {
      gameState.buildings.forEach(building => {
        if (building.owner !== unit.owner && building.health > 0) {
          const buildingCenterX = building.x * TILE_SIZE + (building.width * TILE_SIZE) / 2
          const buildingCenterY = building.y * TILE_SIZE + (building.height * TILE_SIZE) / 2
          const distance = Math.hypot(buildingCenterX - unitCenterX, buildingCenterY - unitCenterY)

          if (distance <= ALERT_SCAN_RANGE && distance < closestDistance) {
            closestDistance = distance
            closestEnemy = building
          }
        }
      })
    }

    // Assign target if found, but don't move to chase it (alert mode stays in position)
    if (closestEnemy) {
      unit.target = closestEnemy
    }
  }

  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.STANDARD

    // Handle movement using common logic, but prevent chasing if in alert mode
    let distance, targetCenterX, targetCenterY

    if (unit.alertMode && unit.owner === gameState.humanPlayer) {
      // Alert mode: don't move, just calculate distance for firing
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2

      if (unit.target.tileX !== undefined) {
        // Target is a unit
        targetCenterX = unit.target.x + TILE_SIZE / 2
        targetCenterY = unit.target.y + TILE_SIZE / 2
      } else {
        // Target is a building
        targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
        targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      }

      distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

      // Clear target if it moves out of range in alert mode
      if (distance > TANK_FIRE_RANGE * TILE_SIZE) {
        unit.target = null
        return
      }
    } else {
      // Normal mode: use standard movement logic
      const result = handleTankMovement(
        unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
      )
      distance = result.distance
      targetCenterX = result.targetCenterX
      targetCenterY = result.targetCenterY
    }

    // Fire if in range and allowed to attack
    // Human player units can always attack, AI units need AI permission
    const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
    const effectiveRange = getEffectiveFireRange(unit)
    if (distance <= effectiveRange && canAttack) {
      const effectiveFireRate = getEffectiveFireRate(unit, COMBAT_CONFIG.FIRE_RATES.STANDARD)
      handleTankFiring(unit, unit.target, bullets, now, effectiveFireRate, targetCenterX, targetCenterY, 'bullet', units, mapGrid, false, null)
    }
  }
}

/**
 * Updates tank-v3 combat with aim-ahead feature
 */
function updateTankV3Combat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.STANDARD

    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    )

    // Fire if in range and allowed to attack
    // Human player units can always attack, AI units need AI permission
    const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
    const effectiveRange = getEffectiveFireRange(unit)
    if (distance <= effectiveRange && canAttack) {
      // Check if we need to start a new burst or continue existing one
      if (!unit.burstState) {
        // Start new burst if cooldown has passed
        const effectiveFireRate = getEffectiveFireRate(unit, COMBAT_CONFIG.FIRE_RATES.STANDARD)
        if (!unit.lastShotTime || now - unit.lastShotTime >= effectiveFireRate) {
          if (unit.canFire !== false && hasClearShot(unit, unit.target, units)) {
            unit.burstState = {
              bulletsToFire: COMBAT_CONFIG.TANK_V3_BURST.COUNT,
              lastBulletTime: 0
            }
          }
        }
      } else {
        // Continue existing burst
        handleTankV3BurstFire(unit, unit.target, bullets, now, targetCenterX, targetCenterY, units, mapGrid)
      }
    }
  }
}

/**
 * Updates rocket tank combat
 */
function updateRocketTankCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.ROCKET

    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    )

    // Fire rockets if in range and allowed to attack
    // Human player units can always attack, AI units need AI permission
    const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
    const effectiveRange = getEffectiveFireRange(unit) * COMBAT_CONFIG.RANGE_MULTIPLIER.ROCKET
    if (distance <= effectiveRange && canAttack) {
      // Check if we need to start a new burst or continue existing one
      if (!unit.burstState) {
        // Start new burst if cooldown has passed
        const effectiveFireRate = getEffectiveFireRate(unit, COMBAT_CONFIG.FIRE_RATES.ROCKET)
        if (!unit.lastShotTime || now - unit.lastShotTime >= effectiveFireRate) {
          if (unit.canFire !== false && isTurretAimedAtTarget(unit, unit.target)) {
            unit.burstState = {
              rocketsToFire: COMBAT_CONFIG.ROCKET_BURST.COUNT,
              lastRocketTime: 0
            }
          }
        }
      } else {
        // Continue existing burst
        handleRocketBurstFire(unit, unit.target, bullets, now, targetCenterX, targetCenterY, units, mapGrid)
      }
    }
  }
}

function updateHowitzerCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const maxRange = getEffectiveFireRange(unit)
    const chaseThreshold = maxRange * 0.9
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit,
      unit.target,
      now,
      occupancyMap,
      chaseThreshold,
      mapGrid
    )

    const minRangeTiles = unit.minRangeTiles !== undefined ? unit.minRangeTiles : HOWITZER_MIN_RANGE_TILES
    const minRange = minRangeTiles * TILE_SIZE
    const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)

    if (typeof distance === 'number') {
      if (distance >= minRange && distance <= maxRange && canAttack) {
        unit.canFire = true
        const reloadTime = unit.reloadTime || HOWITZER_RELOAD_TIME
        const effectiveFireRate = getEffectiveFireRate(unit, reloadTime)
        handleTankFiring(unit, unit.target, bullets, now, effectiveFireRate, targetCenterX, targetCenterY, 'howitzerShell', units, mapGrid, false, null)
      } else {
        unit.canFire = distance >= minRange
        if (distance < minRange) {
          stopUnitMovement(unit)
        }
      }
    } else {
      unit.canFire = true
    }
  } else {
    unit.canFire = true
  }
}

/**
 * Get the effective fire range for a unit (including level bonuses)
 * @param {Object} unit - The unit to get fire range for
 * @returns {number} Effective fire range in pixels
 */
function getEffectiveFireRange(unit) {
  if (!unit) return TANK_FIRE_RANGE * TILE_SIZE
  const defaultRangeTiles = unit.rangeTiles !== undefined
    ? unit.rangeTiles
    : (unit.type === 'howitzer' ? HOWITZER_RANGE_TILES : TANK_FIRE_RANGE)

  let baseRange = defaultRangeTiles * TILE_SIZE

  if (unit.rangeMultiplier) {
    baseRange *= unit.rangeMultiplier
  } else if (unit.level >= 1 && unit.type !== 'howitzer') {
    baseRange *= 1.2
  }

  return baseRange
}

/**
 * Get the effective fire rate for a unit (including level bonuses)
 * @param {Object} unit - The unit to get fire rate for
 * @param {number} baseFireRate - Base fire rate in milliseconds
 * @returns {number} Effective fire rate in milliseconds
 */
function getEffectiveFireRate(unit, baseFireRate) {
  if (!unit) return baseFireRate
  const multiplier = unit.fireRateMultiplier || (unit.level >= 3 ? 1.33 : 1)
  return baseFireRate / multiplier
}

/**
 * Apply armor reduction to incoming damage
 * @param {Object} unit - The unit taking damage
 * @param {number} baseDamage - Base damage amount
 * @returns {number} Reduced damage after armor
 */
function applyArmorReduction(unit, baseDamage) {
  if (unit.armor && unit.armor > 1) {
    // Armor reduces damage by a percentage
    // Level 2 gives 50% armor increase
    const armorMultiplier = unit.armor
    return baseDamage / armorMultiplier
  }
  return baseDamage
}
