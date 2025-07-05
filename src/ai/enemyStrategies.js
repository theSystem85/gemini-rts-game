// enemyStrategies.js - Enhanced enemy AI strategies
import { TILE_SIZE, TANK_FIRE_RANGE, ATTACK_PATH_CALC_INTERVAL } from '../config.js'
import { gameState } from '../gameState.js'
import { findPath } from '../units.js'

// Configuration constants for AI behavior
const AI_CONFIG = {
  GROUP_ATTACK_MIN_SIZE: 3,           // Minimum units needed for group attack
  LOW_HEALTH_RETREAT_THRESHOLD: 0.1,  // 10% health threshold for retreat
  HARVESTER_DEFENSE_RANGE: 6,         // Range in tiles to defend harvesters
  BASE_RETREAT_RANGE: 10,             // Range in tiles to consider as "base area"
  GROUP_FORMATION_RANGE: 8,           // Range in tiles for units to be considered in same group
  DEFENSE_BUILDING_RANGE: 12          // Range to seek protection from defense buildings
}

// Multi-directional attack configuration
const ATTACK_DIRECTIONS = {
  NORTH: { x: 0, y: -1, name: 'north' },
  NORTHEAST: { x: 1, y: -1, name: 'northeast' },
  EAST: { x: 1, y: 0, name: 'east' },
  SOUTHEAST: { x: 1, y: 1, name: 'southeast' },
  SOUTH: { x: 0, y: 1, name: 'south' },
  SOUTHWEST: { x: -1, y: 1, name: 'southwest' },
  WEST: { x: -1, y: 0, name: 'west' },
  NORTHWEST: { x: -1, y: -1, name: 'northwest' }
}

// Track last attack directions to avoid repetition
let lastAttackDirections = new Map() // Map of target building ID to direction
let attackDirectionRotation = 0 // Global rotation counter

/**
 * Evaluates the strength of player defenses near a target
 * Returns a score representing defensive strength
 */
function evaluatePlayerDefenses(target, gameState) {
  if (!gameState.buildings) return 0
  
  let defenseScore = 0
  const targetX = target.tileX !== undefined ? target.tileX : target.x
  const targetY = target.tileY !== undefined ? target.tileY : target.y
  
  // Check for defensive buildings near target
  gameState.buildings
    .filter(b => b.owner === gameState.humanPlayer)
    .forEach(building => {
      const distance = Math.hypot(
        (building.x + building.width / 2) - targetX,
        (building.y + building.height / 2) - targetY
      )
      
      // Add defense score based on building type and proximity
      if (distance <= AI_CONFIG.DEFENSE_BUILDING_RANGE) {
        switch (building.type) {
          case 'turretGunV1':
            defenseScore += 1
            break
          case 'turretGunV2':
            defenseScore += 2
            break
          case 'turretGunV3':
            defenseScore += 3
            break
          case 'rocketTurret':
            defenseScore += 4
            break
          case 'teslaCoil':
            defenseScore += 5
            break
        }
      }
    })
  
  return defenseScore
}

/**
 * Counts allied combat units within formation range
 */
function countNearbyAllies(unit, units) {
  return units.filter(u => 
    u.owner === 'enemy' && 
    u !== unit &&
    u.health > 0 &&
    (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank') &&
    Math.hypot(u.x - unit.x, u.y - unit.y) < AI_CONFIG.GROUP_FORMATION_RANGE * TILE_SIZE
  ).length
}

/**
 * Determines if a group attack should be conducted based on group size and enemy defenses
 */
export function shouldConductGroupAttack(unit, units, gameState, target) {
  if (!target) return false
  
  // Allow individual combat if unit is already in player base area
  const isInPlayerBase = isUnitInPlayerBase(unit, gameState)
  if (isInPlayerBase) {
    return true
  }
  
  // Allow individual combat if unit is under attack
  if (unit.isBeingAttacked || unit.lastDamageTime && Date.now() - unit.lastDamageTime < 5000) {
    return true
  }
  
  const nearbyAllies = countNearbyAllies(unit, units)
  const totalGroupSize = nearbyAllies + 1 // Include the unit itself
  
  // Check if we have minimum group size
  if (totalGroupSize < AI_CONFIG.GROUP_ATTACK_MIN_SIZE) {
    return false
  }
  
  // Evaluate player defenses at target location
  const defenseStrength = evaluatePlayerDefenses(target, gameState)
  
  // Require larger groups for heavily defended targets
  const requiredGroupSize = Math.max(AI_CONFIG.GROUP_ATTACK_MIN_SIZE, Math.ceil(defenseStrength / 2))
  
  return totalGroupSize >= requiredGroupSize
}

/**
 * Checks if unit should retreat due to low health
 */
export function shouldRetreatLowHealth(unit) {
  if (!unit.health || !unit.maxHealth) return false
  
  const healthPercent = unit.health / unit.maxHealth
  return healthPercent <= AI_CONFIG.LOW_HEALTH_RETREAT_THRESHOLD
}

/**
 * Finds the nearest enemy base/defensive position for retreating units
 */
function findNearestEnemyBase(unit, gameState) {
  if (!gameState.buildings) return null
  
  const enemyBuildings = gameState.buildings.filter(b => b.owner === 'enemy')
  let nearestBase = null
  let nearestDistance = Infinity
  
  enemyBuildings.forEach(building => {
    const distance = Math.hypot(
      (building.x + building.width / 2) * TILE_SIZE - (unit.x + TILE_SIZE / 2),
      (building.y + building.height / 2) * TILE_SIZE - (unit.y + TILE_SIZE / 2)
    )
    
    // Prioritize defensive buildings
    const isDefensive = building.type.includes('turret') || building.type === 'teslaCoil'
    const adjustedDistance = isDefensive ? distance * 0.8 : distance
    
    if (adjustedDistance < nearestDistance) {
      nearestDistance = adjustedDistance
      nearestBase = building
    }
  })
  
  return nearestBase
}

/**
 * Handles unit retreat to base when health is low
 */
export function handleRetreatToBase(unit, gameState, mapGrid) {
  const nearestBase = findNearestEnemyBase(unit, gameState)
  
  if (!nearestBase) return false
  
  // Calculate retreat position near the base
  const baseX = Math.floor(nearestBase.x + nearestBase.width / 2)
  const baseY = Math.floor(nearestBase.y + nearestBase.height / 2)
  
  // Find a safe position near the base
  const retreatTarget = findSafePositionNearBase(baseX, baseY, mapGrid, unit)
  
  if (retreatTarget) {
    const path = findPath(
      { x: unit.tileX, y: unit.tileY },
      retreatTarget,
      mapGrid,
      null
    )
    
    if (path.length > 1) {
      unit.path = path.slice(1)
      unit.isRetreating = true
      unit.retreatTarget = retreatTarget
      return true
    }
  }
  
  return false
}

/**
 * Finds a safe position near a base for retreat
 */
function findSafePositionNearBase(baseX, baseY, mapGrid, unit) {
  const directions = [
    { x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 },
    { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ]
  
  for (const dir of directions) {
    const x = baseX + dir.x
    const y = baseY + dir.y
    
    if (x >= 0 && y >= 0 && x < mapGrid[0].length && y < mapGrid.length) {
      const tile = mapGrid[y][x]
      if (tile.type !== 'water' && tile.type !== 'rock' && !tile.building) {
        return { x, y }
      }
    }
  }
  
  return { x: baseX, y: baseY }
}

/**
 * Checks if a harvester is under attack and should seek protection
 */
export function shouldHarvesterSeekProtection(harvester, units) {
  if (harvester.type !== 'harvester') return false
  
  // Check for nearby enemy units threatening the harvester
  const nearbyThreats = units.filter(u =>
    u.owner === gameState.humanPlayer &&
    u.health > 0 &&
    Math.hypot(u.x - harvester.x, u.y - harvester.y) < AI_CONFIG.HARVESTER_DEFENSE_RANGE * TILE_SIZE
  )
  
  return nearbyThreats.length > 0
}

/**
 * Handles harvester retreat to base when under attack
 */
export function handleHarvesterRetreat(harvester, gameState, mapGrid) {
  const nearestBase = findNearestEnemyBase(harvester, gameState)
  
  if (!nearestBase) return false
  
  // Find position near defensive buildings
  const retreatTarget = findDefensivePosition(nearestBase, gameState, mapGrid)
  
  if (retreatTarget) {
    const path = findPath(
      { x: harvester.tileX, y: harvester.tileY },
      retreatTarget,
      mapGrid,
      null
    )
    
    if (path.length > 1) {
      harvester.path = path.slice(1)
      harvester.isRetreating = true
      harvester.retreatTarget = retreatTarget
      // Clear any ore-related state
      harvester.oreField = null
      harvester.harvesting = false
      return true
    }
  }
  
  return false
}

/**
 * Finds a defensive position near base buildings
 */
function findDefensivePosition(baseBuilding, gameState, mapGrid) {
  if (!gameState.buildings) return null
  
  // Look for defensive buildings near the base
  const defensiveBuildings = gameState.buildings.filter(b => 
    b.owner === 'enemy' && 
    (b.type.includes('turret') || b.type === 'teslaCoil') &&
    Math.hypot(
      (b.x + b.width / 2) - (baseBuilding.x + baseBuilding.width / 2),
      (b.y + b.height / 2) - (baseBuilding.y + baseBuilding.height / 2)
    ) < AI_CONFIG.BASE_RETREAT_RANGE
  )
  
  if (defensiveBuildings.length > 0) {
    // Find position between base and defensive buildings
    const defBuilding = defensiveBuildings[0]
    const midX = Math.floor((baseBuilding.x + defBuilding.x) / 2)
    const midY = Math.floor((baseBuilding.y + defBuilding.y) / 2)
    
    return findSafePositionNearBase(midX, midY, mapGrid)
  }
  
  // Fallback to base position
  return {
    x: Math.floor(baseBuilding.x + baseBuilding.width / 2),
    y: Math.floor(baseBuilding.y + baseBuilding.height / 2)
  }
}

/**
 * Checks if a unit should stop retreating (reached safe zone or health recovered)
 */
export function shouldStopRetreating(unit, gameState) {
  if (!unit.isRetreating) return false
  
  // Stop retreating if health is above threshold and near base
  const healthPercent = unit.health / unit.maxHealth
  if (healthPercent > 0.3) { // 30% health to stop retreating
    // Check if unit is near enemy base
    const nearestBase = findNearestEnemyBase(unit, gameState)
    if (nearestBase) {
      const distanceToBase = Math.hypot(
        (nearestBase.x + nearestBase.width / 2) * TILE_SIZE - (unit.x + TILE_SIZE / 2),
        (nearestBase.y + nearestBase.height / 2) * TILE_SIZE - (unit.y + TILE_SIZE / 2)
      )
      
      if (distanceToBase < AI_CONFIG.BASE_RETREAT_RANGE * TILE_SIZE) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Checks if a unit is currently in or near the player's base area
 */
function isUnitInPlayerBase(unit, gameState) {
  if (!gameState.buildings) return false
  
  const unitX = unit.x + TILE_SIZE / 2
  const unitY = unit.y + TILE_SIZE / 2
  
  // Check if unit is near any player buildings
  return gameState.buildings
    .filter(b => b.owner === gameState.humanPlayer)
    .some(building => {
      const buildingCenterX = (building.x + building.width / 2) * TILE_SIZE
      const buildingCenterY = (building.y + building.height / 2) * TILE_SIZE
      const distance = Math.hypot(buildingCenterX - unitX, buildingCenterY - unitY)
      
      // Consider "in base" if within 8 tiles of any player building
      return distance <= 8 * TILE_SIZE
    })
}

/**
 * Main strategy coordinator - applies all AI policies to a unit
 */
export function applyEnemyStrategies(unit, units, gameState, mapGrid, now) {
  // Skip if unit is dead
  if (!unit.health || unit.health <= 0) return
  
  // Handle retreating units
  if (unit.isRetreating) {
    if (shouldStopRetreating(unit, gameState)) {
      unit.isRetreating = false
      unit.retreatTarget = null
      unit.path = []
    } else {
      // Continue retreating
      return
    }
  }
  
  // Check for low health retreat (combat units)
  if ((unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank')) {
    if (shouldRetreatLowHealth(unit)) {
      handleRetreatToBase(unit, gameState, mapGrid)
      return
    }
  }
  
  // Check for harvester protection
  if (unit.type === 'harvester') {
    if (shouldHarvesterSeekProtection(unit, units)) {
      handleHarvesterRetreat(unit, gameState, mapGrid)
      return
    }
  }
  
  // Apply group attack strategies for combat units
  if ((unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank')) {
    const shouldAttack = shouldConductGroupAttack(unit, units, gameState, unit.target)
    unit.allowedToAttack = shouldAttack
    
    // Apply multi-directional attack coordination if allowed to attack
    if (shouldAttack) {
      handleMultiDirectionalAttack(unit, units, gameState, mapGrid)
    }
  }
  
  // Coordinate multi-directional attacks
  if (unit.type === 'tank' && unit.allowedToAttack) {
    coordinateMultiDirectionalAttack(unit, units, gameState)
  }
}

/**
 * Coordinates a multi-directional attack on the target
 */
function coordinateMultiDirectionalAttack(unit, units, gameState) {
  const target = unit.target
  if (!target) return
  
  // Get last attack direction to avoid repetition
  const lastDirection = lastAttackDirections.get(target.id)
  
  // Try all directions to find a valid attack angle
  for (let [key, dir] of Object.entries(ATTACK_DIRECTIONS)) {
    // Rotate directions to spread out attacks
    dir = rotateDirection(dir, attackDirectionRotation)
    
    // Skip if this direction was just used
    if (dir.name === lastDirection) {
      continue
    }
    
    const angle = Math.atan2(dir.y, dir.x)
    const distance = Math.hypot(dir.x, dir.y)
    
    // Check for clear path to target in this direction
    const pathClear = checkAttackPath(unit, target, angle, distance, gameState)
    
    if (pathClear) {
      // Mark this direction as last used for this target
      lastAttackDirections.set(target.id, dir.name)
      
      // Spread out attack timings slightly
      const attackDelay = Math.floor(Math.random() * 200) // Random delay up to 200ms
      unit.attackTime = Date.now() + attackDelay
      
      // Attack in this direction
      unit.attackDirection = dir
      unit.isAttacking = true
      return
    }
  }
  
  // If no clear direction, fallback to direct attack
  unit.attackDirection = { x: 1, y: 0 }
  unit.isAttacking = true
}

/**
 * Rotates a direction vector for spreading out attacks
 */
function rotateDirection(dir, rotation) {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  
  return {
    x: dir.x * cos - dir.y * sin,
    y: dir.x * sin + dir.y * cos
  }
}

/**
 * Checks if the attack path is clear in the given direction
 */
function checkAttackPath(unit, target, angle, distance, gameState) {
  const stepSize = 10 // Check every 10 pixels
  for (let d = 0; d < distance; d += stepSize) {
    const checkX = unit.x + Math.cos(angle) * d
    const checkY = unit.y + Math.sin(angle) * d
    
    // Check for obstacles in the path
    const tile = getTileAtPosition(checkX, checkY, gameState.mapGrid || [])
    if (tile && (tile.type === 'rock' || tile.type === 'water')) {
      return false
    }
  }
  
  return true
}

/**
 * Gets the tile at the given screen position
 */
function getTileAtPosition(x, y, mapGrid) {
  const tileX = Math.floor(x / TILE_SIZE)
  const tileY = Math.floor(y / TILE_SIZE)
  
  if (tileY >= 0 && tileY < mapGrid.length) {
    return mapGrid[tileY][tileX]
  }
  
  return null
}

/**
 * Finds the player's main base center for attack coordination
 */
function findPlayerBaseCenter(gameState) {
  if (!gameState.buildings) return null
  
  const playerBuildings = gameState.buildings.filter(b => b.owner === gameState.humanPlayer)
  if (playerBuildings.length === 0) return null
  
  // Find construction yard or command center as primary target
  let primaryTarget = playerBuildings.find(b => 
    b.type === 'constructionYard' || b.type === 'commandCenter'
  )
  
  // If no primary target, use any important building
  if (!primaryTarget) {
    primaryTarget = playerBuildings.find(b => 
      b.type === 'vehicleFactory' || b.type === 'oreRefinery' || b.type === 'powerPlant'
    )
  }
  
  // Fallback to first building
  if (!primaryTarget) {
    primaryTarget = playerBuildings[0]
  }
  
  return {
    x: Math.floor(primaryTarget.x + primaryTarget.width / 2),
    y: Math.floor(primaryTarget.y + primaryTarget.height / 2),
    building: primaryTarget
  }
}

/**
 * Assigns attack direction to a group of units to avoid clustering
 */
export function assignAttackDirection(unit, units, gameState) {
  const playerBase = findPlayerBaseCenter(gameState)
  if (!playerBase) return null
  
  // Get nearby combat units for direction assignment
  const nearbyUnits = units.filter(u => 
    u.owner === 'enemy' && 
    u !== unit &&
    u.health > 0 &&
    (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank') &&
    Math.hypot(u.x - unit.x, u.y - unit.y) < AI_CONFIG.GROUP_FORMATION_RANGE * TILE_SIZE * 2
  )
  
  const totalGroup = [unit, ...nearbyUnits]
  const groupSize = totalGroup.length
  
  // If single unit, use rotating direction
  if (groupSize === 1) {
    const directions = Object.values(ATTACK_DIRECTIONS)
    const direction = directions[attackDirectionRotation % directions.length]
    attackDirectionRotation++
    return direction
  }
  
  // For groups, distribute around the target
  const buildingId = playerBase.building.id || `${playerBase.building.x}-${playerBase.building.y}`
  
  // Get current direction assignment for this target
  let currentDirection = lastAttackDirections.get(buildingId) || 0
  
  // Assign different directions to each unit in the group
  const unitIndex = totalGroup.indexOf(unit)
  const directionIndex = (currentDirection + unitIndex) % Object.values(ATTACK_DIRECTIONS).length
  const direction = Object.values(ATTACK_DIRECTIONS)[directionIndex]
  
  // Update direction rotation for this target
  lastAttackDirections.set(buildingId, (currentDirection + 1) % Object.values(ATTACK_DIRECTIONS).length)
  
  return direction
}

/**
 * Calculates approach position for multi-directional attack
 */
export function calculateApproachPosition(unit, target, direction, gameState, mapGrid) {
  if (!target || !direction) return null
  
  const targetX = target.tileX !== undefined ? target.tileX : Math.floor(target.x)
  const targetY = target.tileY !== undefined ? target.tileY : Math.floor(target.y)
  
  // Calculate approach distance based on unit type and target defenses
  const defenseStrength = evaluatePlayerDefenses(target, gameState)
  let approachDistance = Math.max(8, Math.min(15, 10 + defenseStrength))
  
  // Adjust for unit fire range
  if (unit.type === 'rocketTank' || unit.type === 'tank-v3') {
    approachDistance = Math.max(approachDistance, TANK_FIRE_RANGE / TILE_SIZE + 2)
  }
  
  // Calculate approach position in the assigned direction
  let approachX = targetX + (direction.x * approachDistance)
  let approachY = targetY + (direction.y * approachDistance)
  
  // Ensure approach position is within map bounds
  if (mapGrid && mapGrid.length > 0) {
    approachX = Math.max(0, Math.min(mapGrid[0].length - 1, approachX))
    approachY = Math.max(0, Math.min(mapGrid.length - 1, approachY))
    
    // Find nearest valid tile if the exact position is blocked
    for (let radius = 0; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
          
          const checkX = approachX + dx
          const checkY = approachY + dy
          
          if (checkX >= 0 && checkY >= 0 && 
              checkX < mapGrid[0].length && checkY < mapGrid.length) {
            const tile = mapGrid[checkY][checkX]
            if (tile.type !== 'water' && tile.type !== 'rock' && !tile.building) {
              return { x: checkX, y: checkY, direction: direction.name }
            }
          }
        }
      }
    }
  }
  
  return { x: approachX, y: approachY, direction: direction.name }
}

/**
 * Coordinates multi-directional attack for combat units
 */
export function handleMultiDirectionalAttack(unit, units, gameState, mapGrid) {
  // Only apply to combat units that aren't already retreating
  if (unit.isRetreating || !unit.allowedToAttack) return false
  
  const combatTypes = ['tank', 'tank_v1', 'tank-v2', 'tank-v3', 'rocketTank']
  if (!combatTypes.includes(unit.type)) return false
  
  // Skip if unit already has a specific approach position
  if (unit.approachPosition && unit.approachDirection) {
    // Check if we're close to approach position
    const distToApproach = Math.hypot(
      unit.tileX - unit.approachPosition.x,
      unit.tileY - unit.approachPosition.y
    )
    
    if (distToApproach <= 2) {
      // Reached approach position, clear it to allow normal combat
      unit.approachPosition = null
      unit.approachDirection = null
      return false
    }
    
    // Continue moving to approach position
    // Always respect the occupancy map for attack movement
    // Throttle attack pathfinding to 3 seconds to reduce computational load
    const now = performance.now()
    const pathRecalcNeeded = !unit.lastAttackPathCalcTime || (now - unit.lastAttackPathCalcTime > ATTACK_PATH_CALC_INTERVAL)
    
    if (pathRecalcNeeded) {
      const occupancyMap = gameState.occupancyMap
      const path = findPath(
        { x: unit.tileX, y: unit.tileY },
        unit.approachPosition,
        mapGrid,
        occupancyMap
      )
      
      if (path.length > 1) {
        unit.path = path.slice(1)
        unit.lastAttackPathCalcTime = now
        return true
      }
    }
  }
  
  // Find target for attack
  const target = findPlayerBaseCenter(gameState)
  if (!target) return false
  
  // Skip if already very close to target (engage directly)
  const distanceToTarget = Math.hypot(
    unit.tileX - target.x,
    unit.tileY - target.y
  )
  
  if (distanceToTarget <= 8) return false // Close enough for direct engagement
  
  // Assign attack direction and approach position
  const direction = assignAttackDirection(unit, units, gameState)
  const approachPos = calculateApproachPosition(unit, target, direction, gameState, mapGrid)
  
  if (approachPos) {
    unit.approachPosition = approachPos
    unit.approachDirection = direction.name
    
    // Set path to approach position
    // Always respect the occupancy map for attack movement
    const occupancyMap = gameState.occupancyMap
    const path = findPath(
      { x: unit.tileX, y: unit.tileY },
      approachPos,
      mapGrid,
      occupancyMap
    )
    
    if (path.length > 1) {
      unit.path = path.slice(1)
      return true
    }
  }
  
  return false
}

/**
 * Resets attack direction memory to ensure varied attack patterns
 * Call this periodically or when major changes occur
 */
export function resetAttackDirections() {
  lastAttackDirections.clear()
  attackDirectionRotation = Math.floor(Math.random() * Object.values(ATTACK_DIRECTIONS).length)
}

/**
 * Gets attack statistics for debugging/monitoring
 */
export function getAttackDirectionStats() {
  return {
    activeDirections: lastAttackDirections.size,
    currentRotation: attackDirectionRotation,
    directions: Array.from(lastAttackDirections.entries())
  }
}
