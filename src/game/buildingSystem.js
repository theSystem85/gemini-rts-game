// Building System Module - Handles building updates, defensive buildings, and Tesla coils
import { TILE_SIZE, TANK_TURRET_ROT, BUILDING_SELL_DURATION } from '../config.js'
import { playSound, playPositionalSound } from '../sound.js'
import { selectedUnits } from '../inputHandler.js'
import { triggerExplosion } from '../logic.js'
import { triggerDistortionEffect } from '../ui/distortionEffect.js'
import { updatePowerSupply, clearBuildingFromMapGrid } from '../buildings.js'
import { checkGameEndConditions } from './gameStateManager.js'
import { updateUnitSpeedModifier } from '../utils.js'
import { updateDangerZoneMaps } from './dangerZoneMap.js'
import { smoothRotateTowardsAngle, angleDiff } from '../logic.js'
import { getTurretImageConfig, turretImagesAvailable } from '../rendering/turretImageRenderer.js'
import { logPerformance } from '../performanceUtils.js'

/**
 * Updates all buildings including health checks, destruction, and defensive capabilities
 * @param {Object} gameState - Game state object
 * @param {Array} units - Array of unit objects
 * @param {Array} bullets - Array of bullet objects
 * @param {Array} factories - Array of factory objects
 * @param {Array} mapGrid - 2D array representing the map
 * @param {number} delta - Time delta
 */
export const updateBuildings = logPerformance(function updateBuildings(gameState, units, bullets, factories, mapGrid, delta) {
  const now = performance.now()

  if (gameState.buildings && gameState.buildings.length > 0) {
    for (let i = gameState.buildings.length - 1; i >= 0; i--) {
      const building = gameState.buildings[i]

      // Handle buildings currently being sold
      if (building.isBeingSold) {
        const progress = (now - building.sellStartTime) / BUILDING_SELL_DURATION
        if (progress >= 1) {
          // Remove building from selected units if it was selected
          if (building.selected) {
            const idx = selectedUnits.findIndex(u => u === building)
            if (idx !== -1) {
              selectedUnits.splice(idx, 1)
            }
          }

          clearBuildingFromMapGrid(building, mapGrid)
          gameState.buildings.splice(i, 1)
          gameState.pendingButtonUpdate = true
          updatePowerSupply(gameState.buildings, gameState)
          updateDangerZoneMaps(gameState)
          checkGameEndConditions(factories, gameState)
          continue
        } else {
          // Skip other updates while selling
          continue
        }
      }

      // Skip destroyed buildings and remove them
      if (building.health <= 0) {
        // Track destroyed buildings for statistics
        if (building.owner === gameState.humanPlayer) {
          gameState.playerBuildingsDestroyed++
        } else if (building.owner !== gameState.humanPlayer) {
          gameState.enemyBuildingsDestroyed++
          // Play enemy building destroyed sound when an enemy building is killed
          const centerX = building.x * TILE_SIZE + (building.width * TILE_SIZE / 2)
          const centerY = building.y * TILE_SIZE + (building.height * TILE_SIZE / 2)
          playSound('enemyBuildingDestroyed', 1.0, 0, true)
        }

        // Remove building from selected units if it was selected
        if (building.selected) {
          const idx = selectedUnits.findIndex(u => u === building)
          if (idx !== -1) {
            selectedUnits.splice(idx, 1)
          }
        }

        // Clear the building from the map grid to unblock tiles for pathfinding
        clearBuildingFromMapGrid(building, mapGrid)

        // Remove the building from the buildings array
        gameState.buildings.splice(i, 1)

        // Trigger UI refresh for production buttons
        gameState.pendingButtonUpdate = true

        // Update power supply after building is destroyed
        updatePowerSupply(gameState.buildings, gameState)
        updateDangerZoneMaps(gameState)

        // Calculate building center for explosion effects
        const buildingCenterX = building.x * TILE_SIZE + (building.width * TILE_SIZE / 2)
        const buildingCenterY = building.y * TILE_SIZE + (building.height * TILE_SIZE / 2)

        // Play explosion sound with reduced volume (0.5)
        playPositionalSound('explosion', buildingCenterX, buildingCenterY, 0.5)

        if (building.type === 'gasStation') {
          const radius = TILE_SIZE * 5
          triggerExplosion(
            buildingCenterX,
            buildingCenterY,
            95 * 5,
            units,
            factories,
            null,
            now,
            undefined,
            radius,
            true
          )
          triggerDistortionEffect(buildingCenterX, buildingCenterY, radius, gameState)
        } else {
          // Add standard explosion effect
          triggerExplosion(buildingCenterX, buildingCenterY, 40, units, factories, null, now)
        }

        // Check for game end conditions after a building is destroyed
        checkGameEndConditions(factories, gameState)

        continue
      }
    }
  }

  // Update defensive buildings
  if (gameState.buildings && gameState.buildings.length > 0) {
    updateDefensiveBuildings(gameState.buildings, units, bullets, delta, gameState)
  }
}, false)

/**
 * Updates defensive buildings like turrets and Tesla coils
 * @param {Array} buildings - Array of building objects
 * @param {Array} units - Array of unit objects
 * @param {Array} bullets - Array of bullet objects
 * @param {number} delta - Time delta
 * @param {Object} gameState - Game state object
 */
const updateDefensiveBuildings = logPerformance(function updateDefensiveBuildings(buildings, units, bullets, delta, gameState) {
  const now = performance.now()

  // Debug: Count Tesla coils
  const teslaCoils = buildings.filter(b => b.type === 'teslaCoil' && b.health > 0)

  buildings.forEach(building => {
    // Defensive buildings: turrets and tesla coil
    if ((building.type === 'rocketTurret' || building.type.startsWith('turretGun') || building.type === 'teslaCoil' || building.type === 'artilleryTurret') && building.health > 0) {
      if (building.holdFire) {
        return
      }

      const centerX = (building.x + building.width / 2) * TILE_SIZE
      const centerY = (building.y + building.height / 2) * TILE_SIZE
      // Find closest enemy for all defensive buildings
      const maxRange = building.fireRange * TILE_SIZE
      const minRange = (building.minFireRange || 0) * TILE_SIZE
      let closestEnemy = null
      let closestDistance = Infinity

      if (building.forcedAttackTarget) {
        const t = building.forcedAttackTarget
        if (t.health === undefined || t.health > 0) {
          const tx = t.x + (t.width ? t.width * TILE_SIZE / 2 : 0)
          const ty = t.y + (t.height ? t.height * TILE_SIZE / 2 : 0)
          const dist = Math.hypot(tx - centerX, ty - centerY)
          if (dist <= maxRange && dist >= minRange) {
            closestEnemy = t
            closestDistance = dist
          } else if (dist > maxRange) {
            building.forcedAttackTarget = null
          }
        } else {
          building.forcedAttackTarget = null
        }
      }

      if (!closestEnemy) {
        for (const unit of units) {
          if (unit.owner !== building.owner && unit.health > 0) {
            const unitCenterX = unit.x + TILE_SIZE / 2
            const unitCenterY = unit.y + TILE_SIZE / 2
            const dx = unitCenterX - centerX
            const dy = unitCenterY - centerY
            const distance = Math.hypot(dx, dy)
            if (distance <= maxRange && distance >= minRange && distance < closestDistance) {
              closestEnemy = unit
              closestDistance = distance
            }
          }
        }
      }

      // Update turret rotation for gun turrets and rocket turrets (continuous tracking)
      if (
        building.type.startsWith('turretGun') ||
        building.type === 'artilleryTurret' ||
        building.type === 'rocketTurret'
      ) {
        const targetObj = closestEnemy || building.forcedAttackTarget
        if (targetObj) {
          // Calculate target angle
          const targetX = targetObj.x + (targetObj.width ? targetObj.width * TILE_SIZE / 2 : TILE_SIZE / 2)
          const targetY = targetObj.y + (targetObj.height ? targetObj.height * TILE_SIZE / 2 : TILE_SIZE / 2)
          const targetAngle = Math.atan2(targetY - centerY, targetX - centerX)

          // Smoothly rotate turret towards target
          const turretRotationSpeed = TANK_TURRET_ROT
          building.turretDirection = smoothRotateTowardsAngle(
            building.turretDirection || 0,
            targetAngle,
            turretRotationSpeed
          )
        }
        // If no enemy, turret keeps its current direction
      }
      // Tesla Coil special logic
      if (building.type === 'teslaCoil') {
        // Check power level - Tesla coil doesn't work when power is below 0
        const currentPowerSupply = building.owner === gameState.humanPlayer ? gameState.playerPowerSupply : gameState.enemyPowerSupply
        if (currentPowerSupply < 0) {
          // Tesla coil is disabled due to insufficient power
          return
        }

        const effectiveCooldown = building.fireCooldown / gameState.speedMultiplier
        if (!building.lastShotTime || now - building.lastShotTime >= effectiveCooldown) {
          if (closestEnemy) {
            // Play loading sound and mark coil as charging
            playPositionalSound('teslacoil_loading', centerX, centerY, 1.0)
            building.teslaState = 'charging'
            building.teslaChargeStartTime = performance.now()

            // Schedule the firing sequence
            setTimeout(() => {
              // Play firing sound and mark as firing
              playPositionalSound('teslacoil_firing', centerX, centerY, 1.0)
              building.teslaState = 'firing'
              building.teslaFireStartTime = performance.now()

              // Apply effects after a short delay to sync with bolt sound
              setTimeout(() => {
                // Check if enemy is still alive and in range
                if (closestEnemy.health > 0) {
                  // Apply Tesla Coil effects
                  closestEnemy.teslaDisabledUntil = now + 60000 // 60 seconds
                  closestEnemy.teslaSlowUntil = now + 60000
                  closestEnemy.teslaSlowed = true

                  // Apply damage to the target
                  let actualDamage = building.damage
                  if (window.cheatSystem) {
                    actualDamage = window.cheatSystem.preventDamage(closestEnemy, building.damage)
                  }

                  // Only apply damage if actualDamage > 0 (god mode protection)
                  if (actualDamage > 0) {
                    closestEnemy.health -= actualDamage
                  }

                  // Track when units are being attacked for AI response
                  if (building.owner !== closestEnemy.owner) {
                    closestEnemy.lastDamageTime = now
                    closestEnemy.lastAttacker = building
                    // Mark as being attacked if it's an enemy unit
                    if (closestEnemy.owner === 'enemy') {
                      closestEnemy.isBeingAttacked = true
                    }
                  }
                }
              }, 200) // Small delay after bolt sound starts
            }, 400) // Delay for loading sound to finish

            // Return to idle state after bolt animation
            setTimeout(() => {
              if (building.teslaState === 'firing') {
                building.teslaState = 'idle'
                building.teslaChargeStartTime = 0
                building.teslaFireStartTime = 0
              }
            }, 800) // 400ms charge + 400ms bolt

            // Create visual lightning effect synchronized with firing sound
            setTimeout(() => {
              const targetX = closestEnemy.x + TILE_SIZE / 2
              const targetY = closestEnemy.y + TILE_SIZE / 2
              const imgWidth = building.width * TILE_SIZE
              const imgHeight = building.height * TILE_SIZE
              const fromX = building.x * TILE_SIZE + imgWidth * (96 / 192)
              const fromY = building.y * TILE_SIZE + imgHeight * (42 / 192)
              closestEnemy.teslaCoilHit = {
                fromX,
                fromY,
                toX: targetX,
                toY: targetY,
                impactTime: performance.now()
              }
            }, 400) // Same timing as firing sound

            building.lastShotTime = now
            building.firingAt = closestEnemy
            building.fireStartTime = performance.now()
          }
        }
      }      // Regular turret logic
      else {
        // Check power level for rocket turrets - they don't work when power is below 0
        if (building.type === 'rocketTurret') {
          const currentPowerSupply = building.owner === gameState.humanPlayer ? gameState.playerPowerSupply : gameState.enemyPowerSupply
          if (currentPowerSupply < 0) {
            // Rocket turret is disabled due to insufficient power
            return
          }
        }

        // Check burst fire status first
        if (building.burstFire && building.currentBurst > 0) {
          // Continue burst fire sequence
          if (now - building.lastBurstTime >= building.burstDelay) {
            if (building.currentTargetPosition && closestEnemy) {
              fireTurretProjectile(building, closestEnemy, centerX, centerY, now, bullets, gameState)
              building.currentBurst--
              building.lastBurstTime = now

              if (building.currentBurst <= 0) {
                // Burst sequence complete, set normal cooldown
                building.lastShotTime = now
              }
            }
          }
        } else {
          // Normal firing cooldown check
          const effectiveCooldown = building.fireCooldown
          if (!building.lastShotTime || now - building.lastShotTime >= effectiveCooldown) {
            // We already have closestEnemy from the shared enemy detection code above

            const firingTarget = closestEnemy || building.forcedAttackTarget
            if (firingTarget) {
              // For gun turrets, target angle is already calculated in continuous tracking above
              const targetX = firingTarget.x + (firingTarget.width ? firingTarget.width * TILE_SIZE / 2 : TILE_SIZE / 2)
              const targetY = firingTarget.y + (firingTarget.height ? firingTarget.height * TILE_SIZE / 2 : TILE_SIZE / 2)
              const targetDistance = Math.hypot(targetX - centerX, targetY - centerY)

              if (targetDistance < minRange) {
                if (building.forcedAttackTarget === firingTarget) {
                  building.forcedAttackTarget = null
                }
                return
              }

              if (targetDistance > maxRange) {
                if (building.forcedAttackTarget === firingTarget) {
                  building.forcedAttackTarget = null
                }
                return
              }
              const targetAngle = Math.atan2(targetY - centerY, targetX - centerX)

              // Only fire if turret is aligned with target (within tolerance)
              const angleError = Math.abs(angleDiff(building.turretDirection, targetAngle))
              const aimingTolerance = 0.1 // ~5.7 degrees tolerance

              if (angleError <= aimingTolerance) {
                // Store current target position for projectile calculation
                building.currentTargetPosition = { x: targetX, y: targetY }
                if (building.type === 'artilleryTurret') {
                  if (Math.random() > 0.25) {
                    const radius = TILE_SIZE * 3
                    const ang = Math.random() * Math.PI * 2
                    const dist = Math.random() * radius
                    building.currentTargetPosition.x += Math.cos(ang) * dist
                    building.currentTargetPosition.y += Math.sin(ang) * dist
                  }
                }

                // Fire projectile
                fireTurretProjectile(building, firingTarget, centerX, centerY, now, bullets, gameState)

                // Handle burst fire for turret gun v3 and rocket turret
                if (building.burstFire) {
                  building.currentBurst = building.burstCount - 1 // Already fired first shot
                  building.lastBurstTime = now
                } else {
                  // Set cooldown for non-burst weapons
                  building.lastShotTime = now
                }
              }
            }
          }
        }
      }
    }
  })
})

/**
 * Helper function to fire a projectile from a turret
 * @param {Object} building - The building firing the projectile
 * @param {Object} target - The target being fired at
 * @param {number} centerX - X coordinate of building center
 * @param {number} centerY - Y coordinate of building center
 * @param {number} now - Current timestamp
 * @param {Array} bullets - Array to add the bullet to
 */
function fireTurretProjectile(building, target, centerX, centerY, now, bullets, gameState) {
  // Bail early if target is missing and we need it
  if (!target && !building.currentTargetPosition) {
    return
  }

  // Apply targeting spread for more realistic shooting
  function applyTargetingSpread(shooterX, shooterY, targetX, targetY, projectileType) {
    // Skip spread for rockets to maintain their precision
    if (projectileType === 'rocket') {
      return { x: targetX, y: targetY }
    }

    const baseAngle = Math.atan2(targetY - shooterY, targetX - shooterX)
    const distance = Math.hypot(targetX - shooterX, targetY - shooterY)

    // Allow up to ~2 degrees of deviation
    const maxAngleOffset = 0.035
    const angleOffset = (Math.random() * 2 - 1) * maxAngleOffset
    const finalAngle = baseAngle + angleOffset

    return {
      x: shooterX + Math.cos(finalAngle) * distance,
      y: shooterY + Math.sin(finalAngle) * distance
    }
  }

  // Determine bullet spawn position
  let spawnX = centerX + Math.cos(building.turretDirection) * (TILE_SIZE * 0.75)
  let spawnY = centerY + Math.sin(building.turretDirection) * (TILE_SIZE * 0.75)

  // Use image-based spawn points if available
  if (gameState.useTurretImages && turretImagesAvailable(building.type)) {
    const cfg = getTurretImageConfig(building.type)
    const points = cfg && (cfg.muzzleFlashOffsets || (cfg.muzzleFlashOffset ? [cfg.muzzleFlashOffset] : null))
    if (points && points.length > 0) {
      const idx = building.nextSpawnIndex || 0
      const pt = points[idx % points.length]
      const scale = TILE_SIZE / 64 // images are 64px base size
      const localX = (pt.x - 32) * scale
      const localY = (pt.y - 32) * scale
      const rotationOffset = cfg.rotationOffset !== undefined ? cfg.rotationOffset : Math.PI / 2
      const rot = (building.turretDirection || 0) + rotationOffset
      const cos = Math.cos(rot)
      const sin = Math.sin(rot)
      const offsetX = localX * cos - localY * sin
      const offsetY = localX * sin + localY * cos
      spawnX = centerX + offsetX
      spawnY = centerY + offsetY
      building.muzzleFlashIndex = idx
      building.nextSpawnIndex = (idx + 1) % points.length
    }
  } else {
    building.muzzleFlashIndex = 0
  }

  // Create a bullet object with all required properties
  const projectile = {
    id: Date.now() + Math.random(),
    x: spawnX,
    y: spawnY,
    speed: building.projectileSpeed,
    baseDamage: building.damage,
    active: true,
    shooter: building,
    startTime: now
  }

  if (building.type === 'rocketTurret') {
    // Rocket projectile - homing but also store target position for explosion
    projectile.homing = true
    projectile.target = target

    // Store target position for explosion even if homing
    if (building.currentTargetPosition) {
      projectile.targetPosition = {
        x: building.currentTargetPosition.x,
        y: building.currentTargetPosition.y
      }
    } else if (target) {
      // Fallback to current target position if target exists
      projectile.targetPosition = {
        x: target.x + TILE_SIZE / 2,
        y: target.y + TILE_SIZE / 2
      }
    } else {
      // No valid target position, don't fire
      return
    }

    // Play rocket sound
    playPositionalSound('shoot_rocket', centerX, centerY, 0.5)
  } else if (building.type === 'artilleryTurret') {
    projectile.parabolic = true
    const targetPos = building.currentTargetPosition || { x: target.x + TILE_SIZE / 2, y: target.y + TILE_SIZE / 2 }
    projectile.startX = projectile.x
    projectile.startY = projectile.y
    projectile.targetX = targetPos.x
    projectile.targetY = targetPos.y
    projectile.dx = targetPos.x - projectile.x
    projectile.dy = targetPos.y - projectile.y
    projectile.distance = Math.hypot(projectile.dx, projectile.dy)
    projectile.flightDuration = projectile.distance / projectile.speed
    projectile.arcHeight = projectile.distance * 0.5
    projectile.targetPosition = { x: targetPos.x, y: targetPos.y }
    projectile.explosionRadius = TILE_SIZE * 3
    playPositionalSound('shoot_heavy', centerX, centerY, 0.5)
  } else {
    // Standard bullet - calculate trajectory and store target position with spread
    projectile.homing = false

    // Apply targeting spread for more realistic turret shooting
    let targetX, targetY
    if (building.currentTargetPosition) {
      const spreadTarget = applyTargetingSpread(
        centerX,
        centerY,
        building.currentTargetPosition.x,
        building.currentTargetPosition.y,
        building.projectileType
      )
      targetX = spreadTarget.x
      targetY = spreadTarget.y
    } else if (target) {
      // Fallback to current target position with spread if target exists
      const baseTargetX = target.x + TILE_SIZE / 2
      const baseTargetY = target.y + TILE_SIZE / 2
      const spreadTarget = applyTargetingSpread(
        centerX,
        centerY,
        baseTargetX,
        baseTargetY,
        building.projectileType
      )
      targetX = spreadTarget.x
      targetY = spreadTarget.y
    } else {
      // No valid target position, don't fire
      return
    }

    // Calculate velocity towards the spread target position
    const angle = Math.atan2(targetY - projectile.y, targetX - projectile.x)
    projectile.vx = Math.cos(angle) * building.projectileSpeed
    projectile.vy = Math.sin(angle) * building.projectileSpeed

    // Store the spread target position for explosion on arrival
    projectile.targetPosition = { x: targetX, y: targetY }

    // Play appropriate sound based on turret type
    if (building.type === 'turretGunV3') {
      playPositionalSound('shoot_heavy', centerX, centerY, 0.5)
    } else {
      playPositionalSound('shoot', centerX, centerY)
    }
  }

  bullets.push(projectile)

  // Trigger recoil and muzzle flash animations for turrets
  building.recoilStartTime = now
  building.muzzleFlashStartTime = now

  // Don't update lastShotTime here - it's handled in the main firing logic
}

/**
 * Updates Tesla Coil effects on units
 * @param {Array} units - Array of unit objects
 */
export function updateTeslaCoilEffects(units) {
  const now = performance.now()
  for (const unit of units) {
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
}
