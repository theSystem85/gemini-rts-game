// Bullet System Module - Handles all bullet/projectile updates and collision detection
import { TILE_SIZE, BULLET_DAMAGES, CREW_KILL_CHANCE } from '../config.js'
import { triggerExplosion } from '../logic.js'
import { playSound, playPositionalSound } from '../sound.js'
import { awardExperience } from '../utils.js'
import {
  checkUnitCollision,
  checkBuildingCollision,
  checkFactoryCollision,
  checkWreckCollision
} from './bulletCollision.js'
import { calculateHitZoneDamageMultiplier } from './hitZoneCalculator.js'
import { canPlayCriticalDamageSound, recordCriticalDamageSoundPlayed } from './soundCooldownManager.js'
import { updateUnitSpeedModifier } from '../utils.js'
import { markBuildingForRepairPause } from '../buildings.js'
import { logPerformance } from '../performanceUtils.js'
import { removeUnitOccupancy } from '../units.js'
import { handleAttackNotification } from './attackNotifications.js'
import { emitSmokeParticles } from '../utils/smokeUtils.js'
import { getRocketSpawnPoint } from '../rendering/rocketTankImageRenderer.js'
import { applyDamageToWreck } from './unitWreckManager.js'
import { handleAICrewLossEvent } from '../ai/enemyStrategies.js'

/**
 * Updates all bullets in the game including movement, collision detection, and cleanup
 * @param {Array} bullets - Array of bullet objects
 * @param {Array} units - Array of unit objects
 * @param {Array} factories - Array of factory objects
 * @param {Object} gameState - Game state object
 * @param {Array} mapGrid - 2D array representing the map
 */
export const updateBullets = logPerformance(function updateBullets(bullets, units, factories, gameState, mapGrid) {
  const now = performance.now()

  // Update bullet speeds based on game speed multiplier
  bullets.forEach(bullet => {
    bullet.effectiveSpeed = bullet.speed * gameState.speedMultiplier
  })

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet.active) {
      bullets.splice(i, 1)
      continue
    }

    // Initialize start time if not set
    if (!bullet.startTime) {
      bullet.startTime = now
    }

    // Ballistic projectile handling: rocket goes straight up then switches to homing
    let skipStandardMotion = false
    if (bullet.parabolic) {
      const t = (now - bullet.startTime) / bullet.flightDuration
      if (t >= 1) {
        triggerExplosion(bullet.targetPosition.x, bullet.targetPosition.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid, bullet.explosionRadius)
        bullets.splice(i,1)
        continue
      } else {
        bullet.x = bullet.startX + bullet.dx * t
        bullet.y = bullet.startY + bullet.dy * t - bullet.arcHeight * Math.sin(Math.PI * t)
        bullet.trail = bullet.trail || []
        bullet.trail.push({ x: bullet.x, y: bullet.y, time: now })
        bullet.trail = bullet.trail.filter(p => now - p.time < 300)
        skipStandardMotion = true
      }
    }

    if (bullet.ballistic) {
      const progress = (now - bullet.startTime) / bullet.ballisticDuration

      if (progress >= 1) {
        // Switch to homing phase from the peak position
        bullet.ballistic = false
        bullet.homing = true
        bullet.startTime = now
        bullet.x = bullet.startX
        bullet.y = bullet.startY - bullet.arcHeight
      } else {
        // Vertical ascent
        const eased = Math.sin((progress * Math.PI) / 2)
        bullet.x = bullet.startX
        bullet.y = bullet.startY - bullet.arcHeight * eased

        // Smoke trail during ascent
        if (!bullet.lastTrail || now - bullet.lastTrail > 60) {
          emitSmokeParticles(gameState, bullet.x, bullet.y, now, 1)
          bullet.lastTrail = now
        }
        bullet.trail = bullet.trail || []
        bullet.trail.push({ x: bullet.x, y: bullet.y, time: now })
        skipStandardMotion = true
      }
    }

    if (!skipStandardMotion) {

      // Handle homing projectiles
      if (bullet.homing) {
        if (now - bullet.startTime > 5000) { // Max flight time for homing missiles
        // Explode at the bullet's current position upon timeout
          if (bullet.originType === 'apacheRocket') {
          // Apache rockets create multiple explosions around the target area even on timeout
            const targetCenter = bullet.targetPosition || { x: bullet.x, y: bullet.y }
            const explosionRadius = TILE_SIZE * 1.5 // 3 tile diameter = 1.5 tile radius
            const numExplosions = 8 // Number of explosion points

            for (let i = 0; i < numExplosions; i++) {
            // Random angle and distance within the explosion radius
              const angle = Math.random() * Math.PI * 2
              const distance = Math.random() * explosionRadius

              const explosionX = targetCenter.x + Math.cos(angle) * distance
              const explosionY = targetCenter.y + Math.sin(angle) * distance

              // Create surface damage explosion (smaller radius, proximity-based damage)
              triggerExplosion(explosionX, explosionY, bullet.baseDamage * 0.3, units, factories, bullet.shooter, now, mapGrid, TILE_SIZE * 0.8, false)
            }

            // Play explosion sound once for the rocket impact
            playPositionalSound('explosion', bullet.x, bullet.y, 0.7)
          } else {
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid, bullet.explosionRadius)
          }
          bullets.splice(i, 1)
          continue
        }

        // Update homing logic
        if (bullet.target && bullet.target.health > 0) {
          let targetCenterX_pixels
          let targetCenterY_pixels

          // Check if the target is a building/factory by presence of width/height properties
          // Buildings have tile-based x, y and width, height in tiles.
          if (typeof bullet.target.width === 'number' && typeof bullet.target.height === 'number') {
            targetCenterX_pixels = (bullet.target.x * TILE_SIZE) + (bullet.target.width * TILE_SIZE) / 2
            targetCenterY_pixels = (bullet.target.y * TILE_SIZE) + (bullet.target.height * TILE_SIZE) / 2
          } else {
          // Target is likely a unit. Assume unit.x, .y are pixel coordinates (top-left).
          // Assume units are TILE_SIZE x TILE_SIZE for centering.
            targetCenterX_pixels = bullet.target.x + TILE_SIZE / 2
            targetCenterY_pixels = bullet.target.y + TILE_SIZE / 2
          }

          const dx = targetCenterX_pixels - bullet.x
          const dy = targetCenterY_pixels - bullet.y
          const distance = Math.hypot(dx, dy)

          if (distance > 5) { // Only adjust if not too close
            bullet.vx = (dx / distance) * bullet.effectiveSpeed
            bullet.vy = (dy / distance) * bullet.effectiveSpeed
          }
        // If distance <= 5, velocity is not updated by this homing logic step.
        // The bullet continues with its current velocity. Collision detection should handle impact.
        }
      // If target is null or dead, bullet continues on current trajectory until timeout.
      } else {
      // Handle non-homing projectiles - check if they've traveled too far or too long
      // Non-homing projectile flight limits
        const timeLimit = 3000 // 3 seconds max flight time
        const distanceFromTarget = bullet.targetPosition ?
          Math.hypot(bullet.x - bullet.targetPosition.x, bullet.y - bullet.targetPosition.y) : 0

        // Explode if bullet has been flying too long or is close enough to its original target destination (for non-homing)
        // For non-homing, targetPosition is the intended destination.
        if (now - bullet.startTime > timeLimit ||
          (bullet.targetPosition && distanceFromTarget < 15 && !bullet.homing && bullet.originType !== 'apacheRocket')) { // Skip distance check for Apache rockets since they explode on arrival
        // Explode at the bullet's current position or original target if non-homing and close
          const explosionX = !bullet.homing && bullet.targetPosition ? bullet.targetPosition.x : bullet.x
          const explosionY = !bullet.homing && bullet.targetPosition ? bullet.targetPosition.y : bullet.y
          if (bullet.originType === 'apacheRocket') {
            // Apache rockets explode immediately when reaching target, not on timeout
            // This should not happen, but just in case
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage * 0.9, units, factories, bullet.shooter, now, mapGrid, TILE_SIZE * 0.8, false)
            playPositionalSound('explosion', bullet.x, bullet.y, 0.7)
          } else {
            triggerExplosion(explosionX, explosionY, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid, bullet.explosionRadius)
          }
          bullets.splice(i, 1)
          continue
        }
      }

      // Update bullet position
      bullet.x += bullet.vx || 0
      bullet.y += bullet.vy || 0

      // Check if Apache rocket has reached its target position or exceeded max flight time
      if (bullet.originType === 'apacheRocket' && bullet.targetPosition) {
        const distanceToTarget = Math.hypot(bullet.x - bullet.targetPosition.x, bullet.y - bullet.targetPosition.y)
        const flightTime = now - (bullet.creationTime || bullet.startTime || now)
        const maxFlightTime = bullet.maxFlightTime || 3000

        if (distanceToTarget < 25 || flightTime >= maxFlightTime) { // Explode on proximity OR time limit
          // Apache rockets create 1 explosion at their current position
          // Base damage 10 * 0.9 multiplier * 2.5 tank multiplier = 22.5 per rocket
          // 8 rockets * 22.5 = 180 damage (enough to kill tank-v3 with 169 HP)
          const baseDamage = bullet.baseDamage * 0.9

          // Apply tank damage multiplier for direct unit hits
          let damageMultiplier = 1.0
          if (bullet.shooter && units) {
            // Check if explosion will hit any tanks
            const explosionRadius = TILE_SIZE * 0.8
            const hasTankNearby = units.some(u => {
              if (u.health <= 0 || u.owner === bullet.shooter.owner) return false
              const tankTypes = ['tank', 'tank_v1', 'tank-v2', 'tank-v3']
              if (!tankTypes.includes(u.type)) return false
              const dist = Math.hypot(u.x + TILE_SIZE / 2 - bullet.x, u.y + TILE_SIZE / 2 - bullet.y)
              return dist <= explosionRadius
            })
            if (hasTankNearby) {
              damageMultiplier = 2.5 // Boost damage for tank targets
            }
          }

          triggerExplosion(bullet.x, bullet.y, baseDamage * damageMultiplier, units, factories, bullet.shooter, now, mapGrid, TILE_SIZE * 0.8, false)

          // Play explosion sound
          playPositionalSound('explosion', bullet.x, bullet.y, 0.7)

          bullets.splice(i, 1)
          continue
        }
      }

      // Persist smoke trail for rockets (skip smoke for Apache rockets)
      if ((bullet.homing || bullet.ballistic) && bullet.originType !== 'apacheRocket') {
        if (!bullet.lastTrail || now - bullet.lastTrail > 60) {
          emitSmokeParticles(gameState, bullet.x, bullet.y, now, 1)
          bullet.lastTrail = now
        }
        bullet.trail = bullet.trail || []
        bullet.trail.push({ x: bullet.x, y: bullet.y, time: now })
        bullet.trail = bullet.trail.filter(p => now - p.time < 300)
      }

      // Add trails for Apache rockets (but no smoke)
      if (bullet.originType === 'apacheRocket') {
        bullet.trail = bullet.trail || []
        bullet.trail.push({ x: bullet.x, y: bullet.y, time: now })
        bullet.trail = bullet.trail.filter(p => now - p.time < 300)
      }

      // Check for unit collisions
      if (!bullet.skipCollisionChecks && bullet.active && units && units.length > 0) {
        for (const unit of units) {
          if (bullet.ignoredUnitId === unit.id && bullet.ignoreUntil && now < bullet.ignoreUntil) {
            continue
          }
          if (unit.health > 0 && checkUnitCollision(bullet, unit)) {
            if (unit.type === 'apache') {
              const shooterType = bullet.shooter?.type || ''
              const allowedShooters = ['rocketTank', 'rocketTurret', 'teslaCoil']
              if (!allowedShooters.includes(shooterType)) {
                continue
              }
            }
            if (unit.type === 'apache' && bullet.projectileType === 'rocket') {
              const dodgeChance = typeof unit.dodgeChance === 'number' ? unit.dodgeChance : 0.6
              const canAttemptDodge = !unit.lastDodgeTime || now - unit.lastDodgeTime > 400
              if (canAttemptDodge && Math.random() < dodgeChance) {
                const lateralSign = Math.random() < 0.5 ? -1 : 1
                const dodgeAngle = (unit.direction || 0) + lateralSign * Math.PI / 2
                const dodgeDistance = TILE_SIZE * 0.6
                const offsetX = Math.cos(dodgeAngle) * dodgeDistance
                const offsetY = Math.sin(dodgeAngle) * dodgeDistance
                unit.x += offsetX
                unit.y += offsetY
                const maxX = mapGrid[0].length * TILE_SIZE - TILE_SIZE
                const maxY = mapGrid.length * TILE_SIZE - TILE_SIZE
                unit.x = Math.max(0, Math.min(unit.x, maxX))
                unit.y = Math.max(0, Math.min(unit.y, maxY))
                unit.tileX = Math.floor(unit.x / TILE_SIZE)
                unit.tileY = Math.floor(unit.y / TILE_SIZE)
                unit.dodgeVelocity = {
                  vx: Math.cos(dodgeAngle) * (unit.speed || 0.5) * TILE_SIZE * 4,
                  vy: Math.sin(dodgeAngle) * (unit.speed || 0.5) * TILE_SIZE * 4,
                  endTime: now + 400
                }
                unit.lastDodgeTime = now
                if (unit.flightState === 'grounded') {
                  unit.flightState = 'takeoff'
                }
                bullet.ignoredUnitId = unit.id
                bullet.ignoreUntil = now + 250
                continue
              }
            }
            // Calculate hit zone damage multiplier for tanks
            const hitZoneResult = calculateHitZoneDamageMultiplier(bullet, unit)

            // Apply damage with some randomization and hit zone multiplier
            const damageMultiplier = 0.8 + Math.random() * 0.4
            let actualDamage = Math.round(bullet.baseDamage * damageMultiplier * hitZoneResult.multiplier)

            // Check for god mode protection
            if (window.cheatSystem) {
              actualDamage = window.cheatSystem.preventDamage(unit, actualDamage)
            }

            // Only apply damage if actualDamage > 0 (god mode protection) and not an Apache rocket
            if (actualDamage > 0 && bullet.originType !== 'apacheRocket') {
            // Apply damage reduction from armor if the unit has armor
              if (unit.armor) {
                unit.health -= Math.max(1, Math.round(actualDamage / unit.armor))
              } else {
                unit.health -= actualDamage
              }

              // console.log(`💥 Unit hit: ${unit.type} took ${actualDamage} damage, health: ${unit.health}/${unit.maxHealth}`)

              // Update speed modifier based on new health level
              updateUnitSpeedModifier(unit)
              let crewLossOccurred = false
              if (unit.crew) {
                for (const member of Object.keys(unit.crew)) {
                  if (unit.crew[member] && Math.random() < CREW_KILL_CHANCE) {
                    unit.crew[member] = false
                    crewLossOccurred = true
                    // Only play sound for human player units
                    if (unit.owner === gameState.humanPlayer) {
                      playSound('our' + member.charAt(0).toUpperCase() + member.slice(1) + 'IsOut')
                    }
                  }
                }
                if (crewLossOccurred) {
                  handleAICrewLossEvent(unit, units, gameState, mapGrid)
                }
              }
            }

            // Play critical damage sound for rear hits on player's units only (with cooldown)
            if (
              hitZoneResult.isRearHit &&
            unit.owner === gameState.humanPlayer &&
            canPlayCriticalDamageSound(unit, now)
            ) {
              playSound('criticalDamage', 0.7)
              recordCriticalDamageSoundPlayed(unit, now)
            }

            // Track when units are being attacked for AI response
            if (bullet.shooter && bullet.shooter.owner !== unit.owner) {
              unit.lastDamageTime = now
              unit.lastAttacker = bullet.shooter
              // Mark as being attacked if it's an enemy unit
              if (unit.owner === 'enemy') {
                unit.isBeingAttacked = true
              }

              // Handle attack notifications for player units/buildings
              handleAttackNotification(unit, bullet.shooter, now)
            }

            // Play hit sound (skip for Apache rockets since they have explosion sound)
            if (bullet.originType !== 'apacheRocket') {
              playPositionalSound('bulletHit', bullet.x, bullet.y, 0.5)
            }

            // Handle unit destruction (only for non-Apache rockets)
            if (unit.health <= 0 && bullet.originType !== 'apacheRocket') {
              playPositionalSound('explosion', bullet.x, bullet.y, 0.5)
              unit.health = 0
              if (!unit.occupancyRemoved) {
                removeUnitOccupancy(unit, gameState.occupancyMap)
                unit.occupancyRemoved = true
              }

              // Award experience to the shooter for killing ANY unit or building (except harvesters cannot receive XP)
              if (bullet.shooter && bullet.shooter.owner !== unit.owner && bullet.shooter.type !== 'harvester') {
                awardExperience(bullet.shooter, unit)
              }
              // Play unit lost sound if player unit dies
              if (unit.owner === gameState.humanPlayer) {
                playSound('unitLost', 1.0, 0, true)
              }
            }

            // If bullet has a target position, explode there; otherwise explode at hit location
            // ALWAYS explode at the bullet's current position for accurate impact
            if (bullet.originType === 'apacheRocket') {
              // Apache rockets explode immediately when reaching target, not on collision
              // This should not happen since they have skipCollisionChecks: true
            } else {
              triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid, bullet.explosionRadius)
            }
            bullets.splice(i, 1)
            continue
          }
        }
      }

      if (!bullet.skipCollisionChecks && bullet.active && Array.isArray(gameState.unitWrecks) && gameState.unitWrecks.length > 0) {
        let wreckHit = false
        for (let j = gameState.unitWrecks.length - 1; j >= 0; j--) {
          const wreck = gameState.unitWrecks[j]
          if (checkWreckCollision(bullet, wreck)) {
            const damageMultiplier = 0.8 + Math.random() * 0.4
            const actualDamage = Math.round(bullet.baseDamage * damageMultiplier)
            if (actualDamage > 0 && bullet.originType !== 'apacheRocket') {
              applyDamageToWreck(wreck, actualDamage, gameState, { x: bullet.x, y: bullet.y })
            }

            // Play hit sound (skip for Apache rockets since they have explosion sound)
            if (bullet.originType !== 'apacheRocket') {
              playPositionalSound('bulletHit', bullet.x, bullet.y, 0.5)
            }
            if (bullet.originType === 'apacheRocket') {
              // Apache rockets explode immediately when reaching target, not on collision
              // This should not happen since they have skipCollisionChecks: true
            } else {
              triggerExplosion(
                bullet.x,
                bullet.y,
                bullet.baseDamage,
                units,
                factories,
                bullet.shooter,
                now,
                mapGrid,
                bullet.explosionRadius
              )
            }
            bullets.splice(i, 1)
            wreckHit = true
            break
          }
        }

        if (wreckHit) {
          continue
        }
      }

      // Check for collisions with buildings
      if (!bullet.skipCollisionChecks && bullet.active && gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (checkBuildingCollision(bullet, building)) {
          // Apply damage with some randomization
            const damageMultiplier = 0.8 + Math.random() * 0.4
            let actualDamage = Math.round(bullet.baseDamage * damageMultiplier)

            // Check for god mode protection for player buildings
            if (window.cheatSystem && building.owner === gameState.humanPlayer) {
              actualDamage = window.cheatSystem.preventDamage(building, actualDamage)
            }

            // Only apply damage if actualDamage > 0 (god mode protection) and not an Apache rocket
            if (actualDamage > 0 && bullet.originType !== 'apacheRocket') {
              building.health -= actualDamage

              // Ensure health doesn't go below 0
              building.health = Math.max(0, building.health)

              // Mark building for repair pause (deferred processing)
              markBuildingForRepairPause(building)

              // Track when buildings are being attacked for repair delay
              // Set lastAttackedTime for ANY attack, including self-attacks
              if (bullet.shooter) {
                building.lastAttackedTime = now

                // Handle attack notifications for player buildings
                if (bullet.shooter.owner !== building.owner) {
                  handleAttackNotification(building, bullet.shooter, now)
                }
              }
            }

            // Play hit sound (skip for Apache rockets since they have explosion sound)
            if (bullet.originType !== 'apacheRocket') {
              playPositionalSound('bulletHit', bullet.x, bullet.y, 0.5)
            }

            // Handle building destruction (only for non-Apache rockets)
            if (building.health <= 0 && bullet.originType !== 'apacheRocket') {
              playPositionalSound('explosion', bullet.x, bullet.y, 0.5)
              building.health = 0
              // Award experience to the shooter for destroying ANY building (except harvesters cannot receive XP)
              if (bullet.shooter && bullet.shooter.owner !== building.owner && bullet.shooter.type !== 'harvester') {
                awardExperience(bullet.shooter, building)
              }
            }

            // Explode at target position or bullet location
            // ALWAYS explode at the bullet's current position for accurate impact
            if (bullet.originType === 'apacheRocket') {
              // Apache rockets explode immediately when reaching target, not on collision
              // This should not happen since they have skipCollisionChecks: true
            } else {
              triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid, bullet.explosionRadius)
            }
            bullets.splice(i, 1)
            break
          }
        }
      }

      // Check for collisions with factories
      if (!bullet.skipCollisionChecks && bullet.active && factories && factories.length > 0) {
        for (const factory of factories) {
          if (checkFactoryCollision(bullet, factory)) {
          // Apply damage with some randomization
            const damageMultiplier = 0.8 + Math.random() * 0.4
            let actualDamage = Math.round(bullet.baseDamage * damageMultiplier)

            // Check for god mode protection for player factories
            if (window.cheatSystem && factory.id === gameState.humanPlayer) {
              actualDamage = window.cheatSystem.preventDamage(factory, actualDamage)
            }

            // Only apply damage if actualDamage > 0 (god mode protection) and not an Apache rocket
            if (actualDamage > 0 && bullet.originType !== 'apacheRocket') {
              factory.health -= actualDamage

              // Ensure health doesn't go below 0
              factory.health = Math.max(0, factory.health)

              // Mark factory for repair pause (deferred processing)
              markBuildingForRepairPause(factory)

              // Track when factories are being attacked for repair delay
              // Set lastAttackedTime for ANY attack, including self-attacks
              if (bullet.shooter) {
                factory.lastAttackedTime = now

                // Handle attack notifications for player factories
                if (bullet.shooter.owner !== factory.owner) {
                  handleAttackNotification(factory, bullet.shooter, now)
                }
              }
            }

            // Play hit sound (skip for Apache rockets since they have explosion sound)
            if (bullet.originType !== 'apacheRocket') {
              playPositionalSound('bulletHit', bullet.x, bullet.y, 0.5)
            }

            // Handle factory destruction (only for non-Apache rockets)
            if (factory.health <= 0 && bullet.originType !== 'apacheRocket') {
              playPositionalSound('explosion', bullet.x, bullet.y, 0.7)
              factory.health = 0
              factory.destroyed = true
            }

            // Explode at target position or bullet location
            // ALWAYS explode at the bullet's current position for accurate impact
            if (bullet.originType === 'apacheRocket') {
              // Apache rockets explode immediately when reaching target, not on collision
              // This should not happen since they have skipCollisionChecks: true
            } else {
              triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid, bullet.explosionRadius)
            }
            bullets.splice(i, 1)
            break
          }
        }
      }

      // Remove bullets that go off-screen
      if (bullet.active && (bullet.x < -100 || bullet.x > (mapGrid[0].length * TILE_SIZE) + 100 ||
        bullet.y < -100 || bullet.y > (mapGrid.length * TILE_SIZE) + 100)) {
        bullets.splice(i, 1)
      }
    }
  }
}, false)

/**
 * Creates and fires a bullet from a unit
 * @param {Object} unit - The unit firing the bullet
 * @param {Object} target - The target being fired at
 * @param {Array} bullets - Array to add the bullet to
 * @param {number} now - Current timestamp
 */
export function fireBullet(unit, target, bullets, now) {
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  let targetCenterX, targetCenterY
  if (target.tileX !== undefined) {
    targetCenterX = target.x + TILE_SIZE / 2
    targetCenterY = target.y + TILE_SIZE / 2
  } else {
    targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2
    targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
  }

  // Create bullet based on unit type
  let bullet = null

  if (unit.type === 'tank' || unit.type === 'tank_v1') {
    bullet = {
      id: Date.now() + Math.random(),
      x: unitCenterX,
      y: unitCenterY,
      speed: 12,
      baseDamage: BULLET_DAMAGES.tank_v1,
      active: true,
      shooter: unit,
      homing: false,
      target
    }
  } else if (unit.type === 'tank-v2') {
    bullet = {
      id: Date.now() + Math.random(),
      x: unitCenterX,
      y: unitCenterY,
      speed: 12,
      baseDamage: BULLET_DAMAGES.tank_v2,
      active: true,
      shooter: unit,
      homing: false,
      target
    }
  } else if (unit.type === 'tank-v3') {
    bullet = {
      id: Date.now() + Math.random(),
      x: unitCenterX,
      y: unitCenterY,
      speed: 14,
      baseDamage: BULLET_DAMAGES.tank_v3,
      active: true,
      shooter: unit,
      homing: false,
      target
    }
  } else if (unit.type === 'rocketTank') {
    const spawn = getRocketSpawnPoint(unit, unitCenterX, unitCenterY)
    const dx = targetCenterX - spawn.x
    const dy = targetCenterY - spawn.y
    const distance = Math.hypot(dx, dy)
    const speed = 6
    const flightDuration = distance / speed

    bullet = {
      id: Date.now() + Math.random(),
      x: spawn.x,
      y: spawn.y,
      speed,
      baseDamage: BULLET_DAMAGES.rocketTank,
      active: true,
      shooter: unit,
      homing: false,
      target,
      ballistic: true,
      startX: spawn.x,
      startY: spawn.y,
      targetX: targetCenterX,
      targetY: targetCenterY,
      dx,
      dy,
      distance,
      flightDuration,
      ballisticDuration: flightDuration / 2,
      arcHeight: Math.max(50, distance * 0.3),
      targetPosition: { x: targetCenterX, y: targetCenterY }
    }
  }

  if (bullet) {
    // Set target position for explosion
    bullet.targetPosition = { x: targetCenterX, y: targetCenterY }

    // Set start time for all bullets
    bullet.startTime = now

    // Calculate bullet direction for non-homing non-ballistic projectiles
    if (!bullet.homing && !bullet.ballistic) {
      const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)
      bullet.vx = bullet.speed * Math.cos(angle)
      bullet.vy = bullet.speed * Math.sin(angle)
    }

    bullets.push(bullet)
    playPositionalSound('shoot', bullet.x, bullet.y, 0.5)
    unit.lastShotTime = now
  }
}
