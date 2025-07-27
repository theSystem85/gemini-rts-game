import { GAS_REFILL_TIME, TANKER_SUPPLY_CAPACITY } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { findPath } from '../units.js'

export const updateTankerTruckLogic = logPerformance(function(units, gameState, delta) {
  const tankers = units.filter(u => u.type === 'tankerTruck' && u.health > 0)
  if (tankers.length === 0) return

  // IMMEDIATE RESPONSE: Check for units that just ran out of gas completely
  handleEmergencyFuelRequests(tankers, units, gameState)

  tankers.forEach(tanker => {
    // Tankers need a loader to operate the refueling equipment
    if (tanker.crew && typeof tanker.crew === 'object' && !tanker.crew.loader) {
      tanker.refuelTarget = null
      tanker.emergencyTarget = null
      tanker.refuelTimer = 0
      return
    }
    // Ensure tanker has proper gas properties initialized
    if (tanker.supplyGas === undefined || tanker.maxSupplyGas === undefined) {
      tanker.maxSupplyGas = TANKER_SUPPLY_CAPACITY
      tanker.supplyGas = TANKER_SUPPLY_CAPACITY
      console.log(`Tanker ${tanker.id} supply gas initialized to ${TANKER_SUPPLY_CAPACITY}`)
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
        console.log(`Tanker ${tanker.id} near ${nearbyUnits.length} units. SupplyGas: ${tanker.supplyGas}/${tanker.maxSupplyGas}`)
        nearbyUnits.forEach(u => {
          const distance = Math.abs(u.tileX - tanker.tileX) + Math.abs(u.tileY - tanker.tileY)
          const gasPercent = Math.round((u.gas / u.maxGas) * 100)
          const needsFuel = u.gas < (u.maxGas * 0.95) ? ' NEEDS FUEL' : ' (full)'
          console.log(`  - ${u.type} ${u.id}: ${Math.round(u.gas)}/${u.maxGas} gas (${gasPercent}%), distance: ${distance}${needsFuel}`)
        })
      }
      tanker.lastDebugTime = performance.now()
    }

    // Handle emergency refueling missions first
    if (tanker.emergencyTarget) {
      const emergencyUnit = units.find(u => u.id === tanker.emergencyTarget.id)

      // Clear emergency mission if target is gone, healthy, or has sufficient fuel
      if (!emergencyUnit || emergencyUnit.health <= 0 ||
          (emergencyUnit.gas > emergencyUnit.maxGas * 0.1 && !emergencyUnit.needsEmergencyFuel)) {
        tanker.emergencyTarget = null
        tanker.emergencyMode = false
        tanker.emergencyStartTime = null
      } else {
        // Check if we're close enough to start refueling (any surrounding tile)
        const dx = Math.abs(emergencyUnit.tileX - tanker.tileX)
        const dy = Math.abs(emergencyUnit.tileY - tanker.tileY)
        if (dx <= 1 && dy <= 1 && !(emergencyUnit.movement && emergencyUnit.movement.isMoving)) {
          // Start emergency refueling
          tanker.refuelTarget = emergencyUnit
          tanker.refuelTimer = 0
          tanker.emergencyTarget = null // Clear emergency flag once refueling starts
        }
        // Skip normal logic while on emergency mission
        return
      }
    }

    if (!tanker.refuelTarget) {
      // This logic is now mainly for player-controlled tankers that get close without a specific target
      // AI tankers should have refuelTarget set by the AI strategy system
      const target = units.find(u =>
        u.id !== tanker.id &&
        u.owner === tanker.owner &&
        typeof u.maxGas === 'number' &&
        u.gas < (u.maxGas * 0.95) && // Only refuel if unit has less than 95% gas
        u.health > 0 && // Ensure target is alive
        Math.abs(u.tileX - tanker.tileX) <= 1 &&
        Math.abs(u.tileY - tanker.tileY) <= 1 &&
        !(u.movement && u.movement.isMoving)
      )
      if (target && (tanker.supplyGas > 0 || tanker.supplyGas === undefined)) {
        // Initialize supply gas if not set
        if (tanker.supplyGas === undefined) {
          tanker.maxSupplyGas = TANKER_SUPPLY_CAPACITY
          tanker.supplyGas = TANKER_SUPPLY_CAPACITY
          console.log(`Tanker ${tanker.id} supply gas initialized to ${TANKER_SUPPLY_CAPACITY}`)
        }

        if (tanker.supplyGas > 0) {
          tanker.refuelTarget = target
          tanker.refuelTimer = 0
          // Clear movement when starting to refuel adjacent units (for player-controlled tankers)
          if (tanker.owner === gameState.humanPlayer) {
            tanker.path = []
            tanker.moveTarget = null
          }
          console.log(`Tanker ${tanker.id} starting to refuel ${target.type} ${target.id} (${Math.round(target.gas)}/${target.maxGas} gas, ${Math.round((target.gas / target.maxGas) * 100)}%)`)
        } else {
          console.log(`Tanker ${tanker.id} found target but cannot refuel - supplyGas: ${tanker.supplyGas}`)
        }
      }
    }

    if (tanker.refuelTarget) {
      const target = units.find(u => u.id === tanker.refuelTarget.id)

      // Debug: Log refuelTarget details
      if (!tanker.lastRefuelDebug || performance.now() - tanker.lastRefuelDebug > 2000) {
        console.log(`DEBUG: Tanker ${tanker.id} has refuelTarget:`, {
          refuelTargetId: tanker.refuelTarget.id,
          refuelTargetType: tanker.refuelTarget.type,
          targetFound: !!target,
          targetId: target?.id,
          targetType: target?.type,
          targetGas: target ? `${Math.round(target.gas)}/${target.maxGas}` : 'N/A',
          distance: target ? Math.abs(target.tileX - tanker.tileX) + Math.abs(target.tileY - tanker.tileY) : 'N/A'
        })
        tanker.lastRefuelDebug = performance.now()
      }

      if (!target ||
          target.health <= 0 ||
          Math.abs(target.tileX - tanker.tileX) > 1 ||
          Math.abs(target.tileY - tanker.tileY) > 1 ||
          (target.movement && target.movement.isMoving)) {
        const distance = target ? Math.abs(target.tileX - tanker.tileX) + Math.abs(target.tileY - tanker.tileY) : 'N/A'
        console.log(`Tanker ${tanker.id} lost refuel target - target exists: ${!!target}, distance: ${distance}`)

        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      } else if (tanker.supplyGas > 0 && target.gas < (target.maxGas * 0.95)) {
        // Log when tanker starts refueling (distance <= 1)
        if (!tanker.refuelTimer || tanker.refuelTimer === 0) {
          console.log(`Tanker ${tanker.id} starting refuel process for ${target.type} ${target.id} at distance ${Math.abs(target.tileX - tanker.tileX) + Math.abs(target.tileY - tanker.tileY)}`)
        }
        // Emergency units get faster refueling rate
        const isEmergencyRefuel = target.gas <= 0
        const baseRate = target.maxGas / GAS_REFILL_TIME
        const fillRate = isEmergencyRefuel ? baseRate * 2 : baseRate // 2x speed for emergency

        const gasNeeded = target.maxGas - target.gas
        const give = Math.min(fillRate * delta, gasNeeded, tanker.supplyGas)
        tanker.refuelTimer = (tanker.refuelTimer || 0) + delta
        target.gas += give
        tanker.supplyGas -= give

        // Log refueling progress occasionally
        if (Math.floor(tanker.refuelTimer / 1000) !== Math.floor((tanker.refuelTimer - delta) / 1000)) {
          console.log(`Tanker ${tanker.id} refueling ${target.type} ${target.id}: ${Math.round(target.gas)}/${target.maxGas} gas (gave ${Math.round(give)})`)
        }

        // For emergency refueling, only fill to 20% to quickly get unit moving
        // For normal refueling, fill to 98% to avoid floating point precision issues
        const emergencyThreshold = isEmergencyRefuel ? target.maxGas * 0.2 : target.maxGas * 0.98

        if (target.gas >= emergencyThreshold || tanker.supplyGas <= 0 || tanker.refuelTimer >= GAS_REFILL_TIME) {
          if (target.gas > target.maxGas) target.gas = target.maxGas

          console.log(`Tanker ${tanker.id} finished refueling ${target.type} ${target.id}: ${Math.round(target.gas)}/${target.maxGas} gas`)

          // Clear emergency flags when unit is refueled
          if (target.gas > 0) {
            target.needsEmergencyFuel = false
            target.emergencyFuelRequestTime = null
            target.outOfGasPlayed = false // Reset for future out-of-gas events
          }

          tanker.refuelTarget = null
          tanker.refuelTimer = 0
          tanker.emergencyMode = false // Clear emergency mode after successful refuel
        }
      } else {
        console.log(`Tanker ${tanker.id} cannot refuel - supplyGas: ${tanker.supplyGas}, target gas: ${target.gas}/${target.maxGas}`)

        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      }
    }
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

    // Find units completely out of gas (critical emergency) or very low on fuel
    const criticalUnits = playerUnits.filter(u =>
      u.gas <= 0 || u.needsEmergencyFuel || u.gas < (u.maxGas * 0.1) // Emergency if 0 gas or less than 10%
    )

    if (criticalUnits.length === 0 || playerTankers.length === 0) return

    // For each critical unit, find the best available tanker
    criticalUnits.forEach(criticalUnit => {
      // Skip if unit already has a tanker assigned or on the way
      const alreadyAssigned = playerTankers.some(tanker =>
        tanker.emergencyTarget && tanker.emergencyTarget.id === criticalUnit.id
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
