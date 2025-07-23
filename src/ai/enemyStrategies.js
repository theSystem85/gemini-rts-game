// enemyStrategies.js - Enhanced enemy AI strategies
import { TILE_SIZE, TANK_FIRE_RANGE, ATTACK_PATH_CALC_INTERVAL } from '../config.js'
import { gameState } from '../gameState.js'
import { findPath } from '../units.js'

// Configuration constants for AI behavior
const AI_CONFIG = {
  GROUP_ATTACK_MIN_SIZE: 3,           // Minimum units needed for group attack
  LOW_HEALTH_RETREAT_THRESHOLD: 0.33, // 33% health threshold for retreat
  HARVESTER_DEFENSE_RANGE: 6,         // Range in tiles to defend harvesters
  BASE_RETREAT_RANGE: 10,             // Range in tiles to consider as "base area"
  GROUP_FORMATION_RANGE: 8,           // Range in tiles for units to be considered in same group
  DEFENSE_BUILDING_RANGE: 12,         // Range to seek protection from defense buildings
  CREW_HEALING_RANGE: 15              // Range to consider for ambulance healing
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
          case 'artilleryTurret':
            defenseScore += 6
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
  
  // Always allow attacking player harvesters (high priority economic targets)
  if (target.type === 'harvester' && target.owner === gameState.humanPlayer) {
    return true
  }
  
  // Allow attacking damaged player units
  if (target.health && target.maxHealth && target.health <= target.maxHealth * 0.5) {
    return true
  }
  
  const nearbyAllies = countNearbyAllies(unit, units)
  const totalGroupSize = nearbyAllies + 1 // Include the unit itself
  
  // Check if we have minimum group size for heavily defended targets
  if (totalGroupSize < AI_CONFIG.GROUP_ATTACK_MIN_SIZE) {
    // Allow solo attacks on weak or economic targets
    if (target.type === 'harvester' || 
        (target.health && target.maxHealth && target.health <= target.maxHealth * 0.3) ||
        target.type === 'oreRefinery') {
      return true
    }
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
    const isDefensive =
      building.type.includes('turret') ||
      building.type === 'teslaCoil' ||
      building.type === 'artilleryTurret'
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

  console.log('Handling retreat for unit:', unit.id, 'to base:', nearestBase ? nearestBase.id : 'none')
  
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
      unit.needsWorkshopRepair = true
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
  
  // Also check if harvester has been recently damaged
  const recentlyDamaged = harvester.lastDamageTime && (performance.now() - harvester.lastDamageTime < 10000)
  
  return nearbyThreats.length > 0 || recentlyDamaged
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
    (b.type.includes('turret') || b.type === 'teslaCoil' || b.type === 'artilleryTurret') &&
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
 * Sends a damaged unit to the nearest vehicle workshop for repair
 */
function sendUnitToWorkshop(unit, gameState, mapGrid) {
  const workshops = gameState.buildings.filter(b =>
    b.type === 'vehicleWorkshop' && b.owner === unit.owner && b.health > 0
  )

  if (workshops.length === 0) return false

  // Find nearest workshop
  let nearest = null
  let nearestDist = Infinity
  workshops.forEach(ws => {
    const dist = Math.hypot(unit.tileX - ws.x, unit.tileY - ws.y)
    if (dist < nearestDist) {
      nearest = ws
      nearestDist = dist
    }
  })

  if (!nearest) return false

  if (!nearest.repairQueue) nearest.repairQueue = []
  if (!nearest.repairQueue.includes(unit)) {
    nearest.repairQueue.push(unit)
    unit.targetWorkshop = nearest
  }
  unit.returningToWorkshop = true

  const waitingY = nearest.y + nearest.height + 1
  const waitingX = nearest.x + (nearest.repairQueue.indexOf(unit) % nearest.width)
  const targetTile = { x: waitingX, y: waitingY }
  const path = findPath({ x: unit.tileX, y: unit.tileY }, targetTile, mapGrid, gameState.occupancyMap)
  if (path && path.length > 0) {
    unit.path = path.slice(1)
    unit.moveTarget = targetTile
  } else {
    unit.x = targetTile.x * TILE_SIZE
    unit.y = targetTile.y * TILE_SIZE
    unit.tileX = targetTile.x
    unit.tileY = targetTile.y
    unit.moveTarget = null
  }
  unit.target = null
  return true
}

/**
 * Checks if a unit should stop retreating (reached safe zone or health recovered)
 */
export function shouldStopRetreating(unit, gameState) {
  if (!unit.isRetreating) return false
  
  // Stop retreating if health is above threshold and near base
  const healthPercent = unit.health / unit.maxHealth
  const notUnderFire = !unit.isBeingAttacked && (!unit.lastDamageTime || performance.now() - unit.lastDamageTime > 2000)
  if (healthPercent > 0.3 && notUnderFire) { // 30% health to stop retreating and no recent attacks
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

  // Ignore other strategies while heading to or being repaired at a workshop
  if (unit.returningToWorkshop || unit.repairingAtWorkshop) {
    return
  }
  
  // Handle retreating units
  if (unit.isRetreating) {
    if (shouldStopRetreating(unit, gameState)) {
      unit.isRetreating = false
      unit.retreatTarget = null
      unit.path = []
      if (unit.needsWorkshopRepair && unit.health < unit.maxHealth) {
        sendUnitToWorkshop(unit, gameState, mapGrid)
        unit.needsWorkshopRepair = false
      }
    } else {
      // Continue retreating
      return
    }
  }
  
  // Check for low health - immediately send to workshop when possible
  if ((unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank')) {
    if (shouldRetreatLowHealth(unit)) {
      const sent = sendUnitToWorkshop(unit, gameState, mapGrid)
      if (!sent) {
        handleRetreatToBase(unit, gameState, mapGrid)
      }
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
      handleMultiDirectionalAttack(unit, units, gameState, mapGrid, now)
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
    if (tile && (tile.type === 'rock' || tile.type === 'water' || tile.seedCrystal)) {
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
export function handleMultiDirectionalAttack(unit, units, gameState, mapGrid, now) {
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
    // Throttle attack pathfinding to 5 seconds to prevent wiggling (matches AI_DECISION_INTERVAL)
    const pathRecalcNeeded = !unit.lastAttackPathCalcTime || (now - unit.lastAttackPathCalcTime > 5000) // Changed from ATTACK_PATH_CALC_INTERVAL to 5000
    
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
    
    // Return true to indicate we're still working on the approach (prevents normal targeting)
    return true
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

  const globalPoint = gameState.globalAttackPoint
  if (globalPoint) {
    unit.approachPosition = globalPoint
    unit.approachDirection = 'global'
    unit.lastDirectionAssignment = now
    const occupancyMap = gameState.occupancyMap
    const path = findPath(
      { x: unit.tileX, y: unit.tileY },
      globalPoint,
      mapGrid,
      occupancyMap
    )
    if (path.length > 1) {
      unit.path = path.slice(1)
      return true
    }
  }

  // Only assign new attack directions every 5 seconds to prevent wiggling
  const lastDirectionAssignment = unit.lastDirectionAssignment || 0
  if (now - lastDirectionAssignment < 5000) {
    return false // Skip direction assignment if too recent
  }
  
  // Assign attack direction and approach position
  const direction = assignAttackDirection(unit, units, gameState)
  const approachPos = calculateApproachPosition(unit, target, direction, gameState, mapGrid)
  
  if (approachPos) {
    unit.approachPosition = approachPos
    unit.approachDirection = direction.name
    unit.lastDirectionAssignment = now // Track when we last assigned a direction
    
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

/**
 * Manages AI crew healing and hospital usage
 * Prioritizes units that need crew restoration
 */
export function manageAICrewHealing(units, gameState, now) {
  // Get all AI players
  const aiPlayers = ['enemy1', 'enemy2', 'enemy3', 'enemy4']
  
  aiPlayers.forEach(aiPlayerId => {
    const aiUnits = units.filter(u => u.owner === aiPlayerId)
    const aiBuildings = gameState.buildings ? gameState.buildings.filter(b => b.owner === aiPlayerId) : []
    const hospitals = aiBuildings.filter(b => b.type === 'hospital' && b.health > 0)
    const ambulances = aiUnits.filter(u => u.type === 'ambulance')
    
    if (hospitals.length === 0) return // No hospitals available
    
    // Find units with missing crew members (excluding ambulance and rocket tank)
    const unitsNeedingCrew = aiUnits.filter(unit => {
      if (!unit.crew || typeof unit.crew !== 'object') return false
      if (unit.type === 'ambulance' || unit.type === 'rocketTank') return false // AI units don't use crew system
      return Object.values(unit.crew).some(alive => !alive)
    })
    
    unitsNeedingCrew.forEach(unit => {
      // Check if unit can move (has driver and commander)
      const canMove = unit.crew.driver && unit.crew.commander
      
      if (!canMove) {
        // Unit cannot move - needs ambulance assistance
        assignAmbulanceToUnit(unit, ambulances, hospitals[0])
      } else {
        // Unit can move - send it to hospital
        sendUnitToHospital(unit, hospitals[0], gameState.mapGrid, now)
      }
    })
    
    // Manage ambulance refilling
    ambulances.forEach(ambulance => {
      if (ambulance.crew < 4 && !ambulance.refillingTarget && !ambulance.healingTarget) {
        sendAmbulanceToHospital(ambulance, hospitals[0], gameState.mapGrid)
      }
    })
  })
}

/**
 * Assigns an ambulance to heal a unit that cannot move
 */
function assignAmbulanceToUnit(targetUnit, ambulances, hospital) {
  // Find available ambulance with crew
  const availableAmbulance = ambulances.find(ambulance => 
    ambulance.crew > 0 && 
    !ambulance.healingTarget && 
    !ambulance.refillingTarget &&
    !ambulance.path // Not currently moving
  )
  
  if (availableAmbulance) {
    availableAmbulance.healingTarget = targetUnit
    availableAmbulance.healingTimer = 0
    
    // Set priority flag to indicate this is a critical healing mission
    availableAmbulance.criticalHealing = true
    
    // Clear any other objectives
    availableAmbulance.target = null
    availableAmbulance.moveTarget = null
    availableAmbulance.path = []
  }
}

/**
 * Sends a unit to hospital for crew restoration
 */
function sendUnitToHospital(unit, hospital, mapGrid, now) {
  // Don't send if already en route or recently assigned
  if (unit.returningToHospital || (unit.lastHospitalAssignment && now - unit.lastHospitalAssignment < 5000)) {
    return
  }
  
  // Mark unit as returning to hospital
  unit.returningToHospital = true
  unit.lastHospitalAssignment = now
  unit.hospitalTarget = hospital
  
  // Clear other objectives
  unit.target = null
  unit.moveTarget = null
  unit.path = []
  unit.isRetreating = false // Override retreat behavior
  
  // Calculate path to hospital refill area (3 tiles below hospital)
  const hospitalCenterX = hospital.x + Math.floor(hospital.width / 2)
  const refillY = hospital.y + hospital.height + 1
  
  const refillPositions = [
    { x: hospitalCenterX, y: refillY },
    { x: hospitalCenterX - 1, y: refillY },
    { x: hospitalCenterX + 1, y: refillY },
    { x: hospitalCenterX, y: refillY + 1 },
    { x: hospitalCenterX - 1, y: refillY + 1 },
    { x: hospitalCenterX + 1, y: refillY + 1 }
  ]
  
  // Find best position
  for (const pos of refillPositions) {
    if (pos.x >= 0 && pos.y >= 0 && pos.x < mapGrid[0].length && pos.y < mapGrid.length) {
      const path = findPath(unit, pos.x, pos.y, mapGrid)
      if (path && path.length > 0) {
        unit.path = path
        unit.moveTarget = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE }
        break
      }
    }
  }
}

/**
 * Sends an ambulance to hospital for refilling
 */
function sendAmbulanceToHospital(ambulance, hospital, mapGrid) {
  ambulance.refillingTarget = hospital
  
  // Calculate path to hospital
  const hospitalCenterX = hospital.x + Math.floor(hospital.width / 2)
  const refillY = hospital.y + hospital.height + 1
  
  const path = findPath(ambulance, hospitalCenterX, refillY, mapGrid)
  if (path && path.length > 0) {
    ambulance.path = path
    ambulance.moveTarget = { x: hospitalCenterX * TILE_SIZE, y: refillY * TILE_SIZE }
  }
}

/**
 * Checks if an AI player should start attacking (has hospital built)
 */
export function shouldAIStartAttacking(aiPlayerId, gameState) {
  if (!gameState.buildings) return false
  
  const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
  const hasHospital = aiBuildings.some(b => b.type === 'hospital' && b.health > 0)
  const hasVehicleFactory = aiBuildings.some(b => b.type === 'vehicleFactory' && b.health > 0)
  const hasRefinery = aiBuildings.some(b => b.type === 'oreRefinery' && b.health > 0)
  
  // AI should only start major attacks after having core infrastructure
  return hasHospital && hasVehicleFactory && hasRefinery
}

// Determine a tile around the player's buildings with the lowest danger level
export function computeLeastDangerAttackPoint(gameState) {
  const human = gameState.humanPlayer || 'player1'
  const dzm = gameState.dangerZoneMaps && gameState.dangerZoneMaps[human]
  if (!dzm) return null

  const buildings = (gameState.buildings || []).filter(
    b => b.owner === human && b.health > 0
  )
  if (buildings.length === 0) return null

  let best = null
  buildings.forEach(b => {
    for (let y = b.y - 1; y <= b.y + b.height; y++) {
      if (y < 0 || y >= dzm.length) continue
      for (let x = b.x - 1; x <= b.x + b.width; x++) {
        if (x < 0 || x >= dzm[0].length) continue
        const dps = dzm[y][x]
        if (!best || dps < best.dps) {
          best = { dps, x, y }
        }
      }
    }
  })

  return best ? { x: best.x, y: best.y } : null
}
