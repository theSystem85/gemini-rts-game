// mineInputHandler.js - Input handling for Mine Layer deployment
import { TILE_SIZE } from '../config.js'
import { calculateZigZagSweepPath } from '../game/mineSweeperBehavior.js'
import { getUniqueId } from '../utils.js'

function createEntryMoveCommand(tile) {
  if (!tile) return null
  return {
    type: 'move',
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2
  }
}

function registerFieldDeployment(unit, fieldId, tileCount) {
  if (!unit || !fieldId || typeof tileCount !== 'number' || tileCount <= 0) return
  if (!unit.pendingMineFieldDeployments) {
    unit.pendingMineFieldDeployments = {}
  }
  unit.pendingMineFieldDeployments[fieldId] = {
    remaining: (unit.pendingMineFieldDeployments[fieldId]?.remaining || 0) + tileCount,
    notified: false
  }
}

function getUnitTilePosition(unit) {
  if (!unit) return { x: 0, y: 0 }
  return {
    x: Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE),
    y: Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
  }
}

function determineSweepOrientation(area, referenceTile) {
  const minX = Math.min(area.startX, area.endX)
  const maxX = Math.max(area.startX, area.endX)
  const minY = Math.min(area.startY, area.endY)
  const maxY = Math.max(area.startY, area.endY)

  const tileX = referenceTile && Number.isFinite(referenceTile.x)
    ? referenceTile.x
    : Math.round((minX + maxX) / 2)
  const tileY = referenceTile && Number.isFinite(referenceTile.y)
    ? referenceTile.y
    : Math.round((minY + maxY) / 2)

  const horizontal = Math.abs(tileX - minX) <= Math.abs(tileX - maxX) ? 'left' : 'right'
  const vertical = Math.abs(tileY - minY) <= Math.abs(tileY - maxY) ? 'top' : 'bottom'

  return { horizontal, vertical }
}

/**
 * Check if any selected units are Mine Layers
 * @param {Array} selectedUnits - Currently selected units
 * @returns {boolean} True if at least one Mine Layer is selected
 */
export function hasMineLayerSelected(selectedUnits) {
  return selectedUnits && selectedUnits.some(unit => unit.type === 'mineLayer' && unit.health > 0)
}

/**
 * Check if any selected units are Mine Sweepers
 * @param {Array} selectedUnits - Currently selected units
 * @returns {boolean} True if at least one Mine Sweeper is selected
 */
export function hasMineSweeperSelected(selectedUnits) {
  return selectedUnits && selectedUnits.some(unit => unit.type === 'mineSweeper' && unit.health > 0)
}

/**
 * Handle Mine Layer Ctrl+Click for single mine deployment
 * @param {Array} selectedUnits - Selected Mine Layer units
 * @param {number} tileX - Target tile X
 * @param {number} tileY - Target tile Y
 * @param {boolean} shiftKey - Whether Shift is held (queue command)
 */
export function handleMineLayerClick(selectedUnits, tileX, tileY, shiftKey) {
  const mineLayers = selectedUnits.filter(unit => unit.type === 'mineLayer' && unit.health > 0)
  console.log('handleMineLayerClick called with', mineLayers.length, 'mine layers')
  if (mineLayers.length === 0) return false

  mineLayers.forEach(unit => {
    const command = {
      type: 'deployMine',
      x: tileX,
      y: tileY
    }
    console.log('Adding deployMine command to unit:', unit.id, command)

    if (shiftKey) {
      // Queue command
      if (!unit.commandQueue) unit.commandQueue = []
      unit.commandQueue.push(command)
    } else {
      // Replace commands
      unit.commandQueue = [command]
      unit.currentCommand = null
    }
  })

  return true
}

/**
 * Handle Mine Layer drag rectangle for area minefield deployment (checkerboard pattern)
 * @param {Array} selectedUnits - Selected Mine Layer units
 * @param {object} area - Area bounds {startX, startY, endX, endY} in tile coordinates
 * @param {boolean} shiftKey - Whether Shift is held (queue commands)
 * @returns {Array} Array of deployment tile coordinates for preview
 */
export function handleMineLayerAreaDeploy(selectedUnits, area, shiftKey) {
  const mineLayers = selectedUnits.filter(unit => unit.type === 'mineLayer' && unit.health > 0)
  if (mineLayers.length === 0) return []

  // Calculate checkerboard pattern
  const deploymentTiles = calculateCheckerboardPattern(area)
  if (deploymentTiles.length === 0) return []
  const deploymentTileSet = new Set(deploymentTiles.map(tile => `${tile.x},${tile.y}`))
  const fieldId = getUniqueId()
  const referenceUnit = getClosestUnitToArea(mineLayers, area) || mineLayers[0]
  const orientation = determineSweepOrientation(area, getUnitTilePosition(referenceUnit))
  const serpentinePath = calculateZigZagSweepPath(area, orientation) || []
  const orderedTiles = serpentinePath.filter(tile => deploymentTileSet.has(`${tile.x},${tile.y}`))
  const segments = splitPathEvenly(orderedTiles, mineLayers.length)

  mineLayers.forEach((unit, index) => {
    const assignedTiles = segments[index] || []
    if (!assignedTiles.length) return

    registerFieldDeployment(unit, fieldId, assignedTiles.length)
    const commands = assignedTiles.map(tile => ({
      type: 'deployMine',
      x: tile.x,
      y: tile.y,
      areaFieldId: fieldId
    }))

    if (shiftKey) {
      if (!unit.commandQueue) unit.commandQueue = []
      unit.commandQueue.push(...commands)
    } else {
      unit.commandQueue = commands
      unit.currentCommand = null
    }
  })

  return orderedTiles
}

/**
 * Calculate checkerboard pattern for mine deployment
 * @param {object} area - Area bounds {startX, startY, endX, endY}
 * @returns {Array} Array of tile coordinates
 */
function calculateCheckerboardPattern(area) {
  const minX = Math.min(area.startX, area.endX)
  const maxX = Math.max(area.startX, area.endX)
  const minY = Math.min(area.startY, area.endY)
  const maxY = Math.max(area.startY, area.endY)

  const tiles = []

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Checkerboard: deploy on tiles where (x + y) is even
      if ((x + y) % 2 === 0) {
        tiles.push({ x, y })
      }
    }
  }

  return tiles
}

/**
 * Handle Mine Sweeper rectangle drag for zig-zag sweep
 * @param {Array} selectedUnits - Selected Mine Sweeper units
 * @param {object} area - Area bounds {startX, startY, endX, endY} in tile coordinates
 * @param {boolean} shiftKey - Whether Shift is held (queue command)
 * @returns {Array} Array of sweep path tiles for preview
 */
export function handleMineSweeperRectangleSweep(selectedUnits, area, shiftKey) {
  const mineSweepers = selectedUnits.filter(unit => unit.type === 'mineSweeper' && unit.health > 0)
  if (mineSweepers.length === 0) return []

  const referenceUnit = getClosestUnitToArea(mineSweepers, area) || mineSweepers[0]
  const orientation = determineSweepOrientation(area, getUnitTilePosition(referenceUnit))
  const path = calculateZigZagSweepPath(area, orientation)
  if (!path || path.length === 0) return []

  const segments = splitPathEvenly(path, mineSweepers.length)

  mineSweepers.forEach((unit, index) => {
    const segment = segments[index] || []
    if (!segment.length) return
    const moveCommand = createEntryMoveCommand(segment[0])
    const sweepCommand = {
      type: 'sweepArea',
      path: segment.map(tile => ({ ...tile }))
    }
    const commands = []
    if (moveCommand) commands.push(moveCommand)
    commands.push(sweepCommand)

    if (shiftKey) {
      if (!unit.commandQueue) unit.commandQueue = []
      unit.commandQueue.push(...commands)
    } else {
      unit.commandQueue = [...commands]
      unit.currentCommand = null
    }
  })

  return path
}

/**
 * Handle Mine Sweeper Ctrl+Drag for freeform sweep
 * @param {Array} selectedUnits - Selected Mine Sweeper units
 * @param {Set} paintedTiles - Set of painted tile coordinates as "x,y" strings
 * @param {boolean} shiftKey - Whether Shift is held (queue command)
 * @returns {Array} Array of sweep path tiles for preview
 */
export function handleMineSweeperFreeformSweep(selectedUnits, paintedTiles, shiftKey) {
  const mineSweepers = selectedUnits.filter(unit => unit.type === 'mineSweeper' && unit.health > 0)
  if (mineSweepers.length === 0) return []

  // Convert Set to sorted array
  const tiles = []
  paintedTiles.forEach(key => {
    const [x, y] = key.split(',').map(Number)
    tiles.push({ x, y })
  })

  // Sort for efficient path
  tiles.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  const segments = splitPathEvenly(tiles, mineSweepers.length)

  mineSweepers.forEach((unit, index) => {
    const segment = segments[index] || []
    if (!segment.length) return
    const path = segment.map(tile => ({ ...tile }))
    const moveCommand = createEntryMoveCommand(path[0])
    const sweepCommand = {
      type: 'sweepArea',
      path
    }

    const commands = []
    if (moveCommand) commands.push(moveCommand)
    commands.push(sweepCommand)

    if (shiftKey) {
      if (!unit.commandQueue) unit.commandQueue = []
      unit.commandQueue.push(...commands)
    } else {
      unit.commandQueue = [...commands]
      unit.currentCommand = null
    }
  })

  return tiles
}

/**
 * Get preview data for mine deployment area
 * @param {object} area - Area bounds {startX, startY, endX, endY}
 * @returns {object} Preview data {tiles: Array, type: 'checkerboard'}
 */
export function getMineDeploymentPreview(area) {
  return {
    tiles: calculateCheckerboardPattern(area),
    type: 'checkerboard'
  }
}

/**
 * Get preview data for sweep area (rectangle)
 * @param {object} area - Area bounds {startX, startY, endX, endY}
 * @returns {object} Preview data {tiles: Array, type: 'sweep'}
 */
export function getSweepAreaPreview(area) {
  return {
    tiles: calculateZigZagSweepPath(area),
    type: 'sweep'
  }
}

/**
 * Get preview data for freeform sweep
 * @param {Set} paintedTiles - Set of painted tile coordinates
 * @returns {object} Preview data {tiles: Array, type: 'freeform'}
 */
export function getFreeformSweepPreview(paintedTiles) {
  const tiles = []
  paintedTiles.forEach(key => {
    const [x, y] = key.split(',').map(Number)
    tiles.push({ x, y })
  })

  return {
    tiles,
    type: 'freeform'
  }
}

function splitPathEvenly(path, count) {
  const safeCount = Math.max(1, count)
  const result = Array.from({ length: safeCount }, () => [])
  if (!path || path.length === 0) {
    return result
  }

  const segmentsToFill = Math.min(safeCount, path.length)
  let cursor = 0
  for (let i = 0; i < segmentsToFill; i++) {
    const remaining = path.length - cursor
    const slotsLeft = segmentsToFill - i
    const segmentSize = Math.ceil(remaining / slotsLeft)
    result[i] = path.slice(cursor, cursor + segmentSize)
    cursor += segmentSize
  }
  return result
}

function getClosestUnitToArea(units, area) {
  if (!units || units.length === 0 || !area) return null
  const center = getAreaCenterTile(area)
  let closest = null
  let bestDist = Infinity
  units.forEach(unit => {
    const pos = getUnitTilePosition(unit)
    const dist = Math.hypot(pos.x - center.x, pos.y - center.y)
    if (dist < bestDist) {
      bestDist = dist
      closest = unit
    }
  })
  return closest
}

function getAreaCenterTile(area) {
  if (!area) return { x: 0, y: 0 }
  const minX = Math.min(area.startX, area.endX)
  const maxX = Math.max(area.startX, area.endX)
  const minY = Math.min(area.startY, area.endY)
  const maxY = Math.max(area.startY, area.endY)
  return {
    x: Math.round((minX + maxX) / 2),
    y: Math.round((minY + maxY) / 2)
  }
}
