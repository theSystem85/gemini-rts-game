import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { markWaypointsAdded } from '../game/waypointSounds.js'
import { findWreckAtTile } from '../game/unitWreckManager.js'
import { playSound } from '../sound.js'
import { findEnemyTarget } from './mouseHelpers.js'
import { findActiveFriendlyBuildingAtTile } from './mouseHelpers.js'
import { isForceAttackModifierActive } from '../utils/inputUtils.js'
import { initiateRetreat } from '../behaviours/retreat.js'
import { getUnitSelectionCenter } from './selectionManager.js'

export function handleForceAttackCommand(handler, worldX, worldY, units, selectedUnits, unitCommands, mapGrid, selectionManager) {
  const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
  if (commandableUnits.length === 0) {
    return false
  }
  selectionManager.clearWreckSelection()
  if (commandableUnits[0].type !== 'factory') {
    let forceAttackTarget = null

    if (gameState.buildings && gameState.buildings.length > 0) {
      for (const building of gameState.buildings) {
        if (selectionManager.isHumanPlayerBuilding(building)) {
          const buildingX = building.x * TILE_SIZE
          const buildingY = building.y * TILE_SIZE
          const buildingWidth = building.width * TILE_SIZE
          const buildingHeight = building.height * TILE_SIZE

          if (worldX >= buildingX &&
              worldX < buildingX + buildingWidth &&
              worldY >= buildingY &&
              worldY < buildingY + buildingHeight) {
            forceAttackTarget = building
            break
          }
        }
      }
    }

    if (!forceAttackTarget) {
      for (const unit of units) {
        if (selectionManager.isHumanPlayerUnit(unit) && !unit.selected) {
          const { centerX, centerY } = getUnitSelectionCenter(unit)
          if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
            forceAttackTarget = unit
            break
          }
        }
      }
    }

    const targetTileX = Math.floor(worldX / TILE_SIZE)
    const targetTileY = Math.floor(worldY / TILE_SIZE)

    if (!forceAttackTarget) {
      const wreckTarget = findWreckAtTile(gameState, targetTileX, targetTileY)
      if (wreckTarget) {
        forceAttackTarget = wreckTarget
      }
    }

    if (!forceAttackTarget) {
      forceAttackTarget = {
        id: `ground_${targetTileX}_${targetTileY}_${Date.now()}`,
        type: 'groundTarget',
        x: worldX,
        y: worldY,
        tileX: targetTileX,
        tileY: targetTileY,
        health: 1,
        maxHealth: 1,
        isGroundTarget: true
      }
    }

    if (forceAttackTarget) {
      const first = commandableUnits[0]
      if (first.isBuilding) {
        commandableUnits.forEach(b => {
          b.forcedAttackTarget = forceAttackTarget
          b.forcedAttack = true
          b.holdFire = false
        })
        return true
      } else {
        commandableUnits.forEach(unit => {
          unit.forcedAttack = true
        })
        unitCommands.handleAttackCommand(commandableUnits, forceAttackTarget, mapGrid, true)
        return true
      }
    }
  }
  return false
}

export function handleGuardCommand(_handler, worldX, worldY, units, selectedUnits, unitCommands, selectionManager, _mapGrid) {
  const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
  if (commandableUnits.length === 0) {
    return false
  }
  let guardTarget = null
  for (const unit of units) {
    if (selectionManager.isHumanPlayerUnit(unit) && !unit.selected) {
      const { centerX, centerY } = getUnitSelectionCenter(unit)
      if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
        guardTarget = unit
        break
      }
    }
  }

  if (guardTarget) {
    commandableUnits.forEach(u => {
      u.guardTarget = guardTarget
      u.guardMode = true
      u.target = null
      u.moveTarget = null
    })
    playSound('confirmed', 0.5)
    return true
  }
  return false
}

export function handleStandardCommands(handler, worldX, worldY, selectedUnits, unitCommands, mapGrid, altPressed = false) {
  const selectionManager = handler.selectionManager
  const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
  if (commandableUnits.length === 0 || commandableUnits[0].type === 'factory') {
    return
  }

  let target = null
  let oreTarget = null
  let refineryTarget = null

  const tileX = Math.floor(worldX / TILE_SIZE)
  const tileY = Math.floor(worldY / TILE_SIZE)
  const hasSelectedHarvesters = commandableUnits.some(unit => unit.type === 'harvester')
  const hasSelectedApaches = commandableUnits.some(unit => unit.type === 'apache')

  if (
    hasSelectedApaches &&
    commandableUnits.every(unit => unit.type === 'apache') &&
    gameState.buildings &&
    Array.isArray(gameState.buildings)
  ) {
    const helipadTarget = findActiveFriendlyBuildingAtTile(
      gameState.buildings,
      tileX,
      tileY,
      gameState.humanPlayer,
      'helipad'
    )
    if (helipadTarget) {
      unitCommands.handleApacheHelipadCommand(commandableUnits, helipadTarget, mapGrid)
      return
    }
  }

  if (hasSelectedHarvesters && gameState.buildings && Array.isArray(gameState.buildings)) {
    refineryTarget = findActiveFriendlyBuildingAtTile(
      gameState.buildings,
      tileX,
      tileY,
      gameState.humanPlayer,
      'oreRefinery'
    )
  }

  if (hasSelectedHarvesters &&
      mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
      tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length &&
      mapGrid[tileY][tileX].ore) {
    oreTarget = { x: tileX, y: tileY }
  }

  let workshopTarget = null
  let hospitalTarget = null
  let gasStationTarget = null
  if (gameState.buildings && Array.isArray(gameState.buildings)) {
    workshopTarget = findActiveFriendlyBuildingAtTile(
      gameState.buildings,
      tileX,
      tileY,
      gameState.humanPlayer,
      'vehicleWorkshop'
    )

    const hasNotFullyLoadedAmbulances = commandableUnits.some(unit => unit.type === 'ambulance' && unit.medics < 4)
    if (hasNotFullyLoadedAmbulances) {
      hospitalTarget = findActiveFriendlyBuildingAtTile(
        gameState.buildings,
        tileX,
        tileY,
        gameState.humanPlayer,
        'hospital'
      )
    }

    const needsGas = commandableUnits.some(u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75)
    if (needsGas) {
      gasStationTarget = findActiveFriendlyBuildingAtTile(
        gameState.buildings,
        tileX,
        tileY,
        gameState.humanPlayer,
        'gasStation'
      )
    }
  }

  if (refineryTarget) {
    unitCommands.handleRefineryUnloadCommand(commandableUnits, refineryTarget, mapGrid)
  } else if (workshopTarget) {
    unitCommands.handleRepairWorkshopCommand(commandableUnits, workshopTarget, mapGrid)
  } else if (hospitalTarget) {
    unitCommands.handleAmbulanceRefillCommand(commandableUnits, hospitalTarget, mapGrid)
  } else if (gasStationTarget) {
    unitCommands.handleGasStationRefillCommand(commandableUnits, gasStationTarget, mapGrid)
  } else if (oreTarget) {
    unitCommands.handleHarvesterCommand(commandableUnits, oreTarget, mapGrid)
  } else {
    target = findEnemyTarget(worldX, worldY, handler.gameFactories || [], handler.gameUnits || [])

    if (target) {
      if (altPressed) {
        commandableUnits.forEach(unit => {
          if (!unit.commandQueue) unit.commandQueue = []
          unit.commandQueue.push({ type: 'attack', target })
        })
        markWaypointsAdded()
      } else {
        unitCommands.handleAttackCommand(commandableUnits, target, mapGrid, false)
      }
    } else {
      if (altPressed) {
        commandableUnits.forEach(unit => {
          if (!unit.commandQueue) unit.commandQueue = []
          unit.commandQueue.push({ type: 'move', x: worldX, y: worldY })
        })
        markWaypointsAdded()
      } else {
        unitCommands.handleMovementCommand(commandableUnits, worldX, worldY, mapGrid)
      }
    }
  }
}

export function handleServiceProviderClick(handler, provider, selectedUnits, unitCommands, mapGrid) {
  if (!unitCommands || !provider) {
    return false
  }
  const selectionManager = handler.selectionManager
  if (!selectionManager || !selectionManager.isHumanPlayerUnit(provider)) {
    return false
  }

  const providerTypes = ['ammunitionTruck', 'tankerTruck', 'ambulance', 'recoveryTank']
  if (!providerTypes.includes(provider.type)) {
    return false
  }

  const requesters = selectedUnits.filter(unit =>
    selectionManager.isHumanPlayerUnit(unit) && unit.id !== provider.id
  )

  if (requesters.length === 0) {
    return false
  }

  return unitCommands.handleServiceProviderRequest(provider, requesters, mapGrid)
}

export function handleFallbackCommand(handler, worldX, worldY, selectedUnits, unitCommands, mapGrid, e) {
  if (selectedUnits.length === 0 || gameState.buildingPlacementMode || gameState.repairMode || gameState.sellMode) {
    return
  }
  const selectionManager = handler.selectionManager
  const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
  if (commandableUnits.length === 0) {
    return
  }

  if (e.shiftKey) {
    initiateRetreat(commandableUnits, worldX, worldY, mapGrid)
  } else if (e.altKey) {
    handleStandardCommands(handler, worldX, worldY, commandableUnits, unitCommands, mapGrid, true)
  } else if (!isForceAttackModifierActive(e)) {
    handleStandardCommands(handler, worldX, worldY, commandableUnits, unitCommands, mapGrid, false)
  }
}
