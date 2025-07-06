// enemyUnitBehavior.js
// Lightweight frame-based AI unit behavior system
// Heavy operations moved to scheduler system for performance

import { TILE_SIZE, TARGETING_SPREAD } from '../config.js'
import { calculateDistance, isWithinRange } from '../utils.js'
import { gameState } from '../gameState.js'
import { canUnitAttackTarget, createBullet } from '../logic.js'
import { applyDefensivePolicy, updateDefensiveState, canDefendAgainstTarget } from './defensivePolicy.js'
import { debugAIState } from './aiDebug.js'

/**
 * Main AI unit update function - now lightweight and frame-based
 * Heavy operations like pathfinding and targeting are handled by the scheduler
 */
export function updateAIUnit(unit, units, gameState, mapGrid, bullets, now, aiPlayerId, targetedOreTiles) {
  // Quick validation checks only
  if (!unit || unit.health <= 0 || unit.owner === gameState.humanPlayer) {
    return
  }

  // Debug function call and bullets parameter
  if (Math.random() < 0.01) {
    console.log(`🔧 UPDATE AI UNIT: ${unit.id} (${unit.type}) - Bullets param:`, {
      bulletsExists: !!bullets,
      bulletsIsArray: Array.isArray(bullets),
      bulletsLength: bullets?.length
    })
    console.log(`🔧 UNIT STATE: isBeingAttacked=${unit.isBeingAttacked}, hasTarget=${!!unit.target}, hasLastAttacker=${!!unit.lastAttacker}`)
    
    // Additional debug for damage tracking
    if (unit.lastDamageTime) {
      const timeSinceDamage = now - unit.lastDamageTime
      console.log(`🔧 DAMAGE STATE: lastDamageTime=${timeSinceDamage.toFixed(0)}ms ago, health=${unit.health}/${unit.maxHealth}`)
    }
  }

  // CRITICAL: Immediate self-defense check - this should happen FIRST
  if (unit.isBeingAttacked && unit.lastAttacker && unit.lastAttacker.health > 0) {
    const distanceToAttacker = calculateDistance(unit.x, unit.y, unit.lastAttacker.x, unit.lastAttacker.y)
    const maxRange = 10 * TILE_SIZE // Extended range for immediate response
    
    if (distanceToAttacker <= maxRange) {
      unit.target = unit.lastAttacker
      unit.targetType = 'defensive'
      
      // Force immediate combat response
      if (Math.random() < 0.02) { // Reduce logging spam
        console.log(`🛡️ DEFENSIVE: Unit ${unit.id || 'NO_ID'} (${unit.type}) immediately targeting attacker ${unit.lastAttacker.id || 'NO_ID'} at distance ${distanceToAttacker.toFixed(1)}`)
      }
    } else {
      // Attacker is too far - look for closer enemies to fight instead of just retreating
      if (Math.random() < 0.05) { // Reduce logging spam
        console.log(`🛡️ DEFENSIVE OUT OF RANGE: Unit ${unit.id || 'NO_ID'} - attacker at distance ${distanceToAttacker.toFixed(1)} > max range ${maxRange}, searching for closer targets`)
      }
      
      // Find closer enemies to fight while retreating
      const nearbyEnemies = units.filter(u => 
        u.health > 0 && 
        u.owner === gameState.humanPlayer &&
        calculateDistance(unit.x, unit.y, u.x, u.y) <= 5 * TILE_SIZE
      )
      
      if (nearbyEnemies.length > 0) {
        let closestEnemy = null
        let closestDistance = Infinity
        
        for (const enemy of nearbyEnemies) {
          const distance = calculateDistance(unit.x, unit.y, enemy.x, enemy.y)
          if (distance < closestDistance) {
            closestDistance = distance
            closestEnemy = enemy
          }
        }
        
        if (closestEnemy) {
          unit.target = closestEnemy
          unit.targetType = 'defensive'
          if (Math.random() < 0.1) {
            console.log(`🎯 CLOSER TARGET: Unit ${unit.id} targeting closer enemy ${closestEnemy.id} at distance ${closestDistance.toFixed(1)} while original attacker is too far`)
          }
        }
      }
    }
  }

  // Update defensive state (handles attack memory and defensive mode cleanup)
  updateDefensiveState(unit, now)

  // Apply defensive policy - this takes priority over strategic targets
  const defensiveTarget = applyDefensivePolicy(unit, units, gameState, now)
  if (defensiveTarget && canDefendAgainstTarget(unit, defensiveTarget)) {
    // Override current target with defensive target
    unit.target = defensiveTarget
    unit.targetType = 'defensive'
    
    // Debug logging for defensive behavior
    if (unit.id && Math.random() < 0.01) { // Log occasionally to avoid spam
      console.log(`Unit ${unit.id} entering defensive mode, targeting`, defensiveTarget.id || 'unknown target')
    }
  }

  // If unit is being attacked but has no target, try to find one immediately
  if (unit.isBeingAttacked && !unit.target && unit.lastAttacker && unit.lastAttacker.health > 0) {
    const distanceToAttacker = calculateDistance(unit.x, unit.y, unit.lastAttacker.x, unit.lastAttacker.y)
    const range = (unit.range || 3) * TILE_SIZE
    
    if (distanceToAttacker <= range) {
      unit.target = unit.lastAttacker
      unit.targetType = 'defensive'
      
      // Debug logging
      if (unit.id && Math.random() < 0.01) {
        console.log(`Unit ${unit.id} immediately targeting attacker ${unit.lastAttacker.id || 'unknown'} at distance ${distanceToAttacker.toFixed(1)}`)
      }
    }
  }

  // Lightweight position and movement validation
  if (unit.isMoving && unit.path && unit.path.length > 0) {
    validateMovement(unit)
  }

  // Basic combat validation (actual targeting handled by scheduler)
  if (unit.target && unit.target.health <= 0) {
    unit.target = null
    unit.targetLastKnownPosition = null
    unit.targetType = null
  }

  // IMPORTANT: Check if current target is too far away and should be abandoned
  if (unit.target && unit.targetType !== 'defensive') {
    const targetX = unit.target.x * (unit.target.width ? TILE_SIZE : 1) // Buildings use tile coords
    const targetY = unit.target.y * (unit.target.height ? TILE_SIZE : 1)
    const distanceToTarget = calculateDistance(unit.x, unit.y, targetX, targetY)
    const maxEngagementRange = 12 * TILE_SIZE // Max distance to engage a target
    
    if (distanceToTarget > maxEngagementRange) {
      console.log(`📏 TARGET TOO FAR: Unit ${unit.id} abandoning target at distance ${distanceToTarget.toFixed(1)} > max ${maxEngagementRange}`)
      unit.target = null
      unit.targetType = null
    }
  }

  // If unit still has no target, find the nearest enemy immediately (emergency targeting)
  if (!unit.target && unit.type !== 'harvester') {
    const nearbyEnemies = units.filter(u => 
      u.health > 0 && 
      u.owner === gameState.humanPlayer &&
      calculateDistance(unit.x, unit.y, u.x, u.y) <= 8 * TILE_SIZE
    )
    
    if (nearbyEnemies.length > 0) {
      // Find closest enemy
      let closestEnemy = null
      let closestDistance = Infinity
      
      for (const enemy of nearbyEnemies) {
        const distance = calculateDistance(unit.x, unit.y, enemy.x, enemy.y)
        if (distance < closestDistance) {
          closestDistance = distance
          closestEnemy = enemy
        }
      }
      
      if (closestEnemy) {
        unit.target = closestEnemy
        unit.targetType = 'emergency'
        
        if (Math.random() < 0.1) { // Debug log
          console.log(`🎯 EMERGENCY: Unit ${unit.id} (${unit.type}) targeting nearest enemy ${closestEnemy.id} at distance ${closestDistance.toFixed(1)}`)
        }
      }
    }
  }

  // CRITICAL: If unit has been damaged recently (last 5 seconds) but no attacker is set,
  // assume it's under attack and find nearest enemy as defensive target
  if (!unit.isBeingAttacked && unit.lastDamageTime && (now - unit.lastDamageTime < 5000) && unit.type !== 'harvester') {
    console.log(`🩸 DAMAGE DETECTED: Unit ${unit.id} (${unit.type}) was damaged recently, searching for nearby enemies`)
    
    const nearbyEnemies = units.filter(u => 
      u.health > 0 && 
      u.owner === gameState.humanPlayer &&
      calculateDistance(unit.x, unit.y, u.x, u.y) <= 6 * TILE_SIZE
    )
    
    // Also check for nearby enemy buildings (turrets, etc.)
    const nearbyBuildings = gameState.buildings.filter(b => 
      b.health > 0 && 
      b.owner === gameState.humanPlayer &&
      calculateDistance(unit.x, unit.y, b.x * TILE_SIZE, b.y * TILE_SIZE) <= 6 * TILE_SIZE
    )
    
    const allNearbyTargets = [...nearbyEnemies, ...nearbyBuildings]
    
    if (allNearbyTargets.length > 0) {
      let closestTarget = null
      let closestDistance = Infinity
      
      for (const target of allNearbyTargets) {
        const targetX = target.x * (target.width ? TILE_SIZE : 1) // Buildings use tile coords
        const targetY = target.y * (target.height ? TILE_SIZE : 1)
        const distance = calculateDistance(unit.x, unit.y, targetX, targetY)
        
        if (distance < closestDistance) {
          closestDistance = distance
          closestTarget = target
        }
      }
      
      if (closestTarget) {
        unit.target = closestTarget
        unit.targetType = 'defensive'
        unit.isBeingAttacked = true // Force defensive mode
        console.log(`🛡️ DAMAGE RESPONSE: Unit ${unit.id} targeting ${closestTarget.type || 'unit'} at distance ${closestDistance.toFixed(1)}`)
      }
    }
  }

  handleImmediateCombat(unit, gameState, now)

  // Handle harvester-specific logic
  if (unit.type === 'harvester') {
    handleHarvesterBehavior(unit, gameState, targetedOreTiles)
  }
}

/**
 * Validate unit movement and handle stuck units
 */
function validateMovement(unit) {
  const now = performance.now()
  
  // Check if unit is stuck (hasn't moved in a while)
  if (!unit.lastPositionCheck) {
    unit.lastPositionCheck = now
    unit.lastKnownPosition = { x: unit.x, y: unit.y }
    return
  }

  // Check every 2 seconds
  if (now - unit.lastPositionCheck > 2000) {
    const distanceMoved = calculateDistance(
      unit.x, unit.y,
      unit.lastKnownPosition.x, unit.lastKnownPosition.y
    )

    // If unit hasn't moved much, clear its path
    if (distanceMoved < 0.5) {
      unit.path = []
      unit.isMoving = false
    }

    unit.lastPositionCheck = now
    unit.lastKnownPosition = { x: unit.x, y: unit.y }
  }
}

/**
 * Handle immediate combat needs without expensive calculations
 */
function handleImmediateCombat(unit, gameState, now) {
  if (!unit.target) {
    // Debug: Log when units don't have targets
    if (unit.isBeingAttacked && Math.random() < 0.1) {
      console.log(`⚠️ NO TARGET: Unit ${unit.id} (${unit.type}) is being attacked but has no target`)
    }
    return
  }

  // If target is in range and unit can attack, according to the new centralized logic
  if (canUnitAttackTarget(unit, unit.target)) {
    // --- DEBUG --- Call AI State Snapshot before firing
    if (Math.random() < 0.1) { // Log 10% of the time to avoid spam
      debugAIState(unit, 'Before Firing')
    }
    // -------------
    
    // Debug logging for shooting
    console.log(`🔥 FIRING: Unit ${unit.id || 'NO_ID'} (${unit.type}) firing at target ${unit.target.id || 'NO_ID'}`)
    
    // Use the centralized bullet creation function
    createBullet(unit, unit.target, gameState)

  } else {
    // Debug why unit isn't firing
    if (unit.target && Math.random() < 0.02) {
      // We don't need to duplicate the checks here, but we can log for clarity
      console.log(`🚫 NOT FIRING: Unit ${unit.id || 'NO_ID'} - canUnitAttackTarget returned false.`)
    }
  }
}

/**
 * Handle harvester-specific behavior
 */
function handleHarvesterBehavior(unit, gameState, targetedOreTiles) {
  // Basic harvester logic - detailed logic handled by scheduler
  if (unit.carriedOre >= (unit.oreCapacity || 100)) {
    // Find nearest refinery (this could be cached by scheduler)
    const refinery = gameState.buildings.find(b => 
      b.type === 'ore_refinery' && 
      b.owner === unit.owner && 
      b.health > 0
    )

    if (refinery && !unit.target) {
      unit.target = refinery
      unit.targetType = 'refinery'
    }
  }
}

/**
 * Select target for unit (called by scheduler, not every frame)
 * This is the heavy operation that was moved out of the main loop
 */
export function selectTargetForUnit(unit, units, gameState) {
  if (!unit || unit.health <= 0 || unit.owner === gameState.humanPlayer) {
    return null
  }

  // Skip if unit is harvester heading to refinery
  if (unit.type === 'harvester' && unit.targetType === 'refinery') {
    return unit.target
  }

  const enemyUnits = units.filter(u => 
    u.health > 0 && 
    u.owner === gameState.humanPlayer
  )

  const enemyBuildings = gameState.buildings.filter(b => 
    b.health > 0 && 
    b.owner === gameState.humanPlayer
  )

  const allTargets = [...enemyUnits, ...enemyBuildings]
  if (allTargets.length === 0) return null

  // Find closest target within a reasonable range
  const maxSearchRange = 15 * TILE_SIZE
  let closestTarget = null
  let closestDistance = Infinity

  for (const target of allTargets) {
    const distance = calculateDistance(unit.x, unit.y, target.x, target.y)
    
    if (distance <= maxSearchRange && distance < closestDistance) {
      closestDistance = distance
      closestTarget = target
    }
  }

  return closestTarget
}

/**
 * Check if unit should be allowed to attack (permission system)
 */
export function shouldUnitAttack(unit, target) {
  if (!unit || !target || unit.health <= 0 || target.health <= 0) {
    return false
  }

  // Check if target is enemy
  if (target.owner === unit.owner) {
    return false
  }

  // Check range
  const distance = calculateDistance(unit.x, unit.y, target.x, target.y)
  const range = (unit.range || 3) * TILE_SIZE

  return distance <= range
}
