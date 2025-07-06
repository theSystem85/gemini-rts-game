// defensivePolicy.js
// AI defensive behavior policy system
// Ensures units defend themselves when attacked, overriding strategic targets when necessary

import { TILE_SIZE } from '../config.js'
import { calculateDistance } from '../utils.js'

// Defensive policy configuration
const DEFENSIVE_CONFIG = {
  // How long to remember being attacked (in milliseconds)
  ATTACK_MEMORY_DURATION: 8000, // 8 seconds
  
  // Range within which unit will prioritize defensive targets
  DEFENSIVE_RANGE: 6 * TILE_SIZE,
  
  // How often to reassess defensive threats (in milliseconds)
  THREAT_ASSESSMENT_INTERVAL: 500, // 0.5 seconds
  
  // Priority multiplier for defensive targets
  DEFENSIVE_PRIORITY_MULTIPLIER: 2.0,
  
  // Maximum time to pursue an attacker before returning to strategic target
  MAX_PURSUIT_TIME: 5000 // 5 seconds
}

/**
 * Check if a unit should enter defensive mode
 * @param {Object} unit - The AI unit to check
 * @param {number} now - Current timestamp
 * @returns {boolean} True if unit should prioritize defense
 */
export function shouldEnterDefensiveMode(unit, now) {
  if (!unit || !unit.lastDamageTime || !unit.lastAttacker) {
    return false
  }

  // Check if attack was recent enough to warrant defensive response
  const timeSinceAttack = now - unit.lastDamageTime
  return timeSinceAttack < DEFENSIVE_CONFIG.ATTACK_MEMORY_DURATION
}

/**
 * Get the defensive target for a unit
 * @param {Object} unit - The AI unit
 * @param {Array} allUnits - All units in the game
 * @param {Object} gameState - Current game state
 * @param {number} now - Current timestamp
 * @returns {Object|null} The target to defend against, or null
 */
export function getDefensiveTarget(unit, allUnits, gameState, now) {
  if (!shouldEnterDefensiveMode(unit, now)) {
    return null
  }

  // Primary defensive target is the last attacker if still valid
  if (unit.lastAttacker && unit.lastAttacker.health > 0) {
    const distanceToAttacker = calculateDistance(
      unit.x, unit.y, 
      unit.lastAttacker.x, unit.lastAttacker.y
    )

    // If attacker is within defensive range, target them
    if (distanceToAttacker <= DEFENSIVE_CONFIG.DEFENSIVE_RANGE) {
      return unit.lastAttacker
    }
  }

  // Find nearest enemy unit that has recently attacked this unit or nearby allies
  const nearbyThreats = findNearbyThreats(unit, allUnits, gameState, now)
  
  if (nearbyThreats.length > 0) {
    // Return the closest threat
    return nearbyThreats[0]
  }

  return null
}

/**
 * Find nearby threats to the unit
 * @param {Object} unit - The AI unit
 * @param {Array} allUnits - All units in the game
 * @param {Object} gameState - Current game state
 * @param {number} now - Current timestamp
 * @returns {Array} Array of threat units, sorted by distance
 */
function findNearbyThreats(unit, allUnits, gameState, now) {
  const threats = []

  // Find enemy units within defensive range
  const enemyUnits = allUnits.filter(u => 
    u.health > 0 && 
    u.owner === gameState.humanPlayer &&
    calculateDistance(unit.x, unit.y, u.x, u.y) <= DEFENSIVE_CONFIG.DEFENSIVE_RANGE
  )

  for (const enemy of enemyUnits) {
    const distance = calculateDistance(unit.x, unit.y, enemy.x, enemy.y)
    
    // Priority boost if this enemy has recently attacked us
    let priority = 1.0
    if (enemy === unit.lastAttacker) {
      priority = DEFENSIVE_CONFIG.DEFENSIVE_PRIORITY_MULTIPLIER
    }

    threats.push({
      unit: enemy,
      distance,
      priority,
      adjustedDistance: distance / priority
    })
  }

  // Sort by adjusted distance (closer and higher priority threats first)
  threats.sort((a, b) => a.adjustedDistance - b.adjustedDistance)

  return threats.map(threat => threat.unit)
}

/**
 * Apply defensive policy to unit targeting
 * This should be called before normal target selection
 * @param {Object} unit - The AI unit
 * @param {Array} allUnits - All units in the game
 * @param {Object} gameState - Current game state
 * @param {number} now - Current timestamp
 * @returns {Object|null} Defensive target or null if no defensive action needed
 */
export function applyDefensivePolicy(unit, allUnits, gameState, now) {
  // Skip defensive policy for harvesters unless they're being directly attacked
  if (unit.type === 'harvester' && !unit.isBeingAttacked) {
    return null
  }

  const defensiveTarget = getDefensiveTarget(unit, allUnits, gameState, now)
  
  if (defensiveTarget) {
    // Mark unit as in defensive mode
    unit.isInDefensiveMode = true
    unit.defensiveModeStartTime = unit.defensiveModeStartTime || now
    unit.strategicTarget = unit.strategicTarget || unit.target // Save original target
    
    // Check if we should stop pursuing and return to strategic target
    const pursuitTime = now - unit.defensiveModeStartTime
    if (pursuitTime > DEFENSIVE_CONFIG.MAX_PURSUIT_TIME) {
      // Return to strategic target if pursuit has gone on too long
      return exitDefensiveMode(unit)
    }

    return defensiveTarget
  } else {
    // No defensive target, return to strategic objective if we were in defensive mode
    if (unit.isInDefensiveMode) {
      return exitDefensiveMode(unit)
    }
  }

  return null
}

/**
 * Exit defensive mode and return to strategic target
 * @param {Object} unit - The AI unit
 * @returns {Object|null} The strategic target to return to
 */
function exitDefensiveMode(unit) {
  unit.isInDefensiveMode = false
  unit.defensiveModeStartTime = null
  
  const strategicTarget = unit.strategicTarget
  unit.strategicTarget = null
  
  return strategicTarget
}

/**
 * Check if unit can effectively defend itself (has weapon, in range, etc.)
 * @param {Object} unit - The AI unit
 * @param {Object} target - The defensive target
 * @returns {boolean} True if unit can defend itself
 */
export function canDefendAgainstTarget(unit, target) {
  if (!unit || !target || unit.health <= 0 || target.health <= 0) {
    return false
  }

  // Check if unit has combat capability
  if (!unit.damage || unit.damage <= 0) {
    return false
  }

  // Check if target is within range
  const distance = calculateDistance(unit.x, unit.y, target.x, target.y)
  const range = (unit.range || 3) * TILE_SIZE

  return distance <= range
}

/**
 * Update defensive policy state for a unit
 * Should be called every frame for units that might need defensive behavior
 * @param {Object} unit - The AI unit
 * @param {number} now - Current timestamp
 */
export function updateDefensiveState(unit, now) {
  // Clear old attack memory
  if (unit.lastDamageTime && (now - unit.lastDamageTime) > DEFENSIVE_CONFIG.ATTACK_MEMORY_DURATION) {
    unit.lastAttacker = null
    unit.isBeingAttacked = false
  }

  // Clear defensive mode if no longer needed
  if (unit.isInDefensiveMode && !shouldEnterDefensiveMode(unit, now)) {
    exitDefensiveMode(unit)
  }
}
