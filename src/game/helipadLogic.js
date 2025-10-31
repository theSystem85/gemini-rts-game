import { HELIPAD_FUEL_CAPACITY, HELIPAD_RELOAD_TIME, GAS_REFILL_TIME, TILE_SIZE } from '../config.js'
import { logPerformance } from '../performanceUtils.js'

export const updateHelipadLogic = logPerformance(function(_units, buildings, _gameState, delta) {
  if (!Array.isArray(buildings) || buildings.length === 0) return

  const helipads = buildings.filter(b => b.type === 'helipad' && b.health > 0)
  if (helipads.length === 0) return

  helipads.forEach(helipad => {
    if (typeof helipad.maxFuel !== 'number' || helipad.maxFuel <= 0) {
      helipad.maxFuel = HELIPAD_FUEL_CAPACITY
    }

    if (typeof helipad.fuel !== 'number') {
      helipad.fuel = helipad.maxFuel
    }

    const capacity = helipad.maxFuel
    if (capacity <= 0) return

    const reloadTime = typeof helipad.fuelReloadTime === 'number' && helipad.fuelReloadTime > 0
      ? helipad.fuelReloadTime
      : HELIPAD_RELOAD_TIME

    if (helipad.fuel < capacity) {
      const effectiveReloadTime = Math.max(reloadTime, 1)
      const rate = capacity / effectiveReloadTime
      helipad.fuel = Math.min(capacity, helipad.fuel + rate * delta)
    }

    helipad.fuel = Math.min(helipad.fuel, capacity)
    helipad.needsRefuel = helipad.fuel <= helipad.maxFuel * 0.1
  })
})

export const updateHelipadService = logPerformance(function(units, buildings, _gameState, delta) {
  if (!Array.isArray(buildings) || buildings.length === 0) return

  const helipads = buildings.filter(b => b.type === 'helipad' && b.health > 0)
  if (helipads.length === 0) return

  helipads.forEach(helipad => {
    const landingX = helipad.x * TILE_SIZE + 50
    const landingY = helipad.y * TILE_SIZE + 90
    const serviceRadius = TILE_SIZE * 1.5

    units.forEach(unit => {
      if (unit.type !== 'apache' || unit.owner !== helipad.owner || unit.health <= 0) return

      const centerX = unit.x + TILE_SIZE / 2
      const centerY = unit.y + TILE_SIZE / 2
      const distance = Math.hypot(centerX - landingX, centerY - landingY)
      const grounded = unit.flightState === 'grounded'

      if (distance <= serviceRadius) {
        unit.landingPadTarget = helipad
      } else if (unit.landingPadTarget === helipad) {
        unit.landingPadTarget = null
      }

      if (distance <= serviceRadius * 0.75 && grounded) {
        const gasNeeded = unit.maxGas - unit.gas
        if (gasNeeded > 0 && helipad.fuel > 0) {
          const fillRate = unit.maxGas / GAS_REFILL_TIME
          const transfer = Math.min(fillRate * delta, gasNeeded, helipad.fuel)
          if (transfer > 0) {
            unit.gas = Math.min(unit.maxGas, unit.gas + transfer)
            helipad.fuel = Math.max(0, helipad.fuel - transfer)
            helipad.needsRefuel = helipad.fuel <= helipad.maxFuel * 0.1
            unit.refueling = unit.gas < unit.maxGas && helipad.fuel > 0
          }
        } else {
          unit.refueling = false
        }
      } else if (unit.landingPadTarget === helipad && !grounded) {
        unit.refueling = false
      } else if (unit.landingPadTarget === helipad && grounded) {
        unit.refueling = false
      }
    })
  })

  units.forEach(unit => {
    if (unit.type === 'apache' && unit.landingPadTarget && !helipads.includes(unit.landingPadTarget)) {
      unit.landingPadTarget = null
    }
  })
})
