import { TILE_SIZE } from './config.js'
import { gameState } from './gameState.js'
import { initializeOccupancyMap, createUnit, unitCosts } from './units.js'
import { buildingData, canPlaceBuilding, createBuilding, placeBuilding, updatePowerSupply } from './buildings.js'
import { updateDangerZoneMaps } from './game/dangerZoneMap.js'
import { gameRandom } from './utils/gameRandom.js'
const baseTilePalette = [
  { id: 'grass', type: 'land', label: 'Grass', variantGroup: 'passable' },
  { id: 'decor', type: 'land', label: 'Decoration', variantGroup: 'decorative' },
  { id: 'rugged', type: 'land', label: 'Rugged Grass', variantGroup: 'impassable' },
  { id: 'street', type: 'street', label: 'Street' },
  { id: 'rock', type: 'rock', label: 'Rock' },
  { id: 'water', type: 'water', label: 'Water' },
  { id: 'ore', type: 'ore', label: 'Ore' }
]

const mapEditorState = {
  active: false,
  randomMode: true,
  pipetteOverride: false, // When true, pipette picked a tile and random mode is disabled until user picks another tile
  tilePalette: [...baseTilePalette],
  currentTileIndex: 0,
  hoverTile: { x: 0, y: 0 },
  lastPaintedTile: null, // Track last painted tile to prevent redrawing same tile
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
let renderScheduler = null
let productionControllerRef = null

// Store original tech tree state to restore when leaving edit mode
let savedTechTreeState = null

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

export function setMapEditorRenderScheduler(scheduler) {
  renderScheduler = scheduler
}

export function setMapEditorProductionController(controller) {
  productionControllerRef = controller
}

function requestRenderFrame() {
  if (renderScheduler) {
    renderScheduler()
  }
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

  // Special handling for ore placement
  if (entry.type === 'ore') {
    // Check if ore can be placed on this tile (same rules as ore spreading)
    const tileType = tile.type
    if (tileType !== 'land' && tileType !== 'street') {
      return // Can only place ore on land or street tiles
    }
    
    // Check for buildings
    const buildings = gameState.buildings || []
    const hasBuilding = buildings.some(building => {
      const bx = building.x, by = building.y
      const bw = building.width || 1, bh = building.height || 1
      return tileX >= bx && tileX < bx + bw && tileY >= by && tileY < by + bh
    })
    if (hasBuilding) return
    
    // Check for factories
    const factories = gameState.factories || []
    const hasFactory = factories.some(factory => {
      return tileX >= factory.x && tileX < factory.x + factory.width &&
             tileY >= factory.y && tileY < factory.y + factory.height
    })
    if (hasFactory) return
    
    // Check occupancy
    const occupancyMap = gameState.occupancyMap || []
    if (occupancyMap[tileY]?.[tileX] > 0) return
    
    // Place ore without changing underlying tile type
    tile.ore = true
    tile.seedCrystal = false // Remove seed crystal if present
    tile.noBuild = 0
  } else {
    // Normal tile placement - change the tile type
    tile.type = entry.type
    tile.ore = entry.type === 'ore'
    tile.seedCrystal = entry.type === 'seedCrystal'
    tile.noBuild = 0
  }

  const variant = pickVariant(entry, tileX, tileY, randomize)
  const textureManager = textureManagerGetter ? textureManagerGetter() : null
  if (textureManager) {
    textureManager.tileVariationMap[`${entry.type}_${tileX}_${tileY}`] = variant
  }

  if (tileMutationNotifier) {
    tileMutationNotifier(grid, tileX, tileY)
  }
  mapEditorState.lastPaintKey = `${tileX},${tileY},${entry.id}`
  scheduleOccupancyRefresh()
  // Request render when game is paused so player sees their changes
  requestRenderFrame()
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
  // Request render when game is paused so player sees their changes
  requestRenderFrame()
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
  // Request render when game is paused so player sees their changes
  requestRenderFrame()
}

function applyBrush(tileX, tileY, { button = 0, shiftKey = false, metaKey = false } = {}) {
  // Check if this is the same tile we just painted (prevent redraw flickering)
  const tileKey = `${tileX},${tileY}`
  if (mapEditorState.lastPaintedTile === tileKey) {
    return
  }
  mapEditorState.lastPaintedTile = tileKey

  // Shift + right-click or Command/Ctrl + left-click = eraser (draw grass)
  if ((button === 2 && shiftKey) || (button === 0 && metaKey)) {
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
  // Use random mode unless pipette override is active
  const useRandom = mapEditorState.randomMode && !mapEditorState.pipetteOverride
  applyTile(tileX, tileY, entry, { randomize: useRandom })
}

function fillBox(toX, toY, button = 0, shiftKey = false, metaKey = false) {
  if (!mapEditorState.boxStart) return
  const startX = Math.min(mapEditorState.boxStart.x, toX)
  const startY = Math.min(mapEditorState.boxStart.y, toY)
  const endX = Math.max(mapEditorState.boxStart.x, toX)
  const endY = Math.max(mapEditorState.boxStart.y, toY)

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      // Clear lastPaintedTile for each tile in the box so all tiles get painted
      mapEditorState.lastPaintedTile = null
      applyBrush(x, y, { button, shiftKey, metaKey })
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
    mapEditorState.pipetteOverride = false // User selected a tile, disable pipette override
  }
}

/**
 * Pipette tool: sample a tile from the map and use it as the current brush
 * This enables pipette override mode which disables random variations until user picks another tile
 */
export function pipetteTile(tileX, tileY) {
  const grid = currentMapGrid()
  const row = grid[tileY]
  if (!row || !row[tileX]) return false
  const tile = row[tileX]

  // Find the matching palette entry based on tile properties
  let matchedId = 'grass' // default
  if (tile.ore) {
    matchedId = 'ore'
  } else if (tile.seedCrystal) {
    matchedId = 'seedCrystal'
  } else if (tile.type === 'land') {
    // Check variant to determine which land type
    const textureManager = textureManagerGetter ? textureManagerGetter() : null
    const grassInfo = textureManager?.grassTileMetadata
    if (grassInfo) {
      const variantKey = `land_${tileX}_${tileY}`
      const variant = textureManager?.tileVariationMap?.[variantKey] ?? 0
      const { passableCount, decorativeCount } = grassInfo
      if (variant < passableCount) {
        matchedId = 'grass'
      } else if (variant < passableCount + decorativeCount) {
        matchedId = 'decor'
      } else {
        matchedId = 'rugged'
      }
    }
  } else if (tile.type === 'street') {
    matchedId = 'street'
  } else if (tile.type === 'rock') {
    matchedId = 'rock'
  } else if (tile.type === 'water') {
    matchedId = 'water'
  }

  const idx = mapEditorState.tilePalette.findIndex(p => p.id === matchedId)
  if (idx >= 0) {
    mapEditorState.currentTileIndex = idx
    mapEditorState.brushKind = 'tile'
    mapEditorState.brushPayload = null
    mapEditorState.previewKey = null
    mapEditorState.pipetteOverride = true // Enable pipette mode to disable random variations
    return true
  }
  return false
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
  
  // Save current tech tree state and unlock everything
  if (productionControllerRef) {
    savedTechTreeState = {
      units: new Set(gameState.availableUnitTypes),
      buildings: new Set(gameState.availableBuildingTypes)
    }
    
    // Unlock all unit types
    const allUnitTypes = Object.keys(unitCosts)
    allUnitTypes.forEach(type => productionControllerRef.forceUnlockUnitType(type))
    
    // Unlock all building types
    const allBuildingTypes = Object.keys(buildingData)
    allBuildingTypes.forEach(type => productionControllerRef.forceUnlockBuildingType(type))
  }
}

export function deactivateMapEditMode() {
  mapEditorState.active = false
  gameState.mapEditMode = false
  mapEditorState.boxStart = null
  mapEditorState.dragging = false
  mapEditorState.brushKind = 'tile'
  mapEditorState.brushPayload = null
  mapEditorState.previewKey = null
  
  // Restore original tech tree state
  if (productionControllerRef && savedTechTreeState) {
    // Clear all unlocks first
    gameState.availableUnitTypes.clear()
    gameState.availableBuildingTypes.clear()
    
    // Restore saved units
    savedTechTreeState.units.forEach(type => {
      gameState.availableUnitTypes.add(type)
    })
    
    // Restore saved buildings
    savedTechTreeState.buildings.forEach(type => {
      gameState.availableBuildingTypes.add(type)
    })
    
    // Update UI to reflect restored state
    productionControllerRef.updateVehicleButtonStates()
    productionControllerRef.updateBuildingButtonStates()
    productionControllerRef.updateTabStates()
    
    savedTechTreeState = null
  }
}

export function handlePointerDown(tileX, tileY, { button = 0, shiftKey = false, metaKey = false } = {}) {
  if (!mapEditorState.active) return
  mapEditorState.dragging = true
  mapEditorState.lastPaintKey = null
  mapEditorState.lastPaintedTile = null // Reset on new stroke
  mapEditorState.hoverTile = { x: tileX, y: tileY }
  if (shiftKey && (button === 0 || button === 2)) {
    mapEditorState.boxStart = { x: tileX, y: tileY }
  } else {
    applyBrush(tileX, tileY, { button, shiftKey, metaKey })
    mapEditorState.boxStart = null
  }
}

export function handlePointerMove(tileX, tileY, buttons = 0, shiftKey = false, metaKey = false) {
  if (!mapEditorState.active) return
  mapEditorState.hoverTile = { x: tileX, y: tileY }
  if (!mapEditorState.dragging || mapEditorState.boxStart) return
  if (!buttons) return

  const paintKey = `${tileX},${tileY},${mapEditorState.brushKind}:${mapEditorState.brushPayload}`
  if (paintKey === mapEditorState.lastPaintKey) return
  const button = (buttons & 2) === 2 ? 2 : 0
  applyBrush(tileX, tileY, { button, shiftKey, metaKey })
}

export function handlePointerUp(tileX, tileY, { button = 0, shiftKey = false, metaKey = false } = {}) {
  if (!mapEditorState.active) return
  mapEditorState.hoverTile = { x: tileX, y: tileY }
  if (mapEditorState.boxStart) {
    fillBox(tileX, tileY, button, shiftKey, metaKey)
  }
  mapEditorState.dragging = false
  mapEditorState.boxStart = null
  mapEditorState.lastPaintKey = null
  mapEditorState.lastPaintedTile = null // Reset after stroke ends
}

export function renderMapEditorOverlay(ctx, scrollOffset) {
  if (!mapEditorState.active) return
  
  const { x, y } = mapEditorState.hoverTile
  const screenX = x * TILE_SIZE - scrollOffset.x
  const screenY = y * TILE_SIZE - scrollOffset.y
  
  // Handle building preview
  if (mapEditorState.brushKind === 'building' && mapEditorState.brushPayload) {
    const buildingType = mapEditorState.brushPayload
    const entry = buildingData[buildingType]
    if (entry) {
      const width = entry.width || 1
      const height = entry.height || 1
      ctx.save()
      ctx.fillStyle = 'rgba(0, 183, 255, 0.25)'
      ctx.fillRect(screenX, screenY, width * TILE_SIZE, height * TILE_SIZE)
      ctx.strokeStyle = '#00b7ff'
      ctx.lineWidth = 2
      ctx.strokeRect(screenX, screenY, width * TILE_SIZE, height * TILE_SIZE)
      ctx.fillStyle = '#fff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(buildingType, screenX + (width * TILE_SIZE) / 2, screenY - 4)
      ctx.restore()
    }
    return
  }
  
  // Handle unit preview
  if (mapEditorState.brushKind === 'unit' && mapEditorState.brushPayload) {
    ctx.save()
    ctx.fillStyle = 'rgba(0, 255, 183, 0.25)'
    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
    ctx.strokeStyle = '#00ffb7'
    ctx.lineWidth = 2
    ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
    ctx.fillStyle = '#fff'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(mapEditorState.brushPayload, screenX + TILE_SIZE / 2, screenY - 4)
    ctx.restore()
    return
  }
  
  // Handle tile preview
  if (mapEditorState.brushKind !== 'tile') return
  
  const entry = getPaletteEntry()
  const { textureManager } = getTextureInfo()

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
