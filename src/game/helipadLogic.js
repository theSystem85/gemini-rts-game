import { HELIPAD_FUEL_CAPACITY, HELIPAD_RELOAD_TIME } from '../config.js'
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
  })
})
