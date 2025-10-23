// ambulanceSystem.js - Handle ambulance healing functionality
import { TILE_SIZE } from '../config.js'
import { playSound } from '../sound.js'
import { logPerformance } from '../performanceUtils.js'
import { getUnitCommandsHandler } from '../inputHandler.js'

export const updateAmbulanceLogic = logPerformance(function(units, gameState, delta) {
  const ambulances = units.filter(u => u.type === 'ambulance')
  if (ambulances.length === 0) return

  const unitCommands = getUnitCommandsHandler ? getUnitCommandsHandler() : null

  ambulances.forEach(ambulance => {
    const queueState = ambulance.utilityQueue
    const queueActive = queueState && queueState.mode === 'heal' && (
      (Array.isArray(queueState.targets) && queueState.targets.length > 0) || queueState.currentTargetId
    )

    // Ambulances require a loader to tend to wounded units
    if (ambulance.crew && typeof ambulance.crew === 'object' && !ambulance.crew.loader) {
      ambulance.healingTarget = null
      ambulance.healingTimer = 0
      if (unitCommands) {
        unitCommands.clearUtilityQueueState(ambulance)
      }
      return
    }
    // Auto-acquire healing target if none set
    if (!ambulance.healingTarget && !queueActive) {
      const potential = units.find(u =>
        u.id !== ambulance.id &&
        u.owner === ambulance.owner &&
        u.crew && typeof u.crew === 'object' &&
        Object.values(u.crew).some(alive => !alive) &&
        Math.abs(u.tileX - ambulance.tileX) <= 1 &&
        Math.abs(u.tileY - ambulance.tileY) <= 1 &&
        !(u.movement && u.movement.isMoving)
      )
      if (potential && ambulance.medics > 0) {
        ambulance.healingTarget = potential
        ambulance.healingTimer = 0
      }
    }
    // Handle ambulance healing target
    if (ambulance.healingTarget) {
      const target = ambulance.healingTarget

      // Check if target still exists and is within range
      const targetExists = units.find(u => u.id === target.id)
      if (!targetExists) {
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
        return
      }

      // Check distance (within 1 tile)
      const dx = Math.abs(ambulance.tileX - target.tileX)
      const dy = Math.abs(ambulance.tileY - target.tileY)
      const withinRange = dx <= 1 && dy <= 1

      if (!withinRange) {
        // Move closer to target
        return
      }

      // Check if target needs healing
      if (!target.crew || typeof target.crew !== 'object') {
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
        return
      }

      // Target must be stationary to receive healing
      if (target.movement && target.movement.isMoving) {
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
        return
      }

      const missingCrew = Object.entries(target.crew).filter(([_, alive]) => !alive)
      if (missingCrew.length === 0) {
        // Target is fully healed
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
        return
      }

      // Check if ambulance has crew to give
      if (!ambulance.medics || ambulance.medics <= 0) {
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
        return
      }

      // Process healing
      ambulance.healingTimer = (ambulance.healingTimer || 0) + delta
      const healingInterval = 2000 // 2 seconds per crew member

      while (missingCrew.length > 0 && ambulance.healingTimer >= healingInterval && ambulance.medics > 0) {
        const [role] = missingCrew.shift()

        // Heal in order: driver, commander, loader, gunner
        const healOrder = ['driver', 'commander', 'loader', 'gunner']
        let healedRole = null

        for (const checkRole of healOrder) {
          if (!target.crew[checkRole]) {
            target.crew[checkRole] = true
            healedRole = checkRole
            break
          }
        }

        if (healedRole) {
          ambulance.medics -= 1
          ambulance.healingTimer -= healingInterval

          // Play sound effect
          // playSound('crewRestored')
        }
      }
    }

    if (queueState && queueState.mode === 'heal') {
      if (!ambulance.healingTarget) {
        queueState.currentTargetId = null
        if (unitCommands) {
          unitCommands.advanceUtilityQueue(ambulance, gameState.mapGrid, true)
        }
      } else if (queueState.currentTargetId !== ambulance.healingTarget.id) {
        queueState.currentTargetId = ambulance.healingTarget.id
      }
    }
  })
})

export function canAmbulanceHealUnit(ambulance, targetUnit) {
  if (ambulance.crew && typeof ambulance.crew === 'object' && !ambulance.crew.loader) {
    return false
  }
  // Check if target has crew system
  if (!targetUnit.crew || typeof targetUnit.crew !== 'object') {
    return false
  }

  if (targetUnit.movement && targetUnit.movement.isMoving) {
    return false
  }

  // Check if target has missing crew members
  const missingCrew = Object.entries(targetUnit.crew).filter(([_, alive]) => !alive)
  if (missingCrew.length === 0) {
    return false
  }

  // Check if ambulance has crew to give
  if (!ambulance.medics || ambulance.medics <= 0) {
    return false
  }

  return true
}

export function assignAmbulanceToHealUnit(ambulance, targetUnit) {
  if (ambulance.crew && typeof ambulance.crew === 'object' && !ambulance.crew.loader) {
    return false
  }
  if (!canAmbulanceHealUnit(ambulance, targetUnit)) {
    return false
  }

  if (targetUnit.movement && targetUnit.movement.isMoving) {
    return false
  }

  ambulance.healingTarget = targetUnit
  ambulance.healingTimer = 0

  // Set path to target
  // This would be handled by the input system when user clicks

  return true
}
