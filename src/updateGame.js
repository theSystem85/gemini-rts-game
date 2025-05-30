// Main Game Update Module - Coordinates all game systems
import { TILE_SIZE } from './config.js'
import { buildOccupancyMap } from './units.js'
import { updateEnemyAI } from './enemy.js'
import { cleanupDestroyedSelectedUnits } from './inputHandler.js'
import { updateBuildingsUnderRepair } from './buildings.js'

// Import modular game systems
import { updateUnitMovement, updateSpawnExit } from './game/unitMovement.js'
import { updateUnitCombat } from './game/unitCombat.js'
import { updateHarvesterLogic } from './game/harvesterLogic.js'
import { updateBullets } from './game/bulletSystem.js'
import { updateBuildings, updateTeslaCoilEffects } from './game/buildingSystem.js'
import { 
  updateMapScrolling, 
  updateOreSpread, 
  updateExplosions, 
  cleanupDestroyedUnits, 
  updateUnitCollisions,
  checkGameEndConditions,
  updateGameTime,
  handleRightClickDeselect
} from './game/gameStateManager.js'
import { updateGlobalPathfinding } from './game/pathfinding.js'

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  try {
    if (gameState.gamePaused) return
    const now = performance.now()
    const occupancyMap = buildOccupancyMap(units, mapGrid)

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
    updateUnitMovement(units, mapGrid, occupancyMap, gameState, now)
    updateSpawnExit(units, factories, mapGrid, occupancyMap)
    updateUnitCombat(units, bullets, mapGrid, gameState, now)
    updateHarvesterLogic(units, mapGrid, occupancyMap, gameState, factories, now)

    // Global pathfinding recalculation
    updateGlobalPathfinding(units, mapGrid, occupancyMap, gameState)

    // Bullet system updates
    updateBullets(bullets, units, factories, gameState, mapGrid)

    // Building system updates
    updateBuildings(gameState, units, bullets, factories, delta)

    // Tesla Coil effects
    updateTeslaCoilEffects(units)

    // Explosion effects
    updateExplosions(gameState)

    // Unit collision resolution
    updateUnitCollisions(units, mapGrid)

    // Ore spreading mechanism
    updateOreSpread(gameState, mapGrid)

    // Cleanup destroyed units
    cleanupDestroyedUnits(units, gameState)

    // Enemy AI updates
    updateEnemyAI(units, factories, bullets, mapGrid, gameState)

    // Update buildings under repair
    if (gameState.buildingsUnderRepair && gameState.buildingsUnderRepair.length > 0) {
      updateBuildingsUnderRepair(gameState, now)
    }

    // Check for game end conditions
    checkGameEndConditions(factories, gameState)

  } catch (error) {
    console.error('Critical error in updateGame:', error)
    console.trace() // Add stack trace to see exactly where the error occurs
    // Don't allow the game to completely crash
  }
}

// Re-export Tesla Coil effects for backward compatibility
export { updateTeslaCoilEffects }
