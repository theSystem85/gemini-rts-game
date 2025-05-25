// productionController.js
// Handle production button setup and state management

import { gameState } from '../gameState.js';
import { unitCosts, buildingCosts } from '../main.js';
import { productionQueue } from '../productionQueue.js';
import { showNotification } from './notifications.js';

export class ProductionController {
  constructor() {
    this.vehicleUnitTypes = ['tank', 'tank-v2', 'rocketTank'];
  }

  // Function to update the enabled/disabled state of vehicle production buttons
  updateVehicleButtonStates() {
    const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === 'player');
    const hasRefinery = gameState.buildings.some(b => b.type === 'oreRefinery' && b.owner === 'player');
    const unitButtons = document.querySelectorAll('.production-button[data-unit-type]');

    unitButtons.forEach(button => {
      const unitType = button.getAttribute('data-unit-type');
      
      if (this.vehicleUnitTypes.includes(unitType)) {
        if (hasVehicleFactory) {
          button.classList.remove('disabled');
          button.title = ''; // Clear tooltip
        } else {
          button.classList.add('disabled');
          button.title = 'Requires Vehicle Factory'; // Add tooltip
        }
      } 
      else if (unitType === 'harvester') {
        if (hasVehicleFactory && hasRefinery) {
          button.classList.remove('disabled');
          button.title = ''; // Clear tooltip
        } else {
          button.classList.add('disabled');
          button.title = 'Requires Vehicle Factory & Ore Refinery'; // Add tooltip
        }
      }
    });
  }

  // Placeholder function to prevent errors - implement later if needed
  updateBuildingButtonStates() {
    // console.log("Checking building button states (placeholder)");
    // Add logic here if buildings have prerequisites (e.g., Construction Yard for others)
  }

  // Combined production button setup function that handles both unit and building buttons
  setupAllProductionButtons() {
    console.log("Setting up all production buttons - ONE TIME ONLY");
    
    // Clear any existing event listeners by cloning and replacing elements
    document.querySelectorAll('.production-button').forEach(button => {
      const clone = button.cloneNode(true);
      if (button.parentNode) {
        button.parentNode.replaceChild(clone, button);
      }
    });
    
    this.setupUnitButtons();
    this.setupBuildingButtons();

    // Initial update of button states when setting up
    this.updateVehicleButtonStates();
    this.updateBuildingButtonStates();
  }

  setupUnitButtons() {
    const unitButtons = document.querySelectorAll('.production-button[data-unit-type]');
    
    unitButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Prevent action if game is paused or button is disabled
        if (gameState.gamePaused || button.classList.contains('disabled')) {
          // Optionally show a notification if disabled
          if (button.classList.contains('disabled')) {
              showNotification('Cannot produce unit: Required building missing.');
          }
          return;
        }

        const unitType = button.getAttribute('data-unit-type');
        const cost = unitCosts[unitType] || 0;

        // Check requirements for the unit type
        let requirementsMet = true;
        let requirementText = '';

        if (this.vehicleUnitTypes.includes(unitType)) {
          const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === 'player');
          if (!hasVehicleFactory) {
            requirementsMet = false;
            requirementText = 'Requires Vehicle Factory';
          }
        } else if (unitType === 'harvester') {
          const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === 'player');
          const hasRefinery = gameState.buildings.some(b => b.type === 'oreRefinery' && b.owner === 'player');
          if (!hasVehicleFactory || !hasRefinery) {
            requirementsMet = false;
            requirementText = 'Requires Vehicle Factory & Ore Refinery';
          }
        }

        // If requirements are not met, disable the button and show tooltip
        if (!requirementsMet) {
          showNotification(`Cannot produce ${unitType}: ${requirementText}.`);
          button.classList.add('disabled');
          button.title = requirementText;
          return; // Stop processing
        }

        // Re-enable button if requirements were previously unmet but now are met
        button.classList.remove('disabled');
        button.title = ''; // Clear requirement tooltip

        // Always allow queuing
        productionQueue.addItem(unitType, button, false);
      });
      
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Prevent action if game is paused
        if (gameState.gamePaused) return;

        // Check if this button has the current production
        if (productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
          if (!productionQueue.pausedUnit) {
            // First right-click pauses
            productionQueue.togglePauseUnit();
          } else {
            // Second right-click cancels
            productionQueue.cancelUnitProduction();
          }
        } else {
          // Find the last queued item of this type
          for (let i = productionQueue.unitItems.length - 1; i >= 0; i--) {
            if (productionQueue.unitItems[i].button === button) {
              // Return money for the cancelled production
              gameState.money += unitCosts[productionQueue.unitItems[i].type] || 0;
              productionQueue.tryResumeProduction();
              // Remove from queue
              productionQueue.unitItems.splice(i, 1);
              
              // Update batch counter
              const remainingCount = productionQueue.unitItems.filter(
                item => item.button === button
              ).length + (productionQueue.currentUnit && productionQueue.currentUnit.button === button ? 1 : 0);
              
              productionQueue.updateBatchCounter(button, remainingCount);
              
              break; // Only remove one at a time
            }
          }
        }
      });
    });
  }

  setupBuildingButtons() {
    const buildingButtons = document.querySelectorAll('.production-button[data-building-type]');
    
    buildingButtons.forEach(button => {
      button.addEventListener('click', () => {
        const buildingType = button.getAttribute('data-building-type');
        
        // If button has "ready-for-placement" class, do nothing
        // The placement is handled by the canvas click event
        if (button.classList.contains('ready-for-placement')) {
          return;
        }
        
        // If a building placement is already in progress, don't queue another one
        if (gameState.buildingPlacementMode) {
          return;
        }
        
        const cost = buildingCosts[buildingType] || 0;
        
        // Always allow queuing
        productionQueue.addItem(buildingType, button, true);
      });
      
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // If this is a ready-for-placement building, cancel its placement
        if (button.classList.contains('ready-for-placement')) {
          productionQueue.cancelBuildingPlacement();
          return;
        }
        
        // Check if this button has the current production
        if (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
          if (!productionQueue.pausedBuilding) {
            // First right-click pauses
            productionQueue.togglePauseBuilding();
          } else {
            // Second right-click cancels
            productionQueue.cancelBuildingProduction();
          }
        } else {
          // Find the last queued item of this type
          for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
            if (productionQueue.buildingItems[i].button === button) {
              // Return money for the cancelled production
              gameState.money += buildingCosts[productionQueue.buildingItems[i].type] || 0;
              productionQueue.tryResumeProduction();
              // Remove from queue
              productionQueue.buildingItems.splice(i, 1);
              
              // Update batch counter
              const remainingCount = productionQueue.buildingItems.filter(
                item => item.button === button
              ).length + (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button ? 1 : 0);
              
              productionQueue.updateBatchCounter(button, remainingCount);
              
              break; // Only remove one at a time
            }
          }
        }
      });
    });
  }

  // Initialize production tabs without setting up buttons again
  initProductionTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Show corresponding content
        const tabName = button.getAttribute('data-tab');
        const tabContent = document.getElementById(`${tabName}TabContent`);
        tabContent.classList.add('active');
        
        // Force image loading in the newly activated tab
        tabContent.querySelectorAll('img').forEach(img => {
          // Trick to force browser to load/reload image if it failed before
          if (!img.complete || img.naturalHeight === 0) {
            const originalSrc = img.src;
            img.src = '';
            setTimeout(() => { img.src = originalSrc; }, 10);
          }
        });
      });
    });
  }
}