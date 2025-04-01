import { TILE_SIZE } from './config.js'
import { canPlaceBuilding, createBuilding, placeBuilding, updatePowerSupply, calculateRepairCost, repairBuilding } from './buildings.js'
import { playSound } from './sound.js'
import { showNotification, savePlayerBuildPatterns } from './main.js'
import { buildingData } from './buildings.js'

export function buildingRepairHandler(e, gameState, gameCanvas, mapGrid, units, factories, productionQueue, moneyEl) {
    // If repair mode is active, check for buildings and factories to repair
    if (gameState.repairMode) {
      const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x;
      const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y;
      
      // Convert to tile coordinates
      const tileX = Math.floor(mouseX / TILE_SIZE);
      const tileY = Math.floor(mouseY / TILE_SIZE);
      
      // First check if we clicked on the player factory
      const playerFactory = factories.find(factory => factory.id === 'player');
      if (playerFactory && 
          tileX >= playerFactory.x && tileX < (playerFactory.x + playerFactory.width) &&
          tileY >= playerFactory.y && tileY < (playerFactory.y + playerFactory.height)) {
          
        // Skip if factory is at full health
        if (playerFactory.health >= playerFactory.maxHealth) {
          showNotification('Factory is already at full health.');
          return;
        }
        
        // Calculate damage percentage
        const damagePercent = 1 - (playerFactory.health / playerFactory.maxHealth);
        // Factory repair cost is based on its base cost of 5000
        const repairCost = Math.ceil(damagePercent * 5000 * 0.3);
        
        // Check if player has enough money
        if (gameState.money < repairCost) {
          showNotification(`Not enough money for repairs. Cost: $${repairCost}`);
          return;
        }
        
        // Start gradual repair of the factory
        gameState.money -= repairCost;
        moneyEl.textContent = gameState.money;
        
        // Create repair info for factory
        if (!gameState.buildingsUnderRepair) {
          gameState.buildingsUnderRepair = [];
        }
        
        const healthToRepair = playerFactory.maxHealth - playerFactory.health;
        
        // Base repair duration on factory cost (same calculation as regular buildings)
        const baseDuration = 1000; // 1 second base duration
        const factoryCost = 5000;
        const buildDuration = baseDuration * (factoryCost / 500);
        const repairDuration = buildDuration * 2.0; // 2x build time (changed from 0.2 to 2.0)
        
        gameState.buildingsUnderRepair.push({
          building: playerFactory,
          startTime: performance.now(),
          duration: repairDuration,
          startHealth: playerFactory.health,
          targetHealth: playerFactory.maxHealth,
          healthToRepair: healthToRepair
        });
        
        // Log for debugging
        console.log(`Starting repair of factory with duration ${repairDuration}ms`);
        
        showNotification(`Factory repair started for $${repairCost}`);
        playSound('construction_started');
        
        return;
      }
      
      // Then check player buildings
      for (const building of gameState.buildings) {
        if (building.owner === 'player' &&
            tileX >= building.x && tileX < (building.x + building.width) &&
            tileY >= building.y && tileY < (building.y + building.height)) {
          
          // Skip if building is at full health
          if (building.health >= building.maxHealth) {
            showNotification('Building is already at full health.');
            return;
          }
          
          // Calculate repair cost
          const repairCost = calculateRepairCost(building);
          
          // Check if player has enough money
          if (gameState.money < repairCost) {
            showNotification(`Not enough money for repairs. Cost: $${repairCost}`);
            return;
          }
          
          // Perform the repair
          const result = repairBuilding(building, gameState);
          
          if (result.success) {
            showNotification(`Building repair started for $${result.cost}`);
            playSound('construction_started');
            moneyEl.textContent = gameState.money;
          } else {
            showNotification(result.message);
          }
          
          return;
        }
      }
      
      showNotification('No player building found to repair.');
      return;
    }
    
    if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
      const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x;
      const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y;
      
      // Convert to tile coordinates
      const tileX = Math.floor(mouseX / TILE_SIZE);
      const tileY = Math.floor(mouseY / TILE_SIZE);
      
      // Get building data
      const buildingType = gameState.currentBuildingType;
      
      try {
        // Check if placement is valid - pass buildings and factories arrays
        if (canPlaceBuilding(buildingType, tileX, tileY, mapGrid, units, gameState.buildings, factories)) {
          // Create and place the building
          const newBuilding = createBuilding(buildingType, tileX, tileY);
          
          // Add owner property to the building
          newBuilding.owner = 'player';
          
          // Add the building to gameState.buildings
          if (!gameState.buildings) {
            gameState.buildings = [];
          }
          gameState.buildings.push(newBuilding);
          
          // Mark building tiles in the map grid
          placeBuilding(newBuilding, mapGrid);
          
          // Update power supply
          updatePowerSupply(gameState.buildings, gameState);
          
          // Exit placement mode
          gameState.buildingPlacementMode = false;
          gameState.currentBuildingType = null;
          
          // Remove ready-for-placement class from the button
          document.querySelectorAll('.ready-for-placement').forEach(button => {
            button.classList.remove('ready-for-placement');
          });
          
          // Clear the completed building reference
          productionQueue.completedBuilding = null;
          
          // Play placement sound
          playSound('buildingPlaced');
  
          // Show notification
          showNotification(`${buildingData[buildingType].displayName} constructed`);
          
          // Start next production if any
          if (productionQueue.buildingItems.length > 0) {
            productionQueue.startNextBuildingProduction();
          }
  
          // Save player building patterns
          savePlayerBuildPatterns(buildingType);
        } else {
          console.log(`Building placement failed for ${buildingType} at (${tileX},${tileY})`);
          // Play error sound for invalid placement
          playSound('error');
        }
      } catch (error) {
        console.error("Error during building placement:", error);
        showNotification("Error placing building: " + error.message, 5000);
        playSound('error');
      }
    }
  }