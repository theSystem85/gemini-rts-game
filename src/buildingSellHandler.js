// buildingSellHandler.js
import { TILE_SIZE } from './config.js'
import { playSound } from './sound.js'
import { buildingCosts } from './main.js'
import { showNotification } from './main.js'

/**
 * Handles the selling of buildings
 * Returns 70% of the original building cost back to the player
 * Restores original map tiles that were under the building
 */
export function buildingSellHandler(e, gameState, gameCanvas, mapGrid, units, factories, moneyEl) {
  // Only process if sell mode is active
  if (!gameState.sellMode) return;
  
  const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x;
  const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y;
  
  // Convert to tile coordinates
  const tileX = Math.floor(mouseX / TILE_SIZE);
  const tileY = Math.floor(mouseY / TILE_SIZE);
  
  // Player factory cannot be sold
  const playerFactory = factories.find(factory => factory.id === 'player');
  if (playerFactory && 
      tileX >= playerFactory.x && tileX < (playerFactory.x + playerFactory.width) &&
      tileY >= playerFactory.y && tileY < (playerFactory.y + playerFactory.height)) {
    showNotification('The main factory cannot be sold.');
    playSound('error');
    return;
  }
  
  // Check player buildings
  for (let i = 0; i < gameState.buildings.length; i++) {
    const building = gameState.buildings[i];
    if (building.owner === 'player' &&
        tileX >= building.x && tileX < (building.x + building.width) &&
        tileY >= building.y && tileY < (building.y + building.height)) {
      
      // Calculate sell value (70% of original cost)
      const buildingType = building.type;
      const originalCost = buildingCosts[buildingType] || 0;
      const sellValue = Math.floor(originalCost * 0.7);
      
      // Add money to player
      gameState.money += sellValue;
      if (typeof productionQueue !== 'undefined' && productionQueue && typeof productionQueue.tryResumeProduction === 'function') {
        productionQueue.tryResumeProduction();
      }
      moneyEl.textContent = gameState.money;
      
      // Remove building from the map grid and restore original tiles
      for (let y = building.y; y < building.y + building.height; y++) {
        for (let x = building.x; x < building.x + building.width; x++) {
          if (mapGrid[y] && mapGrid[y][x]) {
            // Restore the original tile type if it was saved, otherwise default to 'land'
            if (building.originalTiles && 
                building.originalTiles[y - building.y] && 
                building.originalTiles[y - building.y][x - building.x]) {
              mapGrid[y][x].type = building.originalTiles[y - building.y][x - building.x];
            } else {
              mapGrid[y][x].type = 'land';  // Default to land if no original type is stored
            }
          }
        }
      }
      
      // Remove the building from the gameState.buildings array
      gameState.buildings.splice(i, 1);
      
      // Update power supply calculations
      gameState.playerTotalPowerProduction = 0;
      gameState.playerPowerConsumption = 0;
      
      // Recalculate power for remaining buildings
      for (const remainingBuilding of gameState.buildings) {
        if (remainingBuilding.owner === 'player') {
          // Add power production
          if (remainingBuilding.powerProduction) {
            gameState.playerTotalPowerProduction += remainingBuilding.powerProduction;
          }
          
          // Add power consumption
          if (remainingBuilding.powerConsumption) {
            gameState.playerPowerConsumption += remainingBuilding.powerConsumption;
          }
        }
      }
      
      // Play selling sound and show notification
      playSound('deposit');
      showNotification(`Building sold for $${sellValue}.`);
      
      return;
    }
  }
  
  showNotification('No player building found to sell.');
  return;
}