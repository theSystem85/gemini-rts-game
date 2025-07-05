// Main Game Update Module - Coordinates all game systems
import { TILE_SIZE } from './config.js'

import { updateEnemyAI } from './enemy.js'
import { cleanupDestroyedSelectedUnits } from './inputHandler.js'
import { updateBuildingsUnderRepair, updateBuildingsAwaitingRepair } from './buildings.js'
import { handleSelfRepair } from './utils.js'

// Import modular game systems
import { updateUnitMovement, updateSpawnExit } from './game/unitMovement.js'
import { updateUnitCombat, cleanupAttackGroupTargets } from './game/unitCombat.js'
import { updateHarvesterLogic } from './game/harvesterLogic.js'
import { updateBullets } from './game/bulletSystem.js'
import { updateBuildings, updateTeslaCoilEffects } from './game/buildingSystem.js'
import { cleanupSoundCooldowns } from './game/soundCooldownManager.js'
import { 
  updateMapScrolling, 
  updateOreSpread, 
  updateExplosions, 
  cleanupDestroyedUnits, 
  updateUnitCollisions,
  updateGameTime,
  handleRightClickDeselect,
  cleanupDestroyedFactories,
  checkGameEndConditions
} from './game/gameStateManager.js'
import { updateGlobalPathfinding } from './game/pathfinding.js'

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
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

    // Unit system updates
    updateUnitMovement(units, mapGrid, occupancyMap, gameState, now, factories)
    updateSpawnExit(units, factories, mapGrid, occupancyMap)
    updateUnitCombat(units, bullets, mapGrid, gameState, now)
    updateHarvesterLogic(units, mapGrid, occupancyMap, gameState, factories, now)

    // Handle self-repair for level 3 units
    units.forEach(unit => {
      handleSelfRepair(unit, now)
    })

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

  } catch (error) {
    console.error('Critical error in updateGame:', error)
    console.trace() // Add stack trace to see exactly where the error occurs
    // Don't allow the game to completely crash
  }
}

// Re-export Tesla Coil effects for backward compatibility
export { updateTeslaCoilEffects }
