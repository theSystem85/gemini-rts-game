import { spawnUnit, findPath } from './units.js'
import { findClosestOre } from './logic.js'
import { buildingCosts, unitCosts, factories, units, mapGrid, showNotification } from './main.js'
import { gameState } from './gameState.js'
import { buildingData } from './buildings.js'

// Enhanced production queue system
export const productionQueue = {
  unitItems: [],
  buildingItems: [],
  currentUnit: null,
  currentBuilding: null,
  pausedUnit: false,
  pausedBuilding: false,
  completedBuilding: null,
  
  // Utility function to update batch counter display
  updateBatchCounter: function(button, count) {
    const batchCounter = button.querySelector('.batch-counter');
    if (count <= 0) {
      batchCounter.style.display = 'none';
      button.classList.remove('active');
      button.classList.remove('paused');
    } else {
      batchCounter.textContent = count;
      batchCounter.style.display = 'flex';
    }
  },
  
  addItem: function(type, button, isBuilding = false) {
    const cost = isBuilding ? buildingCosts[type] : unitCosts[type] || 0;
    
    // Immediately deduct cost when button is clicked
    if (gameState.money < cost) {
      // Show error feedback
      button.classList.add('error');
      setTimeout(() => button.classList.remove('error'), 300);
      return;
    }
    
    gameState.money -= cost;
    
    // Add to the appropriate queue
    if (isBuilding) {
      this.buildingItems.push({ type, button, isBuilding });
      let currentCount = this.buildingItems.filter(item => item.button === button).length;
      this.updateBatchCounter(button, currentCount);
      
      if (!this.currentBuilding && !this.pausedBuilding) {
        this.startNextBuildingProduction();
      }
    } else {
      this.unitItems.push({ type, button, isBuilding });
      let currentCount = this.unitItems.filter(item => item.button === button).length;
      this.updateBatchCounter(button, currentCount);
      
      if (!this.currentUnit && !this.pausedUnit) {
        this.startNextUnitProduction();
      }
    }
  },
  
  startNextUnitProduction: function() {
    if (this.unitItems.length === 0 || this.pausedUnit) return;
    const item = this.unitItems[0];
    const cost = unitCosts[item.type] || 0;
    
    // Set production duration proportional to cost.
    const baseDuration = 3000;
    const duration = baseDuration * (cost / 500);
    
    // Apply energy slowdown if needed
    const slowdownFactor = (gameState.powerSupply < 0 && 
                           Math.abs(gameState.powerSupply) > 0.9 * gameState.totalPowerProduction) ? 3 : 1;
    
    this.currentUnit = {
      type: item.type,
      button: item.button,
      progress: 0,
      startTime: performance.now(),
      duration: duration * slowdownFactor,
      isBuilding: item.isBuilding
    }
    
    // Mark button as active
    item.button.classList.add('active');
    playSound('productionStart');
  },
  
  startNextBuildingProduction: function() {
    if (this.buildingItems.length === 0 || this.pausedBuilding) return;
    const item = this.buildingItems[0];
    const cost = buildingCosts[item.type] || 0;
    
    // Set production duration proportional to cost.
    const baseDuration = 3000;
    const duration = baseDuration * (cost / 500);
    
    // Apply energy slowdown if needed
    const slowdownFactor = (gameState.powerSupply < 0 && 
                           Math.abs(gameState.powerSupply) > 0.9 * gameState.totalPowerProduction) ? 3 : 1;
    
    this.currentBuilding = {
      type: item.type,
      button: item.button,
      progress: 0,
      startTime: performance.now(),
      duration: duration * slowdownFactor,
      isBuilding: item.isBuilding
    }
    
    // Mark button as active
    item.button.classList.add('active');
    playSound('productionStart');
  },
  
  updateProgress: function(timestamp) {
    // Update unit production
    if (this.currentUnit && !this.pausedUnit) {
      const elapsed = timestamp - this.currentUnit.startTime;
      const progress = Math.min(elapsed / this.currentUnit.duration, 1);
      this.currentUnit.progress = progress;
      const progressBar = this.currentUnit.button.querySelector('.production-progress');
      if (progressBar) {
        progressBar.style.width = `${progress * 100}%`;
      }
      if (progress >= 1) {
        this.completeCurrentUnitProduction();
      }
    }
    
    // Update building production
    if (this.currentBuilding && !this.pausedBuilding) {
      const elapsed = timestamp - this.currentBuilding.startTime;
      const progress = Math.min(elapsed / this.currentBuilding.duration, 1);
      this.currentBuilding.progress = progress;
      const progressBar = this.currentBuilding.button.querySelector('.production-progress');
      if (progressBar) {
        progressBar.style.width = `${progress * 100}%`;
      }
      if (progress >= 1) {
        this.completeCurrentBuildingProduction();
      }
    }
  },
  
  completeCurrentUnitProduction: function() {
    if (!this.currentUnit) return;
    
    // Remove item from queue
    this.unitItems.shift();
    this.updateBatchCounter(this.currentUnit.button, this.unitItems.filter(item => item.button === this.currentUnit.button).length);
    
    // Unit production - spawn the unit
    const unitType = this.currentUnit.type;
    const playerFactory = factories.find(f => f.id === 'player');
    
    if (playerFactory) {
      const newUnit = spawnUnit(playerFactory, unitType, units, mapGrid);
      if (newUnit) {
        units.push(newUnit);
        playSound('productionReady', 1.0); // Play unit ready sound
        
        // If the produced unit is a harvester, automatically send it to harvest
        if (newUnit.type === 'harvester') {
          // Access the targetedOreTiles from the imported module
          const targetedOreTiles = window.gameState?.targetedOreTiles || {};
          
          const orePos = findClosestOre(newUnit, mapGrid, targetedOreTiles);
          if (orePos) {
            // Register this ore tile as targeted by this unit
            const tileKey = `${orePos.x},${orePos.y}`;
            if (window.gameState?.targetedOreTiles) {
              window.gameState.targetedOreTiles[tileKey] = newUnit.id;
            }
            
            const newPath = findPath({ x: newUnit.tileX, y: newUnit.tileY }, orePos, mapGrid, null);
            if (newPath.length > 1) {
              newUnit.path = newPath.slice(1);
              newUnit.oreField = orePos; // Set initial ore field target
            }
          }
        }
      }
    }
    
    // Reset and start next production
    this.currentUnit.button.classList.remove('active', 'paused');
    this.currentUnit = null;
    if (this.unitItems.length > 0) {
      this.startNextUnitProduction();
    }
    playSound('productionComplete');
  },
  
  completeCurrentBuildingProduction: function() {
    if (!this.currentBuilding) return;
    
    // Remove item from queue
    this.buildingItems.shift();
    this.updateBatchCounter(this.currentBuilding.button, this.buildingItems.filter(item => item.button === this.currentBuilding.button).length);
    
    // Building completion - enter placement mode
    gameState.buildingPlacementMode = true;
    gameState.currentBuildingType = this.currentBuilding.type;
    
    // Show notification to place building
    showNotification(`Click on the map to place your ${buildingData[this.currentBuilding.type].displayName}`);
    
    // Remove active state but keep button marked for placement
    this.currentBuilding.button.classList.remove('active');
    this.currentBuilding.button.classList.add('ready-for-placement');
    
    playSound('productionReady');
    
    // Temporarily store the current item for cancellation
    this.completedBuilding = {
      type: this.currentBuilding.type,
      button: this.currentBuilding.button
    };
    
    this.currentBuilding = null;
    
    // Don't automatically start next building production until this one is placed
  },
  
  togglePauseUnit: function() {
    if (!this.currentUnit) return;
    
    this.pausedUnit = !this.pausedUnit;
    if (this.pausedUnit) {
      this.currentUnit.button.classList.add('paused');
      playSound('productionPaused');
    } else {
      this.currentUnit.button.classList.remove('paused');
      playSound('productionStart');
    }
  },
  
  togglePauseBuilding: function() {
    if (!this.currentBuilding) return;
    
    this.pausedBuilding = !this.pausedBuilding;
    if (this.pausedBuilding) {
      this.currentBuilding.button.classList.add('paused');
      playSound('productionPaused');
    } else {
      this.currentBuilding.button.classList.remove('paused');
      playSound('productionStart');
    }
  },
  
  cancelUnitProduction: function() {
    if (!this.currentUnit) return;
    
    const button = this.currentUnit.button;
    const type = this.currentUnit.type;
    
    // Play cancel sound before cancelling
    playSound('productionCancelled');
    
    // Return money for the current production
    gameState.money += unitCosts[type] || 0;
    
    // Remove item from queue
    this.unitItems.shift();
    
    // Count remaining items of this type
    let remainingCount = this.unitItems.filter(item => item.button === button).length;
    
    // Update batch counter
    this.updateBatchCounter(button, remainingCount);
    
    // Reset the progress bar
    const progressBar = button.querySelector('.production-progress');
    if (progressBar) {
      progressBar.style.width = '0%';
    }
    
    // Clear current production
    this.currentUnit = null;
    this.pausedUnit = false;
    
    // Start next item in queue if available
    if (this.unitItems.length > 0) {
      this.startNextUnitProduction();
    }
  },
  
  cancelBuildingProduction: function() {
    if (!this.currentBuilding) return;
    
    const button = this.currentBuilding.button;
    const type = this.currentBuilding.type;
    
    // Play cancel sound before cancelling
    playSound('productionCancelled');
    
    // Return money for the current production
    gameState.money += buildingCosts[type] || 0;
    
    // Remove item from queue
    this.buildingItems.shift();
    
    // Count remaining items of this type
    let remainingCount = this.buildingItems.filter(item => item.button === button).length;
    
    // Update batch counter
    this.updateBatchCounter(button, remainingCount);
    
    // Reset the progress bar
    const progressBar = button.querySelector('.production-progress');
    if (progressBar) {
      progressBar.style.width = '0%';
    }
    
    // Clear current production
    this.currentBuilding = null;
    this.pausedBuilding = false;
    
    // Start next item in queue if available
    if (this.buildingItems.length > 0) {
      this.startNextBuildingProduction();
    }
  },
  
  // Method to cancel a building placement
  cancelBuildingPlacement: function() {
    if (!this.completedBuilding) return;
    
    const button = this.completedBuilding.button;
    const type = this.completedBuilding.type;
    
    // Play cancel sound
    playSound('productionCancelled');
    
    // Return money for the building
    gameState.money += buildingCosts[type] || 0;
    
    // Clear building placement mode
    gameState.buildingPlacementMode = false;
    gameState.currentBuildingType = null;
    
    // Remove ready-for-placement class
    button.classList.remove('ready-for-placement');
    
    // Clear the completed building reference
    this.completedBuilding = null;
    
    // Show notification
    showNotification(`${buildingData[type].displayName} construction canceled`);
    
    // Start next building in queue if available
    if (this.buildingItems.length > 0) {
      this.startNextBuildingProduction();
    }
  }
}
