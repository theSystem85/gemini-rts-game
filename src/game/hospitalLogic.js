import { TILE_SIZE } from '../config.js'
import { playSound } from '../sound.js'
import { logPerformance } from '../performanceUtils.js'
import { getServiceRadiusPixels } from '../utils/serviceRadius.js'
export const updateHospitalLogic = logPerformance(function(units, buildings, gameState, delta) {
  const hospitals = buildings.filter(b => b.type === 'hospital')
  if (hospitals.length === 0) return
  hospitals.forEach(hospital => {
    const serviceRadius = getServiceRadiusPixels(hospital)
    if (serviceRadius <= 0) return

    const centerX = hospital.x * TILE_SIZE + (hospital.width * TILE_SIZE) / 2
    const centerY = hospital.y * TILE_SIZE + (hospital.height * TILE_SIZE) / 2
    units.forEach(unit => {
      if (!unit.crew || typeof unit.crew !== 'object') return
      // Skip ambulances for AI players as they don't use the crew system
      if ((unit.owner !== gameState.humanPlayer) && (unit.type === 'ambulance')) return
      const unitCenterX = (unit.x ?? unit.tileX * TILE_SIZE) + TILE_SIZE / 2
      const unitCenterY = (unit.y ?? unit.tileY * TILE_SIZE) + TILE_SIZE / 2
      const distance = Math.hypot(unitCenterX - centerX, unitCenterY - centerY)
      const inArea = distance <= serviceRadius

      if (inArea) {
        const healInterval = 10000
        const healOrder = ['driver', 'commander', 'loader', 'gunner']
        unit.healTimer = (unit.healTimer || 0) + delta

        while (unit.healTimer >= healInterval) {
          const missingRoles = Object.keys(unit.crew).filter(role => !unit.crew[role])
          if (missingRoles.length === 0) {
            unit.healTimer = 0
            break
          }

          const roleToHeal = healOrder.find(role => missingRoles.includes(role)) || missingRoles[0]
          unit.crew[roleToHeal] = true
          unit.healTimer -= healInterval

          // Only deduct money from human player
          if (unit.owner === gameState.humanPlayer && gameState.money >= 100) {
            gameState.money -= 100
          }
        }

        if (unit.type === 'ambulance' && typeof unit.medics === 'number') {
          const maxMedics = typeof unit.maxMedics === 'number' ? unit.maxMedics : unit.medics
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
