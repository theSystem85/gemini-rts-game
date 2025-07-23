import { GAS_REFILL_TIME, GAS_REFILL_COST } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { playSound } from '../sound.js'

export const updateGasStationLogic = logPerformance(function(units, buildings, gameState, delta) {
  const stations = buildings.filter(b => b.type === 'gasStation')
  if (stations.length === 0) return

  stations.forEach(station => {
    const refillYStart = station.y + station.height
    const refillYEnd = refillYStart + 2
    units.forEach(unit => {
      if (typeof unit.maxGas !== 'number' || unit.health <= 0) return

      if (
        unit.tileY >= refillYStart &&
        unit.tileY <= refillYEnd &&
        unit.tileX >= station.x &&
        unit.tileX < station.x + station.width
      ) {
        if (unit.gas < unit.maxGas) {
          if (!unit.refueling) {
            unit.refueling = true
            if (unit.owner === gameState.humanPlayer) playSound('unitRefules')
          }
          unit.gasRefillTimer = (unit.gasRefillTimer || 0) + delta
          if (unit.gasRefillTimer >= GAS_REFILL_TIME) {
            unit.gas = unit.maxGas
            unit.gasRefillTimer = 0
            unit.outOfGasPlayed = false
            if (unit.owner === gameState.humanPlayer) {
              if (gameState.money >= GAS_REFILL_COST) gameState.money -= GAS_REFILL_COST
            } else {
              const aiFactory = gameState.factories?.find(f => f.id === unit.owner)
              if (aiFactory) aiFactory.budget -= GAS_REFILL_COST
            }
          }
        } else {
          unit.gasRefillTimer = 0
          unit.refueling = false
        }
      } else {
        unit.gasRefillTimer = 0
        unit.refueling = false
      }
    })
  })
})
