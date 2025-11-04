import { TILE_SIZE } from './config.js'
import { playSound } from './sound.js'
import { buildingCosts } from './main.js'
import { showNotification } from './ui/notifications.js'
import { productionQueue } from './productionQueue.js'
import { updateMoneyBar } from './ui/moneyBar.js'
// No need to modify map grid immediately; building removal occurs after the sell animation

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

      // Don't allow selling again while the sell animation runs
      if (building.isBeingSold) {
        showNotification('Building is already being sold.')
        playSound('error')
        return false
      }

      // Calculate sell value (70% of original cost)
      const buildingType = building.type
      const originalCost = buildingCosts[buildingType] || 0
      const sellValue = Math.floor(originalCost * 0.7)

      // Add money to player
      gameState.money += sellValue
      if (productionQueue && typeof productionQueue.tryResumeProduction === 'function') {
        productionQueue.tryResumeProduction()
      }
      // Update money display
      if (typeof updateMoneyBar === 'function') {
        updateMoneyBar()
      }

      // Mark the building as being sold
      building.isBeingSold = true
      building.sellStartTime = performance.now()

      // Play selling sound and show notification
      playSound('deposit')
      showNotification(`Building sold for $${sellValue}.`)

      // Selling initiated successfully
      return true
    }
  }

  showNotification('No player building found to sell.')
  return false
}
