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

  mineLayers.forEach(unit => {
    const orientation = determineSweepOrientation(area, getUnitTilePosition(unit))
    const serpentinePath = calculateZigZagSweepPath(area, orientation) || []
    const orderedTiles = serpentinePath.filter(tile => deploymentTileSet.has(`${tile.x},${tile.y}`))
    if (!orderedTiles.length) return

    registerFieldDeployment(unit, fieldId, orderedTiles.length)
    const commands = orderedTiles.map(tile => ({
      type: 'deployMine',
      x: tile.x,
      y: tile.y,
      areaFieldId: fieldId
    }))

    if (shiftKey) {
      // Queue commands
      if (!unit.commandQueue) unit.commandQueue = []
      unit.commandQueue.push(...commands)
    } else {
      // Replace commands
      unit.commandQueue = commands
      unit.currentCommand = null
    }
  })

  return deploymentTiles
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

  const unitSweepData = mineSweepers.map(unit => {
    const orientation = determineSweepOrientation(area, getUnitTilePosition(unit))
    const path = calculateZigZagSweepPath(area, orientation)
    if (!path || path.length === 0) {
      return { unit, commands: [] }
    }
    const moveCommand = createEntryMoveCommand(path[0])
    const sweepCommand = {
      type: 'sweepArea',
      path
    }
    const commands = []
    if (moveCommand) commands.push(moveCommand)
    commands.push(sweepCommand)
    return { unit, commands }
  })

  unitSweepData.forEach(({ unit, commands }) => {
    if (!commands || commands.length === 0) return
    if (shiftKey) {
      if (!unit.commandQueue) unit.commandQueue = []
      unit.commandQueue.push(...commands)
    } else {
      unit.commandQueue = [...commands]
      unit.currentCommand = null
    }
  })

  const firstSweep = unitSweepData.find(entry => entry.commands && entry.commands.some(cmd => cmd.type === 'sweepArea'))
  return firstSweep ? firstSweep.commands.find(cmd => cmd.type === 'sweepArea').path : []
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

  mineSweepers.forEach(unit => {
    if (!tiles.length) return
    const path = tiles.map(tile => ({ ...tile }))
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
