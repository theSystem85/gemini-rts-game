import { startMineDeployment } from './mineLayerBehavior.js'
import { getMineAtTile, detonateMine } from './mineSystem.js'
import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'

export function processCommandQueues(units, mapGrid, unitCommands) {
  units.forEach(unit => {
    if ((!unit.commandQueue || unit.commandQueue.length === 0) && !unit.currentCommand) return

    if (!unit.currentCommand) {
      const action = unit.commandQueue.shift()
      unit.currentCommand = action
      executeAction(unit, action, mapGrid, unitCommands)
    } else {
      const complete = isActionComplete(unit, unit.currentCommand)
      if (complete) {
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
        // Convert tile coordinates to world coordinates (center of tile)
        const worldX = action.x * TILE_SIZE + TILE_SIZE / 2
        const worldY = action.y * TILE_SIZE + TILE_SIZE / 2
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
      // Check if deployment has completed
      if (unit.deploymentCompleted) {
        unit.deploymentCompleted = false // Reset for next command
        return true
      }

      // Check if at deployment location and deployment is not in progress
      if (unit.deployingMine) {
        return false
      }

      // Check if unit is close to the target tile (within 0.5 tiles)
      const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
      const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
      const distanceToTarget = Math.hypot(unitTileX - action.x, unitTileY - action.y)
      const atLocation = distanceToTarget < 0.6 // Within ~0.6 tiles (accounting for formation spread)

      // Also check if unit has no path and no move target (movement complete)
      const movementComplete = (!unit.path || unit.path.length === 0) && !unit.moveTarget

      if ((atLocation || movementComplete) && !unit.deployingMine) {
        // Start deployment
        startMineDeployment(unit, action.x, action.y, performance.now())
        return false
      }
      return false // Keep command active until deployment completes
    case 'sweepArea':
      // Check if all tiles in path have been swept
      if (action.path && action.path.length > 0) {
        const currentTile = action.path[0]
        const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
        const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
        const distanceToTarget = Math.hypot(unitTileX - currentTile.x, unitTileY - currentTile.y)
        const atTile = distanceToTarget < 0.6 // Within ~0.6 tiles
        const movementComplete = (!unit.path || unit.path.length === 0) && !unit.moveTarget

        if (atTile || movementComplete) {
          // Detonate any mines on this tile safely (sweeper takes no damage)
          const mine = getMineAtTile(currentTile.x, currentTile.y)
          if (mine) {
            // Detonate the mine - sweeper immunity handled in applyMineDamageToTile
            detonateMine(mine, gameState.units, gameState.buildings)
          }
          action.path.shift() // Remove completed tile
          return action.path.length === 0
        }
      }
      return (!unit.path || unit.path.length === 0) && !unit.moveTarget
  }
  return true
}
