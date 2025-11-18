import { startMineDeployment } from './mineLayerBehavior.js'
import { TILE_SIZE } from '../config.js'

export function processCommandQueues(units, mapGrid, unitCommands) {
  units.forEach(unit => {
    if (!unit.commandQueue || unit.commandQueue.length === 0) return

    if (!unit.currentCommand) {
      const action = unit.commandQueue.shift()
      unit.currentCommand = action
      executeAction(unit, action, mapGrid, unitCommands)
    } else {
      if (isActionComplete(unit, unit.currentCommand)) {
        unit.currentCommand = null
      }
    }
  })
}

function executeAction(unit, action, mapGrid, unitCommands) {
  switch (action.type) {
    case 'move':
      unitCommands.handleMovementCommand([unit], action.x, action.y, mapGrid, true)
      break
    case 'attack':
      unitCommands.handleAttackCommand([unit], action.target, mapGrid, false, true)
      break
    case 'agf':
      unit.attackQueue = []
      action.targets.forEach(t => unit.attackQueue.push(t))
      if (unit.attackQueue.length > 0) {
        unitCommands.handleAttackCommand([unit], unit.attackQueue[0], mapGrid, false, true)
      }
      break
    case 'workshopRepair':
      unitCommands.handleWorkshopRepairHotkey([unit], mapGrid, false, true)
      break
    case 'deployMine':
      // Move to deployment location, then deploy
      if (!unit.deployingMine) {
        // Convert tile coordinates to world coordinates
        const worldX = action.x * TILE_SIZE
        const worldY = action.y * TILE_SIZE
        unitCommands.handleMovementCommand([unit], worldX, worldY, mapGrid, true)
      }
      break
    case 'sweepArea':
      // Move along sweep path
      if (action.path && action.path.length > 0) {
        const nextTile = action.path[0]
        // Convert tile coordinates to world coordinates
        const worldX = nextTile.x * TILE_SIZE
        const worldY = nextTile.y * TILE_SIZE
        unitCommands.handleMovementCommand([unit], worldX, worldY, mapGrid, true)
      }
      break
  }
}

function isActionComplete(unit, action) {
  switch (action.type) {
    case 'move':
      return (!unit.path || unit.path.length === 0) && !unit.moveTarget
    case 'attack':
    case 'agf':
      return (!unit.target || unit.target.health <= 0) && (!unit.attackQueue || unit.attackQueue.length === 0)
    case 'workshopRepair':
      return !unit.targetWorkshop && !unit.repairingAtWorkshop && !unit.returningFromWorkshop && (!unit.moveTarget && (!unit.path || unit.path.length === 0))
    case 'deployMine':
      // Check if at deployment location and deployment is not in progress
      if (unit.deployingMine) return false
      const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
      const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
      const atLocation = unitTileX === action.x && unitTileY === action.y
      if (atLocation && !unit.deployingMine) {
        // Start deployment
        startMineDeployment(unit, action.x, action.y, performance.now())
        return false
      }
      return atLocation && !unit.deployingMine
    case 'sweepArea':
      // Check if all tiles in path have been swept
      if (action.path && action.path.length > 0) {
        const currentTile = action.path[0]
        const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
        const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
        if (unitTileX === currentTile.x && unitTileY === currentTile.y) {
          action.path.shift() // Remove completed tile
          return action.path.length === 0
        }
      }
      return (!unit.path || unit.path.length === 0) && !unit.moveTarget
  }
  return true
}
