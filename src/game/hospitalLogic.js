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
      if (!unit.crew) return
      // Skip ambulances for AI players as they don't use the crew system
      if ((unit.owner !== gameState.humanPlayer) && (unit.type === 'ambulance')) return
      const unitCenterX = (unit.x ?? unit.tileX * TILE_SIZE) + TILE_SIZE / 2
      const unitCenterY = (unit.y ?? unit.tileY * TILE_SIZE) + TILE_SIZE / 2
      const distance = Math.hypot(unitCenterX - centerX, unitCenterY - centerY)
      const inArea = distance <= serviceRadius
      const stationary = !(unit.movement && unit.movement.isMoving)
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
      } else {
        unit.healTimer = 0
      }
    })
  })
})
