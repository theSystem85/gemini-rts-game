import { TILE_SIZE } from './config.js'
import { playSound } from './sound.js'
import { buildingCosts } from './main.js'
import { showNotification } from './ui/notifications.js'
import { productionQueue } from './productionQueue.js'
import { updatePowerSupply, clearBuildingFromMapGrid } from './buildings.js'
import { checkGameEndConditions } from './game/gameStateManager.js'

/**
 * Handles the selling of buildings
 * Returns 70% of the original building cost back to the player
 * Restores original map tiles that were under the building
 */
export function buildingSellHandler(e, gameState, gameCanvas, mapGrid, units, factories, moneyEl) {
  // Only process if sell mode is active
  if (!gameState.sellMode) return

  const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
  const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

  // Convert to tile coordinates
  const tileX = Math.floor(mouseX / TILE_SIZE)
  const tileY = Math.floor(mouseY / TILE_SIZE)

  // Player factory cannot be sold
  const playerFactory = factories.find(factory => factory.id === gameState.humanPlayer)
  if (playerFactory &&
      tileX >= playerFactory.x && tileX < (playerFactory.x + playerFactory.width) &&
      tileY >= playerFactory.y && tileY < (playerFactory.y + playerFactory.height)) {
    showNotification('The main factory cannot be sold.')
    playSound('error')
    return
  }

  // Check player buildings
  for (let i = 0; i < gameState.buildings.length; i++) {
    const building = gameState.buildings[i]
    if (building.owner === gameState.humanPlayer &&
        tileX >= building.x && tileX < (building.x + building.width) &&
        tileY >= building.y && tileY < (building.y + building.height)) {

      // Calculate sell value (70% of original cost)
      const buildingType = building.type
      const originalCost = buildingCosts[buildingType] || 0
      const sellValue = Math.floor(originalCost * 0.7)

      // Add money to player
      gameState.money += sellValue
      if (productionQueue && typeof productionQueue.tryResumeProduction === 'function') {
        productionQueue.tryResumeProduction()
      }
      moneyEl.textContent = gameState.money

      // Remove building from the map grid: restore original tiles and clear building flag
      clearBuildingFromMapGrid(building, mapGrid)

      // Remove the building from the gameState.buildings array
      gameState.buildings.splice(i, 1)

      // Update power supply using the proper function that allows negative power
      updatePowerSupply(gameState.buildings, gameState)

      // Play selling sound and show notification
      playSound('deposit')
      showNotification(`Building sold for $${sellValue}.`)

      // Check for game end conditions after a building is sold
      checkGameEndConditions(factories, gameState)

      return
    }
  }

  showNotification('No player building found to sell.')
  return
}
