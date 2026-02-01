import { TILE_SIZE, UNIT_PROPERTIES, UNIT_GAS_PROPERTIES, TANKER_SUPPLY_CAPACITY } from '../config.js'
import { getCachedPath } from '../game/pathfinding.js'
import { getUniqueId } from '../utils.js'
import { findClosestOre } from '../logic.js'
import { assignHarvesterToOptimalRefinery } from '../game/harvesterLogic.js'
import { initializeUnitMovement } from '../game/unifiedMovement.js'

function findAvailableSpawnPosition(buildingCenterX, buildingCenterY, mapGrid, units) {
  const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ]

  for (let distance = 1; distance <= 5; distance++) {
    for (const dir of DIRECTIONS) {
      const x = buildingCenterX + dir.x * distance
      const y = buildingCenterY + dir.y * distance
      if (isPositionValidForSpawn(x, y, mapGrid, units)) {
        return { x, y }
      }
    }
  }

  for (let distance = 6; distance <= 10; distance++) {
    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue
        const x = buildingCenterX + dx
        const y = buildingCenterY + dy
        if (isPositionValidForSpawn(x, y, mapGrid, units)) {
          return { x, y }
        }
      }
    }
  }

  return null
}

function isPositionValidForSpawn(x, y, mapGrid, units) {
  if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) {
    return false
  }
  const tile = mapGrid[y][x]
  if (tile.type === 'water' || tile.type === 'rock' || tile.building || tile.seedCrystal) {
    return false
  }
  for (const unit of units) {
    if (unit.tileX === x && unit.tileY === y) {
      return false
    }
  }
  return true
}

export function spawnEnemyUnit(spawnBuilding, unitType, units, mapGrid, gameState, productionStartTime, aiPlayerId) {
  const buildingCenterX = spawnBuilding.x + Math.floor(spawnBuilding.width / 2)
  const buildingCenterY = spawnBuilding.y + Math.floor(spawnBuilding.height / 2)
  let spawnPosition = findAvailableSpawnPosition(buildingCenterX, buildingCenterY, mapGrid, units)
  if (!spawnPosition) {
    spawnPosition = { x: buildingCenterX, y: buildingCenterY }
  }

  const unit = {
    id: getUniqueId(),
    type: unitType,
    owner: aiPlayerId,
    tileX: spawnPosition.x,
    tileY: spawnPosition.y,
    x: spawnPosition.x * TILE_SIZE,
    y: spawnPosition.y * TILE_SIZE,
    speed: unitType === 'harvester' ? 0.45 : unitType === 'recoveryTank' ? 0.525 : 0.375,
    health: unitType === 'harvester' ? 150 : unitType === 'tank-v2' ? 130 : unitType === 'tank-v3' ? 169 : unitType === 'recoveryTank' ? 150 : 100,
    maxHealth: unitType === 'harvester' ? 150 : unitType === 'tank-v2' ? 130 : unitType === 'tank-v3' ? 169 : unitType === 'recoveryTank' ? 150 : 100,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    spawnTime: Date.now(),
    spawnedInFactory: true,
    holdInFactory: true,
    factoryBuildEndTime: productionStartTime + 5000,
    lastPathCalcTime: 0,
    lastPositionCheckTime: 0,
    lastTargetChangeTime: 0,
    lastDecisionTime: 0,
    direction: 0,
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: 0.15,
    isRotating: false
  }
  unit.effectiveSpeed = unit.speed

  // Initialize gas properties to match player units
  const gasProps = UNIT_GAS_PROPERTIES[unit.type]
  if (gasProps && gasProps.tankSize) {
    unit.maxGas = gasProps.tankSize
    unit.gas = gasProps.tankSize
    unit.gasConsumption = gasProps.consumption
    unit.harvestGasConsumption = gasProps.harvestConsumption || 0
    unit.outOfGasPlayed = false
  }
  if (unit.type === 'tankerTruck') {
    unit.maxSupplyGas = TANKER_SUPPLY_CAPACITY
    unit.supplyGas = TANKER_SUPPLY_CAPACITY
  }

  if (unitType !== 'harvester') {
    unit.level = 0
    unit.experience = 0
    const unitCosts = {
      tank: 1000,
      rocketTank: 2000,
      'tank-v2': 2000,
      'tank-v3': 3000,
      ambulance: 500,
      recoveryTank: 3000
    }

    const fullCrewTanks = ['tank_v1', 'tank-v2', 'tank-v3']
    const loaderUnits = ['tankerTruck', 'ambulance', 'recoveryTank', 'harvester', 'rocketTank']

    // Apache helicopters don't have crew system
    if (unitType !== 'apache') {
      unit.crew = { driver: true, commander: true }

      if (fullCrewTanks.includes(unitType)) {
        unit.crew.gunner = true
        unit.crew.loader = true
      } else if (loaderUnits.includes(unitType)) {
        unit.crew.loader = true
      }
    }

    if (unitType === 'ambulance') {
      unit.medics = UNIT_PROPERTIES.ambulance.medics
      unit.maxMedics = UNIT_PROPERTIES.ambulance.maxMedics
    }

    unit.baseCost = unitCosts[unitType] || 1000
  }

  if (unitType === 'harvester') {
    unit.armor = 3
  }

  if (unitType === 'recoveryTank') {
    unit.armor = 3
  }

  if (unitType === 'tank-v2' || unitType === 'tank-v3') {
    unit.alertMode = true
  }

  if (unitType === 'harvester') {
    const aiGameState = { buildings: gameState?.buildings?.filter(b => b.owner === aiPlayerId) || [] }
    assignHarvesterToOptimalRefinery(unit, aiGameState)
    const targetedOreTiles = gameState?.targetedOreTiles || {}
    const orePos = findClosestOre(unit, mapGrid, targetedOreTiles, unit.assignedRefinery)
    if (orePos) {
      const tileKey = `${orePos.x},${orePos.y}`
      if (gameState?.targetedOreTiles) {
        gameState.targetedOreTiles[tileKey] = unit.id
      }
      const newPath = getCachedPath(
        { x: unit.tileX, y: unit.tileY, owner: unit.owner },
        orePos,
        mapGrid,
        null,
        { unitOwner: unit.owner }
      )
      if (newPath.length > 1) {
        unit.path = newPath.slice(1)
        unit.oreField = orePos
      }
    }
  }

  initializeUnitMovement(unit)

  if (unitType === 'tank_v1' && gameState) {
    const harvesterHunterQueuedKey = `${aiPlayerId}HarvesterHunterQueued`
    if (gameState[harvesterHunterQueuedKey]) {
      unit.harvesterHunter = true
      unit.lastSafeTile = { x: unit.tileX, y: unit.tileY }
      gameState[harvesterHunterQueuedKey] = false
    }
  }

  // Update occupancy map for the newly spawned unit
  if (gameState.occupancyMap) {
    const centerTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
    const centerTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
    if (centerTileY >= 0 && centerTileY < gameState.occupancyMap.length &&
        centerTileX >= 0 && centerTileX < gameState.occupancyMap[0].length) {
      gameState.occupancyMap[centerTileY][centerTileX] = (gameState.occupancyMap[centerTileY][centerTileX] || 0) + 1
    }
  }

  if (window.cheatSystem && window.cheatSystem.isGodModeActive()) {
    window.cheatSystem.addUnitToGodMode(unit)
  }

  return unit
}
