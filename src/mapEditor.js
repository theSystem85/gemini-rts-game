import { TILE_SIZE } from './config.js'
import { gameState } from './gameState.js'
import { initializeOccupancyMap, createUnit } from './units.js'
import { buildingData, canPlaceBuilding, createBuilding, placeBuilding, updatePowerSupply } from './buildings.js'
import { updateDangerZoneMaps } from './game/dangerZoneMap.js'
import { gameRandom } from './utils/gameRandom.js'
const baseTilePalette = [
  { id: 'grass', type: 'land', label: 'Grass', variantGroup: 'passable' },
  { id: 'decor', type: 'land', label: 'Decoration', variantGroup: 'decorative' },
  { id: 'rugged', type: 'land', label: 'Rugged Grass', variantGroup: 'impassable' },
  { id: 'street', type: 'street', label: 'Street' },
  { id: 'rock', type: 'rock', label: 'Rock' },
  { id: 'water', type: 'water', label: 'Water' }
]

const mapEditorState = {
  active: false,
  randomMode: true,
  tilePalette: [...baseTilePalette],
  currentTileIndex: 0,
  hoverTile: { x: 0, y: 0 },
  dragging: false,
  boxStart: null,
  lastPaintKey: null,
  brushKind: 'tile', // tile | building | unit
  brushPayload: null,
  pendingOccupancyFrame: null,
  lockReason: null,
  previewKey: null,
  previewVariant: 0
}

let textureManagerGetter = null
let tileMutationNotifier = null

function currentMapGrid() {
  return gameState.mapGrid || []
}

function currentUnits() {
  return gameState.units || []
}

export function registerMapEditorRendering(getter, notifier) {
  textureManagerGetter = getter
  tileMutationNotifier = notifier
}

function getTextureInfo() {
  const textureManager = textureManagerGetter ? textureManagerGetter() : null
  const grassInfo = textureManager?.grassTileMetadata
  return { textureManager, grassInfo }
}

function getPaletteEntry() {
  return mapEditorState.tilePalette[mapEditorState.currentTileIndex] || mapEditorState.tilePalette[0]
}

function cycleTile(delta = 1) {
  const total = mapEditorState.tilePalette.length
  if (!total) return
  mapEditorState.currentTileIndex = (mapEditorState.currentTileIndex + delta + total) % total
}

function pickLandVariant(variantGroup, x, y, randomize) {
  const { textureManager, grassInfo } = getTextureInfo()
  if (!textureManager || !grassInfo) return textureManager?.getTileVariation('land', x, y) ?? 0

  const { passableCount, decorativeCount, impassableCount } = grassInfo
  const ranges = {
    passable: { start: 0, count: passableCount },
    decorative: { start: passableCount, count: decorativeCount },
    impassable: { start: passableCount + decorativeCount, count: impassableCount }
  }
  const target = ranges[variantGroup] || ranges.passable
  if (!target.count) return textureManager.getTileVariation('land', x, y)
  if (!randomize) return target.start

  const idx = target.start + Math.floor(gameRandom() * target.count)
  return idx
}

function pickVariant(entry, x, y, randomize) {
  const { textureManager } = getTextureInfo()
  if (!textureManager) return 0
  if (entry.type === 'land') {
    return pickLandVariant(entry.variantGroup || 'passable', x, y, randomize)
  }
  const cache = textureManager.tileTextureCache?.[entry.type]
  if (!cache?.length) return 0
  if (!randomize) {
    return textureManager.getTileVariation(entry.type, x, y)
  }
  return Math.floor(gameRandom() * cache.length)
}

function applyTile(tileX, tileY, entry, { randomize = false } = {}) {
  const grid = currentMapGrid()
  const row = grid[tileY]
  if (!row || !row[tileX]) return
  const tile = row[tileX]

  tile.type = entry.type
  tile.ore = entry.type === 'ore'
  tile.seedCrystal = entry.type === 'seedCrystal'
  tile.noBuild = 0

  const variant = pickVariant(entry, tileX, tileY, randomize)
  const textureManager = getTextureManager()
  if (textureManager) {
    textureManager.tileVariationMap[`${entry.type}_${tileX}_${tileY}`] = variant
  }

  if (tileMutationNotifier) {
    tileMutationNotifier(grid, tileX, tileY)
  }
  mapEditorState.lastPaintKey = `${tileX},${tileY},${entry.id}`
  scheduleOccupancyRefresh()
}

function scheduleOccupancyRefresh() {
  if (mapEditorState.pendingOccupancyFrame !== null) return
  mapEditorState.pendingOccupancyFrame = requestAnimationFrame(() => {
    mapEditorState.pendingOccupancyFrame = null
    const textureManager = textureManagerGetter ? textureManagerGetter() : null
    const grid = currentMapGrid()
    const unitList = currentUnits()
    gameState.occupancyMap = initializeOccupancyMap(unitList, grid, textureManager)
  })
}

function applyBuilding(tileX, tileY) {
  if (!mapEditorState.brushPayload) return
  const buildingType = mapEditorState.brushPayload
  const entry = buildingData[buildingType]
  if (!entry) return

  const grid = currentMapGrid()
  const unitList = currentUnits()

  if (!canPlaceBuilding(buildingType, tileX, tileY, grid, unitList, gameState.buildings, [], gameState.humanPlayer)) {
    return
  }

  const building = createBuilding(buildingType, tileX, tileY)
  if (!building) return

  building.owner = gameState.humanPlayer
  building.constructionFinished = true
  building.constructionStartTime = performance.now() - 1000
  building.health = building.maxHealth

  if (!Array.isArray(gameState.buildings)) {
    gameState.buildings = []
  }
  gameState.buildings.push(building)
  placeBuilding(building, grid, gameState.occupancyMap)
  updatePowerSupply(gameState.buildings, gameState)
  updateDangerZoneMaps(gameState)
  scheduleOccupancyRefresh()
}

function applyUnit(tileX, tileY) {
  if (!mapEditorState.brushPayload) return
  const unitType = mapEditorState.brushPayload
  const ownerFactory = { owner: gameState.humanPlayer, x: tileX, y: tileY, width: 1, height: 1, type: 'editor' }
  const unit = createUnit(ownerFactory, unitType, tileX, tileY, {
    worldPosition: { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }
  })
  if (!unit) return
  const unitList = currentUnits()
  if (Array.isArray(unitList)) {
    unitList.push(unit)
  } else {
    gameState.units = [unit]
  }
  scheduleOccupancyRefresh()
}

function applyBrush(tileX, tileY, { button = 0 } = {}) {
  if (button === 2) {
    applyTile(tileX, tileY, baseTilePalette[0], { randomize: true })
    return
  }

  if (mapEditorState.brushKind === 'building') {
    applyBuilding(tileX, tileY)
    return
  }

  if (mapEditorState.brushKind === 'unit') {
    applyUnit(tileX, tileY)
    return
  }

  const entry = getPaletteEntry()
  applyTile(tileX, tileY, entry, { randomize: mapEditorState.randomMode })
}

function fillBox(toX, toY, button = 0) {
  if (!mapEditorState.boxStart) return
  const startX = Math.min(mapEditorState.boxStart.x, toX)
  const startY = Math.min(mapEditorState.boxStart.y, toY)
  const endX = Math.max(mapEditorState.boxStart.x, toX)
  const endY = Math.max(mapEditorState.boxStart.y, toY)

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      applyBrush(x, y, { button })
    }
  }
}

export function setBrushFromProduction(kind, payload) {
  mapEditorState.brushKind = kind
  mapEditorState.brushPayload = payload
  mapEditorState.previewKey = null
}

export function setTileBrushById(id) {
  const idx = mapEditorState.tilePalette.findIndex(p => p.id === id)
  if (idx >= 0) {
    mapEditorState.currentTileIndex = idx
    mapEditorState.brushKind = 'tile'
    mapEditorState.brushPayload = null
    mapEditorState.previewKey = null
  }
}

export function toggleRandomMode(enabled) {
  mapEditorState.randomMode = enabled
  gameState.mapEditRandomMode = enabled
}

export function getMapEditorState() {
  return mapEditorState
}

export function activateMapEditMode() {
  mapEditorState.active = true
  gameState.mapEditMode = true
  gameState.gamePaused = true
  mapEditorState.randomMode = gameState.mapEditRandomMode !== false
  mapEditorState.brushKind = mapEditorState.brushKind || 'tile'
}

export function deactivateMapEditMode() {
  mapEditorState.active = false
  gameState.mapEditMode = false
  mapEditorState.boxStart = null
  mapEditorState.dragging = false
  mapEditorState.brushKind = 'tile'
  mapEditorState.brushPayload = null
  mapEditorState.previewKey = null
}

export function handlePointerDown(tileX, tileY, { button = 0, shiftKey = false } = {}) {
  if (!mapEditorState.active) return
  mapEditorState.dragging = true
  mapEditorState.lastPaintKey = null
  mapEditorState.hoverTile = { x: tileX, y: tileY }
  if (shiftKey && button === 0) {
    mapEditorState.boxStart = { x: tileX, y: tileY }
  } else {
    applyBrush(tileX, tileY, { button })
    mapEditorState.boxStart = null
  }
}

export function handlePointerMove(tileX, tileY, buttons = 0) {
  if (!mapEditorState.active) return
  mapEditorState.hoverTile = { x: tileX, y: tileY }
  if (!mapEditorState.dragging || mapEditorState.boxStart) return
  if (!buttons) return

  const paintKey = `${tileX},${tileY},${mapEditorState.brushKind}:${mapEditorState.brushPayload}`
  if (paintKey === mapEditorState.lastPaintKey) return
  const button = (buttons & 2) === 2 ? 2 : 0
  applyBrush(tileX, tileY, { button })
}

export function handlePointerUp(tileX, tileY, { button = 0 } = {}) {
  if (!mapEditorState.active) return
  mapEditorState.hoverTile = { x: tileX, y: tileY }
  if (mapEditorState.boxStart) {
    fillBox(tileX, tileY, button)
  }
  mapEditorState.dragging = false
  mapEditorState.boxStart = null
  mapEditorState.lastPaintKey = null
}

export function renderMapEditorOverlay(ctx, scrollOffset) {
  if (!mapEditorState.active) return
  if (mapEditorState.brushKind !== 'tile') {
    const { x, y } = mapEditorState.hoverTile
    const screenX = x * TILE_SIZE - scrollOffset.x
    const screenY = y * TILE_SIZE - scrollOffset.y
    ctx.save()
    ctx.fillStyle = 'rgba(0, 183, 255, 0.25)'
    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
    ctx.strokeStyle = '#00b7ff'
    ctx.lineWidth = 2
    ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
    ctx.fillStyle = '#fff'
    ctx.font = '12px Arial'
    ctx.fillText(describeBrush(), screenX + TILE_SIZE / 2, screenY - 4)
    ctx.restore()
    return
  }
  const entry = getPaletteEntry()
  const { textureManager } = getTextureInfo()
  const { x, y } = mapEditorState.hoverTile
  const screenX = x * TILE_SIZE - scrollOffset.x
  const screenY = y * TILE_SIZE - scrollOffset.y

  const key = `${entry.id}:${x},${y}:${mapEditorState.randomMode}`
  if (mapEditorState.previewKey !== key) {
    mapEditorState.previewVariant = pickVariant(entry, x, y, mapEditorState.randomMode)
    mapEditorState.previewKey = key
  }

  if (textureManager && textureManager.spriteImage) {
    const variant = mapEditorState.previewVariant
    const cache = textureManager.tileTextureCache?.[entry.type]
    if (cache && cache[variant]) {
      const info = cache[variant]
      ctx.save()
      ctx.globalAlpha = 0.7
      ctx.drawImage(
        textureManager.spriteImage,
        info.x,
        info.y,
        info.width,
        info.height,
        screenX,
        screenY,
        TILE_SIZE + 1,
        TILE_SIZE + 1
      )
      ctx.restore()
    }
  }

  if (mapEditorState.boxStart) {
    const startX = Math.min(mapEditorState.boxStart.x, x)
    const startY = Math.min(mapEditorState.boxStart.y, y)
    const endX = Math.max(mapEditorState.boxStart.x, x)
    const endY = Math.max(mapEditorState.boxStart.y, y)
    ctx.save()
    ctx.strokeStyle = '#00b7ff'
    ctx.lineWidth = 2
    ctx.strokeRect(
      startX * TILE_SIZE - scrollOffset.x,
      startY * TILE_SIZE - scrollOffset.y,
      (endX - startX + 1) * TILE_SIZE,
      (endY - startY + 1) * TILE_SIZE
    )
    ctx.restore()
  }
}

export function lockMapEditor(reason) {
  mapEditorState.lockReason = reason
}

export function unlockMapEditor() {
  mapEditorState.lockReason = null
}

export function isMapEditorLocked() {
  return Boolean(mapEditorState.lockReason)
}

export function resetBrush() {
  mapEditorState.brushKind = 'tile'
  mapEditorState.brushPayload = null
  mapEditorState.previewKey = null
}

export function handleWheel(deltaY) {
  if (!mapEditorState.active) return
  cycleTile(deltaY < 0 ? 1 : -1)
}

export function describeBrush() {
  if (mapEditorState.brushKind === 'building') {
    return `Building: ${mapEditorState.brushPayload || ''}`
  }
  if (mapEditorState.brushKind === 'unit') {
    return `Unit: ${mapEditorState.brushPayload || ''}`
  }
  const entry = getPaletteEntry()
  return `${entry.label}${mapEditorState.randomMode ? ' (Random)' : ''}`
}

export function ensureMapEditPaused() {
  if (mapEditorState.active) {
    gameState.gamePaused = true
  }
}
