import { startMineDeployment } from './mineLayerBehavior.js'
import { safeSweeperDetonation, getMineAtTile } from './mineSystem.js'
import { activateSweepingMode } from './mineSweeperBehavior.js'
import { TILE_SIZE } from '../config.js'
import { playSound } from '../sound.js'

export function processCommandQueues(units, mapGrid, unitCommands, buildings = []) {
  units.forEach(unit => {
    if ((!unit.commandQueue || unit.commandQueue.length === 0) && !unit.currentCommand) return

    if (!unit.currentCommand) {
      const action = unit.commandQueue.shift()
      unit.currentCommand = action
      executeAction(unit, action, mapGrid, unitCommands)
    } else {
      const complete = isActionComplete(unit, unit.currentCommand, units, buildings)
      if (complete) {
        handleCommandCompletion(unit, unit.currentCommand)
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
        if (!unit.sweeping) {
          activateSweepingMode(unit)
        }
        const nextTile = action.path[0]
        const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
        const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
        if (unitTileX === nextTile.x && unitTileY === nextTile.y) {
          // Already at the tile, detonate mine if any, shift path
          const mine = getMineAtTile(nextTile.x, nextTile.y)
          if (mine) {
            safeSweeperDetonation(mine, units, buildings)
          }
          action.path.shift()
          if (action.path.length === 0) {
            // Completed
            return
          }
          // Continue to next tile
          const newNextTile = action.path[0]
          const worldX = newNextTile.x * TILE_SIZE + TILE_SIZE / 2
          const worldY = newNextTile.y * TILE_SIZE + TILE_SIZE / 2
          unitCommands.handleMovementCommand([unit], worldX, worldY, mapGrid, true)
        } else {
          // Move to next tile
          const worldX = nextTile.x * TILE_SIZE + TILE_SIZE / 2
          const worldY = nextTile.y * TILE_SIZE + TILE_SIZE / 2
          unitCommands.handleMovementCommand([unit], worldX, worldY, mapGrid, true)
        }
      }
      break
  }
}

function isActionComplete(unit, action, units = [], buildings = []) {
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
          // Safely detonate any mines on this tile with sweeper immunity
          const mine = getMineAtTile(currentTile.x, currentTile.y)
          if (mine) {
            safeSweeperDetonation(mine, units, buildings)
          }
          action.path.shift() // Remove completed tile
          return action.path.length === 0
        }
      }
      return (!unit.path || unit.path.length === 0) && !unit.moveTarget
  }
  return true
}

function handleCommandCompletion(unit, action) {
  if (!action) return

  if (action.type === 'sweepArea' && (!action.path || action.path.length === 0) && !action._sweepSoundPlayed) {
    playSound('AllMinesOnTheFieldAreDisarmed', 1.0, 0, true)
    action._sweepSoundPlayed = true
  }

  if (action.type === 'deployMine' && action.areaFieldId) {
    notifyMineFieldDeployed(unit, action.areaFieldId)
  }
}

function notifyMineFieldDeployed(unit, fieldId) {
  if (!unit || !fieldId || !unit.pendingMineFieldDeployments) return
  const entry = unit.pendingMineFieldDeployments[fieldId]
  if (!entry) return

  entry.remaining = Math.max(0, (entry.remaining || 1) - 1)
  if (entry.remaining === 0 && !entry.notified) {
    playSound('The_mine_field_has_been_deployed_and_armed', 1.0, 0, true)
    entry.notified = true
  }
  if (entry.remaining === 0) {
    delete unit.pendingMineFieldDeployments[fieldId]
  }
}
