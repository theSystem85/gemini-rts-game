// Building System Module - Handles building updates, defensive buildings, and Tesla coils
import { TILE_SIZE } from '../config.js'
import { playSound, playPositionalSound } from '../sound.js'
import { selectedUnits } from '../inputHandler.js'
import { triggerExplosion } from '../logic.js'
import { updatePowerSupply, clearBuildingFromMapGrid } from '../buildings.js'
import { checkGameEndConditions } from './gameStateManager.js'
import { updateUnitSpeedModifier } from '../utils.js'

/**
 * Updates all buildings including health checks, destruction, and defensive capabilities
 * @param {Object} gameState - Game state object
 * @param {Array} units - Array of unit objects
 * @param {Array} bullets - Array of bullet objects
 * @param {Array} factories - Array of factory objects
 * @param {Array} mapGrid - 2D array representing the map
 * @param {number} delta - Time delta
 */
export function updateBuildings(gameState, units, bullets, factories, mapGrid, delta) {
  const now = performance.now()

  if (gameState.buildings && gameState.buildings.length > 0) {
    for (let i = gameState.buildings.length - 1; i >= 0; i--) {
      const building = gameState.buildings[i]

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

        // Update power supply after building is destroyed
        updatePowerSupply(gameState.buildings, gameState)

        // Play explosion sound with reduced volume (0.5)
        playPositionalSound('explosion', buildingCenterX, buildingCenterY, 0.5)

        // Add explosion effect
        const buildingCenterX = building.x * TILE_SIZE + (building.width * TILE_SIZE / 2)
        const buildingCenterY = building.y * TILE_SIZE + (building.height * TILE_SIZE / 2)
        triggerExplosion(buildingCenterX, buildingCenterY, 40, units, factories, null, now)

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
}

/**
 * Updates defensive buildings like turrets and Tesla coils
 * @param {Array} buildings - Array of building objects
 * @param {Array} units - Array of unit objects
 * @param {Array} bullets - Array of bullet objects
 * @param {number} delta - Time delta
 * @param {Object} gameState - Game state object
 */
function updateDefensiveBuildings(buildings, units, bullets, delta, gameState) {
  const now = performance.now()

  // Debug: Count Tesla coils
  const teslaCoils = buildings.filter(b => b.type === 'teslaCoil' && b.health > 0)
  
  buildings.forEach(building => {
    // Defensive buildings: turrets and tesla coil
    if ((building.type === 'rocketTurret' || building.type.startsWith('turretGun') || building.type === 'teslaCoil') && building.health > 0) {

      const centerX = (building.x + building.width / 2) * TILE_SIZE
      const centerY = (building.y + building.height / 2) * TILE_SIZE      // Find closest enemy for all defensive buildings
      let closestEnemy = null
      let closestDistance = Infinity
      for (const unit of units) {
        if (unit.owner !== building.owner && unit.health > 0) {
          const unitCenterX = unit.x + TILE_SIZE / 2
          const unitCenterY = unit.y + TILE_SIZE / 2
          const dx = unitCenterX - centerX
          const dy = unitCenterY - centerY
          const distance = Math.hypot(dx, dy)
          if (distance <= building.fireRange * TILE_SIZE && distance < closestDistance) {
            closestEnemy = unit
            closestDistance = distance
          }
        }
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
            // Play loading sound immediately
            playSound('teslacoil_loading')
            
            // Schedule the firing sequence
            setTimeout(() => {
              // Play firing sound first
              playSound('teslacoil_firing')
              
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
            
            // Create visual lightning effect synchronized with firing sound
            setTimeout(() => {
              const targetX = closestEnemy.x + TILE_SIZE / 2
              const targetY = closestEnemy.y + TILE_SIZE / 2
              closestEnemy.teslaCoilHit = {
                fromX: centerX,
                fromY: centerY,
                toX: targetX,
                toY: targetY,
                impactTime: performance.now()
              }
            }, 400) // Same timing as firing sound
            
            building.lastShotTime = now
            building.firingAt = closestEnemy
            building.fireStartTime = now
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
              fireTurretProjectile(building, closestEnemy, centerX, centerY, now, bullets)
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

            if (closestEnemy) {
              // Aim at the target
              const targetX = closestEnemy.x + TILE_SIZE / 2
              const targetY = closestEnemy.y + TILE_SIZE / 2
              building.turretDirection = Math.atan2(targetY - centerY, targetX - centerX)

              // Store current target position for projectile calculation
              building.currentTargetPosition = { x: targetX, y: targetY }

              // Fire projectile
              fireTurretProjectile(building, closestEnemy, centerX, centerY, now, bullets)

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
  })
}

/**
 * Helper function to fire a projectile from a turret
 * @param {Object} building - The building firing the projectile
 * @param {Object} target - The target being fired at
 * @param {number} centerX - X coordinate of building center
 * @param {number} centerY - Y coordinate of building center
 * @param {number} now - Current timestamp
 * @param {Array} bullets - Array to add the bullet to
 */
function fireTurretProjectile(building, target, centerX, centerY, now, bullets) {
  // Bail early if target is missing and we need it
  if (!target && !building.currentTargetPosition) {
    return;
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

  // Create a bullet object with all required properties
  const projectile = {
    id: Date.now() + Math.random(),
    x: centerX + Math.cos(building.turretDirection) * (TILE_SIZE * 0.75), // Offset from building center
    y: centerY + Math.sin(building.turretDirection) * (TILE_SIZE * 0.75), // Offset from building center
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
      return;
    }

    // Play rocket sound
    playPositionalSound('shoot_rocket', centerX, centerY, 0.5)
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
      return;
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
