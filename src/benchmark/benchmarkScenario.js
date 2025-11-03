import { gameState } from '../gameState.js'
import { factories, mapGrid, units, getCurrentGame } from '../main.js'
import { buildingData, createBuilding, placeBuilding, updatePowerSupply } from '../buildings.js'
import { initializeOccupancyMap, createUnit } from '../units.js'
import { updateDangerZoneMaps } from '../game/dangerZoneMap.js'
import { getTextureManager } from '../rendering.js'
import { cleanupOreFromBuildings } from '../gameSetup.js'
import { TILE_SIZE } from '../config.js'
import { getUniqueId } from '../utils.js'
import { resetBenchmarkCameraFocus } from './benchmarkTracker.js'

const BUILDING_TYPES = Object.keys(buildingData)

const PLAYER_BASE_ANGLES = {
  player1: Math.PI / 4,
  player2: -3 * Math.PI / 4,
  player3: (3 * Math.PI) / 4,
  player4: -Math.PI / 4
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function prepareMap() {
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[y].length; x++) {
      const tile = mapGrid[y][x]
      tile.type = 'land'
      tile.ore = false
      tile.noBuild = 0
      tile.seedCrystal = false
      delete tile.building
    }
  }
}

function prepareArea(x, y, width, height) {
  for (let ty = y; ty < y + height; ty++) {
    for (let tx = x; tx < x + width; tx++) {
      if (ty >= 0 && ty < mapGrid.length && tx >= 0 && tx < mapGrid[ty].length) {
        const tile = mapGrid[ty][tx]
        tile.type = 'street'
        tile.ore = false
        tile.noBuild = 0
      }
    }
  }
}

function placePlayerBuildings(playerId, factory, mapWidth, mapHeight) {
  const angle = PLAYER_BASE_ANGLES[playerId] ?? 0
  const centerX = factory.x + Math.floor(factory.width / 2)
  const centerY = factory.y + Math.floor(factory.height / 2)
  const radiusBase = 8
  const radiusStep = 2

  BUILDING_TYPES.forEach((type, index) => {
    if (type === 'constructionYard') {
      return
    }

    const data = buildingData[type]
    if (!data) return

    const angleOffset = angle - (Math.PI / 3) + (index / (BUILDING_TYPES.length - 1)) * (2 * Math.PI) / 3
    const radius = radiusBase + radiusStep * (index % 6)
    const targetCenterX = centerX + Math.round(Math.cos(angleOffset) * radius)
    const targetCenterY = centerY + Math.round(Math.sin(angleOffset) * radius)

    const tileX = clamp(targetCenterX - Math.floor(data.width / 2), 1, mapWidth - data.width - 1)
    const tileY = clamp(targetCenterY - Math.floor(data.height / 2), 1, mapHeight - data.height - 1)

    prepareArea(tileX - 1, tileY - 1, data.width + 2, data.height + 2)

    const building = createBuilding(type, tileX, tileY)
    building.id = `${playerId}_${type}_${index}_${getUniqueId()}`
    building.owner = playerId
    building.constructionFinished = true
    building.constructionStartTime = performance.now() - 10000
    building.isBenchmarkStructure = true

    placeBuilding(building, mapGrid, null)
    gameState.buildings.push(building)
  })
}

function spawnSupportUnits(factory, supportAnchor) {
  if (!supportAnchor) return

  const supportTypes = ['harvester', 'tankerTruck', 'ambulance', 'recoveryTank']
  const mapWidth = mapGrid[0]?.length || 0
  const mapHeight = mapGrid.length || 0

  supportTypes.forEach((type, index) => {
    const baseX = clamp(supportAnchor.x, 1, mapWidth - 2)
    const baseY = clamp(supportAnchor.y, 1, mapHeight - 2)
    const tileX = clamp(baseX + index * 2, 1, mapWidth - 2)
    const tileY = clamp(baseY, 1, mapHeight - 2)
    prepareArea(tileX, tileY, 1, 1)
    const unit = createUnit(factory, type, tileX, tileY)
    unit.x = tileX * TILE_SIZE
    unit.y = tileY * TILE_SIZE
    unit.target = null
    unit.id = `${unit.id}_bench`
    units.push(unit)
  })
}

function spawnBattleUnits(factory, anchor) {
  const battleTypes = ['tank_v1', 'tank-v2', 'tank-v3', 'rocketTank', 'howitzer', 'apache']
  const offsets = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 },
    { x: 4, y: 2 }
  ]

  const createdUnits = []
  const mapWidth = mapGrid[0]?.length || 0
  const mapHeight = mapGrid.length || 0

  battleTypes.forEach((type, index) => {
    const offset = offsets[index % offsets.length]
    const tileX = clamp(anchor.x + offset.x, 1, mapWidth - 2)
    const tileY = clamp(anchor.y + offset.y, 1, mapHeight - 2)

    prepareArea(tileX, tileY, 1, 1)

    const unit = createUnit(factory, type, tileX, tileY)
    unit.x = tileX * TILE_SIZE
    unit.y = tileY * TILE_SIZE
    unit.id = `${unit.id}_bench`

    if (unit.type === 'apache') {
      unit.isAirUnit = true
      unit.flightState = 'airborne'
      unit.altitude = TILE_SIZE * 3
      unit.targetAltitude = unit.altitude
      unit.hovering = true
      unit.rotor = unit.rotor || { angle: 0, speed: 0, targetSpeed: 0 }
      unit.rotor.speed = 20
      unit.rotor.targetSpeed = 20
    }

    createdUnits.push(unit)
    units.push(unit)
  })

  return createdUnits
}

function assignBattleTargets(anchorEntries) {
  anchorEntries.forEach(([playerId, anchor]) => {
    const enemyUnits = anchorEntries
      .filter(([otherId]) => otherId !== playerId)
      .flatMap(([, enemyAnchor]) => enemyAnchor.units)

    anchor.units.forEach(unit => {
      if (enemyUnits.length === 0) {
        unit.target = null
        return
      }
      const target = enemyUnits[Math.floor(Math.random() * enemyUnits.length)]
      unit.target = target
      unit.guardMode = false
    })
  })
}

export function setupBenchmarkScenario() {
  const game = getCurrentGame()
  if (!game) {
    throw new Error('Game instance not available')
  }

  gameState.playerCount = 4
  gameState.humanPlayer = 'player1'
  gameState.speedMultiplier = 1

  game.resetGame()

  prepareMap()

  factories.forEach(factory => {
    placeBuilding(factory, mapGrid, null)
  })

  const mapWidth = mapGrid[0]?.length || 0
  const mapHeight = mapGrid.length || 0

  cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)

  gameState.money = 50000
  gameState.gameTime = 0
  gameState.frameCount = 0
  gameState.totalMoneyEarned = 0
  gameState.playerUnitsDestroyed = 0
  gameState.enemyUnitsDestroyed = 0
  gameState.playerBuildingsDestroyed = 0
  gameState.enemyBuildingsDestroyed = 0
  gameState.unitWrecks = []
  gameState.smokeParticles = []
  gameState.smokeParticlePool = []
  gameState.benchmarkActive = true
  gameState.availableUnitTypes = new Set(['tank_v1', 'tank-v2', 'tank-v3', 'rocketTank', 'harvester', 'ambulance', 'tankerTruck', 'recoveryTank', 'apache', 'howitzer'])
  gameState.availableBuildingTypes = new Set(BUILDING_TYPES)
  gameState.newUnitTypes = new Set()
  gameState.newBuildingTypes = new Set()
  gameState.defeatedPlayers = new Set()

  factories.forEach(factory => {
    factory.budget = 50000
    factory.rallyPoint = null
    factory.isBenchmarkStructure = true
  })

  const centerX = Math.floor(mapWidth / 2)
  const centerY = Math.floor(mapHeight / 2)

  const battleAnchors = {
    player1: { x: centerX - 10, y: centerY + 6, units: [] },
    player2: { x: centerX + 6, y: centerY - 10, units: [] },
    player3: { x: centerX - 10, y: centerY - 10, units: [] },
    player4: { x: centerX + 6, y: centerY + 6, units: [] }
  }

  const supportAnchors = {
    player1: { x: factories[0]?.x + (factories[0]?.width || 0) + 2, y: factories[0]?.y + (factories[0]?.height || 0) + 1 },
    player2: { x: factories[1]?.x - 6, y: factories[1]?.y - 2 },
    player3: { x: factories[2]?.x + (factories[2]?.width || 0) + 2, y: factories[2]?.y - 2 },
    player4: { x: factories[3]?.x - 6, y: factories[3]?.y + (factories[3]?.height || 0) + 1 }
  }

  const anchorEntries = Object.entries(battleAnchors)

  anchorEntries.forEach(([playerId, anchor]) => {
    const factory = factories.find(f => f.owner === playerId)
    if (!factory) return

    placePlayerBuildings(playerId, factory, mapWidth, mapHeight)
    spawnSupportUnits(factory, supportAnchors[playerId])

    const battleUnits = spawnBattleUnits(factory, anchor)
    anchor.units.push(...battleUnits)
  })

  assignBattleTargets(anchorEntries)

  cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
  updatePowerSupply(gameState.buildings, gameState)

  gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
  updateDangerZoneMaps(gameState)

  gameState.gamePaused = false
  gameState.gameStarted = true

  if (typeof game.centerOnPlayerFactory === 'function') {
    game.centerOnPlayerFactory()
  }
}

export function teardownBenchmarkScenario() {
  gameState.benchmarkActive = false
  resetBenchmarkCameraFocus()
}
