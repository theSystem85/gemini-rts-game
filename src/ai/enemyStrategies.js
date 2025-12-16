// enemyStrategies.js - Enhanced enemy AI strategies
import { TILE_SIZE, TANK_FIRE_RANGE, ATTACK_PATH_CALC_INTERVAL, HOWITZER_FIRE_RANGE, HOWITZER_FIREPOWER, HOWITZER_FIRE_COOLDOWN } from '../config.js'
import { gameState } from '../gameState.js'
import { findPath } from '../units.js'
import { createFormationOffsets } from '../game/pathfinding.js'
import { getUnitCommandsHandler } from '../inputHandler.js'
import { assignAmbulanceToHealUnit } from '../game/ambulanceSystem.js'
import { calculateRepairCost } from '../buildings.js'
import { gameRandom } from '../utils/gameRandom.js'

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

// Pre-computed DPS values for enemy unit types
const UNIT_DPS = {
  tank_v1: 20 / (4000 / 1000),
  tank_v2: 24 / (4000 / 1000),
  'tank-v2': 24 / (4000 / 1000),
  'tank-v3': 30 / (4000 / 1000),
  rocketTank: 120 / (12000 / 1000),
  howitzer: HOWITZER_FIREPOWER / (HOWITZER_FIRE_COOLDOWN / 1000)
}

const AI_REPAIR_COOLDOWN_SECONDS = 10
const AI_LOW_BUDGET_THRESHOLD = 3500
const AI_CRITICAL_BUILDINGS = new Set([
  'constructionYard',
  'powerPlant',
  'oreRefinery',
  'vehicleFactory',
  'vehicleWorkshop',
  'radarStation'
])

const RECOVERY_COMMAND_COOLDOWN = 2000
const crewScanCooldowns = new Map()

// Resolve active AI player IDs based on current game setup
function getAIPlayers(gameState) {
  const human = gameState.humanPlayer || 'player1'
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  return allPlayers.filter(p => p !== human)
}

function getUnitDps(unit) {
  const type = unit.type === 'tank' ? 'tank_v1' : unit.type
  return UNIT_DPS[type] || UNIT_DPS.tank_v1
}

function getNowTime() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now()
}

function getMissingCrewCount(unit) {
  if (!unit || !unit.crew || typeof unit.crew !== 'object') return 0
  return Object.values(unit.crew).filter(alive => !alive).length
}

function ensureAmbulanceQueue(ambulance) {
  if (!ambulance) return []
  if (!Array.isArray(ambulance.pendingHealQueue)) {
    ambulance.pendingHealQueue = []
  }
  return ambulance.pendingHealQueue
}

function isUnitAlreadyQueued(ambulance, unitId) {
  if (!ambulance || !Array.isArray(ambulance.pendingHealQueue)) return false
  return ambulance.pendingHealQueue.some(entry => entry && entry.unitId === unitId)
}

function requestAmbulanceSupport(targetUnit, ambulances, mapGrid) {
  if (!targetUnit || !targetUnit.id) return false
  const missingCrew = getMissingCrewCount(targetUnit)
  if (missingCrew === 0) return false
  const requestTime = getNowTime()

  const eligibleAmbulances = ambulances
    .filter(ambulance => ambulance && ambulance.health > 0 && ambulance.type === 'ambulance')
    .map(ambulance => {
      const distance = Math.hypot(
        (ambulance.x ?? ambulance.tileX * TILE_SIZE) - (targetUnit.x ?? targetUnit.tileX * TILE_SIZE),
        (ambulance.y ?? ambulance.tileY * TILE_SIZE) - (targetUnit.y ?? targetUnit.tileY * TILE_SIZE)
      )
      return {
        ambulance,
        distance
      }
    })
    .filter(entry => {
      const { ambulance } = entry
      if (ambulance.medics <= 0) return false
      if (ambulance.crew && typeof ambulance.crew === 'object' && !ambulance.crew.loader) return false
      return true
    })

  if (eligibleAmbulances.length === 0) {
    return false
  }

  eligibleAmbulances.sort((a, b) => a.distance - b.distance)

  // Check if unit is already being served or queued
  const alreadyAssigned = eligibleAmbulances.some(entry => {
    const ambulance = entry.ambulance
    if (ambulance.healingTarget && ambulance.healingTarget.id === targetUnit.id) {
      return true
    }
    return isUnitAlreadyQueued(ambulance, targetUnit.id)
  })
  if (alreadyAssigned) {
    targetUnit.lastAmbulanceRequestTime = requestTime
    return true
  }

  for (const { ambulance } of eligibleAmbulances) {
    if (ambulance.refillingTarget || ambulance.healingTarget) {
      continue
    }
    if (assignAmbulanceToHealUnit(ambulance, targetUnit, mapGrid)) {
      ambulance.criticalHealing = true
      ambulance.pendingHealQueue = ambulance.pendingHealQueue?.filter(entry => entry.unitId !== targetUnit.id)
      targetUnit.lastAmbulanceRequestTime = requestTime
      return true
    }
  }

  // If no ambulance free, queue with the closest one
  const closest = eligibleAmbulances[0]?.ambulance
  if (!closest) {
    return false
  }

  const queue = ensureAmbulanceQueue(closest)
  const alreadyQueued = queue.some(entry => entry.unitId === targetUnit.id)
  if (!alreadyQueued) {
    queue.push({ unitId: targetUnit.id, requestedAt: requestTime })
    targetUnit.lastAmbulanceRequestTime = requestTime
    return true
  }

  return false
}

function hasPendingRepair(building, awaitingList, underRepairList) {
  if (!building) return true
  const awaiting = awaitingList?.some(entry => entry.building === building)
  if (awaiting) return true
  const repairing = underRepairList?.some(entry => entry.building === building)
  return !!repairing
}

function compareRepairPriority(a, b, lowBudget) {
  if (lowBudget) {
    const aCritical = AI_CRITICAL_BUILDINGS.has(a.type)
    const bCritical = AI_CRITICAL_BUILDINGS.has(b.type)
    if (aCritical !== bCritical) {
      return aCritical ? -1 : 1
    }
  }

  const aDamage = (a.maxHealth - a.health) / a.maxHealth
  const bDamage = (b.maxHealth - b.health) / b.maxHealth

  if (bDamage !== aDamage) {
    return bDamage - aDamage
  }

  return (a.health || 0) - (b.health || 0)
}

export function manageAIRepairs(aiPlayerId, aiFactory, gameState, now) {
  if (!aiFactory || aiFactory.health <= 0) return
  if (!Array.isArray(gameState.buildings) || gameState.buildings.length === 0) return

  const aiBuildings = gameState.buildings.filter(building => (
    building &&
    building.owner === aiPlayerId &&
    building.health > 0 &&
    building.health < building.maxHealth &&
    building.type !== 'concreteWall'
  ))

  if (aiBuildings.length === 0) {
    return
  }

  if (!gameState.buildingsAwaitingRepair) {
    gameState.buildingsAwaitingRepair = []
  }
  if (!gameState.buildingsUnderRepair) {
    gameState.buildingsUnderRepair = []
  }

  const awaitingList = gameState.buildingsAwaitingRepair
  const underRepairList = gameState.buildingsUnderRepair
  const availableBudget = aiFactory.budget || 0
  const lowBudget = availableBudget < AI_LOW_BUDGET_THRESHOLD
  const hasCriticalDamage = aiBuildings.some(b => AI_CRITICAL_BUILDINGS.has(b.type))

  aiBuildings.sort((a, b) => compareRepairPriority(a, b, lowBudget))

  aiBuildings.forEach(building => {
    if (lowBudget && hasCriticalDamage && !AI_CRITICAL_BUILDINGS.has(building.type)) {
      return
    }

    if (hasPendingRepair(building, awaitingList, underRepairList)) {
      return
    }

    const healthToRepair = building.maxHealth - building.health
    if (healthToRepair <= 0) {
      return
    }

    const repairCost = calculateRepairCost(building)
    if (!repairCost || repairCost <= 0) {
      return
    }

    const lastAttackedTime = (typeof building.lastAttackedTime === 'number')
      ? building.lastAttackedTime
      : (now - AI_REPAIR_COOLDOWN_SECONDS * 1000)

    awaitingList.push({
      building,
      repairCost,
      healthToRepair,
      lastAttackedTime,
      isFactory: false,
      initiatedByAI: true
    })
  })
}

function computeDangerAtTarget(aiPlayerId, target, gameState) {
  const dzm = gameState.dangerZoneMaps && gameState.dangerZoneMaps[aiPlayerId]
  if (!dzm) return 0
  const tx = target.tileX !== undefined ? target.tileX : Math.floor(target.x)
  const ty = target.tileY !== undefined ? target.tileY : Math.floor(target.y)
  if (ty >= 0 && ty < dzm.length && tx >= 0 && tx < dzm[0].length) {
    return dzm[ty][tx]
  }
  return 0
}

function computeRequiredGroupSize(aiPlayerId, target, gameState) {
  const danger = computeDangerAtTarget(aiPlayerId, target, gameState)
  if (danger <= 0) return AI_CONFIG.GROUP_ATTACK_MIN_SIZE
  const avgDps = UNIT_DPS.tank_v1
  return Math.max(
    AI_CONFIG.GROUP_ATTACK_MIN_SIZE,
    Math.ceil(danger / avgDps)
  )
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
const lastAttackDirections = new Map() // Map of target building ID to direction
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
    (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank' || u.type === 'howitzer') &&
    Math.hypot(u.x - unit.x, u.y - unit.y) < AI_CONFIG.GROUP_FORMATION_RANGE * TILE_SIZE
  ).length
}

/**
 * Determines if a group attack should be conducted based on group size and enemy defenses
 */
export function shouldConductGroupAttack(unit, units, gameState, target) {
  if (!target) return false

  // Prevent AI from attacking before having core infrastructure
  if (!shouldAIStartAttacking(unit.owner, gameState)) return false

  // Allow individual combat if unit is already in player base area
  const isInPlayerBase = isUnitInPlayerBase(unit, gameState)
  if (isInPlayerBase) {
    return true
  }

  // If we've already maneuvered into firing range of the target, don't hold fire
  // waiting for extra allies. This prevents units from parking next to the
  // player's base and never actually shooting.
  if (target.owner === gameState.humanPlayer) {
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2

    const targetCenterX = target.tileX !== undefined
      ? target.x + TILE_SIZE / 2
      : (target.x + target.width / 2) * TILE_SIZE
    const targetCenterY = target.tileY !== undefined
      ? target.y + TILE_SIZE / 2
      : (target.y + target.height / 2) * TILE_SIZE

    const distanceToTarget = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)

    // Tanks and rocket tanks have slightly different ranges, but using the
    // standard tank fire range as a baseline is sufficient. Adding a small
    // buffer keeps the check tolerant to targeting jitter.
    let effectiveRange = TANK_FIRE_RANGE * TILE_SIZE
    if (unit.type === 'rocketTank') {
      effectiveRange *= 1.3
    } else if (unit.type === 'howitzer') {
      effectiveRange = HOWITZER_FIRE_RANGE * TILE_SIZE
    }
    if (distanceToTarget <= effectiveRange * 1.1) {
      return true
    }
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

  const requiredGroupSize = computeRequiredGroupSize(unit.owner, target, gameState)

  if (totalGroupSize < requiredGroupSize) {
    // Allow solo harvester attacks or very weak targets
    if (target.type === 'harvester' || (target.health && target.health <= (target.maxHealth || 0) * 0.3)) {
      return true
    }
    return false
  }

  return true
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

  if (!nearestBase) return false

  // Calculate retreat position near the base
  const baseX = Math.floor(nearestBase.x + nearestBase.width / 2)
  const baseY = Math.floor(nearestBase.y + nearestBase.height / 2)

  // Find a safe position near the base
  const retreatTarget = findSafePositionNearBase(baseX, baseY, mapGrid, unit)

  if (retreatTarget) {
    const path = findPath(
      { x: unit.tileX, y: unit.tileY, owner: unit.owner },
      retreatTarget,
      mapGrid,
      null,
      undefined,
      { unitOwner: unit.owner }
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
      { x: harvester.tileX, y: harvester.tileY, owner: harvester.owner },
      retreatTarget,
      mapGrid,
      null,
      undefined,
      { unitOwner: harvester.owner }
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
  const path = findPath(
    { x: unit.tileX, y: unit.tileY, owner: unit.owner },
    targetTile,
    mapGrid,
    gameState.occupancyMap,
    undefined,
    { unitOwner: unit.owner }
  )
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
  if ((unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank' || unit.type === 'howitzer')) {
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
  if ((unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank' || unit.type === 'howitzer')) {
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
      const attackDelay = Math.floor(gameRandom() * 200) // Random delay up to 200ms
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
    (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank' || u.type === 'howitzer') &&
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
  const currentDirection = lastAttackDirections.get(buildingId) || 0

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
  } else if (unit.type === 'howitzer') {
    approachDistance = Math.max(approachDistance, HOWITZER_FIRE_RANGE + 2)
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

  const combatTypes = ['tank', 'tank_v1', 'tank-v2', 'tank-v3', 'rocketTank', 'howitzer']
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
        { x: unit.tileX, y: unit.tileY, owner: unit.owner },
        unit.approachPosition,
        mapGrid,
        occupancyMap,
        undefined,
        { unitOwner: unit.owner }
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
      { x: unit.tileX, y: unit.tileY, owner: unit.owner },
      globalPoint,
      mapGrid,
      occupancyMap,
      undefined,
      { unitOwner: unit.owner }
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

    // Apply simple formation to nearby allies
    const group = units.filter(u =>
      u.owner === unit.owner &&
      (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank' || u.type === 'howitzer') &&
      Math.hypot(u.x - unit.x, u.y - unit.y) <= AI_CONFIG.GROUP_FORMATION_RANGE * TILE_SIZE
    )
    if (group.length > 1) {
      createFormationOffsets(group, unit.id)
    }

    // Set path to approach position
    // Always respect the occupancy map for attack movement
    const occupancyMap = gameState.occupancyMap
    const path = findPath(
      { x: unit.tileX, y: unit.tileY, owner: unit.owner },
      approachPos,
      mapGrid,
      occupancyMap,
      undefined,
      { unitOwner: unit.owner }
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
  attackDirectionRotation = Math.floor(gameRandom() * Object.values(ATTACK_DIRECTIONS).length)
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
  // Get all AI players (respect human player and playerCount)
  const aiPlayers = getAIPlayers(gameState)

  aiPlayers.forEach(aiPlayerId => {
    const aiUnits = units.filter(u => u.owner === aiPlayerId)
    const aiBuildings = gameState.buildings ? gameState.buildings.filter(b => b.owner === aiPlayerId) : []
    const hospitals = aiBuildings.filter(b => b.type === 'hospital' && b.health > 0)
    const ambulances = aiUnits.filter(u => u.type === 'ambulance')

    const lastScan = crewScanCooldowns.get(aiPlayerId) || 0
    const allowScan = !lastScan || (now - lastScan >= 5000)

    if (allowScan) {
      crewScanCooldowns.set(aiPlayerId, now)

      // Find units with missing crew members (excluding ambulance)
      const unitsNeedingCrew = aiUnits.filter(unit => {
        if (!unit.crew || typeof unit.crew !== 'object') return false
        if (unit.type === 'ambulance') return false
        return Object.values(unit.crew).some(alive => !alive)
      })

      unitsNeedingCrew.forEach(unit => {
        const engagedAmbulance = requestAmbulanceSupport(unit, ambulances, gameState.mapGrid)
        const canMove = unit.crew.driver && unit.crew.commander

        if (canMove) {
          if (hospitals.length > 0 && !engagedAmbulance) {
            sendUnitToHospital(unit, hospitals[0], gameState.mapGrid, now)
          }
        } else if (!engagedAmbulance && hospitals.length > 0) {
          // Unit cannot move - ensure it remains on the ambulance queue or wait for next scan
          assignAmbulanceToUnit(unit, ambulances, hospitals[0], gameState.mapGrid)
        }
      })
    }

    if (hospitals.length === 0) return // No hospitals available

    // Manage ambulance refilling
    ambulances.forEach(ambulance => {
      if (ambulance.medics < 4 && !ambulance.refillingTarget && !ambulance.healingTarget) {
        sendAmbulanceToHospital(ambulance, hospitals[0], gameState.mapGrid)
      }
    })
  })
}

/**
 * Assigns an ambulance to heal a unit that cannot move
 */
function assignAmbulanceToUnit(targetUnit, ambulances, hospital, mapGrid) {
  const engaged = requestAmbulanceSupport(targetUnit, ambulances, mapGrid)

  if (!engaged && hospital) {
    // If no ambulance available, attempt to direct unit to hospital when possible
    const canMove = targetUnit.crew && targetUnit.crew.driver && targetUnit.crew.commander
    if (canMove) {
      sendUnitToHospital(targetUnit, hospital, mapGrid, getNowTime())
    }
  }
}

export function handleAICrewLossEvent(unit, units, gameState, mapGrid) {
  if (!unit || !units) return
  const aiPlayers = getAIPlayers(gameState)
  if (!aiPlayers.includes(unit.owner)) return
  if (!unit.crew || typeof unit.crew !== 'object') return
  if (!Object.values(unit.crew).some(alive => !alive)) return

  const aiUnits = units.filter(candidate => candidate.owner === unit.owner)
  if (aiUnits.length === 0) return

  const ambulances = aiUnits.filter(candidate => candidate.type === 'ambulance' && candidate.health > 0)
  if (ambulances.length === 0) return

  requestAmbulanceSupport(unit, ambulances, mapGrid)
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
  const startNode = { x: unit.tileX, y: unit.tileY, owner: unit.owner }
  for (const pos of refillPositions) {
    if (pos.x >= 0 && pos.y >= 0 && pos.x < mapGrid[0].length && pos.y < mapGrid.length) {
      const path = findPath(startNode, pos, mapGrid, null, undefined, { unitOwner: unit.owner })
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

  const startNode = { x: ambulance.tileX, y: ambulance.tileY, owner: ambulance.owner }
  const path = findPath(startNode, { x: hospitalCenterX, y: refillY }, mapGrid, null, undefined, { unitOwner: ambulance.owner })
  if (path && path.length > 0) {
    ambulance.path = path
    ambulance.moveTarget = { x: hospitalCenterX * TILE_SIZE, y: refillY * TILE_SIZE }
  }
}

function getTargetTilePosition(target) {
  if (!target) return null
  if (Number.isFinite(target.tileX) && Number.isFinite(target.tileY)) {
    return { x: target.tileX, y: target.tileY }
  }
  if (typeof target.x === 'number' && typeof target.y === 'number') {
    return {
      x: Math.floor((target.x + TILE_SIZE / 2) / TILE_SIZE),
      y: Math.floor((target.y + TILE_SIZE / 2) / TILE_SIZE)
    }
  }
  return null
}

function tileDistance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

function getSortedRecoveryTankOptions(candidateTanks, usedTankIds, targetTile) {
  if (!targetTile) return []

  return candidateTanks
    .filter(tank => !usedTankIds.has(tank.id))
    .map(tank => {
      const tankTile = getTargetTilePosition(tank)
      if (!tankTile) return null
      return {
        tank,
        distance: tileDistance(tankTile.x, tankTile.y, targetTile.x, targetTile.y)
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
}

function isRecoveryTankAvailable(tank) {
  if (!tank || tank.health <= 0) return false

  // Allow tanks that are still in factory to be assigned tasks (they'll execute when released)
  // Skip tanks that are already busy with other tasks
  if (tank.recoveryTask || tank.towedWreck) return false
  if (tank.repairTarget || tank.repairTargetUnit) return false
  if (tank.returningToHospital || tank.repairingAtWorkshop || tank.returningToWorkshop) return false
  if (tank.crew && typeof tank.crew === 'object' && !tank.crew.loader) return false

  const queue = tank.utilityQueue
  if (queue && queue.mode === 'repair') {
    if (queue.currentTargetId) return false
    if (Array.isArray(queue.targets) && queue.targets.length > 0) return false
  }

  return true
}

function hasRecentRecoveryCommand(tank, now) {
  if (!tank || !tank.lastRecoveryCommandTime) return false
  // Skip cooldown for freshly spawned tanks
  if (tank.freshlySpawned) {
    tank.freshlySpawned = false // Clear flag after first check
    return false
  }
  return now - tank.lastRecoveryCommandTime < RECOVERY_COMMAND_COOLDOWN
}

function isUnitAlreadyAssignedToRecovery(recoveryTanks, targetUnit) {
  if (!targetUnit || !targetUnit.id) return false

  return recoveryTanks.some(tank => {
    if (!tank || tank.health <= 0) return false
    if (tank.repairTarget && tank.repairTarget.id === targetUnit.id) return true
    if (tank.repairTargetUnit && tank.repairTargetUnit.id === targetUnit.id) return true

    const queue = tank.utilityQueue
    if (!queue || queue.mode !== 'repair') return false

    if (queue.currentTargetId === targetUnit.id && (queue.currentTargetType || 'unit') === 'unit') {
      return true
    }

    if (!Array.isArray(queue.targets)) return false
    return queue.targets.some(entry => {
      if (!entry) return false
      if (typeof entry === 'object') {
        const entryId = entry.id
        const entryType = entry.type || 'unit'
        return entryId === targetUnit.id && entryType === 'unit'
      }
      return entry === targetUnit.id
    })
  })
}

function attemptAssignRecoveryTankToWreck(tank, wreck, mapGrid, unitCommands, now) {
  if (!tank || !wreck || !unitCommands) {
    window.logger.warn('Recovery tank wreck assignment failed: missing tank, wreck, or commands', {
      hasTank: !!tank,
      hasWreck: !!wreck,
      hasCommands: !!unitCommands
    })
    return false
  }

  const descriptor = { id: wreck.id, isWreckTarget: true, queueAction: 'tow' }
  const result = unitCommands.setUtilityQueue(tank, [descriptor], 'repair', mapGrid, {
    suppressNotifications: true
  })

  tank.lastRecoveryCommandTime = now

  // Check multiple success conditions
  if (tank.recoveryTask && tank.recoveryTask.wreckId === wreck.id) {
    return true
  }

  if (result?.started) {
    return true
  }

  const queue = tank.utilityQueue
  const queueSuccess = !!(queue && queue.mode === 'repair' && queue.currentTargetId === wreck.id && (queue.currentTargetType || 'unit') === 'wreck')

  if (!queueSuccess) {
    window.logger.warn(`✗ Recovery tank ${tank.id} assignment to wreck ${wreck.id} failed`, {
      hasQueue: !!queue,
      queueMode: queue?.mode,
      currentTargetId: queue?.currentTargetId,
      resultStarted: result?.started
    })
  }

  return queueSuccess
}

function attemptAssignRecoveryTankToUnit(tank, targetUnit, mapGrid, unitCommands, now) {
  if (!tank || !targetUnit || !unitCommands) return false

  const result = unitCommands.setUtilityQueue(tank, [targetUnit], 'repair', mapGrid, {
    suppressNotifications: true
  })

  tank.lastRecoveryCommandTime = now

  if (tank.repairTargetUnit && tank.repairTargetUnit.id === targetUnit.id) {
    return true
  }

  if (result?.started) {
    return true
  }

  const queue = tank.utilityQueue
  if (!queue || queue.mode !== 'repair') return false

  if (queue.currentTargetId === targetUnit.id && (queue.currentTargetType || 'unit') === 'unit') {
    return true
  }

  if (!Array.isArray(queue.targets)) return false
  return queue.targets.some(entry => {
    if (!entry) return false
    if (typeof entry === 'object') {
      const entryId = entry.id
      const entryType = entry.type || 'unit'
      return entryId === targetUnit.id && entryType === 'unit'
    }
    return entry === targetUnit.id
  })
}

export function manageAIRecoveryTanks(units, gameState, mapGrid, now) {
  const unitCommands = getUnitCommandsHandler ? getUnitCommandsHandler() : null
  if (!unitCommands) {
    window.logger.warn('manageAIRecoveryTanks: No unit commands handler available')
    return
  }

  const timeNow = typeof now === 'number'
    ? now
    : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())

  const aiPlayers = getAIPlayers(gameState)

  aiPlayers.forEach(aiPlayerId => {
    const aiUnits = units.filter(u => u.owner === aiPlayerId && u.health > 0)
    if (aiUnits.length === 0) return

    const recoveryTanks = aiUnits.filter(u => u.type === 'recoveryTank')
    if (recoveryTanks.length === 0) return

    const candidateTanks = recoveryTanks.filter(tank =>
      isRecoveryTankAvailable(tank) && !hasRecentRecoveryCommand(tank, timeNow)
    )

    if (candidateTanks.length === 0) return

    const usedTankIds = new Set()

    if (Array.isArray(gameState.unitWrecks) && gameState.unitWrecks.length > 0) {
      const availableWrecks = gameState.unitWrecks.filter(wreck =>
        !wreck.assignedTankId &&
        !wreck.towedBy &&
        !wreck.isBeingRecycled
      )

      // For each available recovery tank, find the closest wreck and assign it
      // This ensures proximity-based assignment
      candidateTanks.forEach(tank => {
        if (usedTankIds.has(tank.id)) return
        if (availableWrecks.length === 0) return

        const tankTile = getTargetTilePosition(tank)
        if (!tankTile) return

        // Find closest wreck to this tank
        let closestWreck = null
        let closestDistance = Infinity

        availableWrecks.forEach(wreck => {
          const wreckTile = getTargetTilePosition(wreck)
          if (!wreckTile) return

          const distance = tileDistance(tankTile.x, tankTile.y, wreckTile.x, wreckTile.y)
          if (distance < closestDistance) {
            closestDistance = distance
            closestWreck = wreck
          }
        })

        if (closestWreck) {
          const success = attemptAssignRecoveryTankToWreck(tank, closestWreck, mapGrid, unitCommands, timeNow)
          if (success) {
            usedTankIds.add(tank.id)
            // Remove assigned wreck from available list
            const wreckIndex = availableWrecks.indexOf(closestWreck)
            if (wreckIndex > -1) {
              availableWrecks.splice(wreckIndex, 1)
            }
          }
        }
      })
    }

    if (usedTankIds.size === candidateTanks.length) return

    const damagedUnits = aiUnits.filter(u => {
      if (!u || u.type === 'recoveryTank' || u.health <= 0) return false
      if (typeof u.maxHealth !== 'number' || u.maxHealth <= 0) return false
      if (u.health / u.maxHealth >= 0.5) return false
      if (u.restorationProtectedFromRecovery) return false
      return true
    })

    damagedUnits.sort((a, b) => (a.health / a.maxHealth) - (b.health / b.maxHealth))

    damagedUnits.forEach(targetUnit => {
      if (usedTankIds.size === candidateTanks.length) return
      if (isUnitAlreadyAssignedToRecovery(recoveryTanks, targetUnit)) return

      const targetTile = getTargetTilePosition(targetUnit)
      if (!targetTile) return

      const sortedTanks = getSortedRecoveryTankOptions(candidateTanks, usedTankIds, targetTile)

      for (const entry of sortedTanks) {
        const success = attemptAssignRecoveryTankToUnit(entry.tank, targetUnit, mapGrid, unitCommands, timeNow)
        if (success) {
          usedTankIds.add(entry.tank.id)
          break
        }
      }
    })
  })
}

/**
 * Manages tanker truck refueling and guard behavior for all AI players
 */
export function manageAITankerTrucks(units, gameState, mapGrid) {
  const aiPlayers = getAIPlayers(gameState)

  aiPlayers.forEach(aiPlayerId => {
    const aiUnits = units.filter(u => u.owner === aiPlayerId)
    const tankers = aiUnits.filter(u => u.type === 'tankerTruck')
    if (tankers.length === 0) return

    const harvesters = aiUnits.filter(u => u.type === 'harvester' && u.health > 0)
    const gasStations = (gameState.buildings || []).filter(
      b => b.owner === aiPlayerId && b.type === 'gasStation' && b.health > 0
    )

    // Separate critical (gas <= 0) and low gas units for priority handling
    const criticalUnits = []
    const lowGasUnits = []
    aiUnits.forEach(u => {
      if (u.type === 'tankerTruck' || typeof u.maxGas !== 'number' || u.health <= 0) {
        return
      }
      if (u.gas <= 0) {
        criticalUnits.push(u)
      } else if (u.gas / u.maxGas < 0.5) { // Units below 50% fuel need service
        lowGasUnits.push(u)
      }
    })

    tankers.forEach(tanker => {
      // First priority: tanker needs refill
      const needsRefill =
        (typeof tanker.maxGas === 'number' && tanker.gas / tanker.maxGas < 0.2) ||
        (typeof tanker.maxSupplyGas === 'number' &&
          tanker.supplyGas / tanker.maxSupplyGas < 0.2)

      if (needsRefill && gasStations.length > 0) {
        sendTankerToGasStation(tanker, gasStations[0], mapGrid)
        return
      }

      // Second priority: IMMEDIATE response to critical units (gas <= 0)
      if (criticalUnits.length > 0) {
        // Find the closest critical unit that doesn't already have a tanker assigned
        let target = null
        let bestDistance = Infinity

        criticalUnits.forEach(criticalUnit => {
          // Skip if another tanker is already handling this critical unit
          const alreadyAssigned = tankers.some(otherTanker =>
            otherTanker !== tanker &&
            (otherTanker.emergencyTarget?.id === criticalUnit.id ||
             otherTanker.refuelTarget?.id === criticalUnit.id)
          )
          if (alreadyAssigned) return

          const distance = Math.hypot(criticalUnit.tileX - tanker.tileX, criticalUnit.tileY - tanker.tileY)
          if (distance < bestDistance) {
            bestDistance = distance
            target = criticalUnit
          }
        })

        if (target) {
          // INTERRUPT current non-critical tasks for emergency response
          if (tanker.refuelTarget && tanker.refuelTarget.gas > 0) {
            tanker.refuelTarget = null
            tanker.refuelTimer = 0
          }
          tanker.guardTarget = null

          sendTankerToUnit(tanker, target, mapGrid, gameState.occupancyMap)
          tanker.emergencyTarget = target // Mark as emergency mission
          tanker.emergencyMode = true
          return
        }
      }

      // Third priority: low gas units
      if (lowGasUnits.length > 0) {
        const target = lowGasUnits.reduce((best, unit) => {
          const unitRatio = unit.gas / unit.maxGas
          const bestRatio = best ? best.gas / best.maxGas : Infinity
          if (unitRatio < bestRatio) return unit
          if (unitRatio > bestRatio) return best

          const unitDistance = Math.hypot(unit.tileX - tanker.tileX, unit.tileY - tanker.tileY)
          const bestDistance = best
            ? Math.hypot(best.tileX - tanker.tileX, best.tileY - tanker.tileY)
            : Infinity
          return unitDistance < bestDistance ? unit : best
        }, null)

        if (target) {
          sendTankerToUnit(tanker, target, mapGrid, gameState.occupancyMap)
          return
        }
      }

      // Fourth priority: guard harvesters
      if (harvesters.length > 0) {
        const guardTarget = harvesters.find(h => !lowGasUnits.includes(h) && !criticalUnits.includes(h)) || harvesters[0]
        if (!tanker.guardTarget || tanker.guardTarget.health <= 0 || tanker.guardTarget.id !== guardTarget.id) {
          tanker.guardTarget = guardTarget
        }
      }
    })
  })
}

function sendTankerToGasStation(tanker, station, mapGrid) {
  const cx = station.x + Math.floor(station.width / 2)
  const cy = station.y + station.height + 1
  const startNode = { x: tanker.tileX, y: tanker.tileY, owner: tanker.owner }
  const path = findPath(startNode, { x: cx, y: cy }, mapGrid, null, undefined, { unitOwner: tanker.owner })
  if (path && path.length > 1) {
    tanker.path = path.slice(1)
    tanker.moveTarget = { x: cx, y: cy }
  }
  tanker.guardTarget = null
}

function sendTankerToUnit(tanker, unit, mapGrid, occupancyMap) {
  // Set the refuel target BEFORE pathfinding, just like player tanker commands
  tanker.refuelTarget = unit
  tanker.refuelTimer = 0


  // Try to find an adjacent position to the target unit (like player tanker commands do)
  const targetTileX = unit.tileX
  const targetTileY = unit.tileY
  const directions = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ]

  const startNode = { x: tanker.tileX, y: tanker.tileY, owner: tanker.owner }
  let pathFound = false
  for (const dir of directions) {
    const destX = targetTileX + dir.x
    const destY = targetTileY + dir.y
    if (destX >= 0 && destY >= 0 && destX < mapGrid[0].length && destY < mapGrid.length) {
      const path = findPath(startNode, { x: destX, y: destY }, mapGrid, occupancyMap, undefined, { unitOwner: tanker.owner })
      if (path && path.length > 0) {
        tanker.path = path.slice(1)
        tanker.moveTarget = { x: destX, y: destY }
        pathFound = true
        break
      }
    }
  }

  if (!pathFound) {
  }

  tanker.guardTarget = null
}

/**
 * Manages ammunition supply truck deployment and resupply operations for all AI players
 * Implements FR-031, FR-034, FR-036
 */
export function manageAIAmmunitionTrucks(units, gameState, mapGrid) {
  const aiPlayers = getAIPlayers(gameState)

  aiPlayers.forEach(aiPlayerId => {
    const aiUnits = units.filter(u => u.owner === aiPlayerId)
    const ammoTrucks = aiUnits.filter(u => u.type === 'ammunitionTruck' && u.health > 0)
    if (ammoTrucks.length === 0) return

    const ammoFactories = (gameState.buildings || []).filter(
      b => b.owner === aiPlayerId && b.type === 'ammunitionFactory' && b.health > 0
    )

    // Separate critical (ammo <= 0) and low ammo units for priority handling
    const criticalUnits = []
    const lowAmmoUnits = []
    aiUnits.forEach(u => {
      if (u.type === 'ammunitionTruck' || u.health <= 0) return
      
      // Check for units with ammunition system (maxAmmunition or maxRocketAmmo)
      const hasAmmoSystem = typeof u.maxAmmunition === 'number' || typeof u.maxRocketAmmo === 'number'
      if (!hasAmmoSystem) return

      const maxAmmo = u.type === 'apache' ? u.maxRocketAmmo : u.maxAmmunition
      const currentAmmo = u.type === 'apache' ? u.rocketAmmo : u.ammunition
      
      if (currentAmmo <= 0) {
        criticalUnits.push(u)
      } else if (currentAmmo / maxAmmo < 0.2) { // 20% threshold for low ammunition
        lowAmmoUnits.push(u)
      }
    })

    ammoTrucks.forEach(truck => {
      // First priority: truck needs reload
      const needsReload = typeof truck.maxAmmoCargo === 'number' && truck.ammoCargo / truck.maxAmmoCargo < 0.2

      if (needsReload && ammoFactories.length > 0) {
        sendAmmoTruckToFactory(truck, ammoFactories[0], mapGrid)
        return
      }

      // Second priority: IMMEDIATE response to critical units (ammo <= 0)
      if (criticalUnits.length > 0 && truck.ammoCargo > 0) {
        let target = null
        let bestDistance = Infinity

        criticalUnits.forEach(criticalUnit => {
          // Skip if another truck is already handling this critical unit
          const alreadyAssigned = ammoTrucks.some(otherTruck =>
            otherTruck !== truck &&
            otherTruck.ammoResupplyTarget?.id === criticalUnit.id
          )
          if (alreadyAssigned) return

          const distance = Math.hypot(criticalUnit.tileX - truck.tileX, criticalUnit.tileY - truck.tileY)
          if (distance < bestDistance) {
            bestDistance = distance
            target = criticalUnit
          }
        })

        if (target) {
          sendAmmoTruckToUnit(truck, target, mapGrid, gameState.occupancyMap)
          return
        }
      }

      // Third priority: low ammo units
      if (lowAmmoUnits.length > 0 && truck.ammoCargo > 0) {
        let target = lowAmmoUnits[0]
        let best = Math.hypot(target.tileX - truck.tileX, target.tileY - truck.tileY)
        lowAmmoUnits.forEach(u => {
          const d = Math.hypot(u.tileX - truck.tileX, u.tileY - truck.tileY)
          if (d < best) {
            best = d
            target = u
          }
        })
        sendAmmoTruckToUnit(truck, target, mapGrid, gameState.occupancyMap)
        return
      }

      // Fourth priority: follow combat groups at safe distance
      const combatUnits = aiUnits.filter(u => 
        (u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank') &&
        u.health > 0
      )
      if (combatUnits.length > 0) {
        // Find center of mass of combat group
        let centerX = 0
        let centerY = 0
        combatUnits.forEach(u => {
          centerX += u.tileX
          centerY += u.tileY
        })
        centerX = Math.floor(centerX / combatUnits.length)
        centerY = Math.floor(centerY / combatUnits.length)

        // Stay 3-5 tiles behind the combat group
        const distance = Math.hypot(truck.tileX - centerX, truck.tileY - centerY)
        if (distance > 7 || distance < 3) {
          // Move to maintain safe distance
          const angle = Math.atan2(truck.tileY - centerY, truck.tileX - centerX)
          const targetX = Math.floor(centerX + Math.cos(angle) * 5)
          const targetY = Math.floor(centerY + Math.sin(angle) * 5)
          
          if (targetX >= 0 && targetY >= 0 && targetX < mapGrid[0].length && targetY < mapGrid.length) {
            const startNode = { x: truck.tileX, y: truck.tileY, owner: truck.owner }
            const path = findPath(startNode, { x: targetX, y: targetY }, mapGrid, null, undefined, { unitOwner: truck.owner })
            if (path && path.length > 1) {
              truck.path = path.slice(1)
              truck.moveTarget = { x: targetX, y: targetY }
            }
          }
        }
      }
    })
  })
}

function sendAmmoTruckToFactory(truck, factory, mapGrid) {
  const cx = factory.x + Math.floor(factory.width / 2)
  const cy = factory.y + factory.height + 1
  const startNode = { x: truck.tileX, y: truck.tileY, owner: truck.owner }
  const path = findPath(startNode, { x: cx, y: cy }, mapGrid, null, undefined, { unitOwner: truck.owner })
  if (path && path.length > 1) {
    truck.path = path.slice(1)
    truck.moveTarget = { x: cx, y: cy }
  }
  // Clear any existing resupply target
  truck.ammoResupplyTarget = null
}

function sendAmmoTruckToUnit(truck, unit, mapGrid, occupancyMap) {
  // Set the resupply target BEFORE pathfinding
  truck.ammoResupplyTarget = unit
  truck.ammoResupplyTimer = 0

  // Try to find an adjacent position to the target unit
  const targetTileX = unit.tileX
  const targetTileY = unit.tileY
  const directions = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
  ]

  const startNode = { x: truck.tileX, y: truck.tileY, owner: truck.owner }
  let pathFound = false
  for (const dir of directions) {
    const destX = targetTileX + dir.x
    const destY = targetTileY + dir.y
    if (destX >= 0 && destY >= 0 && destX < mapGrid[0].length && destY < mapGrid.length) {
      const path = findPath(startNode, { x: destX, y: destY }, mapGrid, occupancyMap, undefined, { unitOwner: truck.owner })
      if (path && path.length > 0) {
        truck.path = path.slice(1)
        truck.moveTarget = { x: destX, y: destY }
        pathFound = true
        break
      }
    }
  }
}

/**
 * Monitors AI unit ammunition levels and triggers resupply retreats
 * Implements FR-032, FR-033
 */
export function manageAIAmmunitionMonitoring(units, gameState, mapGrid) {
  const aiPlayers = getAIPlayers(gameState)

  aiPlayers.forEach(aiPlayerId => {
    const aiUnits = units.filter(u => u.owner === aiPlayerId && u.health > 0)
    const ammoFactories = (gameState.buildings || []).filter(
      b => b.owner === aiPlayerId && b.type === 'ammunitionFactory' && b.health > 0
    )
    const ammoTrucks = aiUnits.filter(u => u.type === 'ammunitionTruck' && u.health > 0)

    aiUnits.forEach(unit => {
      // Skip units without ammunition system
      const hasAmmoSystem = typeof unit.maxAmmunition === 'number' || typeof unit.maxRocketAmmo === 'number'
      if (!hasAmmoSystem || unit.type === 'ammunitionTruck') return

      const maxAmmo = unit.type === 'apache' ? unit.maxRocketAmmo : unit.maxAmmunition
      const currentAmmo = unit.type === 'apache' ? unit.rocketAmmo : unit.ammunition
      const ammoPercentage = currentAmmo / maxAmmo

      // FR-033: Retreat logic when ammunition falls below 20%
      if (ammoPercentage < 0.2 && !unit.retreatingForAmmo) {
        unit.retreatingForAmmo = true
        
        // Find nearest resupply point (factory or truck)
        let nearestResupply = null
        let nearestDistance = Infinity

        // Check ammunition factories
        ammoFactories.forEach(factory => {
          const distance = Math.hypot(
            unit.tileX - (factory.x + Math.floor(factory.width / 2)),
            unit.tileY - (factory.y + Math.floor(factory.height / 2))
          )
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestResupply = { type: 'factory', target: factory }
          }
        })

        // Check ammunition trucks with cargo
        ammoTrucks.forEach(truck => {
          if (truck.ammoCargo > 0) {
            const distance = Math.hypot(unit.tileX - truck.tileX, unit.tileY - truck.tileY)
            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestResupply = { type: 'truck', target: truck }
            }
          }
        })

        // Path to nearest resupply point
        if (nearestResupply) {
          let targetX, targetY
          if (nearestResupply.type === 'factory') {
            targetX = nearestResupply.target.x + Math.floor(nearestResupply.target.width / 2)
            targetY = nearestResupply.target.y + nearestResupply.target.height + 1
          } else {
            targetX = nearestResupply.target.tileX
            targetY = nearestResupply.target.tileY
          }

          const startNode = { x: unit.tileX, y: unit.tileY, owner: unit.owner }
          const path = findPath(startNode, { x: targetX, y: targetY }, mapGrid, gameState.occupancyMap, undefined, { unitOwner: unit.owner })
          if (path && path.length > 1) {
            // Cancel current attack/move commands
            unit.target = null
            unit.path = path.slice(1)
            unit.moveTarget = { x: targetX, y: targetY }
          }
        }
      } else if (ammoPercentage >= 0.8 && unit.retreatingForAmmo) {
        // Resume normal operations after resupply
        unit.retreatingForAmmo = false
      }
    })
  })
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
