import { GAS_REFILL_TIME, TANKER_SUPPLY_CAPACITY } from '../config.js'
import { logPerformance } from '../performanceUtils.js'

export const updateTankerTruckLogic = logPerformance(function(units, gameState, delta) {
  const tankers = units.filter(u => u.type === 'tankerTruck' && u.health > 0)
  if (tankers.length === 0) return

  tankers.forEach(tanker => {
    if (!tanker.refuelTarget) {
      const target = units.find(u =>
        u.id !== tanker.id &&
        u.owner === tanker.owner &&
        typeof u.maxGas === 'number' &&
        u.gas < u.maxGas &&
        Math.abs(u.tileX - tanker.tileX) <= 1 &&
        Math.abs(u.tileY - tanker.tileY) <= 1
      )
      if (target) {
        tanker.refuelTarget = target
        tanker.refuelTimer = 0
      }
    }

    if (tanker.refuelTarget) {
      const target = units.find(u => u.id === tanker.refuelTarget.id)
      if (!target || Math.abs(target.tileX - tanker.tileX) > 1 || Math.abs(target.tileY - tanker.tileY) > 1) {
        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      } else if (tanker.supplyGas > 0 && target.gas < target.maxGas) {
        const fillRate = target.maxGas / GAS_REFILL_TIME
        const gasNeeded = target.maxGas - target.gas
        const give = Math.min(fillRate * delta, gasNeeded, tanker.supplyGas)
        tanker.refuelTimer = (tanker.refuelTimer || 0) + delta
        target.gas += give
        tanker.supplyGas -= give
        if (target.gas >= target.maxGas || tanker.supplyGas <= 0 || tanker.refuelTimer >= GAS_REFILL_TIME) {
          if (target.gas > target.maxGas) target.gas = target.maxGas
          tanker.refuelTarget = null
          tanker.refuelTimer = 0
        }
      } else {
        tanker.refuelTarget = null
        tanker.refuelTimer = 0
      }
    }
  })
})
