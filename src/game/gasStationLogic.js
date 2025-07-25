import { GAS_REFILL_TIME, GAS_REFILL_COST } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { playSound } from '../sound.js'

export const updateGasStationLogic = logPerformance(function(units, buildings, gameState, delta) {
  const stations = buildings.filter(b => b.type === 'gasStation')
  if (stations.length === 0) return

  stations.forEach(station => {
    const areaStartX = station.x - 1
    const areaEndX = station.x + station.width
    const areaStartY = station.y - 1
    const areaEndY = station.y + station.height

    units.forEach(unit => {
      if (typeof unit.maxGas !== 'number' || unit.health <= 0) return

      const inArea =
        unit.tileX >= areaStartX &&
        unit.tileX <= areaEndX &&
        unit.tileY >= areaStartY &&
        unit.tileY <= areaEndY

      if (inArea) {
        let refilling = false

        if (unit.gas < unit.maxGas) {
          refilling = true
          if (!unit.refueling) {
            unit.refueling = true
            // if (unit.owner === gameState.humanPlayer) playSound('unitRefules')
          }

          const fillRate = unit.maxGas / GAS_REFILL_TIME
          unit.gasRefillTimer = (unit.gasRefillTimer || 0) + delta
          unit.gas = Math.min(unit.maxGas, unit.gas + fillRate * delta)
        }

        if (unit.type === 'tankerTruck' && unit.supplyGas < unit.maxSupplyGas) {
          refilling = true
          if (!unit.refueling) unit.refueling = true
          const supplyRate = unit.maxSupplyGas / GAS_REFILL_TIME
          unit.gasRefillTimer = (unit.gasRefillTimer || 0) + delta
          unit.supplyGas = Math.min(unit.maxSupplyGas, unit.supplyGas + supplyRate * delta)
        }

        if (refilling) {
          const costPerMs = GAS_REFILL_COST / GAS_REFILL_TIME
          const costThisTick = costPerMs * delta
          if (unit.owner === gameState.humanPlayer) {
            if (gameState.money > 0) {
              gameState.money = Math.max(0, gameState.money - costThisTick)
            }
          } else {
            const aiFactory = gameState.factories?.find(f => f.id === unit.owner)
            if (aiFactory && typeof aiFactory.budget === 'number') {
              aiFactory.budget = Math.max(0, aiFactory.budget - costThisTick)
            }
          }
        } else {
          unit.gasRefillTimer = 0
          unit.refueling = false
          unit.outOfGasPlayed = false
        }
      } else {
        unit.gasRefillTimer = 0
        unit.refueling = false
      }
    })
  })
})
