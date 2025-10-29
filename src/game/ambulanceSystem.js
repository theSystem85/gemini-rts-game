// ambulanceSystem.js - Handle ambulance healing functionality
import { SERVICE_DISCOVERY_RANGE, SERVICE_SERVING_RANGE, TILE_SIZE } from '../config.js'
import { logPerformance } from '../performanceUtils.js'
import { getUnitCommandsHandler } from '../inputHandler.js'
import { getServiceRadiusPixels } from '../utils/serviceRadius.js'

export const updateAmbulanceLogic = logPerformance(function(units, gameState, delta) {
  const ambulances = units.filter(u => u.type === 'ambulance')
  if (ambulances.length === 0) return

  const unitCommands = getUnitCommandsHandler ? getUnitCommandsHandler() : null

  ambulances.forEach(ambulance => {
    const queueState = ambulance.utilityQueue
    const queueActive = queueState && queueState.mode === 'heal' && (
      (Array.isArray(queueState.targets) && queueState.targets.length > 0) || queueState.currentTargetId
    )
    const now = performance?.now ? performance.now() : Date.now()
    const wasServing = Boolean(ambulance._alertWasServing)

    // Check if ambulance is in hospital range - if so, don't heal, let it refill
    const inHospitalRange = isAmbulanceInHospitalRange(ambulance, gameState.buildings)
    if (inHospitalRange) {
      // Clear healing target when in hospital range to allow refilling
      if (ambulance.healingTarget) {
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
      }
      return
    }

    // Ambulances require a loader to tend to wounded units
    if (ambulance.crew && typeof ambulance.crew === 'object' && !ambulance.crew.loader) {
      ambulance.healingTarget = null
      ambulance.healingTimer = 0
      if (unitCommands) {
        unitCommands.clearUtilityQueueState(ambulance)
      }
      return
    }
    if (!ambulance.alertMode) {
      ambulance.alertActiveService = false
      ambulance.alertAssignmentId = null
      ambulance.nextUtilityScanTime = null
    }

    const canAutoScan = ambulance.alertMode && !ambulance.healingTarget && !queueActive && !ambulance.refillingTarget
    if (canAutoScan && unitCommands) {
      const nextScan = ambulance.nextUtilityScanTime || 0
      if (now >= nextScan) {
        const candidates = units
          .filter(u =>
            u.id !== ambulance.id &&
            u.owner === ambulance.owner &&
            u.crew && typeof u.crew === 'object' &&
            Object.values(u.crew).some(alive => !alive) &&
            !(u.movement && u.movement.isMoving)
          )
          .map(u => ({
            unit: u,
            distance: Math.hypot(u.tileX - ambulance.tileX, u.tileY - ambulance.tileY)
          }))
          .filter(entry => entry.distance <= SERVICE_DISCOVERY_RANGE)
          .sort((a, b) => a.distance - b.distance)

        const targetEntry = candidates[0]

        if (targetEntry) {
          const assigned = unitCommands.assignAmbulanceToTarget(ambulance, targetEntry.unit, gameState.mapGrid, {
            suppressNotifications: true
          })
          if (assigned) {
            ambulance.alertActiveService = true
            ambulance.alertAssignmentId = targetEntry.unit.id
          } else {
            ambulance.nextUtilityScanTime = now + 2000
          }
        } else {
          ambulance.nextUtilityScanTime = now + 2000
        }
      }
    }

    // Auto-acquire healing target if none set (legacy close-range behaviour)
    if (!ambulance.healingTarget && !queueActive && !ambulance.alertMode) {
      const potential = units.find(u =>
        u.id !== ambulance.id &&
        u.owner === ambulance.owner &&
        u.crew && typeof u.crew === 'object' &&
        Object.values(u.crew).some(alive => !alive) &&
        Math.hypot(u.tileX - ambulance.tileX, u.tileY - ambulance.tileY) <= SERVICE_SERVING_RANGE &&
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
      const distanceInTiles = Math.hypot(ambulance.tileX - target.tileX, ambulance.tileY - target.tileY)
      const withinRange = distanceInTiles <= SERVICE_SERVING_RANGE

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
        ambulance.medics = 0
        ambulance.healingTarget = null
        ambulance.healingTimer = 0
        if (unitCommands) {
          unitCommands.clearUtilityQueueState(ambulance)
        } else if (ambulance.utilityQueue) {
          ambulance.utilityQueue.mode = null
          ambulance.utilityQueue.targets = []
          ambulance.utilityQueue.currentTargetId = null
          ambulance.utilityQueue.currentTargetType = null
          ambulance.utilityQueue.currentTargetAction = null
        }
        return
      }

      // Process healing
      ambulance.healingTimer = (ambulance.healingTimer || 0) + delta
      const healingInterval = 2000 // 2 seconds per crew member

      const healOrder = ['driver', 'commander', 'loader', 'gunner']
      while (ambulance.healingTimer >= healingInterval && ambulance.medics > 0) {
        const currentMissing = Object.keys(target.crew).filter(role => !target.crew[role])
        if (currentMissing.length === 0) {
          ambulance.healingTarget = null
          ambulance.healingTimer = 0
          break
        }

        const roleToHeal = healOrder.find(role => currentMissing.includes(role)) || currentMissing[0]
        target.crew[roleToHeal] = true
        ambulance.medics = Math.max(ambulance.medics - 1, 0)
        ambulance.healingTimer -= healingInterval

        // Play sound effect
        // playSound('crewRestored')
      }
    }

    if (queueState && queueState.mode === 'heal') {
      if (!ambulance.healingTarget) {
        if (queueState.currentTargetId || queueState.currentTargetType) {
          queueState.currentTargetId = null
          queueState.currentTargetType = null
        }
        if (unitCommands) {
          unitCommands.advanceUtilityQueue(ambulance, gameState.mapGrid, true)
        }
      } else if (queueState.currentTargetId !== ambulance.healingTarget.id || queueState.currentTargetType !== 'unit') {
        queueState.currentTargetId = ambulance.healingTarget.id
        queueState.currentTargetType = 'unit'
      }
    }

    const isCurrentlyServing = Boolean(ambulance.healingTarget)
    if (wasServing && !isCurrentlyServing) {
      ambulance.alertActiveService = false
      ambulance.alertAssignmentId = null
      ambulance.nextUtilityScanTime = now + 2000
    }
    if (isCurrentlyServing) {
      ambulance.alertActiveService = true
    }
    ambulance._alertWasServing = isCurrentlyServing
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

function isAmbulanceInHospitalRange(ambulance, buildings) {
  if (!buildings || buildings.length === 0) {
    return false
  }

  const hospitals = buildings.filter(b => b.type === 'hospital')
  if (hospitals.length === 0) return false

  const ambulanceCenterX = (ambulance.x ?? ambulance.tileX * TILE_SIZE) + TILE_SIZE / 2
  const ambulanceCenterY = (ambulance.y ?? ambulance.tileY * TILE_SIZE) + TILE_SIZE / 2

  for (const hospital of hospitals) {
    const serviceRadius = getServiceRadiusPixels(hospital)
    if (serviceRadius <= 0) continue

    const hospitalCenterX = hospital.x * TILE_SIZE + (hospital.width * TILE_SIZE) / 2
    const hospitalCenterY = hospital.y * TILE_SIZE + (hospital.height * TILE_SIZE) / 2

    const distance = Math.hypot(ambulanceCenterX - hospitalCenterX, ambulanceCenterY - hospitalCenterY)
    if (distance <= serviceRadius) {
      return true
    }
  }

  return false
}
