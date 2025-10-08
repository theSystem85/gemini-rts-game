import { TILE_SIZE, TANK_FIRE_RANGE, BUILDING_PROXIMITY_RANGE } from '../config.js'
import { buildingData } from '../buildings.js'

const DEFAULT_NON_COMBAT_RANGE = 2
const ROCKET_RANGE_MULTIPLIER = 1.5
const TILE_PADDING = 0.5
const INITIAL_BASE_DISCOVERY_RADIUS = 10
const BASE_VISIBILITY_BORDER = 4

const DEFENSIVE_BUILDING_TYPES = new Set([
  'turretGunV1',
  'turretGunV2',
  'turretGunV3',
  'rocketTurret',
  'teslaCoil',
  'artilleryTurret'
])

const BASE_BUILDING_TYPES = new Set(
  Object.keys(buildingData).filter(type => type !== 'concreteWall' && !DEFENSIVE_BUILDING_TYPES.has(type))
)

function createVisibilityRow(width) {
  const row = new Array(width)
  for (let x = 0; x < width; x++) {
    row[x] = { discovered: false, visible: false }
  }
  return row
}

export function initializeShadowOfWar(gameState, mapGrid) {
  if (!gameState) return
  const grid = mapGrid || gameState.mapGrid
  if (!grid || !grid.length || !grid[0]) {
    gameState.visibilityMap = []
    return
  }

  const height = grid.length
  const width = grid[0].length
  gameState.visibilityMap = new Array(height)
  for (let y = 0; y < height; y++) {
    gameState.visibilityMap[y] = createVisibilityRow(width)
  }

  markInitialBaseDiscovery(gameState)
}

function ensureVisibilityMap(gameState, mapGrid) {
  const grid = mapGrid || gameState.mapGrid
  if (!grid || !grid.length || !grid[0]) return null

  const height = grid.length
  const width = grid[0].length

  if (!gameState.visibilityMap || gameState.visibilityMap.length !== height || gameState.visibilityMap[0]?.length !== width) {
    initializeShadowOfWar(gameState, grid)
  }

  return gameState.visibilityMap
}

function resetVisibility(visibilityMap) {
  for (let y = 0; y < visibilityMap.length; y++) {
    const row = visibilityMap[y]
    if (!row) continue
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]
      if (!cell) continue
      cell.visible = false
    }
  }
}

function isFriendlyOwner(owner, gameState) {
  if (!owner || !gameState) return false
  const friendlyOwners = new Set([gameState.humanPlayer, 'player'])
  if (gameState.humanPlayer === 'player1') {
    friendlyOwners.add('player1')
  }
  return friendlyOwners.has(owner)
}

function isDefensiveStructure(structure) {
  const type = structure?.type
  if (!type) return false
  if (DEFENSIVE_BUILDING_TYPES.has(type)) return true
  return Boolean(structure.fireRange && structure.fireRange > 0)
}

function isBaseStructure(structure) {
  const type = structure?.type
  if (!type) return false
  if (DEFENSIVE_BUILDING_TYPES.has(type)) return false
  if (type === 'concreteWall') return false
  return BASE_BUILDING_TYPES.has(type)
}

function getStructureFireRange(structure) {
  if (!structure) return 0
  if (typeof structure.fireRange === 'number') {
    return structure.fireRange
  }
  const type = structure.type
  if (!type) {
    return 0
  }
  const data = buildingData[type]
  if (data && typeof data.fireRange === 'number') {
    return data.fireRange
  }
  return 0
}

function applyRectVisibility(visibilityMap, startX, startY, width, height, borderTiles = 0) {
  if (!visibilityMap || visibilityMap.length === 0) return

  const mapHeight = visibilityMap.length
  const mapWidth = visibilityMap[0]?.length || 0
  if (mapWidth === 0) return

  const padding = Math.max(0, Math.floor(borderTiles))
  const minX = Math.max(0, Math.floor(startX) - padding)
  const minY = Math.max(0, Math.floor(startY) - padding)
  const maxX = Math.min(mapWidth - 1, Math.ceil(startX + width) + padding - 1)
  const maxY = Math.min(mapHeight - 1, Math.ceil(startY + height) + padding - 1)

  for (let y = minY; y <= maxY; y++) {
    const row = visibilityMap[y]
    if (!row) continue
    for (let x = minX; x <= maxX; x++) {
      const cell = row[x]
      if (!cell) continue
      cell.visible = true
      cell.discovered = true
    }
  }
}

function getUnitVisionRange(unit) {
  if (!unit) return 0
  switch (unit.type) {
    case 'rocketTank':
      return Math.ceil(TANK_FIRE_RANGE * ROCKET_RANGE_MULTIPLIER)
    case 'tank':
    case 'tank_v1':
    case 'tank-v2':
    case 'tank_v2':
    case 'tank-v3':
    case 'tank_v3':
    case 'recoveryTank':
      return TANK_FIRE_RANGE
    case 'harvester':
    case 'ambulance':
    case 'tankerTruck':
      return DEFAULT_NON_COMBAT_RANGE
    default:
      return TANK_FIRE_RANGE
  }
}

function applyVisibility(visibilityMap, centerX, centerY, rangeTiles) {
  if (!visibilityMap || visibilityMap.length === 0) return
  const height = visibilityMap.length
  const width = visibilityMap[0]?.length || 0
  if (width === 0) return

  const radius = Math.max(0, rangeTiles)
  const radiusCeil = Math.ceil(radius)
  const limitSq = (radius + TILE_PADDING) * (radius + TILE_PADDING)

  const minY = Math.max(0, Math.floor(centerY - radiusCeil))
  const maxY = Math.min(height - 1, Math.ceil(centerY + radiusCeil))
  const minX = Math.max(0, Math.floor(centerX - radiusCeil))
  const maxX = Math.min(width - 1, Math.ceil(centerX + radiusCeil))

  for (let y = minY; y <= maxY; y++) {
    const row = visibilityMap[y]
    if (!row) continue
    for (let x = minX; x <= maxX; x++) {
      const cell = row[x]
      if (!cell) continue
      const dx = (x + 0.5) - centerX
      const dy = (y + 0.5) - centerY
      const distSq = dx * dx + dy * dy
      if (distSq <= limitSq) {
        cell.visible = true
        cell.discovered = true
      }
    }
  }
}

function markDiscoveredArea(visibilityMap, centerX, centerY, rangeTiles) {
  if (!visibilityMap || visibilityMap.length === 0) return

  const height = visibilityMap.length
  const width = visibilityMap[0]?.length || 0
  if (width === 0) return

  const radius = Math.max(0, rangeTiles)
  const radiusCeil = Math.ceil(radius)
  const limitSq = (radius + TILE_PADDING) * (radius + TILE_PADDING)

  const minY = Math.max(0, Math.floor(centerY - radiusCeil))
  const maxY = Math.min(height - 1, Math.ceil(centerY + radiusCeil))
  const minX = Math.max(0, Math.floor(centerX - radiusCeil))
  const maxX = Math.min(width - 1, Math.ceil(centerX + radiusCeil))

  for (let y = minY; y <= maxY; y++) {
    const row = visibilityMap[y]
    if (!row) continue
    for (let x = minX; x <= maxX; x++) {
      const cell = row[x]
      if (!cell) continue
      const dx = (x + 0.5) - centerX
      const dy = (y + 0.5) - centerY
      const distSq = dx * dx + dy * dy
      if (distSq <= limitSq) {
        cell.discovered = true
      }
    }
  }
}

function markInitialBaseDiscovery(gameState) {
  if (!gameState || !Array.isArray(gameState.visibilityMap) || !gameState.visibilityMap.length) return

  const buildings = Array.isArray(gameState.buildings) ? gameState.buildings : []
  if (!buildings.length) return

  buildings.forEach(building => {
    if (!building) return
    if (building.type !== 'constructionYard') return

    const owner = building.owner || building.id
    if (!isFriendlyOwner(owner, gameState)) return

    const centerX = building.x + building.width / 2
    const centerY = building.y + building.height / 2
    markDiscoveredArea(gameState.visibilityMap, centerX, centerY, INITIAL_BASE_DISCOVERY_RADIUS)
  })
}

export function updateShadowOfWar(gameState, units = [], mapGrid = gameState?.mapGrid, additionalStructures = []) {
  if (!gameState) return
  const visibilityMap = ensureVisibilityMap(gameState, mapGrid)
  if (!visibilityMap) return

  resetVisibility(visibilityMap)

  const structures = new Set()
  if (Array.isArray(gameState.buildings)) {
    gameState.buildings.forEach(building => structures.add(building))
  }
  if (Array.isArray(additionalStructures)) {
    additionalStructures.forEach(structure => structures.add(structure))
  }

  structures.forEach(structure => {
    if (!structure) return
    const owner = structure.owner || structure.id
    if (!isFriendlyOwner(owner, gameState)) return
    const rawX = typeof structure.x === 'number' ? structure.x : 0
    const rawY = typeof structure.y === 'number' ? structure.y : 0
    const width = Math.max(1, Math.round(structure.width || 1))
    const height = Math.max(1, Math.round(structure.height || 1))
    const startX = Math.floor(rawX)
    const startY = Math.floor(rawY)
    const centerX = rawX + width / 2
    const centerY = rawY + height / 2

    if (isDefensiveStructure(structure)) {
      const range = Math.max(BUILDING_PROXIMITY_RANGE, getStructureFireRange(structure))
      applyVisibility(visibilityMap, centerX, centerY, range)
      applyRectVisibility(visibilityMap, startX, startY, width, height)
    } else if (isBaseStructure(structure)) {
      applyRectVisibility(visibilityMap, startX, startY, width, height, BASE_VISIBILITY_BORDER)
    } else {
      applyVisibility(visibilityMap, centerX, centerY, BUILDING_PROXIMITY_RANGE)
      applyRectVisibility(visibilityMap, startX, startY, width, height)
    }
  })

  if (Array.isArray(units)) {
    units.forEach(unit => {
      if (!unit || !isFriendlyOwner(unit.owner, gameState)) return
      const centerX = (unit.x + TILE_SIZE / 2) / TILE_SIZE
      const centerY = (unit.y + TILE_SIZE / 2) / TILE_SIZE
      const range = getUnitVisionRange(unit)
      applyVisibility(visibilityMap, centerX, centerY, range)
    })
  }
}

export function markAllVisible(gameState) {
  if (!gameState || !Array.isArray(gameState.visibilityMap)) return
  gameState.visibilityMap.forEach(row => {
    if (!row) return
    row.forEach(cell => {
      if (!cell) return
      cell.visible = true
      cell.discovered = true
    })
  })
}
