import { TILE_SIZE } from '../config.js'
import { findPath } from '../units.js'
import { updateUnitSpeedModifier } from '../utils.js'
import { gameState } from '../gameState.js'

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
  while (workshop.repairQueue.length > 0) {
    const slot = workshop.repairSlots.find(s => !s.unit)
    if (!slot) break
    const unit = workshop.repairQueue.shift()
    if (!unit || unit.health <= 0) continue
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
  }
}

export function updateWorkshopLogic(units, buildings, mapGrid, delta) {
  const workshops = buildings.filter(b => b.type === 'vehicleWorkshop')
  const now = performance.now()
  workshops.forEach(workshop => {
    initWorkshop(workshop)
    assignUnitsToSlots(workshop, mapGrid)
    workshop.repairSlots.forEach(slot => {
      const unit = slot.unit
      if (!unit) return
      if (unit.health <= 0) { slot.unit = null; return }
      const dist = Math.hypot(unit.x - slot.x * TILE_SIZE, unit.y - slot.y * TILE_SIZE)
      if (!unit.repairingAtWorkshop) {
        if (dist < TILE_SIZE / 3) {
          unit.repairingAtWorkshop = true
          unit.path = []
          unit.moveTarget = null
          if (unit.movement) {
            unit.movement.velocity = { x: 0, y: 0 }
            unit.movement.targetVelocity = { x: 0, y: 0 }
            unit.movement.isMoving = false
            unit.movement.currentSpeed = 0
          }
        }
      } else {
        if (unit.health < unit.maxHealth) {
          unit.health = Math.min(unit.health + unit.maxHealth * 0.03 * (delta / 1000), unit.maxHealth)
          updateUnitSpeedModifier(unit)
        } else {
          unit.repairingAtWorkshop = false
          slot.unit = null
          unit.repairSlot = null
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
}
