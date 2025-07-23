import { GAS_REFILL_TIME, GAS_REFILL_COST } from '../config.js'
import { logPerformance } from '../performanceUtils.js'

export const updateGasStationLogic = logPerformance(function(units, buildings, gameState, delta) {
  const stations = buildings.filter(b => b.type === 'gasStation')
  if (stations.length === 0) return

  stations.forEach(station => {
    units.forEach(unit => {
      if (typeof unit.maxGas !== 'number' || unit.health <= 0) return

      const nearestX = Math.max(station.x, Math.min(unit.tileX, station.x + station.width - 1))
      const nearestY = Math.max(station.y, Math.min(unit.tileY, station.y + station.height - 1))
      const dx = Math.abs(unit.tileX - nearestX)
      const dy = Math.abs(unit.tileY - nearestY)

      if (dx <= 1 && dy <= 1) {
        if (unit.gas < unit.maxGas) {
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
        }
      } else {
        unit.gasRefillTimer = 0
      }
    })
  })
})
