// attackGroupHandler.js
import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { markWaypointsAdded } from '../game/waypointSounds.js'

export class AttackGroupHandler {
  constructor() {
    this.isAttackGroupSelecting = false
    this.attackGroupStartWorld = { x: 0, y: 0 }
    this.attackGroupWasDragging = false
    this.potentialAttackGroupStart = { x: 0, y: 0 }
    this.hasSelectedCombatUnits = false
    this.disableAGFRendering = false
  }

  shouldStartAttackGroupMode(selectedUnits) {
    const hasSelectedUnits = selectedUnits && selectedUnits.length > 0

    // Treat utility/service vehicles as non-combat for AGF: they should not trigger AGF on drag
    const isServiceVehicle = (u) => (
      u.type === 'ambulance' || u.type === 'tankerTruck' || u.type === 'recoveryTank'
    )

    // Combat units are human-owned, not buildings, and not utility/service or harvesters
    const hasCombatUnits = hasSelectedUnits && selectedUnits.some(unit =>
      unit.owner === gameState.humanPlayer && !unit.isBuilding &&
      unit.type !== 'harvester' && !isServiceVehicle(unit)
    )
    const hasSelectedFactory = hasSelectedUnits && selectedUnits.some(unit =>
      (unit.isBuilding && (unit.type === 'vehicleFactory' || unit.type === 'constructionYard')) ||
      (unit.id && (unit.id === gameState.humanPlayer))
    )
    const notInSpecialMode = !gameState.buildingPlacementMode &&
                            !gameState.repairMode &&
                            !gameState.sellMode &&
                            !gameState.attackGroupMode
    return hasSelectedUnits && hasCombatUnits && !hasSelectedFactory && notInSpecialMode
  }

  handleMouseUp(worldX, worldY, units, selectedUnits, unitCommands, mapGrid, standardCommandFn) {
    this.isAttackGroupSelecting = false
    gameState.disableAGFRendering = true

    if (this.attackGroupWasDragging) {
      const enemyTargets = this.findEnemyUnitsInAttackGroup(units)
      if (enemyTargets.length > 0) {
        if (gameState.altKeyDown) {
          selectedUnits.forEach(unit => {
            if (!unit.commandQueue) unit.commandQueue = []
            unit.commandQueue.push({ type: 'agf', targets: enemyTargets })
          })
          markWaypointsAdded()
        } else {
          this.setupAttackQueue(selectedUnits, enemyTargets, unitCommands, mapGrid)
        }
      }
    } else if (standardCommandFn) {
      standardCommandFn(worldX, worldY, selectedUnits, unitCommands, mapGrid, gameState.altKeyDown)
    }

    gameState.attackGroupMode = false
    gameState.attackGroupStart = { x: 0, y: 0 }
    gameState.attackGroupEnd = { x: 0, y: 0 }

    this.resetAttackGroupState()

    setTimeout(() => {
      gameState.disableAGFRendering = false
    }, 50)
  }

  resetAttackGroupState() {
    this.isAttackGroupSelecting = false
    this.attackGroupWasDragging = false
    this.hasSelectedCombatUnits = false
    this.potentialAttackGroupStart = { x: 0, y: 0 }
    this.attackGroupStartWorld = { x: 0, y: 0 }
    gameState.selectionActive = false
    gameState.selectionStart = { x: 0, y: 0 }
    gameState.selectionEnd = { x: 0, y: 0 }
  }

  findEnemyUnitsInAttackGroup(units) {
    const x1 = Math.min(gameState.attackGroupStart.x, gameState.attackGroupEnd.x)
    const y1 = Math.min(gameState.attackGroupStart.y, gameState.attackGroupEnd.y)
    const x2 = Math.max(gameState.attackGroupStart.x, gameState.attackGroupEnd.x)
    const y2 = Math.max(gameState.attackGroupStart.y, gameState.attackGroupEnd.y)

    const enemyTargets = []
    const humanPlayer = gameState.humanPlayer || 'player1'

    const isHumanPlayerTarget = (target) => {
      return target.owner === humanPlayer || (humanPlayer === 'player1' && target.owner === 'player')
    }

    for (const unit of units) {
      if (!isHumanPlayerTarget(unit) && unit.health > 0) {
        const centerX = unit.x + TILE_SIZE / 2
        const centerY = unit.y + TILE_SIZE / 2
        if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
          enemyTargets.push(unit)
        }
      }
    }

    if (gameState.buildings) {
      for (const building of gameState.buildings) {
        if (!isHumanPlayerTarget(building) && building.health > 0) {
          const buildingCenterX = (building.x + building.width / 2) * TILE_SIZE
          const buildingCenterY = (building.y + building.height / 2) * TILE_SIZE

          if (buildingCenterX >= x1 && buildingCenterX <= x2 &&
              buildingCenterY >= y1 && buildingCenterY <= y2) {
            enemyTargets.push(building)
          }
        }
      }
    }

    return enemyTargets
  }

  setupAttackQueue(selectedUnits, enemyTargets, unitCommands, mapGrid) {
    gameState.attackGroupTargets = [...enemyTargets]
    unitCommands.isAttackGroupOperation = true

    const combatUnits = selectedUnits.filter(unit =>
      unit.type !== 'harvester' && unit.owner === gameState.humanPlayer
    )

    combatUnits.forEach((unit) => {
      unit.attackQueue = []
      unit.target = null
      enemyTargets.forEach(target => {
        unit.attackQueue.push(target)
      })
      if (unit.attackQueue.length > 0) {
        unit.target = unit.attackQueue[0]
      }
    })

    if (combatUnits.length > 0 && combatUnits[0].target) {
      unitCommands.handleAttackCommand(combatUnits, combatUnits[0].target, mapGrid, false)
    }

    unitCommands.isAttackGroupOperation = false
  }

  shouldDisableAGFRendering() {
    return this.disableAGFRendering
  }

  updateAGFCapability(selectedUnits) {
    this.hasSelectedCombatUnits = this.shouldStartAttackGroupMode(selectedUnits)
  }
}
