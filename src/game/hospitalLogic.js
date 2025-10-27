import { TILE_SIZE, UNIT_PROPERTIES } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { getServiceRadiusPixels } from '../utils/serviceRadius.js'
import { showNotification } from '../ui/notifications.js'
export const updateHospitalLogic = logPerformance(function(units, buildings, gameState, delta) {
  const hospitals = buildings.filter(b => b.type === 'hospital')
  if (hospitals.length === 0) return
  hospitals.forEach(hospital => {
    const serviceRadius = getServiceRadiusPixels(hospital)
    if (serviceRadius <= 0) return

    const centerX = hospital.x * TILE_SIZE + (hospital.width * TILE_SIZE) / 2
    const centerY = hospital.y * TILE_SIZE + (hospital.height * TILE_SIZE) / 2
    units.forEach(unit => {
      if (!unit.crew) return
      // Skip ambulances for AI players as they don't use the crew system
      if ((unit.owner !== gameState.humanPlayer) && (unit.type === 'ambulance')) return
      const unitCenterX = (unit.x ?? unit.tileX * TILE_SIZE) + TILE_SIZE / 2
      const unitCenterY = (unit.y ?? unit.tileY * TILE_SIZE) + TILE_SIZE / 2
      const distance = Math.hypot(unitCenterX - centerX, unitCenterY - centerY)
      const inArea = distance <= serviceRadius
      const stationary = !(unit.movement && unit.movement.isMoving)

      if (unit.type === 'ambulance') {
        if (unit.refillingTarget !== hospital && unit.refillArrivalNotified) {
          unit.refillArrivalNotified = false
        }

        if (unit.refillingTarget === hospital) {
          if (inArea) {
            if (unit.owner === gameState.humanPlayer && !unit.refillArrivalNotified) {
              const hospitalTileX = Math.floor(centerX / TILE_SIZE)
              const hospitalTileY = Math.floor(centerY / TILE_SIZE)
              showNotification(
                `Ambulance #${unit.id} reached hospital service zone at (${hospitalTileX}, ${hospitalTileY}).`,
                2500
              )
            }
            unit.refillArrivalNotified = true
            unit.refillingStatus = 'arrived'
          } else if (unit.refillArrivalNotified) {
            unit.refillArrivalNotified = false
            if (unit.refillingStatus === 'arrived') {
              unit.refillingStatus = null
            }
          }
        }
      }

      if (inArea && stationary) {
        unit.healTimer = (unit.healTimer || 0) + delta
        const missing = Object.entries(unit.crew).filter(([_,alive]) => !alive)
        while (missing.length > 0 && unit.healTimer >= 10000) {
          const [role] = missing.shift()
          unit.crew[role] = true
          unit.healTimer -= 10000
          // Only deduct money from human player
          if (unit.owner === gameState.humanPlayer && gameState.money >= 100) {
            gameState.money -= 100
          }
        }
        if (unit.type === 'ambulance' && typeof unit.medics === 'number') {
          const defaultMaxMedics = UNIT_PROPERTIES?.ambulance?.maxMedics ?? 10
          let maxMedics

          if (typeof unit.maxMedics === 'number' && unit.maxMedics > 0) {
            maxMedics = unit.maxMedics
          } else {
            maxMedics = defaultMaxMedics
            unit.maxMedics = maxMedics
          }

          if (unit.medics < maxMedics) {
            unit.medicRefillTimer = (unit.medicRefillTimer || 0) + delta
            const restockInterval = 2000
            while (unit.medics < maxMedics && unit.medicRefillTimer >= restockInterval) {
              unit.medics += 1
              unit.medicRefillTimer -= restockInterval
            }
            if (unit.medics > maxMedics) {
              unit.medics = maxMedics
            }
          } else {
            unit.medicRefillTimer = 0
          }
        }
      } else {
        unit.healTimer = 0
        if (unit.type === 'ambulance') {
          unit.medicRefillTimer = 0
        }
      }
    })
  })
})
