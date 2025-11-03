// unitCombat.js - Handles all unit combat and targeting logic
import { TILE_SIZE, TANK_FIRE_RANGE, TANK_BULLET_SPEED, TURRET_AIMING_THRESHOLD, TANK_V3_BURST, ATTACK_PATH_CALC_INTERVAL, HOWITZER_FIRE_RANGE, HOWITZER_MIN_RANGE, HOWITZER_FIREPOWER, HOWITZER_FIRE_COOLDOWN, HOWITZER_PROJECTILE_SPEED, HOWITZER_EXPLOSION_RADIUS_TILES, APACHE_RANGE_REDUCTION } from '../config.js'
import { playSound, playPositionalSound } from '../sound.js'
import { hasClearShot, angleDiff, smoothRotateTowardsAngle } from '../logic.js'
import { findPath } from '../units.js'
import { stopUnitMovement } from './unifiedMovement.js'
import { gameState } from '../gameState.js'
import { updateUnitSpeedModifier } from '../utils.js'
import { getRocketSpawnPoint } from '../rendering/rocketTankImageRenderer.js'
import { getApacheRocketSpawnPoints } from '../rendering/apacheImageRenderer.js'
import { logPerformance } from '../performanceUtils.js'
import { isPositionVisibleToPlayer } from './shadowOfWar.js'

/**
 * Check if the turret is properly aimed at the target
 * @param {Object} unit - Tank unit
 * @param {Object} target - Target to aim at
 * @returns {boolean} True if turret is aimed within threshold
 */
function isTurretAimedAtTarget(unit, target) {
  if (!target) {
    return false
  }

  if (unit.type === 'howitzer') {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2

    let targetCenterX
    let targetCenterY

    if (target.tileX !== undefined) {
      targetCenterX = target.x + TILE_SIZE / 2
      targetCenterY = target.y + TILE_SIZE / 2
    } else {
      targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
      targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
    }

    const angleToTarget = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)
    const angleDifference = Math.abs(angleDiff(unit.direction || 0, angleToTarget))
    return angleDifference <= TURRET_AIMING_THRESHOLD
  }

  if (unit.turretDirection === undefined) {
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

function getApacheTargetCenter(target) {
  if (!target) {
    return null
  }

  if (target.tileX !== undefined) {
    return {
      x: target.x + TILE_SIZE / 2,
      y: target.y + TILE_SIZE / 2
    }
  }

  return {
    x: (target.x + (target.width || 1) / 2) * TILE_SIZE,
    y: (target.y + (target.height || 1) / 2) * TILE_SIZE
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
    ROCKET: 20,
    APACHE: 10
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
    const clearShot = unit.type === 'rocketTank' || unit.type === 'apache' || hasClearShot(unit, target, units)
    const turretAimed = unit.type === 'apache' ? true : isTurretAimedAtTarget(unit, target)
    if (unit.canFire !== false && clearShot && turretAimed) {
      const targetIsAirborneApache = target && target.type === 'apache' && target.flightState !== 'grounded'
      const shooterCanHitAir =
        unit.type === 'rocketTank' ||
        unit.type === 'apache' ||
        unit.type === 'rocketTurret' ||
        unit.type === 'teslaCoil'
      if (targetIsAirborneApache && !shooterCanHitAir) {
        return false
      }
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
      const isApacheRocket = projectileType === 'rocket' && unit.type === 'apache'
      const bulletSpeed = isRocketTankRocket
        ? 6
        : (projectileType === 'rocket' ? (isApacheRocket ? 5 : 3) : TANK_BULLET_SPEED)

      let rocketSpawn = null
      if (isRocketTankRocket) {
        rocketSpawn = getRocketSpawnPoint(unit, unitCenterX, unitCenterY)
      } else if (isApacheRocket) {
        rocketSpawn = unit.customRocketSpawn || getApacheRocketSpawnPoints(unit, unitCenterX, unitCenterY).left
      }

      const bullet = {
        id: Date.now() + Math.random(),
        x: (isRocketTankRocket || isApacheRocket) ? rocketSpawn.x : unitCenterX,
        y: (isRocketTankRocket || isApacheRocket) ? rocketSpawn.y : unitCenterY,
        speed: bulletSpeed,
        baseDamage: getDamageForUnitType(unit.type),
        active: true,
        shooter: unit,
        homing: isRocketTankRocket ? false : (isApacheRocket ? false : (projectileType === 'rocket')),
        target: projectileType === 'rocket' && !isApacheRocket ? target : null,
        targetPosition: { x: finalTarget.x, y: finalTarget.y },
        startTime: now,
        projectileType
      }

      if (isApacheRocket) {
        bullet.explosionRadius = TILE_SIZE
        bullet.skipCollisionChecks = true
        bullet.maxFlightTime = 3000 // 3 seconds max flight time before forced explosion
        bullet.creationTime = now
        bullet.startX = rocketSpawn.x
        bullet.startY = rocketSpawn.y
        // Apache rockets fly straight to their target position
        const dx = finalTarget.x - rocketSpawn.x
        const dy = finalTarget.y - rocketSpawn.y
        const distance = Math.hypot(dx, dy)
        bullet.vx = (dx / distance) * bulletSpeed
        bullet.vy = (dy / distance) * bulletSpeed
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
        bullet.flightDuration = distance / bulletSpeed
        bullet.ballisticDuration = bullet.flightDuration / 2
        bullet.arcHeight = Math.max(50, distance * 0.3)
      } else if (!bullet.homing) {
        bullet.vx = bullet.speed * Math.cos(angle)
        bullet.vy = bullet.speed * Math.sin(angle)
      }

      bullets.push(bullet)
      const soundName = projectileType === 'rocket' ? 'shoot_rocket' : 'shoot'
      const vol = projectileType === 'rocket' ? 0.3 : 0.5
      playPositionalSound(soundName, bullet.x, bullet.y, vol)
      unit.lastShotTime = now

      // Trigger recoil and muzzle flash animations
      unit.recoilStartTime = now
      unit.muzzleFlashStartTime = now

      if (isApacheRocket && unit.customRocketSpawn) {
        delete unit.customRocketSpawn
      }
      if (isApacheRocket) {
        bullet.originType = 'apacheRocket'
      }

      return true
    }
  }
  return false
}

/**
 * Get damage value based on unit type
 */
function getDamageForUnitType(unitType) {
  switch (unitType) {
    case 'tank-v3': return COMBAT_CONFIG.DAMAGE.TANK_V3
    case 'rocketTank': return COMBAT_CONFIG.DAMAGE.ROCKET
    case 'apache': return COMBAT_CONFIG.DAMAGE.APACHE
    default: return COMBAT_CONFIG.DAMAGE.STANDARD
  }
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
 * Handle multi-rocket volley for Apache helicopter
 */
function handleApacheVolley(unit, target, bullets, now, targetCenterX, targetCenterY, units, mapGrid) {
  const availableAmmo = Math.max(0, Math.floor(unit.rocketAmmo || 0))
  if (availableAmmo <= 0) {
    unit.volleyState = null
    unit.apacheAmmoEmpty = true
    unit.canFire = false
    return true
  }

  if (!unit.volleyState) {
    const rocketsThisVolley = Math.min(8, availableAmmo)
    const leftCount = Math.min(4, Math.ceil(rocketsThisVolley / 2))
    const rightCount = Math.min(4, rocketsThisVolley - leftCount)

    unit.volleyState = {
      leftRemaining: leftCount,
      rightRemaining: rightCount,
      lastRocketTime: 0,
      delay: 120,
      nextSide: 'left',
      totalInVolley: rocketsThisVolley
    }
  }

  const state = unit.volleyState
  if (state.leftRemaining <= 0 && state.rightRemaining <= 0) {
    unit.volleyState = null
    return true
  }

  if (now - state.lastRocketTime < state.delay) {
    return false
  }

  let side = state.nextSide
  if (side === 'left' && state.leftRemaining <= 0) side = 'right'
  if (side === 'right' && state.rightRemaining <= 0) side = 'left'

  if (state.leftRemaining <= 0 && state.rightRemaining <= 0) {
    unit.volleyState = null
    return true
  }

  const centerX = unit.x + TILE_SIZE / 2
  const centerY = unit.y + TILE_SIZE / 2
  const spawnPoints = getApacheRocketSpawnPoints(unit, centerX, centerY)
  const spawn = spawnPoints[side] || { x: centerX, y: centerY }

  let approachVectorX = targetCenterX - centerX
  let approachVectorY = targetCenterY - centerY
  let approachDistance = Math.hypot(approachVectorX, approachVectorY)
  if (approachDistance < 1) {
    const fallbackAngle = unit.direction || 0
    approachVectorX = Math.cos(fallbackAngle)
    approachVectorY = Math.sin(fallbackAngle)
    approachDistance = 1
  }

  const forwardNormX = approachVectorX / approachDistance
  const forwardNormY = approachVectorY / approachDistance
  const maxImpactDistance = Math.min(approachDistance, TILE_SIZE * 0.9)
  const desiredImpactDistance = Math.max(
    Math.min(TILE_SIZE * 0.3, maxImpactDistance),
    Math.min(approachDistance * 0.6, maxImpactDistance)
  )

  const baseImpactX = targetCenterX - forwardNormX * desiredImpactDistance
  const baseImpactY = targetCenterY - forwardNormY * desiredImpactDistance
  const perpendicularX = -forwardNormY
  const perpendicularY = forwardNormX
  const lateralSpan = Math.min(TILE_SIZE * 0.35, approachDistance * 0.25)
  const lateralOffset = (Math.random() - 0.5) * 2 * lateralSpan
  const forwardJitter = (Math.random() - 0.5) * Math.min(TILE_SIZE * 0.2, desiredImpactDistance * 0.4)

  let impactX = baseImpactX - forwardNormX * forwardJitter + perpendicularX * lateralOffset
  let impactY = baseImpactY - forwardNormY * forwardJitter + perpendicularY * lateralOffset

  if (Array.isArray(mapGrid) && mapGrid.length > 0 && Array.isArray(mapGrid[0])) {
    const mapWidth = mapGrid[0].length * TILE_SIZE
    const mapHeight = mapGrid.length * TILE_SIZE
    const minX = TILE_SIZE * 0.5
    const minY = TILE_SIZE * 0.5
    const maxX = Math.max(minX, mapWidth - TILE_SIZE * 0.5)
    const maxY = Math.max(minY, mapHeight - TILE_SIZE * 0.5)
    impactX = Math.max(minX, Math.min(impactX, maxX))
    impactY = Math.max(minY, Math.min(impactY, maxY))
  }

  const overrideTarget = { x: impactX, y: impactY }

  unit.customRocketSpawn = spawn
  const fired = handleTankFiring(
    unit,
    target,
    bullets,
    now,
    0,
    overrideTarget.x,
    overrideTarget.y,
    'rocket',
    units,
    mapGrid,
    false,
    overrideTarget // Override target to bypass targeting spread
  )
  unit.customRocketSpawn = null

  if (fired) {
    unit.rocketAmmo = Math.max(0, (unit.rocketAmmo || 0) - 1)
    if (side === 'left') {
      state.leftRemaining = Math.max(0, state.leftRemaining - 1)
    } else {
      state.rightRemaining = Math.max(0, state.rightRemaining - 1)
    }
    state.lastRocketTime = now
    state.nextSide = side === 'left' ? 'right' : 'left'

    if (state.leftRemaining <= 0 && state.rightRemaining <= 0) {
      unit.volleyState = null
      return true
    }
    if (unit.rocketAmmo <= 0) {
      unit.apacheAmmoEmpty = true
      unit.canFire = false
      unit.volleyState = null
      return true
    }
  }

  return false
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
  const mapGrid = gameState.mapGrid

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
      // Check if target is an airborne Apache - only certain units can target them
      const targetIsAirborneApache = p.type === 'apache' && p.flightState !== 'grounded'
      const shooterCanHitAir = unit.type === 'rocketTank' || unit.type === 'apache'

      // Skip airborne Apache if this unit can't target air units
      if (targetIsAirborneApache && !shooterCanHitAir) {
        return
      }

      const cx = p.x + TILE_SIZE / 2
      const cy = p.y + TILE_SIZE / 2
      const d = Math.hypot(cx - unitCenterX, cy - unitCenterY)
      if (d <= range && d < closestDist) {
        if (unit.type === 'howitzer' && !isPositionVisibleToPlayer(gameState, mapGrid, cx, cy)) {
          return
        }
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
          if (unit.type === 'howitzer' && !isPositionVisibleToPlayer(gameState, mapGrid, bx, by)) {
            return
          }
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
    } else if (unit.type === 'apache') {
      updateApacheCombat(unit, units, bullets, mapGrid, now, occupancyMap)
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
        // Check if target is an airborne Apache - only certain units can target them
        const targetIsAirborneApache = potentialTarget.type === 'apache' && potentialTarget.flightState !== 'grounded'
        const shooterCanHitAir = unit.type === 'rocketTank' || unit.type === 'apache'

        // Skip airborne Apache if this unit can't target air units
        if (targetIsAirborneApache && !shooterCanHitAir) {
          return
        }

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

function updateApacheCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (!unit.target || unit.target.health <= 0) {
    unit.volleyState = null
    unit.flightPlan = unit.flightPlan && unit.flightPlan.mode === 'combat' ? null : unit.flightPlan
    return
  }

  if (unit.remoteControlActive) {
    return
  }

  const ammoRemaining = Math.max(0, Math.floor(unit.rocketAmmo || 0))
  unit.apacheAmmoEmpty = ammoRemaining <= 0
  if (unit.apacheAmmoEmpty) {
    unit.canFire = false
    unit.volleyState = null
  }

  const targetCenter = getApacheTargetCenter(unit.target)
  if (!targetCenter) {
    unit.volleyState = null
    return
  }

  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2
  const dx = targetCenter.x - unitCenterX
  const dy = targetCenter.y - unitCenterY
  const distance = Math.hypot(dx, dy)

  const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
  const effectiveRange = getEffectiveFireRange(unit) * COMBAT_CONFIG.RANGE_MULTIPLIER.ROCKET
  const inRange = distance <= effectiveRange
  const directOverlapThreshold = TILE_SIZE * 0.45
  const targetDirectlyBelow = distance < directOverlapThreshold

  let existingPlan = unit.flightPlan && unit.flightPlan.mode === 'combat' ? unit.flightPlan : null
  const followTargetId = unit.target.id || null

  const desiredFacing = Math.atan2(dy, dx)
  const currentDirection = typeof unit.direction === 'number' ? unit.direction : 0
  const rotationSpeed = unit.rotationSpeed || 0.18
  const newDirection = smoothRotateTowardsAngle(currentDirection, desiredFacing, rotationSpeed)
  unit.direction = newDirection
  unit.rotation = newDirection
  if (unit.movement) {
    unit.movement.rotation = newDirection
    if (!existingPlan) {
      unit.movement.targetRotation = newDirection
    }
  }

  if (inRange && !targetDirectlyBelow) {
    if (existingPlan) {
      unit.flightPlan = null
      existingPlan = null
    }
    unit.moveTarget = null
  } else if (!unit.helipadLandingRequested) {
    let standOffX = targetCenter.x
    let standOffY = targetCenter.y
    let desiredDistance = distance

    if (targetDirectlyBelow) {
      desiredDistance = Math.max(TILE_SIZE * 1.2, effectiveRange * 0.25)
      const baseAngle = (typeof unit.direction === 'number' ? unit.direction : desiredFacing) + Math.PI / 2
      standOffX = targetCenter.x + Math.cos(baseAngle) * desiredDistance
      standOffY = targetCenter.y + Math.sin(baseAngle) * desiredDistance
    } else {
      let offsetX = unitCenterX - targetCenter.x
      let offsetY = unitCenterY - targetCenter.y
      let offsetMag = Math.hypot(offsetX, offsetY)
      if (offsetMag < 1) {
        offsetX = Math.cos(newDirection)
        offsetY = Math.sin(newDirection)
        offsetMag = 1
      }
      const normX = offsetX / offsetMag
      const normY = offsetY / offsetMag
      desiredDistance = Math.max(TILE_SIZE, Math.min(effectiveRange * 0.9, offsetMag))
      standOffX = targetCenter.x + normX * desiredDistance
      standOffY = targetCenter.y + normY * desiredDistance
    }

    if (Array.isArray(mapGrid) && mapGrid.length > 0 && Array.isArray(mapGrid[0])) {
      const maxX = mapGrid[0].length * TILE_SIZE - TILE_SIZE / 2
      const maxY = mapGrid.length * TILE_SIZE - TILE_SIZE / 2
      standOffX = Math.max(TILE_SIZE / 2, Math.min(standOffX, maxX))
      standOffY = Math.max(TILE_SIZE / 2, Math.min(standOffY, maxY))
    }

    const standOffTile = {
      x: Math.max(0, Math.floor(standOffX / TILE_SIZE)),
      y: Math.max(0, Math.floor(standOffY / TILE_SIZE))
    }

    const planStopRadius = targetDirectlyBelow
      ? Math.max(12, desiredDistance * 0.3)
      : Math.max(12, desiredDistance * 0.05)
    const distanceToStandOff = Math.hypot(unitCenterX - standOffX, unitCenterY - standOffY)
    const needsPlanUpdate =
      !existingPlan ||
      existingPlan.followTargetId !== followTargetId ||
      Math.abs((existingPlan.desiredRange || 0) - desiredDistance) > 1 ||
      Boolean(existingPlan?.strafe) !== targetDirectlyBelow

    if (needsPlanUpdate || distanceToStandOff > planStopRadius * 1.25) {
      unit.flightPlan = {
        x: standOffX,
        y: standOffY,
        stopRadius: planStopRadius,
        mode: 'combat',
        followTargetId,
        destinationTile: standOffTile,
        desiredRange: desiredDistance,
        strafe: targetDirectlyBelow
      }
      existingPlan = unit.flightPlan
    } else if (existingPlan) {
      existingPlan.x = standOffX
      existingPlan.y = standOffY
      existingPlan.stopRadius = planStopRadius
      existingPlan.destinationTile = standOffTile
      existingPlan.desiredRange = desiredDistance
      existingPlan.strafe = targetDirectlyBelow
    }

    unit.moveTarget = standOffTile
  }

  unit.autoHoldAltitude = true
  if (unit.flightState === 'grounded') {
    unit.manualFlightState = 'takeoff'
  }

  if (distance <= effectiveRange && canAttack) {
    if (!unit.volleyState && !unit.apacheAmmoEmpty) {
      const effectiveFireRate = getEffectiveFireRate(unit, COMBAT_CONFIG.FIRE_RATES.ROCKET)
      if (!unit.lastShotTime || now - unit.lastShotTime >= effectiveFireRate) {
        if (unit.canFire !== false) {
          const rocketsThisVolley = Math.min(8, ammoRemaining)
          const leftCount = Math.min(4, Math.ceil(rocketsThisVolley / 2))
          const rightCount = Math.min(4, rocketsThisVolley - leftCount)

          unit.volleyState = {
            leftRemaining: leftCount,
            rightRemaining: rightCount,
            lastRocketTime: 0,
            delay: 120,
            nextSide: 'left',
            totalInVolley: rocketsThisVolley
          }
        }
      }
    }

    if (unit.volleyState && !unit.apacheAmmoEmpty) {
      const volleyComplete = handleApacheVolley(unit, unit.target, bullets, now, targetCenter.x, targetCenter.y, units, mapGrid)
      if (volleyComplete) {
        unit.lastShotTime = now
      }
    }
  } else {
    unit.volleyState = null
  }
}

function updateHowitzerCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (!unit.target || unit.target.health <= 0) {
    return
  }

  const CHASE_THRESHOLD = getHowitzerRange(unit) * 1.1
  const { distance, targetCenterX, targetCenterY } = handleTankMovement(
    unit,
    unit.target,
    now,
    occupancyMap,
    CHASE_THRESHOLD,
    mapGrid
  )

  const canAttack = unit.owner === gameState.humanPlayer || (unit.owner !== gameState.humanPlayer && unit.allowedToAttack === true)
  const minRangePx = getHowitzerMinRange()
  const effectiveRange = getHowitzerRange(unit)
  const targetVisible = isHowitzerTargetVisible(unit, unit.target, mapGrid)
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  if (distance < minRangePx) {
    if (unit.owner !== gameState.humanPlayer && mapGrid && mapGrid.length > 0) {
      const shouldReposition = !unit.lastMinRangeReposition || (now - unit.lastMinRangeReposition > 750)
      if (shouldReposition) {
        const mapHeight = mapGrid.length
        const mapWidth = mapGrid[0]?.length || 0

        if (mapWidth > 0) {
          const retreatVectorX = unitCenterX - targetCenterX
          const retreatVectorY = unitCenterY - targetCenterY
          const retreatDistance = Math.hypot(retreatVectorX, retreatVectorY)

          if (retreatDistance > 1) {
            const desiredDistance = Math.max(minRangePx + TILE_SIZE, retreatDistance)
            const normX = retreatVectorX / retreatDistance
            const normY = retreatVectorY / retreatDistance
            const desiredX = targetCenterX + normX * desiredDistance
            const desiredY = targetCenterY + normY * desiredDistance

            const baseTileX = Math.max(0, Math.min(mapWidth - 1, Math.floor(desiredX / TILE_SIZE)))
            const baseTileY = Math.max(0, Math.min(mapHeight - 1, Math.floor(desiredY / TILE_SIZE)))

            const currentTileX = Math.floor(unitCenterX / TILE_SIZE)
            const currentTileY = Math.floor(unitCenterY / TILE_SIZE)

            const candidateOffsets = [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: -1 },
              { x: 1, y: 1 },
              { x: -1, y: -1 },
              { x: 1, y: -1 },
              { x: -1, y: 1 }
            ]

            for (const offset of candidateOffsets) {
              const tileX = Math.max(0, Math.min(mapWidth - 1, baseTileX + offset.x))
              const tileY = Math.max(0, Math.min(mapHeight - 1, baseTileY + offset.y))

              if (tileX === currentTileX && tileY === currentTileY) {
                continue
              }

              const tile = mapGrid[tileY]?.[tileX]
              if (!tile || tile.type === 'water' || tile.type === 'rock' || tile.building) {
                continue
              }

              const path = findPath(
                { x: currentTileX, y: currentTileY },
                { x: tileX, y: tileY },
                mapGrid,
                occupancyMap
              )

              if (path.length > 1) {
                unit.path = path.slice(1)
                unit.moveTarget = { x: tileX, y: tileY }
                unit.lastAttackPathCalcTime = now
                break
              }
            }
          }
        }

        unit.lastMinRangeReposition = now
      }
    }

    return
  }

  if (distance <= effectiveRange && canAttack && targetVisible && unit.canFire !== false && isTurretAimedAtTarget(unit, unit.target)) {
    if (unit.crew && typeof unit.crew === 'object' && !unit.crew.loader) {
      return
    }
    const cooldown = getHowitzerCooldown(unit)
    if (!unit.lastShotTime || now - unit.lastShotTime >= cooldown) {
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      const aimPoint = applyTargetingSpread(unitCenterX, unitCenterY, targetCenterX, targetCenterY, 'artillery', unit.type)
      fireHowitzerShell(unit, aimPoint, bullets, now)
    }
  }
}

/**
 * Get the effective fire range for a unit (including level bonuses)
 * @param {Object} unit - The unit to get fire range for
 * @returns {number} Effective fire range in pixels
 */
function getEffectiveFireRange(unit) {
  if (unit.type === 'howitzer') {
    let baseRange = HOWITZER_FIRE_RANGE * TILE_SIZE
    if (unit.rangeMultiplier) {
      baseRange *= unit.rangeMultiplier
    }
    return baseRange
  }

  let baseRange = TANK_FIRE_RANGE * TILE_SIZE

  if (unit.type === 'apache') {
    baseRange *= APACHE_RANGE_REDUCTION
  }

  if (unit.level >= 1) {
    baseRange *= (unit.rangeMultiplier || 1.2)
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
  let effectiveRate = baseFireRate

  // Apply level 3 bonus: 33% fire rate increase (faster firing = lower milliseconds)
  if (unit.level >= 3) {
    effectiveRate = baseFireRate / (unit.fireRateMultiplier || 1.33)
  }

  return effectiveRate
}

function getHowitzerRange(unit) {
  const rangeMultiplier = unit.rangeMultiplier || 1
  return HOWITZER_FIRE_RANGE * TILE_SIZE * rangeMultiplier
}

function getHowitzerMinRange() {
  return HOWITZER_MIN_RANGE * TILE_SIZE
}

function getHowitzerCooldown(unit) {
  const fireRateMultiplier = unit.fireRateMultiplier || 1
  return HOWITZER_FIRE_COOLDOWN / fireRateMultiplier
}

function getHowitzerDamage(unit) {
  const damageMultiplier = unit.damageMultiplier || 1
  return HOWITZER_FIREPOWER * damageMultiplier
}

function isHowitzerTargetVisible(unit, target, mapGrid) {
  if (!gameState.shadowOfWarEnabled) {
    return true
  }

  if (!target) return false

  let targetCenterX
  let targetCenterY

  if (target.tileX !== undefined) {
    targetCenterX = target.x + TILE_SIZE / 2
    targetCenterY = target.y + TILE_SIZE / 2
  } else {
    targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
    targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
  }

  return isPositionVisibleToPlayer(gameState, mapGrid, targetCenterX, targetCenterY)
}

function fireHowitzerShell(unit, aimTarget, bullets, now) {
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  const dx = aimTarget.x - unitCenterX
  const dy = aimTarget.y - unitCenterY
  const distance = Math.hypot(dx, dy)

  const projectile = {
    id: Date.now() + Math.random(),
    x: unitCenterX,
    y: unitCenterY,
    speed: HOWITZER_PROJECTILE_SPEED,
    baseDamage: getHowitzerDamage(unit),
    active: true,
    shooter: unit,
    startTime: now,
    parabolic: true,
    startX: unitCenterX,
    startY: unitCenterY,
    targetX: aimTarget.x,
    targetY: aimTarget.y,
    dx,
    dy,
    distance,
    flightDuration: distance / HOWITZER_PROJECTILE_SPEED,
    arcHeight: distance * 0.5,
    targetPosition: { x: aimTarget.x, y: aimTarget.y },
    explosionRadius: TILE_SIZE * HOWITZER_EXPLOSION_RADIUS_TILES,
    projectileType: 'artillery'
  }

  bullets.push(projectile)
  playPositionalSound('shoot_heavy', unitCenterX, unitCenterY, 0.5)
  unit.lastShotTime = now
  unit.recoilStartTime = now
  unit.muzzleFlashStartTime = now
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
