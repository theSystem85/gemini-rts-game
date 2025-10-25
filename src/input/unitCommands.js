// unitCommands.js
import { TILE_SIZE, TANK_FIRE_RANGE } from '../config.js'
import { findPath } from '../units.js'
import { playSound, playPositionalSound } from '../sound.js'
import { gameState } from '../gameState.js'
import { cancelRetreatForUnits } from '../behaviours/retreat.js'
import { forceHarvesterUnloadPriority } from '../game/harvesterLogic.js'
import { showNotification } from '../ui/notifications.js'
import { units } from '../main.js'
import {
  getWreckById,
  findNearestWorkshop,
  releaseWreckAssignment,
  getRecycleDurationForWreck
} from '../game/unitWreckManager.js'

const UTILITY_QUEUE_MODES = {
  HEAL: 'heal',
  REFUEL: 'refuel',
  REPAIR: 'repair'
}

const AMBULANCE_APPROACH_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
]

const RECOVERY_APPROACH_OFFSETS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 }
]

export class UnitCommandsHandler {

  // Helper function to clear attack group feature state for units
  clearAttackGroupState(units) {
    units.forEach(unit => {
      // Clear attack queue for this unit
      if (unit.attackQueue) {
        unit.attackQueue = null
      }
    })

    // Only clear attack group targets when explicitly requested (not based on attack queue status)
    // This allows the indicators to persist until user performs a different action
    gameState.attackGroupTargets = []
  }

  cancelRecoveryTask(unit) {
    if (!unit || unit.type !== 'recoveryTank' || !unit.recoveryTask) {
      return
    }

    const wreck = getWreckById(gameState, unit.recoveryTask.wreckId)
    if (wreck) {
      if (wreck.assignedTankId === unit.id) {
        releaseWreckAssignment(wreck)
      }
      if (wreck.towedBy === unit.id) {
        wreck.towedBy = null
      }
    }

    unit.recoveryTask = null
    unit.towedWreck = null
    unit.recoveryProgress = 0
  }

  ensureUtilityQueueState(unit, mode = null) {
    if (!unit) return null
    if (!unit.utilityQueue) {
      unit.utilityQueue = { mode: null, targets: [], currentTargetId: null, currentTargetType: null }
    }
    if (mode && unit.utilityQueue.mode !== mode) {
      unit.utilityQueue.mode = mode
      unit.utilityQueue.targets = []
      unit.utilityQueue.currentTargetId = null
      unit.utilityQueue.currentTargetType = null
    }
    return unit.utilityQueue
  }

  clearUtilityQueueState(unit) {
    if (!unit || !unit.utilityQueue) return
    unit.utilityQueue.mode = null
    unit.utilityQueue.targets = []
    unit.utilityQueue.currentTargetId = null
    unit.utilityQueue.currentTargetType = null
  }

  cancelCurrentUtilityTask(unit) {
    if (!unit) return
    if (unit.utilityQueue) {
      unit.utilityQueue.currentTargetId = null
      unit.utilityQueue.currentTargetType = null
    }

    if (unit.type === 'ambulance') {
      unit.healingTarget = null
      unit.healingTimer = 0
    } else if (unit.type === 'tankerTruck') {
      unit.refuelTarget = null
      unit.refuelTimer = 0
      unit.emergencyTarget = null
      unit.emergencyMode = false
    } else if (unit.type === 'recoveryTank') {
      unit.repairTarget = null
      unit.repairTargetUnit = null
      unit.repairData = null
      unit.repairStarted = false
    }
  }

  canAmbulanceProvideCrew(ambulance) {
    if (!ambulance || ambulance.type !== 'ambulance') {
      return false
    }
    if (ambulance.health <= 0) {
      return false
    }
    if (ambulance.crew && typeof ambulance.crew === 'object' && !ambulance.crew.loader) {
      return false
    }
    return ambulance.medics > 0
  }

  canTankerProvideFuel(tanker) {
    if (!tanker || tanker.type !== 'tankerTruck') {
      return false
    }
    if (tanker.health <= 0) {
      return false
    }
    if (tanker.crew && typeof tanker.crew === 'object' && !tanker.crew.loader) {
      return false
    }
    return true
  }

  canRecoveryTankRepair(tank) {
    if (!tank || tank.type !== 'recoveryTank') {
      return false
    }
    if (tank.health <= 0) {
      return false
    }
    if (tank.crew && typeof tank.crew === 'object' && !tank.crew.loader) {
      return false
    }
    return true
  }

  isUtilityTargetValid(mode, serviceUnit, target) {
    if (!serviceUnit || !target) {
      return false
    }

    const isWreckTarget = target.isWreckTarget === true

    if (isWreckTarget) {
      if (mode !== UTILITY_QUEUE_MODES.REPAIR) {
        return false
      }
      const wreck = getWreckById(gameState, target.id)
      if (!wreck) {
        return false
      }
      if (wreck.owner !== serviceUnit.owner) {
        return false
      }
      if (wreck.isBeingRestored || wreck.towedBy || wreck.isBeingRecycled) {
        return false
      }
      if (wreck.assignedTankId && wreck.assignedTankId !== serviceUnit.id) {
        return false
      }
      return true
    }

    const actualTarget = target.type ? target : this.findUnitById(target.id)
    if (!actualTarget || actualTarget.health <= 0) {
      return false
    }
    if (actualTarget.id === serviceUnit.id) {
      return false
    }
    if (actualTarget.owner !== serviceUnit.owner) {
      return false
    }

    if (mode === UTILITY_QUEUE_MODES.HEAL) {
      return !!(actualTarget.crew && Object.values(actualTarget.crew).some(alive => !alive))
    }
    if (mode === UTILITY_QUEUE_MODES.REFUEL) {
      return typeof actualTarget.maxGas === 'number' && actualTarget.gas < actualTarget.maxGas
    }
    if (mode === UTILITY_QUEUE_MODES.REPAIR) {
      return actualTarget.health < actualTarget.maxHealth
    }
    return false
  }

  findUnitById(id) {
    if (!id) return null
    return units.find(u => u.id === id) || null
  }

  assignAmbulanceToTarget(ambulance, targetUnit, mapGrid, { suppressNotifications = false } = {}) {
    if (!this.canAmbulanceProvideCrew(ambulance)) {
      if (!suppressNotifications) {
        showNotification('No ambulances with crew selected!', 2000)
      }
      return false
    }
    if (!targetUnit || !targetUnit.crew || typeof targetUnit.crew !== 'object') {
      if (!suppressNotifications) {
        showNotification('Target unit cannot be healed!', 2000)
      }
      return false
    }
    const missingCrew = Object.entries(targetUnit.crew).some(([_, alive]) => !alive)
    if (!missingCrew) {
      if (!suppressNotifications) {
        showNotification('Target unit is already fully crewed!', 2000)
      }
      return false
    }

    const startTile = {
      x: Math.floor((ambulance.x + TILE_SIZE / 2) / TILE_SIZE),
      y: Math.floor((ambulance.y + TILE_SIZE / 2) / TILE_SIZE)
    }
    const targetTileX = Math.floor((targetUnit.x + TILE_SIZE / 2) / TILE_SIZE)
    const targetTileY = Math.floor((targetUnit.y + TILE_SIZE / 2) / TILE_SIZE)

    for (const offset of AMBULANCE_APPROACH_OFFSETS) {
      const destX = targetTileX + offset.x
      const destY = targetTileY + offset.y
      if (destX < 0 || destY < 0 || destY >= mapGrid.length || destX >= mapGrid[0].length) {
        continue
      }
      const path = findPath(startTile, { x: destX, y: destY }, mapGrid, null)
      if (path && path.length > 0) {
        ambulance.path = path.slice(1)
        ambulance.moveTarget = { x: destX, y: destY }
        ambulance.healingTarget = targetUnit
        ambulance.healingTimer = 0
        return true
      }
    }

    if (!suppressNotifications) {
      showNotification('Cannot path to target for healing!', 2000)
    }
    return false
  }

  assignTankerToTarget(tanker, targetUnit, mapGrid, { suppressNotifications = false } = {}) {
    if (!this.canTankerProvideFuel(tanker)) {
      if (!suppressNotifications) {
        showNotification('No tanker trucks with crew selected!', 2000)
      }
      return false
    }
    if (!targetUnit || typeof targetUnit.maxGas !== 'number' || targetUnit.gas >= targetUnit.maxGas) {
      if (!suppressNotifications) {
        showNotification('Target unit does not need fuel!', 2000)
      }
      return false
    }

    const startTile = { x: tanker.tileX, y: tanker.tileY }
    const targetTileX = Math.floor((targetUnit.x + TILE_SIZE / 2) / TILE_SIZE)
    const targetTileY = Math.floor((targetUnit.y + TILE_SIZE / 2) / TILE_SIZE)

    for (const offset of AMBULANCE_APPROACH_OFFSETS) {
      const destX = targetTileX + offset.x
      const destY = targetTileY + offset.y
      if (destX < 0 || destY < 0 || destY >= mapGrid.length || destX >= mapGrid[0].length) {
        continue
      }
      const path = findPath(startTile, { x: destX, y: destY }, mapGrid, null)
      if (path && path.length > 0) {
        tanker.path = path.slice(1)
        tanker.moveTarget = { x: destX, y: destY }
        tanker.refuelTarget = targetUnit
        tanker.refuelTimer = 0
        tanker.emergencyTarget = null
        return true
      }
    }

    if (!suppressNotifications) {
      showNotification('Cannot path to target for refuel!', 2000)
    }
    return false
  }

  assignRecoveryTankToTarget(tank, targetUnit, mapGrid, { suppressNotifications = false } = {}) {
    if (!this.canRecoveryTankRepair(tank)) {
      if (!suppressNotifications) {
        showNotification('Recovery tank cannot repair right now!', 2000)
      }
      return false
    }
    if (!targetUnit || targetUnit.health >= targetUnit.maxHealth) {
      if (!suppressNotifications) {
        showNotification('Target unit does not need repairs!', 2000)
      }
      return false
    }

    const startTile = { x: tank.tileX, y: tank.tileY }
    for (const offset of RECOVERY_APPROACH_OFFSETS) {
      const destX = targetUnit.tileX + offset.x
      const destY = targetUnit.tileY + offset.y
      if (destX < 0 || destY < 0 || destY >= mapGrid.length || destX >= mapGrid[0].length) {
        continue
      }
      const path = findPath(startTile, { x: destX, y: destY }, mapGrid, gameState.occupancyMap)
      if (path && path.length > 0) {
        tank.path = path.slice(1)
        tank.moveTarget = { x: destX * TILE_SIZE, y: destY * TILE_SIZE }
        tank.target = null
        tank.repairTarget = null
        tank.repairData = null
        tank.repairStarted = false
        tank.repairTargetUnit = targetUnit
        return true
      }
    }

    if (!suppressNotifications) {
      showNotification('Cannot reach unit for repair!', 2000)
    }
    return false
  }

  assignRecoveryTankToWreck(tank, wreck, mapGrid, { mode = 'tow', suppressNotifications = false } = {}) {
    if (!tank || tank.type !== 'recoveryTank' || tank.health <= 0) {
      return false
    }
    if (!wreck || wreck.owner !== tank.owner) {
      if (!suppressNotifications) {
        showNotification('Recovery tanks can only recover your own wrecks.', 2000)
      }
      return false
    }
    if (wreck.isBeingRestored || wreck.isBeingRecycled || wreck.towedBy) {
      if (!suppressNotifications) {
        showNotification('This wreck is already being processed.', 2000)
      }
      return false
    }

    if (wreck.assignedTankId && wreck.assignedTankId !== tank.id) {
      const assignedTankAlive = units.some(
        candidate => candidate.id === wreck.assignedTankId && candidate.type === 'recoveryTank' && candidate.health > 0
      )
      if (assignedTankAlive) {
        if (!suppressNotifications) {
          showNotification('Another recovery tank is already assigned to this wreck.', 2000)
        }
        return false
      }
      releaseWreckAssignment(wreck)
    }

    if (!this.canRecoveryTankRepair(tank)) {
      if (!suppressNotifications) {
        showNotification('Recovery tank cannot recover right now!', 2000)
      }
      return false
    }

    if (!mapGrid || mapGrid.length === 0 || !Array.isArray(mapGrid[0])) {
      return false
    }

    const candidatePositions = [
      { x: wreck.tileX, y: wreck.tileY },
      { x: wreck.tileX + 1, y: wreck.tileY },
      { x: wreck.tileX - 1, y: wreck.tileY },
      { x: wreck.tileX, y: wreck.tileY + 1 },
      { x: wreck.tileX, y: wreck.tileY - 1 }
    ]

    let assignedPath = null
    let destination = null
    for (const pos of candidatePositions) {
      if (pos.x < 0 || pos.y < 0 || pos.y >= mapGrid.length || pos.x >= mapGrid[0].length) {
        continue
      }
      const path = findPath({ x: tank.tileX, y: tank.tileY }, pos, mapGrid, gameState.occupancyMap)
      if (path && path.length > 0) {
        assignedPath = path
        destination = pos
        break
      }
    }

    if (!assignedPath || !destination) {
      if (!suppressNotifications) {
        showNotification('Cannot reach wreck location.', 2000)
      }
      return false
    }

    const task = { wreckId: wreck.id }

    if (mode === 'tow') {
      const nearestWorkshop = findNearestWorkshop(gameState, tank.owner, { x: tank.tileX, y: tank.tileY })
      if (!nearestWorkshop) {
        if (!suppressNotifications) {
          showNotification('No workshop available for recovery!', 2000)
        }
        return false
      }
      task.mode = 'tow'
      task.state = 'movingToWreck'
      task.workshopId = nearestWorkshop.workshop.id
      task.workshopEntry = nearestWorkshop.entryTile
      task.originalPosition = { x: tank.tileX, y: tank.tileY }
    } else if (mode === 'recycle') {
      const recycleDuration = getRecycleDurationForWreck(wreck)
      task.mode = 'recycle'
      task.state = 'movingToWreck'
      task.recycleDuration = recycleDuration
    } else {
      return false
    }

    this.cancelRecoveryTask(tank)
    tank.guardMode = false
    tank.guardTarget = null
    tank.path = assignedPath.slice(1)
    tank.moveTarget = { x: destination.x, y: destination.y }
    tank.recoveryTask = task
    wreck.assignedTankId = tank.id

    if (!suppressNotifications) {
      playSound('movement', 0.5)
    }

    return true
  }

  startUtilityTaskForMode(unit, targetUnit, mode, mapGrid, suppressNotifications = false) {
    if (mode === UTILITY_QUEUE_MODES.HEAL) {
      return this.assignAmbulanceToTarget(unit, targetUnit, mapGrid, { suppressNotifications })
    }
    if (mode === UTILITY_QUEUE_MODES.REFUEL) {
      return this.assignTankerToTarget(unit, targetUnit, mapGrid, { suppressNotifications })
    }
    if (mode === UTILITY_QUEUE_MODES.REPAIR) {
      return this.assignRecoveryTankToTarget(unit, targetUnit, mapGrid, { suppressNotifications })
    }
    return false
  }

  startNextUtilityTask(unit, mapGrid, suppressNotifications = false) {
    const queue = unit?.utilityQueue
    if (!queue || queue.currentTargetId) {
      return false
    }

    while (queue.targets.length > 0) {
      const entry = queue.targets.shift()
      if (!entry) continue
      const entryInfo = typeof entry === 'object' ? entry : { id: entry, type: 'unit' }
      if (!entryInfo.id) {
        continue
      }

      if (entryInfo.type === 'wreck') {
        const descriptor = { id: entryInfo.id, isWreckTarget: true }
        if (!this.isUtilityTargetValid(queue.mode, unit, descriptor)) {
          continue
        }
        const wreck = getWreckById(gameState, entryInfo.id)
        if (!wreck) {
          continue
        }
        const started = this.assignRecoveryTankToWreck(unit, wreck, mapGrid, { suppressNotifications: true })
        if (started) {
          queue.currentTargetId = entryInfo.id
          queue.currentTargetType = 'wreck'
          return true
        }
      } else {
        const target = this.findUnitById(entryInfo.id)
        if (!target || !this.isUtilityTargetValid(queue.mode, unit, target)) {
          continue
        }
        const started = this.startUtilityTaskForMode(unit, target, queue.mode, mapGrid, suppressNotifications)
        if (started) {
          queue.currentTargetId = target.id
          queue.currentTargetType = 'unit'
          return true
        }
      }
    }

    if (!queue.targets.length) {
      queue.mode = null
      queue.currentTargetType = null
    }
    return false
  }

  setUtilityQueue(unit, targets, mode, mapGrid, { append = false, suppressNotifications = false } = {}) {
    if (!unit) {
      return { addedTargets: [], started: false }
    }
    const queue = this.ensureUtilityQueueState(unit, mode)
    if (!append) {
      if (mode === UTILITY_QUEUE_MODES.REPAIR) {
        this.cancelRecoveryTask(unit)
      }
      this.cancelCurrentUtilityTask(unit)
      queue.targets = []
      queue.currentTargetId = null
      queue.currentTargetType = null
      queue.mode = mode
    }

    const existing = new Set()
    queue.targets.forEach(entry => {
      if (!entry) return
      if (typeof entry === 'object') {
        existing.add(`${entry.type || 'unit'}:${entry.id}`)
      } else {
        existing.add(`unit:${entry}`)
      }
    })
    if (queue.currentTargetId) {
      existing.add(`${queue.currentTargetType || 'unit'}:${queue.currentTargetId}`)
    }

    const addedTargets = []
    targets.forEach(target => {
      if (!target) return
      if (!this.isUtilityTargetValid(mode, unit, target)) return
      const targetType = target.isWreckTarget ? 'wreck' : 'unit'
      const key = `${targetType}:${target.id}`
      if (existing.has(key)) return
      queue.targets.push({ id: target.id, type: targetType })
      existing.add(key)
      addedTargets.push(target)
    })

    let started = false
    if (!queue.currentTargetId) {
      started = this.startNextUtilityTask(unit, mapGrid, suppressNotifications)
    }

    if (!queue.currentTargetId && queue.targets.length === 0 && !append) {
      queue.mode = null
    }

    return { addedTargets, started }
  }

  advanceUtilityQueue(unit, mapGrid, suppressNotifications = true) {
    if (!unit || !unit.utilityQueue) {
      return false
    }
    unit.utilityQueue.currentTargetId = null
    unit.utilityQueue.currentTargetType = null
    const started = this.startNextUtilityTask(unit, mapGrid, suppressNotifications)
    if (!started && unit.utilityQueue.targets.length === 0) {
      unit.utilityQueue.mode = null
      unit.utilityQueue.currentTargetType = null
    }
    return started
  }

  queueUtilityTargets(serviceUnits, targets, mode, mapGrid) {
    if (!serviceUnits || serviceUnits.length === 0 || !targets || targets.length === 0) {
      return false
    }

    let capabilityCheck
    if (mode === UTILITY_QUEUE_MODES.HEAL) {
      capabilityCheck = unit => this.canAmbulanceProvideCrew(unit)
    } else if (mode === UTILITY_QUEUE_MODES.REFUEL) {
      capabilityCheck = unit => this.canTankerProvideFuel(unit)
    } else if (mode === UTILITY_QUEUE_MODES.REPAIR) {
      capabilityCheck = unit => this.canRecoveryTankRepair(unit)
    } else {
      return false
    }

    const capableUnits = serviceUnits.filter(capabilityCheck)
    if (capableUnits.length === 0) {
      return false
    }

    const primaryUnit = capableUnits[0]
    const filteredTargets = targets.filter(target => this.isUtilityTargetValid(mode, primaryUnit, target))
    if (filteredTargets.length === 0) {
      return false
    }

    const assignments = capableUnits.map(() => [])
    filteredTargets.forEach((target, index) => {
      const assignedIndex = index % capableUnits.length
      assignments[assignedIndex].push(target)
    })

    let anyQueued = false
    capableUnits.forEach((unit, index) => {
      const assignedTargets = assignments[index]
      if (assignedTargets.length === 0) {
        return
      }
      const result = this.setUtilityQueue(unit, assignedTargets, mode, mapGrid, { suppressNotifications: true })
      if (result.addedTargets.length > 0 || result.started) {
        anyQueued = true
      }
    })

    if (anyQueued) {
      playSound('movement', 0.5)
    }
    return anyQueued
  }

  getUtilityQueuePosition(unit, target, overrideType = null) {
    if (!unit || !unit.utilityQueue || !target) {
      return null
    }
    const queue = unit.utilityQueue
    const targetId = target.id
    if (!targetId) {
      return null
    }
    const targetType = overrideType || (target.isWreckTarget ? 'wreck' : 'unit')
    const currentType = queue.currentTargetType || 'unit'
    if (queue.currentTargetId === targetId && currentType === targetType) {
      return 1
    }
    if (!Array.isArray(queue.targets)) {
      return null
    }
    const index = queue.targets.findIndex(entry => {
      if (!entry) return false
      if (typeof entry === 'object') {
        const entryType = entry.type || 'unit'
        return entry.id === targetId && entryType === targetType
      }
      return entry === targetId && targetType === 'unit'
    })
    if (index === -1) {
      return null
    }
    return (queue.currentTargetId ? 2 : 1) + index
  }

  handleMovementCommand(selectedUnits, targetX, targetY, mapGrid, skipQueueClear = false) {
    // Filter out units that cannot be commanded due to missing commander
    const commandableUnits = selectedUnits.filter(unit => {
      if (unit.crew && typeof unit.crew === 'object' && !unit.crew.commander) {
        // Unit cannot be commanded without commander
        return false
      }
      return true
    })

    // If no commandable units, show notification and return
    if (commandableUnits.length === 0 && selectedUnits.some(unit =>
      unit.crew && typeof unit.crew === 'object' && !unit.crew.commander)) {
      showNotification('Cannot command units without commanders!', 2000)
      return
    }

    // Use commandable units for the rest of the function
    const unitsToCommand = commandableUnits.length > 0 ? commandableUnits : selectedUnits

    // Clear attack group feature state when issuing movement commands
    this.clearAttackGroupState(unitsToCommand)

    // Cancel retreat for all selected units when issuing movement commands
    cancelRetreatForUnits(unitsToCommand)

    if (!skipQueueClear) {
      unitsToCommand.forEach(unit => {
        this.cancelRecoveryTask(unit)
        unit.commandQueue = []
        unit.currentCommand = null
      })
    }

    const count = unitsToCommand.length

    let anyMoved = false
    let outOfGasCount = 0
    unitsToCommand.forEach((unit, index) => {
      unit.guardTarget = null
      unit.guardMode = false
      let formationOffset = { x: 0, y: 0 }

      const colsCount = Math.ceil(Math.sqrt(count))
      const col = index % colsCount
      const row = Math.floor(index / colsCount)

      // Apply formation offsets based on whether formation mode is active
      if (unit.formationActive && unit.formationOffset) {
        // Use stored formation offsets for this unit
        formationOffset = {
          x: unit.formationOffset.x,
          y: unit.formationOffset.y
        }
      } else {
        // Default grid formation if formation mode is not active
        const formationSpacing = TILE_SIZE * 1.2 // 1.2 tiles spacing to prevent overlap
        formationOffset = {
          x: col * formationSpacing - ((colsCount - 1) * formationSpacing) / 2,
          y: row * formationSpacing - ((colsCount - 1) * formationSpacing) / 2
        }
      }

      const destX = Math.floor(targetX) + formationOffset.x
      const destY = Math.floor(targetY) + formationOffset.y
      const originalDestTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) }

      // Check if this tile is already targeted by previously processed units
      const alreadyTargeted = unitsToCommand.slice(0, index).some(u =>
        u.moveTarget && u.moveTarget.x === originalDestTile.x && u.moveTarget.y === originalDestTile.y
      )

      // If already targeted, find an adjacent free tile instead
      let destTile = originalDestTile
      if (alreadyTargeted) {
        const directions = [
          { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
          { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ]

        for (const dir of directions) {
          const newTile = {
            x: originalDestTile.x + dir.dx,
            y: originalDestTile.y + dir.dy
          }

          // Check if this new tile is valid and not targeted
          if (newTile.x >= 0 && newTile.y >= 0 &&
              newTile.x < mapGrid[0].length && newTile.y < mapGrid.length &&
              mapGrid[newTile.y][newTile.x].type !== 'water' &&
              mapGrid[newTile.y][newTile.x].type !== 'rock' &&
              !mapGrid[newTile.y][newTile.x].building &&
              !selectedUnits.slice(0, index).some(u =>
                u.moveTarget && u.moveTarget.x === newTile.x && u.moveTarget.y === newTile.y
              )) {
            destTile = newTile
            break
          }
        }
      }

      // Fixed: correctly pass unit.tileX and unit.tileY as source coordinates
      const path =
        unit.gas <= 0 && typeof unit.maxGas === 'number'
          ? null
          : findPath(
            { x: unit.tileX, y: unit.tileY },
            destTile,
            mapGrid,
            gameState.occupancyMap
          )

      if (path && path.length > 0) {
        unit.path = path.length > 1 ? path.slice(1) : path
        // Clear any existing target when issuing a move command - but preserve turret direction
        unit.target = null
        unit.moveTarget = destTile // Store the final destination
        // Clear any previous target when moving
        unit.originalTarget = null

        // Flag that turret should rotate to movement direction for tanks
        if (unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank') {
          unit.turretShouldFollowMovement = true
        }
        unit.originalPath = null
        // Clear force attack flag when issuing a move command
        unit.forcedAttack = false
        anyMoved = true
      } else if (typeof unit.maxGas === 'number' && unit.gas <= 0) {
        outOfGasCount++
      }

    })
    if (outOfGasCount > 0) {
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('outOfGas', avgX, avgY, 0.5)
    } else if (anyMoved) {
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('movement', avgX, avgY, 0.5)
    }
  }

  handleAttackCommand(selectedUnits, target, mapGrid, isForceAttack = false, skipQueueClear = false) {
    // Clear attack group feature state when issuing single target attack commands
    // Only clear if this is not part of an attack group operation (when isForceAttack is not from AGF)
    if (!this.isAttackGroupOperation) {
      this.clearAttackGroupState(selectedUnits)
    }

    // Cancel retreat for all selected units when issuing attack commands
    cancelRetreatForUnits(selectedUnits)
    selectedUnits.forEach(u => { u.guardTarget = null; u.guardMode = false })

    if (!skipQueueClear) {
      selectedUnits.forEach(unit => {
        this.cancelRecoveryTask(unit)
        unit.commandQueue = []
        unit.currentCommand = null
      })
    }

    // Semicircle formation logic for attack
    // Calculate safe attack distance with explosion buffer
    const explosionSafetyBuffer = TILE_SIZE * 0.5
    const safeAttackDistance = Math.max(
      TANK_FIRE_RANGE * TILE_SIZE,
      TILE_SIZE * 2 + explosionSafetyBuffer
    ) - TILE_SIZE

    // Get semicircle formation positions
    const formationPositions = this.calculateSemicircleFormation(selectedUnits, target, safeAttackDistance)

    selectedUnits.forEach((unit, index) => {
      // Reset firing capability when issuing attack commands (in case it was disabled during retreat)
      unit.canFire = true

      const position = formationPositions[index]

      // Ensure position is within safe distance
      const unitCenter = { x: unit.x + TILE_SIZE / 2, y: unit.y + TILE_SIZE / 2 }
      const targetCenter = this.getTargetPoint(target, unitCenter)
      const finalDx = targetCenter.x - position.x
      const finalDy = targetCenter.y - position.y
      const finalDist = Math.hypot(finalDx, finalDy)

      let destX = position.x
      let destY = position.y

      if (finalDist < safeAttackDistance) {
        const scale = safeAttackDistance / finalDist
        destX = targetCenter.x - finalDx * scale
        destY = targetCenter.y - finalDy * scale
      }

      const desiredTile = {
        x: Math.floor(destX / TILE_SIZE),
        y: Math.floor(destY / TILE_SIZE)
      }

      // Find path to the target position, always respect occupancy map (including in attack mode)
      const occupancyMap = gameState.occupancyMap
      const path = findPath({ x: unit.tileX, y: unit.tileY }, desiredTile, mapGrid, occupancyMap)

      if (path && path.length > 0 && (unit.tileX !== desiredTile.x || unit.tileY !== desiredTile.y)) {
        unit.path = path.slice(1)
        unit.target = target
        unit.moveTarget = desiredTile // Store movement target for green indicator
        unit.forcedAttack = isForceAttack
      } else {
        // If already at position, just set the target
        unit.path = []
        unit.target = target
        unit.moveTarget = null // No movement needed
        unit.forcedAttack = isForceAttack
      }
    })

    // Play attacking sound for user-initiated attack commands
    playSound('attacking', 1.0)
  }

  handleRefineryUnloadCommand(selectedUnits, refinery, mapGrid) {
    selectedUnits.forEach(u => { u.commandQueue = []; u.currentCommand = null })
    // Clear attack group feature state when issuing refinery unload commands
    this.clearAttackGroupState(selectedUnits)

    let harvestersCommanded = 0

    selectedUnits.forEach(unit => {
      if (unit.type === 'harvester') {
        unit.guardTarget = null
        unit.guardMode = false
        // Force this harvester to be assigned to the clicked refinery (regardless of current ore status)
        // This will be used when the harvester next needs to unload
        unit.assignedRefinery = refinery // Store the actual refinery object

        // If harvester has ore, immediately force priority unload
        if (unit.oreCarried > 0) {
          forceHarvesterUnloadPriority(unit, refinery, units)

          // Path the harvester to the refinery immediately
          const path = findPath(
            { x: unit.tileX, y: unit.tileY },
            {
              x: refinery.x + Math.floor(refinery.width / 2),
              y: refinery.y + Math.floor(refinery.height / 2)
            },
            mapGrid,
            gameState.occupancyMap
          )

          if (path && path.length > 0) {
            unit.path = path.length > 1 ? path.slice(1) : path
            unit.target = null // Clear any combat target
            unit.moveTarget = { x: refinery.x + Math.floor(refinery.width / 2),
              y: refinery.y + Math.floor(refinery.height / 2) }
            unit.forcedAttack = false
          }
        }

        harvestersCommanded++
      }
    })

    // Play confirmed sound if at least one harvester was commanded
    if (harvestersCommanded > 0) {
      playSound('confirmed', 0.8)
    }
  }

  handleHarvesterCommand(selectedUnits, oreTarget, mapGrid) {
    selectedUnits.forEach(u => { u.commandQueue = []; u.currentCommand = null })
    // Clear attack group feature state when issuing harvester commands
    this.clearAttackGroupState(selectedUnits)

    let anyAssigned = false
    selectedUnits.forEach(unit => {
      if (unit.type === 'harvester') {
        unit.guardTarget = null
        unit.guardMode = false
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          oreTarget,
          mapGrid,
          gameState.occupancyMap
        )

        if (path && path.length > 0) {
          unit.path = path.length > 1 ? path.slice(1) : path
          // Set the harvester's manual ore target
          unit.manualOreTarget = oreTarget
          unit.oreField = null // Clear any automatic ore field assignment
          unit.target = null // Clear any combat target
          unit.moveTarget = oreTarget
          unit.forcedAttack = false
          anyAssigned = true
        }
      }
    })

    if (anyAssigned) {
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('movement', avgX, avgY, 0.5)
    }
  }

  handleRepairWorkshopCommand(selectedUnits, workshop, mapGrid) {
    selectedUnits.forEach(u => { u.commandQueue = []; u.currentCommand = null })
    this.clearAttackGroupState(selectedUnits)

    selectedUnits.forEach((unit, index) => {
      unit.guardTarget = null
      unit.guardMode = false
      if (!workshop.repairQueue) workshop.repairQueue = []
      if (!workshop.repairQueue.includes(unit)) {
        workshop.repairQueue.push(unit)
        unit.targetWorkshop = workshop
      }

      // Assign waiting positions in a line near the workshop
      // Position units in a line 2 tiles below the workshop for better queuing
      const waitingY = workshop.y + workshop.height + 1
      const waitingX = workshop.x + (index % workshop.width)
      const targetTile = { x: waitingX, y: waitingY }

      const path = findPath({ x: unit.tileX, y: unit.tileY }, targetTile, mapGrid, gameState.occupancyMap)
      if (path && path.length > 0) {
        unit.path = path.length > 1 ? path.slice(1) : path
        unit.moveTarget = targetTile
      } else {
        unit.x = targetTile.x * TILE_SIZE
        unit.y = targetTile.y * TILE_SIZE
        unit.tileX = targetTile.x
        unit.tileY = targetTile.y
        unit.moveTarget = null
      }
    })
    playSound('movement', 0.5)
  }

  handleWorkshopRepairHotkey(selectedUnits, mapGrid, queue = false, fromQueue = false) {
    const workshops = gameState.buildings.filter(b =>
      b.type === 'vehicleWorkshop' && b.owner === gameState.humanPlayer && b.health > 0
    )
    if (workshops.length === 0) {
      showNotification('No operational workshop available!', 2000)
      return
    }

    const damaged = selectedUnits.filter(u => u.health < u.maxHealth)
    if (damaged.length === 0) {
      if (!fromQueue) showNotification('No damaged units selected', 2000)
      return
    }

    damaged.forEach(unit => {
      // Determine nearest workshop each time for accuracy
      let nearest = null
      let nearestDist = Infinity
      workshops.forEach(ws => {
        const dist = Math.hypot(unit.tileX - ws.x, unit.tileY - ws.y)
        if (dist < nearestDist) { nearest = ws; nearestDist = dist }
      })
      if (!nearest) return

      if (queue) {
        if (!unit.commandQueue) unit.commandQueue = []
        unit.commandQueue.push({ type: 'workshopRepair' })
      } else {
        unit.returnTile = { x: unit.tileX, y: unit.tileY }
        if (!nearest.repairQueue) nearest.repairQueue = []
        if (!nearest.repairQueue.includes(unit)) {
          nearest.repairQueue.push(unit)
          unit.targetWorkshop = nearest
        }
        const waitingY = nearest.y + nearest.height + 1
        const waitingX = nearest.x + (nearest.repairQueue.indexOf(unit) % nearest.width)
        const targetTile = { x: waitingX, y: waitingY }
        const path = findPath({ x: unit.tileX, y: unit.tileY }, targetTile, mapGrid, gameState.occupancyMap)
        if (path && path.length > 0) {
          unit.path = path.slice(1)
          unit.moveTarget = targetTile
        } else {
          unit.x = targetTile.x * TILE_SIZE
          unit.y = targetTile.y * TILE_SIZE
          unit.tileX = targetTile.x
          unit.tileY = targetTile.y
          unit.moveTarget = null
        }
        if (!fromQueue) playSound('movement', 0.5)
      }
    })
  }

  handleAmbulanceHealCommand(selectedUnits, targetUnit, mapGrid) {
    const ambulances = selectedUnits.filter(unit => this.canAmbulanceProvideCrew(unit))
    if (ambulances.length === 0) {
      showNotification('No ambulances with crew selected!', 2000)
      return
    }

    if (!targetUnit || !targetUnit.crew || typeof targetUnit.crew !== 'object') {
      showNotification('Target unit cannot be healed!', 2000)
      return
    }

    const missingCrew = Object.entries(targetUnit.crew).some(([_, alive]) => !alive)
    if (!missingCrew) {
      showNotification('Target unit is already fully crewed!', 2000)
      return
    }

    let anyStarted = false
    ambulances.forEach(ambulance => {
      const result = this.setUtilityQueue(ambulance, [targetUnit], UTILITY_QUEUE_MODES.HEAL, mapGrid)
      if (result.addedTargets.length > 0 || result.started) {
        anyStarted = true
      }
    })

    if (anyStarted) {
      playSound('movement', 0.5)
    }
  }

  handleTankerRefuelCommand(selectedUnits, targetUnit, mapGrid) {
    const tankers = selectedUnits.filter(unit => this.canTankerProvideFuel(unit))
    if (tankers.length === 0) {
      return
    }
    if (!targetUnit || typeof targetUnit.maxGas !== 'number' || targetUnit.gas >= targetUnit.maxGas) {
      showNotification('Target unit does not need fuel!', 2000)
      return
    }

    let anyStarted = false
    tankers.forEach(tanker => {
      const result = this.setUtilityQueue(tanker, [targetUnit], UTILITY_QUEUE_MODES.REFUEL, mapGrid)
      if (result.addedTargets.length > 0 || result.started) {
        anyStarted = true
      }
    })

    if (anyStarted) {
      playSound('movement', 0.5)
    }
  }

  handleAmbulanceRefillCommand(selectedUnits, hospital, mapGrid) {
    // Filter for ambulances that need refilling
    const ambulances = selectedUnits.filter(unit =>
      unit.type === 'ambulance' && unit.medics < 4
    )

    if (ambulances.length === 0) {
      showNotification('No ambulances need refilling!', 2000)
      return
    }

    // Assign ambulances to refill at the hospital
    ambulances.forEach(ambulance => {
      ambulance.refillingTarget = hospital

      // Set path to hospital refill area (3 tiles below hospital)
      const hospitalCenterX = hospital.x + Math.floor(hospital.width / 2)
      const refillY = hospital.y + hospital.height + 1 // 1 tile below hospital

      // Find available position in refill area
      const refillPositions = [
        { x: hospitalCenterX - 1, y: refillY },
        { x: hospitalCenterX, y: refillY },
        { x: hospitalCenterX + 1, y: refillY },
        { x: hospitalCenterX - 1, y: refillY + 1 },
        { x: hospitalCenterX, y: refillY + 1 },
        { x: hospitalCenterX + 1, y: refillY + 1 },
        { x: hospitalCenterX - 1, y: refillY + 2 },
        { x: hospitalCenterX, y: refillY + 2 },
        { x: hospitalCenterX + 1, y: refillY + 2 }
      ]

      let destinationFound = false
      for (const pos of refillPositions) {
        if (pos.x >= 0 && pos.y >= 0 && pos.x < mapGrid[0].length && pos.y < mapGrid.length) {
          const path = findPath(
            { x: ambulance.tileX, y: ambulance.tileY },
            { x: pos.x, y: pos.y },
            mapGrid,
            gameState.occupancyMap
          )
          if (path && path.length > 0) {
            ambulance.path = path
            ambulance.moveTarget = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE }
            ambulance.target = null // Clear any attack target
            destinationFound = true
            break
          }
        }
      }

      if (!destinationFound) {
        showNotification('Cannot reach hospital refill area!', 2000)
        ambulance.refillingTarget = null
      }
    })

    playSound('movement', 0.5)
  }

  handleGasStationRefillCommand(selectedUnits, station, mapGrid) {
    const unitsNeedingGas = selectedUnits.filter(
      u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75
    )

    if (unitsNeedingGas.length === 0) {
      showNotification('No units need refilling!', 2000)
      return
    }

    const positions = []
    for (let x = station.x - 1; x <= station.x + station.width; x++) {
      for (let y = station.y - 1; y <= station.y + station.height; y++) {
        const insideX = x >= station.x && x < station.x + station.width
        const insideY = y >= station.y && y < station.y + station.height
        if (insideX && insideY) continue
        if (x >= 0 && y >= 0 && x < mapGrid[0].length && y < mapGrid.length) {
          positions.push({ x, y })
        }
      }
    }

    unitsNeedingGas.forEach((unit, index) => {
      const pos = positions[index % positions.length]
      const path = findPath(
        { x: unit.tileX, y: unit.tileY },
        { x: pos.x, y: pos.y },
        mapGrid,
        gameState.occupancyMap
      )
      if (path && path.length > 0) {
        unit.path = path
        unit.moveTarget = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE }
      }
    })
    playSound('movement', 0.5)
  }

  handleRecoveryTowCommand(selectedUnits, targetUnit) {
    const tanks = selectedUnits.filter(u => u.type === 'recoveryTank')
    if (tanks.length === 0) return

    tanks.forEach(tank => {
      if (tank.towedUnit && tank.towedUnit.id === targetUnit.id) {
        tank.towedUnit.towedBy = null
        tank.towedUnit = null
        return
      }
      if (!tank.towedUnit && targetUnit.crew && (!targetUnit.crew.driver || !targetUnit.crew.commander)) {
        tank.towedUnit = targetUnit
        targetUnit.towedBy = tank
      }
    })
  }

  handleRecoveryTankRepairCommand(selectedUnits, targetUnit, mapGrid) {
    const recoveryTanks = selectedUnits.filter(unit => this.canRecoveryTankRepair(unit))
    if (recoveryTanks.length === 0) {
      return
    }

    if (!targetUnit || targetUnit.health >= targetUnit.maxHealth) {
      showNotification('Target unit does not need repairs!', 2000)
      return
    }

    let anyStarted = false
    recoveryTanks.forEach(tank => {
      const result = this.setUtilityQueue(tank, [targetUnit], UTILITY_QUEUE_MODES.REPAIR, mapGrid)
      if (result.addedTargets.length > 0 || result.started) {
        anyStarted = true
      }
    })

    if (anyStarted) {
      playSound('movement', 0.5)
    }
  }

  handleRecoveryWreckTowCommand(selectedUnits, wreck, mapGrid) {
    if (!wreck) return
    const recoveryTanks = selectedUnits.filter(u => this.canRecoveryTankRepair(u))
    if (recoveryTanks.length === 0) return
    const availableTank = recoveryTanks.find(tank => !tank.recoveryTask || tank.recoveryTask.wreckId === wreck.id)
    if (!availableTank) {
      showNotification('All selected recovery tanks are busy.', 2000)
      return
    }

    this.assignRecoveryTankToWreck(availableTank, wreck, mapGrid, { mode: 'tow', suppressNotifications: false })
  }

  handleRecoveryWreckRecycleCommand(selectedUnits, wreck, mapGrid) {
    if (!wreck) return
    const recoveryTanks = selectedUnits.filter(u => this.canRecoveryTankRepair(u))
    if (recoveryTanks.length === 0) return
    const availableTank = recoveryTanks.find(tank => !tank.recoveryTask || tank.recoveryTask.wreckId === wreck.id)
    if (!availableTank) {
      showNotification('All selected recovery tanks are busy.', 2000)
      return
    }

    this.assignRecoveryTankToWreck(availableTank, wreck, mapGrid, { mode: 'recycle', suppressNotifications: false })
  }

  handleDamagedUnitToRecoveryTankCommand(selectedUnits, recoveryTank, mapGrid) {
    const damagedUnits = selectedUnits.filter(unit => unit.health < unit.maxHealth && unit.type !== 'recoveryTank')
    if (damagedUnits.length === 0) {
      return
    }

    damagedUnits.forEach(unit => {
      // Calculate the position where the damaged unit should move to get repaired
      const tankTileX = recoveryTank.tileX
      const tankTileY = recoveryTank.tileY

      // Find a position within 1 tile of the recovery tank
      const repairPositions = [
        { x: tankTileX - 1, y: tankTileY },     // Left
        { x: tankTileX + 1, y: tankTileY },     // Right
        { x: tankTileX, y: tankTileY - 1 },     // Above
        { x: tankTileX, y: tankTileY + 1 },     // Below
        { x: tankTileX - 1, y: tankTileY - 1 }, // Top-left
        { x: tankTileX + 1, y: tankTileY - 1 }, // Top-right
        { x: tankTileX - 1, y: tankTileY + 1 }, // Bottom-left
        { x: tankTileX + 1, y: tankTileY + 1 }  // Bottom-right
      ]

      let destinationFound = false
      for (const pos of repairPositions) {
        if (pos.x >= 0 && pos.y >= 0 && pos.x < mapGrid[0].length && pos.y < mapGrid.length) {
          const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: pos.x, y: pos.y }, mapGrid, gameState.occupancyMap)
          if (path && path.length > 0) {
            unit.path = path.slice(1) // Remove the first node (current position)
            unit.moveTarget = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE }
            unit.target = null // Clear any attack target
            // Set guard mode to protect the recovery tank while being repaired
            unit.guardMode = true
            unit.guardTarget = recoveryTank
            destinationFound = true
            break
          }
        }
      }

      if (!destinationFound) {
        showNotification('Cannot reach recovery tank for repair!', 2000)
      }
    })

    playSound('movement', 0.5)
  }

  /**
   * Calculate semicircle attack formation positions around a target
   */
  calculateSemicircleFormation(units, target, safeAttackDistance) {
    const positions = []
    const unitCount = units.length

    // Get target center point
    const targetCenter = this.getTargetPoint(target, { x: 0, y: 0 })

    if (unitCount === 1) {
      // Single unit - position directly in front
      const angle = 0 // Face the target directly
      const x = targetCenter.x - Math.cos(angle) * safeAttackDistance
      const y = targetCenter.y - Math.sin(angle) * safeAttackDistance
      positions.push({ x, y })
    } else {
      // Multiple units - arrange in semicircle
      const arcSpan = Math.PI // 180 degrees
      const angleStep = arcSpan / Math.max(1, unitCount - 1)
      const startAngle = -arcSpan / 2 // Start from left side

      for (let i = 0; i < unitCount; i++) {
        const angle = startAngle + (i * angleStep)
        const x = targetCenter.x - Math.cos(angle) * safeAttackDistance
        const y = targetCenter.y - Math.sin(angle) * safeAttackDistance
        positions.push({ x, y })
      }
    }

    return positions
  }

  // Helper: For a given target and unit center, return the appropriate aiming point.
  // For factories, this returns the closest point on the factory rectangle.
  getTargetPoint(target, unitCenter) {
    if (target.tileX !== undefined) {
      return { x: target.x + TILE_SIZE / 2, y: target.y + TILE_SIZE / 2 }
    } else {
      const rect = {
        x: target.x * TILE_SIZE,
        y: target.y * TILE_SIZE,
        width: target.width * TILE_SIZE,
        height: target.height * TILE_SIZE
      }
      return {
        x: Math.max(rect.x, Math.min(unitCenter.x, rect.x + rect.width)),
        y: Math.max(rect.y, Math.min(unitCenter.y, rect.y + rect.height))
      }
    }
  }
}
