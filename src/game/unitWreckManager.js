import { TILE_SIZE } from '../config.js'
import { getUnitCost } from '../utils.js'

const DEFAULT_BUILD_DURATION_BASE = 3000
const MIN_BUILD_DURATION = 1000

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function estimateBuildDuration(unitType, existingDuration = null) {
  if (existingDuration && existingDuration > 0) {
    return existingDuration
  }
  const cost = getUnitCost(unitType) || 500
  const estimated = DEFAULT_BUILD_DURATION_BASE * (cost / 500)
  return Math.max(MIN_BUILD_DURATION, estimated)
}

export function registerUnitWreck(unit, gameState) {
  if (!unit) return null
  if (!gameState.unitWrecks) {
    gameState.unitWrecks = []
  }

  const existing = gameState.unitWrecks.find(w => w.sourceUnitId === unit.id)
  if (existing) {
    return existing
  }

  const wreck = {
    id: `${unit.id}-wreck`,
    sourceUnitId: unit.id,
    unitType: unit.type,
    owner: unit.owner,
    x: unit.x,
    y: unit.y,
    tileX: unit.tileX,
    tileY: unit.tileY,
    direction: unit.direction || 0,
    turretDirection: unit.turretDirection || unit.direction || 0,
    createdAt: performance.now(),
    cost: getUnitCost(unit.type) || 0,
    buildDuration: estimateBuildDuration(unit.type, unit.buildDuration),
    assignedTankId: null,
    towedBy: null,
    isBeingRecycled: false,
    recycleStartedAt: null,
    recycleDuration: null,
    noiseSeed: Math.random(),
    spriteCacheKey: unit.type
  }

  gameState.unitWrecks.push(wreck)
  return wreck
}

export function getWreckById(gameState, wreckId) {
  if (!gameState || !gameState.unitWrecks) return null
  return gameState.unitWrecks.find(wreck => wreck.id === wreckId)
}

export function removeWreckById(gameState, wreckId) {
  if (!gameState || !gameState.unitWrecks) return null
  const index = gameState.unitWrecks.findIndex(wreck => wreck.id === wreckId)
  if (index !== -1) {
    const [removed] = gameState.unitWrecks.splice(index, 1)
    return removed
  }
  return null
}

export function findWreckAtTile(gameState, tileX, tileY) {
  if (!gameState || !gameState.unitWrecks) return null
  return gameState.unitWrecks.find(wreck => {
    const wTileX = Math.floor((wreck.x + TILE_SIZE / 2) / TILE_SIZE)
    const wTileY = Math.floor((wreck.y + TILE_SIZE / 2) / TILE_SIZE)
    return wTileX === tileX && wTileY === tileY
  })
}

export function releaseWreckAssignment(wreck) {
  if (!wreck) return
  wreck.assignedTankId = null
  wreck.towedBy = null
  wreck.isBeingRecycled = false
  wreck.recycleStartedAt = null
  wreck.recycleDuration = null
}

export function updateWreckPositionFromTank(wreck, tank) {
  if (!wreck || !tank) return
  const offsetDistance = TILE_SIZE * 0.8
  const angle = tank.direction || 0
  const offsetX = -Math.cos(angle) * offsetDistance
  const offsetY = -Math.sin(angle) * offsetDistance
  wreck.x = tank.x + offsetX
  wreck.y = tank.y + offsetY
  wreck.tileX = Math.floor((wreck.x + TILE_SIZE / 2) / TILE_SIZE)
  wreck.tileY = Math.floor((wreck.y + TILE_SIZE / 2) / TILE_SIZE)
}

export function findNearestWorkshop(gameState, owner, fromTile) {
  if (!gameState || !gameState.buildings) return null
  const workshops = gameState.buildings.filter(building =>
    building.type === 'vehicleWorkshop' &&
    building.owner === owner &&
    building.health > 0
  )

  if (workshops.length === 0) {
    return null
  }

  let best = null
  let bestDistance = Infinity

  workshops.forEach(workshop => {
    const entryTiles = getWorkshopEntryTiles(workshop)
    entryTiles.forEach(tile => {
      const dx = tile.x - fromTile.x
      const dy = tile.y - fromTile.y
      const dist = Math.hypot(dx, dy)
      if (dist < bestDistance) {
        bestDistance = dist
        best = { workshop, entryTile: tile }
      }
    })
  })

  return best
}

function getWorkshopEntryTiles(workshop) {
  const tiles = []
  const startX = workshop.x - 1
  const endX = workshop.x + workshop.width
  const startY = workshop.y - 1
  const endY = workshop.y + workshop.height

  for (let x = startX; x <= endX; x++) {
    tiles.push({ x, y: startY })
    tiles.push({ x, y: endY })
  }

  for (let y = startY + 1; y < endY; y++) {
    tiles.push({ x: startX, y })
    tiles.push({ x: endX, y })
  }

  return tiles
}

export function getRecycleDurationForWreck(wreck) {
  if (!wreck) return MIN_BUILD_DURATION
  return clamp(estimateBuildDuration(wreck.unitType, wreck.buildDuration), MIN_BUILD_DURATION, 600000)
}

