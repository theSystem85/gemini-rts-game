import { TILE_SIZE, TANK_FIRE_RANGE, BUILDING_PROXIMITY_RANGE } from '../config.js'

const DEFAULT_NON_COMBAT_RANGE = 2
const ROCKET_RANGE_MULTIPLIER = 1.5
const TILE_PADDING = 0.5

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
    const centerX = structure.x + structure.width / 2
    const centerY = structure.y + structure.height / 2
    applyVisibility(visibilityMap, centerX, centerY, BUILDING_PROXIMITY_RANGE)
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
