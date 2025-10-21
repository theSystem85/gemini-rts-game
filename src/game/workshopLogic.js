import { TILE_SIZE } from '../config.js'
import { findPath, createUnit } from '../units.js'
import { updateUnitSpeedModifier, getUnitCost } from '../utils.js'
import { gameState } from '../gameState.js'
import { playSound } from '../sound.js'
import { logPerformance } from '../performanceUtils.js'
import { getWreckById, removeWreckById } from './unitWreckManager.js'

function initWorkshop(workshop) {
  if (!workshop.repairSlots) {
    workshop.repairSlots = []
    for (let x = workshop.x - 1; x <= workshop.x + workshop.width; x++) {
      for (let y = workshop.y - 1; y <= workshop.y + workshop.height; y++) {
        const around = x === workshop.x - 1 || x === workshop.x + workshop.width ||
                       y === workshop.y - 1 || y === workshop.y + workshop.height
        if (around) {
          workshop.repairSlots.push({ x, y, unit: null })
        }
      }
    }
    workshop.repairQueue = []
  }
}

function assignUnitsToSlots(workshop, mapGrid) {
  initWorkshop(workshop)

  // Process queue in order - only assign the first eligible unit to avoid congestion
  let index = 0
  while (index < workshop.repairQueue.length) {
    const slot = workshop.repairSlots.find(s => !s.unit)
    if (!slot) break // No available slots

    const unit = workshop.repairQueue[index]
    if (!unit || unit.health <= 0) {
      if (unit) {
        delete unit.workshopRepairCost
        delete unit.workshopRepairPaid
        delete unit.workshopStartHealth
        delete unit.targetWorkshop
      }
      workshop.repairQueue.splice(index, 1)
      continue
    }

    const distToWorkshop = Math.hypot(
      unit.tileX - (workshop.x + workshop.width / 2),
      unit.tileY - (workshop.y + workshop.height / 2)
    )

    if (distToWorkshop <= 3) {
      workshop.repairQueue.splice(index, 1)
      slot.unit = unit
      unit.repairSlot = slot

      const path = findPath(
        { x: unit.tileX, y: unit.tileY },
        { x: slot.x, y: slot.y },
        mapGrid,
        gameState.occupancyMap
      )

      if (path && path.length > 1) {
        unit.path = path.slice(1)
        unit.moveTarget = { x: slot.x, y: slot.y }
      } else {
        unit.x = slot.x * TILE_SIZE
        unit.y = slot.y * TILE_SIZE
        unit.tileX = slot.x
        unit.tileY = slot.y
      }

      // Only assign one unit per update cycle to prevent congestion
      break
    } else {
      index++
    }
  }
}

function processWorkshopRestoration(workshop, units, mapGrid, delta) {
  // Initialize restoration queue if not present
  if (!workshop.restorationQueue) {
    workshop.restorationQueue = []
  }

  // Check if workshop is currently restoring something
  if (workshop.currentRestoration) {
    const restoration = workshop.currentRestoration

    // Check if wreck still exists
    const wreck = getWreckById(gameState, restoration.wreckId)
    if (!wreck) {
      // Wreck was destroyed, cancel restoration
      workshop.currentRestoration = null
      workshop.restorationProgress = 0
      playSound('repairCancelled', 0.6)
      return
    }

    // Update restoration progress
    restoration.elapsed = (restoration.elapsed || 0) + delta
    const progress = Math.min(restoration.elapsed / restoration.buildDuration, 1)
    workshop.restorationProgress = progress

    // Position wreck on workshop center during restoration
    const centerTileX = Math.floor(workshop.x + workshop.width / 2)
    const centerTileY = Math.floor(workshop.y + workshop.height / 2)
    wreck.x = centerTileX * TILE_SIZE
    wreck.y = centerTileY * TILE_SIZE
    wreck.tileX = centerTileX
    wreck.tileY = centerTileY
    wreck.isBeingRestored = true

    // Check if restoration is complete
    if (progress >= 1) {
      // Create restored unit
      const rallyPoint = workshop.rallyPoint || { x: centerTileX, y: centerTileY }
      const restored = createUnit(
        { owner: workshop.owner },
        restoration.unitType,
        rallyPoint.x,
        rallyPoint.y,
        { buildDuration: restoration.buildDuration }
      )

      // Reset crew to alive state
      if (restored.crew) {
        Object.keys(restored.crew).forEach(role => {
          restored.crew[role] = true
        })
      }

      // Set unit to full health
      restored.health = restored.maxHealth
      restored.x = rallyPoint.x * TILE_SIZE
      restored.y = rallyPoint.y * TILE_SIZE
      restored.tileX = rallyPoint.x
      restored.tileY = rallyPoint.y

      // Face southwest
      restored.direction = Math.PI * 5 / 4 // 225 degrees
      if (restored.turretDirection !== undefined) {
        restored.turretDirection = Math.PI * 5 / 4
      }

      units.push(restored)

      // Update occupancy
      const occupancyMap = gameState.occupancyMap
      if (occupancyMap) {
        const centerTileX = Math.floor((restored.x + TILE_SIZE / 2) / TILE_SIZE)
        const centerTileY = Math.floor((restored.y + TILE_SIZE / 2) / TILE_SIZE)
        if (
          centerTileY >= 0 &&
          centerTileY < occupancyMap.length &&
          centerTileX >= 0 &&
          centerTileX < occupancyMap[0].length
        ) {
          occupancyMap[centerTileY][centerTileX] = (occupancyMap[centerTileY][centerTileX] || 0) + 1
        }
      }

      // Remove wreck
      removeWreckById(gameState, wreck.id)

      // Clear restoration state
      workshop.currentRestoration = null
      workshop.restorationProgress = 0

      // Play completion sound
      playSound('repairFinished', 0.8)
    }
  } else if (workshop.restorationQueue.length > 0) {
    // Start next restoration
    const nextInQueue = workshop.restorationQueue.shift()
    const wreck = getWreckById(gameState, nextInQueue.wreckId)

    if (wreck) {
      // Start restoration
      workshop.currentRestoration = {
        wreckId: nextInQueue.wreckId,
        unitType: nextInQueue.unitType,
        buildDuration: nextInQueue.buildDuration,
        elapsed: 0,
        startedAt: performance.now()
      }
      workshop.restorationProgress = 0

      // Position wreck on workshop center
      const centerTileX = Math.floor(workshop.x + workshop.width / 2)
      const centerTileY = Math.floor(workshop.y + workshop.height / 2)
      wreck.x = centerTileX * TILE_SIZE
      wreck.y = centerTileY * TILE_SIZE
      wreck.tileX = centerTileX
      wreck.tileY = centerTileY
      wreck.isBeingRestored = true

      // Update occupancy for wreck
      const occupancyMap = gameState.occupancyMap
      if (occupancyMap) {
        const centerX = Math.floor((wreck.x + TILE_SIZE / 2) / TILE_SIZE)
        const centerY = Math.floor((wreck.y + TILE_SIZE / 2) / TILE_SIZE)
        if (
          centerY >= 0 &&
          centerY < occupancyMap.length &&
          centerX >= 0 &&
          centerX < occupancyMap[0].length
        ) {
          // Note: We should use adjustWreckOccupancy from unitWreckManager but it's not exported
          // For now, we'll handle it directly
          if (wreck.occupancyTileX !== null && wreck.occupancyTileY !== null) {
            const prevY = wreck.occupancyTileY
            const prevX = wreck.occupancyTileX
            if (
              prevY >= 0 &&
              prevY < occupancyMap.length &&
              prevX >= 0 &&
              prevX < occupancyMap[prevY].length
            ) {
              occupancyMap[prevY][prevX] = Math.max(0, (occupancyMap[prevY][prevX] || 0) - 1)
            }
          }
          occupancyMap[centerY][centerX] = (occupancyMap[centerY][centerX] || 0) + 1
          wreck.occupancyTileX = centerX
          wreck.occupancyTileY = centerY
        }
      }

      playSound('unit_is_being_repaired', 0.7)
    }
  }
}

export const updateWorkshopLogic = logPerformance(function updateWorkshopLogic(units, buildings, mapGrid, delta) {
  const workshops = buildings.filter(b => b.type === 'vehicleWorkshop')
  workshops.forEach(workshop => {
    initWorkshop(workshop)

    // Process workshop restoration queue
    processWorkshopRestoration(workshop, units, mapGrid, delta)

    assignUnitsToSlots(workshop, mapGrid)
    workshop.repairSlots.forEach(slot => {
      const unit = slot.unit
      if (!unit) return
      if (unit.health <= 0) {
        // Clean up repair cost tracking and workshop assignment
        delete unit.workshopRepairCost
        delete unit.workshopRepairPaid
        delete unit.workshopStartHealth
        delete unit.targetWorkshop
        slot.unit = null
        return
      }
      const dist = Math.hypot(unit.x - slot.x * TILE_SIZE, unit.y - slot.y * TILE_SIZE)

      // Check if unit has been moved away from workshop (new path or move target)
      if (unit.repairingAtWorkshop && (
        unit.path.length > 0 ||
          (unit.moveTarget && (unit.moveTarget.x !== slot.x || unit.moveTarget.y !== slot.y)) ||
          (unit.movement && unit.movement.isMoving)
      )) {
        // Unit is being moved away, clean up repair state and workshop assignment
        unit.repairingAtWorkshop = false
        unit.returningToWorkshop = false
        slot.unit = null
        unit.repairSlot = null
        delete unit.workshopRepairCost
        delete unit.workshopRepairPaid
        delete unit.workshopStartHealth
        delete unit.targetWorkshop
        return
      }
      if (!unit.repairingAtWorkshop) {
        if (dist < TILE_SIZE / 3 && !(unit.movement && unit.movement.isMoving)) {
          unit.repairingAtWorkshop = true
          unit.path = []
          unit.moveTarget = null

          // Calculate repair cost (30% of unit cost based on missing health)
          const unitCost = getUnitCost(unit.type)
          const healthPercentageMissing = (unit.maxHealth - unit.health) / unit.maxHealth
          const totalRepairCost = Math.ceil(unitCost * 0.3 * healthPercentageMissing)

          // Initialize repair cost tracking
          unit.workshopRepairCost = totalRepairCost
          unit.workshopRepairPaid = 0
          unit.workshopStartHealth = unit.health

          // Play repair sound when repair starts
          playSound('unit_is_being_repaired', 0.7)

          if (unit.movement) {
            unit.movement.velocity = { x: 0, y: 0 }
            unit.movement.targetVelocity = { x: 0, y: 0 }
            unit.movement.isMoving = false
            unit.movement.currentSpeed = 0
          }
        }
      } else {
        if (unit.health < unit.maxHealth) {
          // Calculate how much health to restore this frame
          const healthIncrease = unit.maxHealth * 0.06 * (delta / 1000)
          const newHealth = Math.min(unit.health + healthIncrease, unit.maxHealth)

          // Calculate cost for this health increase
          if (unit.workshopRepairCost && unit.workshopRepairPaid < unit.workshopRepairCost) {
            const healthRepaired = newHealth - unit.workshopStartHealth
            const totalHealthToRepair = unit.maxHealth - unit.workshopStartHealth
            const repairProgress = totalHealthToRepair > 0 ? healthRepaired / totalHealthToRepair : 1

            const expectedPaid = Math.min(repairProgress * unit.workshopRepairCost, unit.workshopRepairCost)
            const costThisFrame = expectedPaid - unit.workshopRepairPaid

            if (costThisFrame > 0 && gameState.money >= costThisFrame) {
              gameState.money -= costThisFrame
              unit.workshopRepairPaid += costThisFrame
            }
          }

          unit.health = newHealth
          updateUnitSpeedModifier(unit)
        } else {
          // Repair complete - clean up cost tracking and workshop assignment
          unit.repairingAtWorkshop = false
          unit.returningToWorkshop = false
          slot.unit = null
          unit.repairSlot = null
          delete unit.workshopRepairCost
          delete unit.workshopRepairPaid
          delete unit.workshopStartHealth
          delete unit.targetWorkshop // Clear workshop assignment

          if (unit.returnTile) {
            const path = findPath({ x: unit.tileX, y: unit.tileY }, unit.returnTile, mapGrid, gameState.occupancyMap)
            if (path && path.length > 1) {
              unit.path = path.slice(1)
              unit.moveTarget = { x: unit.returnTile.x, y: unit.returnTile.y }
              unit.returningFromWorkshop = true
            } else {
              unit.returningFromWorkshop = false
              unit.returnTile = null
            }
          } else if (workshop.rallyPoint) {
            const path = findPath({ x: unit.tileX, y: unit.tileY }, workshop.rallyPoint, mapGrid, gameState.occupancyMap)
            if (path && path.length > 1) {
              unit.path = path.slice(1)
              unit.moveTarget = { x: workshop.rallyPoint.x, y: workshop.rallyPoint.y }
            }
          }
          assignUnitsToSlots(workshop, mapGrid)
        }
      }
    })
  })
}, false)
