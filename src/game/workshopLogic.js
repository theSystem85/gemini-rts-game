import { TILE_SIZE } from '../config.js'
import { findPath } from '../units.js'
import { updateUnitSpeedModifier, getUnitCost } from '../utils.js'
import { gameState } from '../gameState.js'
import { playSound } from '../sound.js'
import { logPerformance } from '../performanceUtils.js'

function initWorkshop(workshop) {
  if (!workshop.repairSlots) {
    workshop.repairSlots = []
    for (let i = 0; i < 3; i++) {
      workshop.repairSlots.push({ x: workshop.x + i, y: workshop.y + workshop.height, unit: null })
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
      // Clean up repair cost tracking and workshop assignment if unit is removed from queue
      if (unit) {
        delete unit.workshopRepairCost
        delete unit.workshopRepairPaid
        delete unit.workshopStartHealth
        delete unit.targetWorkshop
      }
      workshop.repairQueue.splice(index, 1)
      continue
    }
    
    // Check if unit is in the waiting area or close enough to workshop
    const waitingAreaY = workshop.y + workshop.height + 1
    const isInWaitingArea = (unit.tileY === waitingAreaY && 
                            unit.tileX >= workshop.x && 
                            unit.tileX < workshop.x + workshop.width)
    const distToWorkshop = Math.hypot(unit.tileX - (workshop.x + 1), unit.tileY - (workshop.y + workshop.height))
    
    if (isInWaitingArea || distToWorkshop <= 2) {
      // Unit is ready to be assigned to a repair slot
      workshop.repairQueue.splice(index, 1)
      slot.unit = unit
      unit.repairSlot = slot
      
      const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: slot.x, y: slot.y }, mapGrid, gameState.occupancyMap)
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
      // Unit not in position yet, continue to next
      index++
    }
  }
}

export const updateWorkshopLogic = logPerformance(function updateWorkshopLogic(units, buildings, mapGrid, delta) {
  const workshops = buildings.filter(b => b.type === 'vehicleWorkshop')
  const now = performance.now()
  workshops.forEach(workshop => {
    initWorkshop(workshop)
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
      if (unit.repairingAtWorkshop && (unit.path.length > 0 || (unit.moveTarget && (unit.moveTarget.x !== slot.x || unit.moveTarget.y !== slot.y)))) {
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
        if (dist < TILE_SIZE / 3) {
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
          const healthIncrease = unit.maxHealth * 0.03 * (delta / 1000)
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
          
          if (workshop.rallyPoint) {
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
