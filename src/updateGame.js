// Main Game Update Module - Coordinates all game systems
import {
  TILE_SIZE,
  SMOKE_EMIT_INTERVAL
} from './config.js'

import { emitSmokeParticles } from './utils/smokeUtils.js'
import { getBuildingImage } from './buildingImageMap.js'

import { logPerformance } from './performanceUtils.js'

import { updateEnemyAI } from './enemy.js'
import { cleanupDestroyedSelectedUnits, getUnitCommandsHandler } from './inputHandler.js'
import { updateBuildingsUnderRepair, updateBuildingsAwaitingRepair, buildingData } from './buildings.js'
import { handleSelfRepair } from './utils.js'
import { updateGuardBehavior } from './behaviours/guard.js'

// Import modular game systems
import { updateUnitMovement, updateSpawnExit } from './game/unitMovement.js'
import { updateUnitCombat, cleanupAttackGroupTargets } from './game/unitCombat.js'
import { updateHarvesterLogic } from './game/harvesterLogic.js'
import { updateWorkshopLogic } from './game/workshopLogic.js'
import { updateBullets } from './game/bulletSystem.js'
import { updateHospitalLogic } from './game/hospitalLogic.js'
import { updateAmbulanceLogic } from './game/ambulanceSystem.js'
import { updateGasStationLogic } from './game/gasStationLogic.js'
import { updateTankerTruckLogic } from './game/tankerTruckLogic.js'
import { updateRecoveryTankLogic } from './game/recoveryTankSystem.js'
import { updateBuildings, updateTeslaCoilEffects } from './game/buildingSystem.js'
import { cleanupSoundCooldowns } from './game/soundCooldownManager.js'
import { processCommandQueues } from './game/commandQueue.js'
import { 
  updateMapScrolling,
  updateOreSpread,
  updateExplosions,
  updateSmokeParticles,
  cleanupDestroyedUnits,
  updateUnitCollisions,
  updateGameTime,
  handleRightClickDeselect,
  cleanupDestroyedFactories,
  checkGameEndConditions
} from './game/gameStateManager.js'
import { updateGlobalPathfinding } from './game/pathfinding.js'
import { logUnitStatus } from './utils/logger.js'
import { updateRemoteControlledUnits } from './game/remoteControl.js'

export const updateGame = logPerformance(function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  try {
    if (gameState.gamePaused) return
    const now = performance.now()
    const occupancyMap = gameState.occupancyMap

    // Update game time
    updateGameTime(gameState, delta)

    // Update movement speeds for all units based on speed multiplier
    units.forEach(unit => {
      unit.effectiveSpeed = unit.speed * gameState.speedMultiplier
    })

    // Clean up unit selection - prevent null references
    cleanupDestroyedSelectedUnits()

    // Handle right-click deselection
    handleRightClickDeselect(gameState, units)

    // Map scrolling with inertia
    updateMapScrolling(gameState, mapGrid)

    // Process queued unit commands before running unit systems
    const unitCommands = getUnitCommandsHandler()
    processCommandQueues(units, mapGrid, unitCommands)

    // Apply remote control inputs for selected tanks
    updateRemoteControlledUnits(units, bullets, mapGrid, occupancyMap)

    // Unit system updates
    units.forEach(unit => {
      updateGuardBehavior(unit, mapGrid, occupancyMap, now)
    })
    updateUnitMovement(units, mapGrid, occupancyMap, gameState, now, factories)
    updateSpawnExit(units, factories, mapGrid, occupancyMap)
    updateUnitCombat(units, bullets, mapGrid, gameState, now)
    updateHarvesterLogic(units, mapGrid, occupancyMap, gameState, factories, now)
    updateWorkshopLogic(units, gameState.buildings, mapGrid, delta)

    updateRecoveryTankLogic(units, gameState, delta)

    updateHospitalLogic(units, gameState.buildings, gameState, delta)
    updateAmbulanceLogic(units, gameState, delta)
    updateGasStationLogic(units, gameState.buildings, gameState, delta)
    updateTankerTruckLogic(units, gameState, delta)
    // Handle self-repair for level 3 units
    units.forEach(unit => {
      handleSelfRepair(unit, now)
    })

    // Emit smoke for heavily damaged tanks
    units.forEach(unit => {
      if (
        unit.maxHealth &&
        unit.health / unit.maxHealth < 0.25 &&
        (unit.type.includes('tank') || unit.type === 'harvester')
      ) {
        if (!unit.lastSmokeTime || now - unit.lastSmokeTime > SMOKE_EMIT_INTERVAL) {
          const offsetX = -Math.cos(unit.direction) * TILE_SIZE * 0.4
          const offsetY = -Math.sin(unit.direction) * TILE_SIZE * 0.4

          const particleCount = 1 + Math.floor(Math.random() * 2)
          emitSmokeParticles(
            gameState,
            unit.x + TILE_SIZE / 2 + offsetX,
            unit.y + TILE_SIZE / 2 + offsetY,
            now,
            particleCount
          )
          unit.lastSmokeTime = now
        }
      }
    })

    // Emit smoke for buildings with smoke spots
    if (gameState.buildings && gameState.buildings.length > 0) {
      gameState.buildings.forEach(building => {
        const buildingConfig = buildingData[building.type]
        if (
          buildingConfig && 
          buildingConfig.smokeSpots && 
          buildingConfig.smokeSpots.length > 0
        ) {
          // Initialize smoke emission tracking for each spot if not exists
          if (!building.smokeEmissionTrackers) {
            building.smokeEmissionTrackers = buildingConfig.smokeSpots.map(() => ({
              lastEmissionTime: 0,
              emissionStage: 0 // Track which emission in the sequence we're on
            }))
          }
          
          // Get the actual building image to determine real dimensions
          const buildingImage = getBuildingImage(building.type)
          if (!buildingImage) {
            return // Skip if image not loaded yet
          }
          
          // Calculate dynamic scaling factors based on actual image vs rendered size
          const renderedWidth = building.width * TILE_SIZE
          const renderedHeight = building.height * TILE_SIZE
          const actualImageWidth = buildingImage.naturalWidth || buildingImage.width
          const actualImageHeight = buildingImage.naturalHeight || buildingImage.height
          
          // Calculate individual scaling factors for X and Y (important for non-square images)
          const scaleX = renderedWidth / actualImageWidth
          const scaleY = renderedHeight / actualImageHeight
          
          // Emit smoke from each smoke spot with proper coordinate scaling and timing
          buildingConfig.smokeSpots.forEach((smokeSpot, spotIndex) => {
            const tracker = building.smokeEmissionTrackers[spotIndex]
            const timeSinceLastEmission = now - tracker.lastEmissionTime
            
            // Emit every 200ms for steady, overlapping smoke streams
            if (timeSinceLastEmission > 200) {
              const scaledX = smokeSpot.x * scaleX
              const scaledY = smokeSpot.y * scaleY
              // Use precise coordinates without additional offset now that scaling is accurate
              const smokeX = building.x * TILE_SIZE + scaledX
              const smokeY = building.y * TILE_SIZE + scaledY
              
              // Emit 3 particles for denser, overlapping effect
              emitSmokeParticles(gameState, smokeX, smokeY, now, 3)
              
              tracker.lastEmissionTime = now
              tracker.emissionStage = (tracker.emissionStage + 1) % 4 // Cycle through stages
            }
          })
        }
      })
    }

    // Cleanup destroyed attack group targets
    cleanupAttackGroupTargets(gameState)

    // Global pathfinding recalculation
    updateGlobalPathfinding(units, mapGrid, occupancyMap, gameState)

    // Bullet system updates
    updateBullets(bullets, units, factories, gameState, mapGrid)

    // Building system updates
    updateBuildings(gameState, units, bullets, factories, mapGrid, delta)

    // Tesla Coil effects
    updateTeslaCoilEffects(units)

    // Explosion effects
    updateExplosions(gameState)
    updateSmokeParticles(gameState)

    // Unit collision resolution
    updateUnitCollisions(units, mapGrid)

    // Ore spreading mechanism
    updateOreSpread(gameState, mapGrid, factories)

    // Cleanup destroyed units
    cleanupDestroyedUnits(units, gameState)

    // Cleanup destroyed factories
    cleanupDestroyedFactories(factories, mapGrid, gameState)

    // Cleanup sound cooldowns for destroyed units
    cleanupSoundCooldowns(units)

    // Check for game end conditions after factory/building destruction
    checkGameEndConditions(factories, gameState)

    // Enemy AI updates
    updateEnemyAI(units, factories, bullets, mapGrid, gameState)

    // Update buildings under repair
    if (gameState.buildingsUnderRepair && gameState.buildingsUnderRepair.length > 0) {
      updateBuildingsUnderRepair(gameState, now)
    }
    
    // Update buildings awaiting repair (countdown for buildings under attack)
    updateBuildingsAwaitingRepair(gameState, now)

    // Self-repair for level 3 units
    handleSelfRepair(units, now)

    // Log status changes for units with logging enabled
    units.forEach(unit => {
      if (unit.loggingEnabled) {
        logUnitStatus(unit)
      }
    })

  } catch (error) {
    console.error('Critical error in updateGame:', error)
    console.trace() // Add stack trace to see exactly where the error occurs
    // Don't allow the game to completely crash
  }
}, false)

// Re-export Tesla Coil effects for backward compatibility
export { updateTeslaCoilEffects }
