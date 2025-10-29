import { GAS_REFILL_TIME, TANKER_SUPPLY_CAPACITY, SERVICE_DISCOVERY_RANGE, SERVICE_SERVING_RANGE } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { findPath } from '../units.js'
import { stopUnitMovement } from './unifiedMovement.js'
import { getUnitCommandsHandler } from '../inputHandler.js'

function clearAwaitingRefuelState(unit, tankerId = null) {
  if (!unit) return
  if (unit.awaitingRefuel && (!unit.awaitingRefuelTankerId || tankerId === null || unit.awaitingRefuelTankerId === tankerId)) {
    unit.awaitingRefuel = false
    unit.awaitingRefuelTankerId = null
    unit.awaitingRefuelAssignedAt = null
  }
}

export const updateTankerTruckLogic = logPerformance(function(units, gameState, delta) {
  const tankers = units.filter(u => u.type === 'tankerTruck' && u.health > 0)
  if (tankers.length === 0) return

  // IMMEDIATE RESPONSE: Check for units that just ran out of gas completely
  handleEmergencyFuelRequests(tankers, units, gameState)

  const unitCommands = getUnitCommandsHandler ? getUnitCommandsHandler() : null

  tankers.forEach(tanker => {
    const queueState = tanker.utilityQueue
    const queueActive = queueState && queueState.mode === 'refuel' && (
      (Array.isArray(queueState.targets) && queueState.targets.length > 0) || queueState.currentTargetId
    )
    const now = performance?.now ? performance.now() : Date.now()
    const wasServing = Boolean(tanker._alertWasServing)

    // Tankers need a loader to operate the refueling equipment
    if (tanker.crew && typeof tanker.crew === 'object' && !tanker.crew.loader) {
      tanker.refuelTarget = null
      tanker.emergencyTarget = null
      tanker.refuelTimer = 0
      if (unitCommands) {
        unitCommands.clearUtilityQueueState(tanker)
      }
      return
    }
    // Ensure tanker has proper gas properties initialized
    if (tanker.supplyGas === undefined || tanker.maxSupplyGas === undefined) {
      tanker.maxSupplyGas = TANKER_SUPPLY_CAPACITY
      tanker.supplyGas = TANKER_SUPPLY_CAPACITY
    }

    // Add periodic debugging for tankers
    if (!tanker.lastDebugTime || performance.now() - tanker.lastDebugTime > 5000) {
      const nearbyUnits = units.filter(u =>
        u.id !== tanker.id &&
        u.owner === tanker.owner &&
        typeof u.maxGas === 'number' &&
        Math.abs(u.tileX - tanker.tileX) <= 2 &&
        Math.abs(u.tileY - tanker.tileY) <= 2
      )
      if (nearbyUnits.length > 0) {
        nearbyUnits.forEach(u => {
          const distance = Math.abs(u.tileX - tanker.tileX) + Math.abs(u.tileY - tanker.tileY)
          const gasPercent = Math.round((u.gas / u.maxGas) * 100)
          const needsFuel = u.gas < (u.maxGas * 0.95) ? ' NEEDS FUEL' : ' (full)'
        })
      }
      tanker.lastDebugTime = performance.now()
    }

    // Handle emergency refueling missions first
    if (queueActive) {
      tanker.emergencyTarget = null
      tanker.emergencyMode = false
      tanker.emergencyStartTime = null
    } else if (tanker.emergencyTarget) {
      const emergencyUnit = units.find(u => u.id === tanker.emergencyTarget.id)

      // Clear emergency mission if target is gone, healthy, or has sufficient fuel
      if (!emergencyUnit || emergencyUnit.health <= 0 ||
          (emergencyUnit.gas > emergencyUnit.maxGas * 0.1 && !emergencyUnit.needsEmergencyFuel)) {
        tanker.emergencyTarget = null
        tanker.emergencyMode = false
        tanker.emergencyStartTime = null
      } else {
        // Check if we're close enough to start refueling (any surrounding tile)
        const distance = Math.hypot(emergencyUnit.tileX - tanker.tileX, emergencyUnit.tileY - tanker.tileY)
        if (distance <= SERVICE_SERVING_RANGE && !(emergencyUnit.movement && emergencyUnit.movement.isMoving)) {
          // Start emergency refueling
          tanker.refuelTarget = emergencyUnit
          tanker.refuelTimer = 0
          stopUnitMovement(tanker)
          tanker.moveTarget = null
          tanker.emergencyTarget = null // Clear emergency flag once refueling starts
        }
        // Skip normal logic while on emergency mission
        return
      }
    }

    if (!tanker.alertMode) {
      tanker.alertActiveService = false
      tanker.alertAssignmentId = null
      tanker.nextUtilityScanTime = null
    }

    const canAutoScan = tanker.alertMode && !tanker.refuelTarget && !queueActive && !tanker.emergencyTarget && !tanker.emergencyMode
    if (canAutoScan && unitCommands) {
      const nextScan = tanker.nextUtilityScanTime || 0
      if (now >= nextScan) {
        const candidates = units
          .filter(u =>
            u.id !== tanker.id &&
            u.owner === tanker.owner &&
            typeof u.maxGas === 'number' &&
            u.gas < (u.maxGas * 0.95) &&
            u.health > 0 &&
            !(u.movement && u.movement.isMoving)
          )
          .map(u => ({
            unit: u,
            distance: Math.hypot(u.tileX - tanker.tileX, u.tileY - tanker.tileY)
          }))
          .filter(entry => entry.distance <= SERVICE_DISCOVERY_RANGE)
          .sort((a, b) => a.distance - b.distance)

        const targetEntry = candidates[0]

        if (targetEntry) {
          const assigned = unitCommands.assignTankerToTarget(tanker, targetEntry.unit, gameState.mapGrid, {
            suppressNotifications: true
          })
          if (assigned) {
            tanker.alertActiveService = true
            tanker.alertAssignmentId = targetEntry.unit.id
          } else {
            tanker.nextUtilityScanTime = now + 2000
          }
        } else {
          tanker.nextUtilityScanTime = now + 2000
        }
      }
    }

    if (!tanker.refuelTarget && !queueActive && !tanker.alertMode) {
      // This logic is now mainly for player-controlled tankers that get close without a specific target
      // AI tankers should have refuelTarget set by the AI strategy system
      const target = units.find(u =>
        u.id !== tanker.id &&
        u.owner === tanker.owner &&
        typeof u.maxGas === 'number' &&
        u.gas < (u.maxGas * 0.95) && // Only refuel if unit has less than 95% gas
        u.health > 0 && // Ensure target is alive
        Math.hypot(u.tileX - tanker.tileX, u.tileY - tanker.tileY) <= SERVICE_SERVING_RANGE &&
        !(u.movement && u.movement.isMoving)
      )
      if (target && (tanker.supplyGas > 0 || tanker.supplyGas === undefined)) {
        // Initialize supply gas if not set
        if (tanker.supplyGas === undefined) {
          tanker.maxSupplyGas = TANKER_SUPPLY_CAPACITY
          tanker.supplyGas = TANKER_SUPPLY_CAPACITY
        }

        if (tanker.supplyGas > 0) {
          tanker.refuelTarget = target
          tanker.refuelTimer = 0
          stopUnitMovement(tanker)
          tanker.moveTarget = null
        }
      }
    }

    if (tanker.refuelTarget) {
      const target = units.find(u => u.id === tanker.refuelTarget.id)

      if (target && tanker.refuelTarget !== target) {
        tanker.refuelTarget = target
      }

      // Debug: Log refuelTarget details
      if (!tanker.lastRefuelDebug || performance.now() - tanker.lastRefuelDebug > 2000) {
        tanker.lastRefuelDebug = performance.now()
      }

      const distanceToTarget = target ? Math.hypot(target.tileX - tanker.tileX, target.tileY - tanker.tileY) : Infinity
      const targetMoving = Boolean(target?.movement && target.movement.isMoving)
      const wasRefueling = Boolean(tanker.refueling || target?.refueling)
      const targetHasGasStats = target && typeof target.maxGas === 'number'
      const tankerSupplyIsNumber = typeof tanker.supplyGas === 'number'
      if (!target ||
          target.health <= 0 ||
          targetMoving ||
          !targetHasGasStats) {
        const distance = target ? Math.abs(target.tileX - tanker.tileX) + Math.abs(target.tileY - tanker.tileY) : 'N/A'

        if (target) {
          target.refueling = false
          clearAwaitingRefuelState(target, tanker.id)
        }
        tanker.refueling = false
        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      } else if (distanceToTarget > SERVICE_SERVING_RANGE) {
        if (target) {
          target.refueling = false
          if (wasRefueling) {
            clearAwaitingRefuelState(target, tanker.id)
          }
        }
        tanker.refueling = false
        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      } else if ((tankerSupplyIsNumber ? tanker.supplyGas > 0 : true) && (target.gas ?? 0) < (target.maxGas * 0.95)) {
        if (!tankerSupplyIsNumber) {
          tanker.maxSupplyGas = tanker.maxSupplyGas ?? TANKER_SUPPLY_CAPACITY
          tanker.supplyGas = tanker.maxSupplyGas
        }

        if (typeof target.gas !== 'number' || Number.isNaN(target.gas)) {
          target.gas = 0
        }

        // Log when tanker starts refueling (within serving range)
        if (!tanker.refuelTimer || tanker.refuelTimer === 0) {
        }
        if (!tanker.refueling) {
          stopUnitMovement(tanker)
          tanker.moveTarget = null
          tanker.path = []
        }
        if (!target.refueling) {
          stopUnitMovement(target)
          target.moveTarget = null
          target.path = []
        }
        tanker.refueling = true
        target.refueling = true
        if (target.awaitingRefuelTankerId === tanker.id) {
          target.awaitingRefuel = true
        }
        // Emergency units get faster refueling rate
        const isEmergencyRefuel = target.gas <= 0
        const baseRate = target.maxGas / GAS_REFILL_TIME
        const fillRate = isEmergencyRefuel ? baseRate * 2 : baseRate // 2x speed for emergency

        const availableGas = Math.max(0, tanker.supplyGas)
        const gasNeeded = Math.max(0, target.maxGas - target.gas)
        const transfer = Math.min(fillRate * delta, gasNeeded, availableGas)
        tanker.refuelTimer = (tanker.refuelTimer || 0) + delta
        if (transfer > 0) {
          target.gas = Math.min(target.maxGas, target.gas + transfer)
          tanker.supplyGas = availableGas - transfer
        }

        // Log refueling progress occasionally
        if (Math.floor(tanker.refuelTimer / 1000) !== Math.floor((tanker.refuelTimer - delta) / 1000)) {
        }

        // For emergency refueling, only fill to 20% to quickly get unit moving
        // For normal refueling, fill to 98% to avoid floating point precision issues
        const emergencyThreshold = isEmergencyRefuel ? target.maxGas * 0.2 : target.maxGas * 0.98

        if (target.gas >= emergencyThreshold || tanker.supplyGas <= 0 || tanker.refuelTimer >= GAS_REFILL_TIME) {
          if (target.gas > target.maxGas) target.gas = target.maxGas


          // Clear emergency flags when unit is refueled
          if (target.gas > 0) {
            target.needsEmergencyFuel = false
            target.emergencyFuelRequestTime = null
            target.outOfGasPlayed = false // Reset for future out-of-gas events
          }

          clearAwaitingRefuelState(target, tanker.id)
          target.refueling = false
          tanker.refueling = false
          tanker.refuelTarget = null
          tanker.refuelTimer = 0
          tanker.emergencyMode = false // Clear emergency mode after successful refuel
        }
      } else {

        if (target) {
          target.refueling = false
          clearAwaitingRefuelState(target, tanker.id)
        }
        tanker.refueling = false
        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      }
    }

    if (queueState && queueState.mode === 'refuel') {
      if (!tanker.refuelTarget) {
        if (queueState.currentTargetId || queueState.currentTargetType) {
          queueState.currentTargetId = null
          queueState.currentTargetType = null
        }
        if (unitCommands) {
          unitCommands.advanceUtilityQueue(tanker, gameState.mapGrid, true)
        }
      } else if (queueState.currentTargetId !== tanker.refuelTarget.id || queueState.currentTargetType !== 'unit') {
        queueState.currentTargetId = tanker.refuelTarget.id
        queueState.currentTargetType = 'unit'
      }
    }

    const isCurrentlyServing = Boolean(tanker.refuelTarget)
    if (wasServing && !isCurrentlyServing) {
      tanker.alertActiveService = false
      tanker.alertAssignmentId = null
      tanker.nextUtilityScanTime = now + 2000
    }
    if (isCurrentlyServing) {
      tanker.alertActiveService = true
    }
    tanker._alertWasServing = isCurrentlyServing
  })
})

/**
 * Handles immediate emergency fuel requests for units that just ran out of gas
 * This ensures tanker trucks respond immediately to completely out-of-gas units
 */
function handleEmergencyFuelRequests(tankers, units, gameState) {
  // Group units and tankers by owner
  const playerGroups = {}

  units.forEach(unit => {
    if (!playerGroups[unit.owner]) {
      playerGroups[unit.owner] = { units: [], tankers: [] }
    }
    if (unit.type === 'tankerTruck' && unit.health > 0) {
      playerGroups[unit.owner].tankers.push(unit)
    } else if (typeof unit.maxGas === 'number' && unit.health > 0) {
      playerGroups[unit.owner].units.push(unit)
    }
  })

  // Process each player's emergency fuel requests
  Object.entries(playerGroups).forEach(([_, group]) => {
    const { units: playerUnits, tankers: playerTankers } = group

    // Find units that have triggered an emergency fuel request and are stopped
    const criticalUnits = playerUnits.filter(u =>
      (u.needsEmergencyFuel && u.emergencyFuelRequestTime && (!u.movement || !u.movement.isMoving))
    )

    if (criticalUnits.length === 0 || playerTankers.length === 0) return

    // For each critical unit, find the best available tanker
    criticalUnits.forEach(criticalUnit => {
      // Skip if unit already has a tanker assigned or on the way
      const alreadyAssigned = playerTankers.some(tanker =>
        (tanker.emergencyTarget && tanker.emergencyTarget.id === criticalUnit.id) ||
        (tanker.refuelTarget && tanker.refuelTarget.id === criticalUnit.id)
      )
      if (alreadyAssigned) return

      // Find the closest available tanker with fuel supply
      let bestTanker = null
      let bestDistance = Infinity

      playerTankers.forEach(tanker => {
        // Skip tankers without fuel supply
        if (!tanker.supplyGas || tanker.supplyGas <= 0) return

        // Skip tankers that need refilling themselves
        if (typeof tanker.maxGas === 'number' && tanker.gas / tanker.maxGas < 0.1) return

        const distance = Math.hypot(
          tanker.tileX - criticalUnit.tileX,
          tanker.tileY - criticalUnit.tileY
        )

        // Prefer tankers that are not currently on high-priority missions
        const isAvailable = !tanker.emergencyTarget &&
                           (!tanker.refuelTarget || tanker.refuelTarget.gas > 0)

        const adjustedDistance = isAvailable ? distance : distance * 1.5

        if (adjustedDistance < bestDistance) {
          bestDistance = adjustedDistance
          bestTanker = tanker
        }
      })

      if (bestTanker) {
        // Interrupt current non-emergency tasks
        if (bestTanker.refuelTarget && bestTanker.refuelTarget.gas > 0) {
          bestTanker.refuelTarget = null
          bestTanker.refuelTimer = 0
        }

        // Clear non-emergency paths and targets
        if (!bestTanker.emergencyTarget) {
          bestTanker.guardTarget = null
        }

        // Assign emergency mission
        bestTanker.emergencyTarget = criticalUnit
        assignTankerToEmergencyUnit(bestTanker, criticalUnit, gameState)
        criticalUnit.emergencyFuelRequestTime = null
      }
    })
  })
}

/**
 * Assigns a tanker truck to immediately move to an emergency unit
 */
function assignTankerToEmergencyUnit(tanker, emergencyUnit, gameState) {
  // Set the refuel target BEFORE pathfinding, just like player tanker commands
  tanker.refuelTarget = emergencyUnit
  tanker.refuelTimer = 0

  // Calculate path to emergency unit - find adjacent position like player commands
  const mapGrid = gameState.mapGrid
  if (!mapGrid) return

  const targetTileX = emergencyUnit.tileX
  const targetTileY = emergencyUnit.tileY
  const directions = [
    // Prefer actual adjacent tiles first, fall back to the unit tile
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
    { x: 0, y: 0 }
  ]

  for (const dir of directions) {
    const destX = targetTileX + dir.x
    const destY = targetTileY + dir.y
    if (destX >= 0 && destY >= 0 && destX < mapGrid[0].length && destY < mapGrid.length) {
      const path = findPath(
        { x: tanker.tileX, y: tanker.tileY },
        { x: destX, y: destY },
        mapGrid,
        gameState.occupancyMap
      )
      if (path && path.length > 0) {
        tanker.path = path.slice(1)
        const finalTile = path[path.length - 1]
        tanker.moveTarget = { x: finalTile.x, y: finalTile.y }
        break
      }
    }
  }

  // Mark this as high priority
  tanker.emergencyMode = true
  tanker.emergencyStartTime = performance.now()
}
