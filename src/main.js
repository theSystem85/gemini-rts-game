// main.js
import { setupInputHandlers } from './inputHandler.js'
import { unitCosts } from './units.js'
import { renderGame, renderMinimap } from './rendering.js'
import { gameState } from './gameState.js'
import { updateGame } from './updateGame.js'
import { 
  buildingData,
  createBuilding,
  canPlaceBuilding,
  placeBuilding,
  updatePowerSupply,
  repairBuilding,
  calculateRepairCost,
  updateBuildingsUnderRepair
} from './buildings.js'
import { productionQueue } from './productionQueue.js'
import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { playSound, toggleBackgroundMusic } from './sound.js'
import { initFactories } from './factories.js'
import { initBackgroundMusic } from './sound.js'
// import { preloadBuildingImages } from './buildingImageMap.js' // Moved to gameSetup.js
import { buildingRepairHandler } from './buildingRepairHandler.js'
import { buildingSellHandler } from './buildingSellHandler.js'
import { createUnit } from './units.js'
import { initializeGameAssets, generateMap as generateMapFromSetup } from './gameSetup.js';
// Import save game functionality
import { initSaveGameSystem } from './saveGame.js';

// Initialize loading states
let allAssetsLoaded = false;
let gameInitialized = false; // This flag indicates if the game loop has run its initial setup

initializeGameAssets(() => {
  console.log("All game assets preloaded successfully!");
  allAssetsLoaded = true;
  // The game loop will pick this up.
});

const gameCanvas = document.getElementById('gameCanvas')
const gameCtx = gameCanvas.getContext('2d')
const minimapCanvas = document.getElementById('minimap')
const minimapCtx = minimapCanvas.getContext('2d')
const moneyEl = document.getElementById('money')
const gameTimeEl = document.getElementById('gameTime')
const winsEl = document.getElementById('wins')
const lossesEl = document.getElementById('losses')
const pauseBtn = document.getElementById('pauseBtn')
const restartBtn = document.getElementById('restartBtn')
const sidebar = document.getElementById('sidebar')

// Replace the now-obsolete productionButtons reference
// const productionButtons = document.getElementById('productionButtons')
// Instead, we'll look for production buttons in both tabs later

const startBtn = document.getElementById('startBtn')
if (startBtn) {
  startBtn.style.display = 'none'
}
sidebar.style.backgroundColor = '#333'
sidebar.style.color = '#fff'

// Initialize the energy bar early to ensure it's created before the game starts
// This is crucial for the energy bar to appear properly
addPowerIndicator();

// Find the speed control that's now defined in HTML
const speedMultiplier = document.getElementById('speedMultiplier')
if (speedMultiplier) {
  speedMultiplier.value = gameState.speedMultiplier // Set initial value to match gameState
  speedMultiplier.addEventListener('change', (e) => {
    const value = parseFloat(e.target.value)
    if (value >= 0.25 && value <= 4) {
      gameState.speedMultiplier = value
    } else {
      e.target.value = gameState.speedMultiplier
    }
  })
}

// REMOVE: Don't create duplicate shuffle controls since they're already in HTML
// const shuffleControl = document.createElement('div')
// shuffleControl.innerHTML = `
//   <label style="display: flex; align-items: center; margin: 10px 0;">
//     Seed:
//     <input type="number" id="mapSeed" value="1" style="width: 70px; margin-left: 10px;">
//   </label>
//   <button id="shuffleMapBtn" style="margin: 10px 0;">Shuffle Map</button>
// `
// sidebar.appendChild(shuffleControl)

function resizeCanvases() {
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Set canvas display size (CSS)
  gameCanvas.style.width = `${window.innerWidth - 250}px`;
  gameCanvas.style.height = `${window.innerHeight}px`;
  
  // Set actual pixel size scaled by device pixel ratio
  gameCanvas.width = (window.innerWidth - 250) * pixelRatio;
  gameCanvas.height = window.innerHeight * pixelRatio;
  
  // Scale the drawing context to counter the device pixel ratio
  gameCtx.scale(pixelRatio, pixelRatio);
  
  // Maintain high-quality rendering
  gameCtx.imageSmoothingEnabled = true;
  gameCtx.imageSmoothingQuality = 'high';
  
  // Set minimap size - make it fit entirely in the sidebar
  minimapCanvas.style.width = '230px'; // Slightly smaller than sidebar width (250px)
  minimapCanvas.style.height = '138px'; // Keep aspect ratio
  minimapCanvas.width = 230 * pixelRatio;
  minimapCanvas.height = 138 * pixelRatio;
  
  // Scale minimap context
  minimapCtx.scale(pixelRatio, pixelRatio);
  minimapCtx.imageSmoothingEnabled = true;
  minimapCtx.imageSmoothingQuality = 'high';
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

export const mapGrid = []

// Seeded random generator
function seededRandom(seed) {
  const m = 0x80000000, a = 1103515245, c = 12345
  let state = seed
  return function() {
    state = (a * state + c) % m
    return state / (m - 1)
  }
}

// Generate a new map using the given seed and organic features
function generateMap(seed) {
  const rand = seededRandom(parseInt(seed))
  // Clear any old content
  mapGrid.length = 0
  for (let y = 0; y < MAP_TILES_Y; y++) {
    mapGrid[y] = []
    for (let x = 0; x < MAP_TILES_X; x++) {
      // Initially all land
      mapGrid[y][x] = { type: 'land' }
      // ...existing code for initial random assignment if needed...
    }
  }
  // -------- Step 0: Generate Ore Fields --------
  const oreClusterCount = 6;
  const oreClusters = [];
  for (let i = 0; i < oreClusterCount; i++) {
    const clusterCenterX = Math.floor(rand() * MAP_TILES_X);
    const clusterCenterY = Math.floor(rand() * MAP_TILES_Y);
    oreClusters.push({ x: clusterCenterX, y: clusterCenterY });
    const clusterRadius = Math.floor(rand() * 3) + 5; // radius between 5 and 7
    for (let y = Math.max(0, clusterCenterY - clusterRadius); y < Math.min(MAP_TILES_Y, clusterCenterY + clusterRadius); y++) {
      for (let x = Math.max(0, clusterCenterX - clusterRadius); x < Math.min(MAP_TILES_X, clusterCenterX + clusterRadius); x++) {
        const dx = x - clusterCenterX, dy = y - clusterCenterY;
        if (Math.hypot(dx, dy) < clusterRadius && rand() < 0.9) {
          mapGrid[y][x].type = 'ore';
        }
      }
    }
  }

  // -------- Step 1: Generate Mountain Chains (Rock Clusters) --------
  const rockClusterCount = 9;
  const rockClusters = [];
  for (let i = 0; i < rockClusterCount; i++) {
    const clusterCenterX = Math.floor(rand() * MAP_TILES_X);
    const clusterCenterY = Math.floor(rand() * MAP_TILES_Y);
    rockClusters.push({ x: clusterCenterX, y: clusterCenterY });
    const clusterRadius = Math.floor(rand() * 3) + 2; // radius between 2 and 4
    for (let y = Math.max(0, clusterCenterY - clusterRadius); y < Math.min(MAP_TILES_Y, clusterCenterY + clusterRadius); y++) {
      for (let x = Math.max(0, clusterCenterX - clusterRadius); x < Math.min(MAP_TILES_X, clusterCenterX + clusterRadius); x++) {
        const dx = x - clusterCenterX, dy = y - clusterCenterY;
        if (Math.hypot(dx, dy) < clusterRadius && rand() < 0.8) {
          mapGrid[y][x].type = 'rock';
        }
      }
    }
  }
  // Helper: Draw a thick line (Bresenham-like)
  function drawThickLine(grid, start, end, type, thickness) {
    // ...existing code...
    const dx = end.x - start.x, dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let j = 0; j <= steps; j++) {
      const x = Math.floor(start.x + (dx * j) / steps);
      const y = Math.floor(start.y + (dy * j) / steps);
      for (let ty = -Math.floor(thickness/2); ty <= Math.floor(thickness/2); ty++) {
        for (let tx = -Math.floor(thickness/2); tx <= Math.floor(thickness/2); tx++) {
          const nx = x + tx, ny = y + ty;
          if (nx >= 0 && ny >= 0 && nx < MAP_TILES_X && ny < MAP_TILES_Y) {
            grid[ny][nx].type = type;
          }
        }
      }
    }
  }
  // Connect rock clusters in sequence (mountain chains)
  for (let i = 0; i < rockClusters.length - 1; i++) {
    drawThickLine(mapGrid, rockClusters[i], rockClusters[i+1], 'rock', 2);
  }

  // -------- Step 2: Generate Lakes and Rivers --------
  const lakeCount = 2;
  const lakeCenters = [];
  for (let i = 0; i < lakeCount; i++) {
    const centerX = Math.floor(rand() * MAP_TILES_X);
    const centerY = Math.floor(rand() * MAP_TILES_Y);
    lakeCenters.push({ x: centerX, y: centerY });
    const radius = Math.floor(rand() * 4) + 4; // radius between 4 and 7
    for (let y = Math.max(0, centerY - radius); y < Math.min(MAP_TILES_Y, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x < Math.min(MAP_TILES_X, centerX + radius); x++) {
        const dx = x - centerX, dy = y - centerY;
        if (Math.hypot(dx, dy) < radius) {
          mapGrid[y][x].type = 'water';
        }
      }
    }
  }
  // Connect lakes with a river
  if (lakeCenters.length === 2) {
    const startLake = lakeCenters[0];
    const endLake = lakeCenters[1];
    const steps = Math.max(Math.abs(endLake.x - startLake.x), Math.abs(endLake.y - startLake.y));
    for (let j = 0; j <= steps; j++) {
      const x = Math.floor(startLake.x + ((endLake.x - startLake.x) * j) / steps);
      const y = Math.floor(startLake.y + ((endLake.y - startLake.y) * j) / steps);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_TILES_X && ny < MAP_TILES_Y) {
            if (rand() < 0.8) {
              mapGrid[ny][nx].type = 'water';
            }
          }
        }
      }
    }
    // Ensure at least one street crosses the river (midpoint)
    const riverMidX = Math.floor((startLake.x + endLake.x) / 2);
    const riverMidY = Math.floor((startLake.y + endLake.y) / 2);
    mapGrid[riverMidY][riverMidX].type = 'street';
  }

  // -------- Step 3: Generate Streets --------
  const playerFactoryPos = { x: Math.floor(MAP_TILES_X * 0.1), y: Math.floor(MAP_TILES_Y * 0.9) };
  const enemyFactoryPos = { x: Math.floor(MAP_TILES_X * 0.9), y: Math.floor(MAP_TILES_Y * 0.1) };

  // Connect ore fields to player factory
  oreClusters.forEach(cluster => {
    drawThickLine(mapGrid, playerFactoryPos, cluster, 'street', 2);
  });
  // Connect the two bases
  drawThickLine(mapGrid, playerFactoryPos, enemyFactoryPos, 'street', 2);

  // Existing base connectivity for redundancy
  const dxx = enemyFactoryPos.x - playerFactoryPos.x;
  const dyy = enemyFactoryPos.y - playerFactoryPos.y;
  const connectSteps = Math.max(Math.abs(dxx), Math.abs(dyy));
  for (let j = 0; j <= connectSteps; j++) {
    const x = Math.floor(playerFactoryPos.x + (dxx * j) / connectSteps);
    const y = Math.floor(playerFactoryPos.y + (dyy * j) / connectSteps);
    if (x >= 0 && y >= 0 && x < MAP_TILES_X && y < MAP_TILES_Y) {
      mapGrid[y][x].type = 'street';
      if (x + 1 < MAP_TILES_X) { mapGrid[y][x+1].type = 'street'; }
      if (y + 1 < MAP_TILES_Y) { mapGrid[y+1][x].type = 'street'; }
    }
  }
  // ...existing code...
}

// Reset game state with the new map (clearing factories, units, bullets, and resetting the viewport)
function resetGameWithNewMap(seed) {
  generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y); // Use imported generateMap
  factories.length = 0
  initFactories(factories, mapGrid)
  units.length = 0
  bullets.length = 0
  const playerFactory = factories.find(f => f.id === 'player')
  if (playerFactory) {
    const factoryPixelX = playerFactory.x * TILE_SIZE
    const factoryPixelY = playerFactory.y * TILE_SIZE
    // Ensure gameCanvas.width and gameCanvas.height are the CSS dimensions for centering logic
    const logicalCanvasWidth = parseInt(gameCanvas.style.width, 10) || gameCanvas.width;
    const logicalCanvasHeight = parseInt(gameCanvas.style.height, 10) || gameCanvas.height;

    gameState.scrollOffset.x = Math.max(0, Math.min(
      factoryPixelX - logicalCanvasWidth / 2,
      MAP_TILES_X * TILE_SIZE - logicalCanvasWidth
    ))
    gameState.scrollOffset.y = Math.max(0, Math.min(
      factoryPixelY - logicalCanvasHeight / 2,
      MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight
    ))
  }
  gameState.gameTime = 0
  gameState.gameOver = false
  gameState.gameStarted = true
  gameState.gamePaused = true // Ensure game is paused after reset
  pauseBtn.textContent = 'Start' // Update button text
  // ...existing code to restart/update the game loop if necessary...
}

// Add event listener for the shuffle map button using the entered seed
document.getElementById('shuffleMapBtn').addEventListener('click', () => {
  const seedInput = document.getElementById('mapSeed')
  const seed = seedInput.value || '1'
  resetGameWithNewMap(seed)
})

// Replace the original static map generation with the seeded generation on initial load
generateMapFromSetup(document.getElementById('mapSeed').value, mapGrid, MAP_TILES_X, MAP_TILES_Y); // Use imported generateMap

export const factories = []
initFactories(factories, mapGrid)

// Initialize rally points as null
factories.forEach(factory => {
  factory.rallyPoint = null;
  factory.selected = false;
});

// Center viewport on player factory
const playerFactory = factories.find(f => f.id === 'player')
if (playerFactory) {
  const factoryPixelX = playerFactory.x * TILE_SIZE
  const factoryPixelY = playerFactory.y * TILE_SIZE
  
  // Ensure gameCanvas.width and gameCanvas.height are the CSS dimensions for centering logic
  const logicalCanvasWidth = parseInt(gameCanvas.style.width, 10) || gameCanvas.width;
  const logicalCanvasHeight = parseInt(gameCanvas.style.height, 10) || gameCanvas.height;
  
  // Center the factory in the viewport
  gameState.scrollOffset.x = Math.max(0, Math.min(
    factoryPixelX - logicalCanvasWidth / 2,
    MAP_TILES_X * TILE_SIZE - logicalCanvasWidth
  ))
  gameState.scrollOffset.y = Math.max(0, Math.min(
    factoryPixelY - logicalCanvasHeight / 2,
    MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight
  ))
}

export const units = []
export const bullets = []

setupInputHandlers(units, factories, mapGrid)

// Add buildingCosts based on our building data
export const buildingCosts = {};
for (const [type, data] of Object.entries(buildingData)) {
  buildingCosts[type] = data.cost;
}

// Add factory repair cost
buildingCosts['factory'] = 5000;

// List of unit types considered vehicles requiring a Vehicle Factory
const vehicleUnitTypes = ['tank', 'tank-v2', 'rocketTank'];

// Function to update the enabled/disabled state of vehicle production buttons
export function updateVehicleButtonStates() {
  const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === 'player');
  const hasRefinery = gameState.buildings.some(b => b.type === 'oreRefinery' && b.owner === 'player');
  const unitButtons = document.querySelectorAll('.production-button[data-unit-type]');

  unitButtons.forEach(button => {
    const unitType = button.getAttribute('data-unit-type');
    
    if (vehicleUnitTypes.includes(unitType)) {
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
export function updateBuildingButtonStates() {
  // console.log("Checking building button states (placeholder)");
  // Add logic here if buildings have prerequisites (e.g., Construction Yard for others)
}

// MODIFIED: Combined production button setup function that handles both unit and building buttons
function setupAllProductionButtons() {
  console.log("Setting up all production buttons - ONE TIME ONLY");
  
  // Clear any existing event listeners by cloning and replacing elements
  document.querySelectorAll('.production-button').forEach(button => {
    const clone = button.cloneNode(true);
    if (button.parentNode) {
      button.parentNode.replaceChild(clone, button);
    }
  });
  
  // Now set up unit buttons
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

      if (vehicleUnitTypes.includes(unitType)) {
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

      // Remove money check and error feedback here!
      // Always allow queuing:
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
  
  // Set up building buttons
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
      
      // Remove money check and error feedback here!
      // Always allow queuing:
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

  // Initial update of button states when setting up
  updateVehicleButtonStates();
  updateBuildingButtonStates(); // Now defined
}

// Initialize production tabs without setting up buttons again
function initProductionTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    // Fix: Remove the nested click handler that was causing issues
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

pauseBtn.addEventListener('click', () => {
  gameState.gamePaused = !gameState.gamePaused
  
  // Update button icon based on game state
  const playPauseIcon = pauseBtn.querySelector('.play-pause-icon');
  if (playPauseIcon) {
    playPauseIcon.textContent = gameState.gamePaused ? '▶' : '⏸';
  }
  
  // If the game was just unpaused, resume any pending productions
  if (!gameState.gamePaused) {
    productionQueue.resumeProductionAfterUnpause();
  }
})

// In the initial setup section, set the correct initial button state 
const playPauseIcon = document.querySelector('.play-pause-icon');
if (playPauseIcon) {
  playPauseIcon.textContent = gameState.gamePaused ? '▶' : '⏸';
}

restartBtn.addEventListener('click', () => {
  window.location.reload()
})

gameState.gameStarted = true
// gameState.gamePaused is already set to true in gameState.js

// Instead of auto-playing background music immediately,
// wait for the first user interaction.
document.addEventListener('click', initBackgroundMusic, { once: true })

const musicControlButton = document.getElementById('musicControl')
if (musicControlButton) {
  musicControlButton.addEventListener('click', () => {
    toggleBackgroundMusic()
    
    // Toggle music icon
    const musicIcon = musicControlButton.querySelector('.music-icon');
    if (musicIcon) {
      // If background music is available and we can check its state
      if (typeof bgMusicAudio !== 'undefined' && bgMusicAudio) {
        musicIcon.textContent = bgMusicAudio.paused ? '♪' : '🔇';
      } else {
        // Toggle based on previous state if audio object isn't available
        musicIcon.textContent = musicIcon.textContent === '♪' ? '🔇' : '♪';
      }
    }
  })
}

// Add the minimap event listeners
const minimapElement = document.getElementById('minimap')
if (minimapElement) {
  // Handle minimap dragging state
  let isMinimapDragging = false;

  minimapElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) {
      e.preventDefault();
      isMinimapDragging = true;
      handleMinimapClick(e);
    }
  });

  minimapElement.addEventListener('mousemove', (e) => {
    if (isMinimapDragging) {
      handleMinimapClick(e);
    }
  });

  // Use mouseup on the document to ensure we catch the event even if released outside the minimap
  document.addEventListener('mouseup', (e) => {
    if (isMinimapDragging) {
      // This is important - process one last time with the final cursor position
      // when it's still in drag mode before ending the drag
      if (e.target === minimapElement) {
        handleMinimapClick(e);
      }
      isMinimapDragging = false;
    }
  });

  // Prevent context menu on minimap
  minimapElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
}

function handleMinimapClick(e) {
  // Get minimap dimensions
  const minimap = e.target
  const minimapRect = minimap.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio || 1
  
  // Calculate click position relative to minimap
  // Use CSS dimensions (display size) for calculating click position
  const clickX = (e.clientX - minimapRect.left) / minimapRect.width
  const clickY = (e.clientY - minimapRect.top) / minimapRect.height
  
  // Use logical (CSS) dimensions for scroll calculation, not the scaled canvas dimensions
  // The actual game coordinate space should use CSS dimensions
  const logicalCanvasWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
  const logicalCanvasHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight
  
  // Calculate new scroll position
  const newX = clickX * (MAP_TILES_X * TILE_SIZE - logicalCanvasWidth)
  const newY = clickY * (MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight)
  
  // Update gameState.scrollOffset
  gameState.scrollOffset.x = Math.max(0, Math.min(newX, MAP_TILES_X * TILE_SIZE - logicalCanvasWidth))
  gameState.scrollOffset.y = Math.max(0, Math.min(newY, MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight))
}

let lastTime = 0
function gameLoop(timestamp) {
  if (!gameInitialized) {
    // Wait for assets to be loaded before initializing and starting the game loop
    if (!allAssetsLoaded) {
      // Display a loading message or spinner
      gameCtx.fillStyle = '#000';
      gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
      gameCtx.font = '20px Arial';
      gameCtx.fillStyle = '#fff';
      gameCtx.textAlign = 'center';
      gameCtx.fillText('Loading assets, please wait...', gameCanvas.width / (2 * (window.devicePixelRatio || 1)), gameCanvas.height / (2 * (window.devicePixelRatio || 1)));
      requestAnimationFrame(gameLoop);
      return;
    }
    // Assets are loaded, perform one-time initializations
    console.log("Game initialized and starting loop.");
    gameInitialized = true;
    lastTime = timestamp; // Initialize lastTime
    initBackgroundMusic(); // Initialize background music now that assets might be ready
    // Call initial button state updates
    updateVehicleButtonStates();
    updateBuildingButtonStates();
  }

  const deltaTime = (timestamp - lastTime) * gameState.speedMultiplier;
  lastTime = timestamp;

  if (!gameState.gameOver) {
    if (!gameState.gamePaused) {
      updateGame(deltaTime, gameState, units, factories, bullets, mapGrid, productionQueue, moneyEl, gameTimeEl);
      updateBuildingsUnderRepair(gameState, performance.now());
    }
  }

  renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, gameState.buildings, gameState.scrollOffset, gameState.selectionActive, gameState.selectionStart, gameState.selectionEnd, gameState);
  renderMinimap(minimapCtx, minimapCanvas, mapGrid, gameState.scrollOffset, gameCanvas, units, gameState.buildings, gameState);
  
  moneyEl.textContent = gameState.money
  gameTimeEl.textContent = Math.floor(gameState.gameTime)
  winsEl.textContent = gameState.wins
  lossesEl.textContent = gameState.losses
  
  requestAnimationFrame(gameLoop);
}

// Modify the animation loop to update production progress and handle energy effects
function animate(timestamp) {
  if (!gameState.gameStarted || gameState.gamePaused) {
    requestAnimationFrame(animate);
    return;
  }
  
  // Calculate delta time with a maximum to avoid spiral of doom on slow frames
  const now = timestamp || performance.now();
  if (!lastFrameTime) lastFrameTime = now;
  const delta = Math.min(now - lastFrameTime, 33); // Cap at ~30 FPS equivalent
  lastFrameTime = now;
  
  // Check if game is over
  if (gameState.gameOver) {
    gameState.gamePaused = true;
  }
  
  // Update production progress
  productionQueue.updateProgress(timestamp);
  
  // Update buildings under repair
  updateBuildingsUnderRepair(gameState, timestamp);
  
  // Update energy bar display
  updateEnergyBar();
  
  // Update game elements
  updateGame(delta / 1000, mapGrid, factories, units, bullets, gameState);
  
  // Render game with low energy effects if applicable
  renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, gameState.buildings,
    gameState.scrollOffset, gameState.selectionActive, 
    gameState.selectionStart, gameState.selectionEnd, gameState);
  
  // Render minimap with low energy effects if applicable
  renderMinimap(minimapCtx, minimapCanvas, mapGrid, 
    gameState.scrollOffset, gameCanvas, units, gameState.buildings, gameState);
  
  // Update money display
  moneyEl.textContent = `$${Math.floor(gameState.money)}`;
  
  // Update game time display
  const gameTimeSeconds = Math.floor(gameState.gameTime);
  const minutes = Math.floor(gameTimeSeconds / 60);
  const seconds = gameTimeSeconds % 60;
  gameTimeEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  
  // Use setTimeout to ensure we don't overload the browser
  if (units.length > 20) {
    // For large number of units, use setTimeout to give browser breathing room
    setTimeout(() => requestAnimationFrame(animate), 5);
  } else {
    requestAnimationFrame(animate);
  }
}

// Initialize animation loop
let lastFrameTime = null
// Use only one animation loop instead of two - comment out gameLoop call
// gameLoop(performance.now())
requestAnimationFrame(animate)

// Add power indicator to sidebar with energy bar
function addPowerIndicator() {
  // Get the energy bar container that's already in the HTML
  const energyBarContainer = document.getElementById('energyBarContainer');
  if (!energyBarContainer) {
    return;
  }
  
  // Clear any existing content to prevent duplicates
  energyBarContainer.innerHTML = '';
  
  // Create energy bar
  const energyBar = document.createElement('div');
  energyBar.id = 'energyBar';
  
  // Set explicit styles for the energy bar to ensure it's visible
  energyBar.style.width = '100%';
  energyBar.style.height = '100%';
  energyBar.style.backgroundColor = '#4CAF50'; // Green
  energyBar.style.position = 'absolute';
  energyBar.style.top = '0';
  energyBar.style.left = '0';
  energyBar.style.zIndex = '0';
  
  // Create energy text
  const energyText = document.createElement('div');
  energyText.id = 'energyText';
  energyText.className = 'energyBarLabel';
  energyText.style.position = 'absolute';
  energyText.style.width = '100%';
  energyText.style.textAlign = 'center';
  energyText.style.fontSize = '12px';
  energyText.style.lineHeight = '20px';
  energyText.style.zIndex = '1';
  energyText.style.textShadow = '0 0 3px #000';
  energyText.style.color = '#fff'; // White text
  energyText.textContent = 'Energy: 100';
  
  // Add elements to container
  energyBarContainer.appendChild(energyBar);
  energyBarContainer.appendChild(energyText);
  
  // Make sure the container itself is visible and properly styled
  energyBarContainer.style.display = 'block';
  energyBarContainer.style.visibility = 'visible';
  energyBarContainer.style.height = '20px';
  energyBarContainer.style.position = 'relative';
  energyBarContainer.style.overflow = 'hidden';
  energyBarContainer.style.border = '1px solid #555';
  energyBarContainer.style.borderRadius = '2px';
  energyBarContainer.style.margin = '0 0 10px 0';
  
  // Initialize energy stats in gameState with default values
  gameState.totalPowerProduction = 100;
  gameState.powerConsumption = 0;
  gameState.playerTotalPowerProduction = 100;
  gameState.playerPowerConsumption = 0;
  
  // Force an immediate update
  setTimeout(() => updateEnergyBar(), 100);
}

// Update the energy bar display
function updateEnergyBar() {
  const energyBar = document.getElementById('energyBar');
  const energyText = document.getElementById('energyText');
  
  if (!energyBar || !energyText) {
    // Try to recreate the energy bar if not found
    addPowerIndicator();
    return;
  }
  
  // Use player-specific power values
  const totalProduction = gameState.playerTotalPowerProduction || 0;
  const totalConsumption = gameState.playerPowerConsumption || 0;
  
  // Display energy production value
  energyText.textContent = `Energy: ${totalProduction - totalConsumption}`;
  
  // Calculate percentage of energy remaining
  let energyPercentage = 100;
  if (totalProduction > 0) {
    energyPercentage = Math.max(0, 100 - (totalConsumption / totalProduction) * 100);
  } else if (totalConsumption > 0) {
    // If no production but consumption exists
    energyPercentage = 0;
  }
  
  // Update bar width
  energyBar.style.width = `${energyPercentage}%`;
  
  // Update bar color based on percentage thresholds
  if (energyPercentage <= 10) {
    // Below 10% - Red
    energyBar.style.backgroundColor = '#F44336';
  } else if (energyPercentage <= 25) {
    // Below 25% - Orange
    energyBar.style.backgroundColor = '#FF9800';
  } else if (energyPercentage <= 50) {
    // Below 50% - Yellow
    energyBar.style.backgroundColor = '#FFEB3B';
  } else {
    // Above 50% - Green
    energyBar.style.backgroundColor = '#4CAF50';
  }
  
  // Check if energy is below 10% for production slowdown only (not game speed)
  if (energyPercentage <= 10) {
    gameState.lowEnergyMode = true;
  } else {
    gameState.lowEnergyMode = false;
  }
}

// Keep DOMContentLoaded but remove the duplicate addPowerIndicator call
document.addEventListener('DOMContentLoaded', () => {
  initProductionTabs();
  setupAllProductionButtons(); // Set up all buttons once
  initSaveGameSystem(); // Initialize save game system
});

// Add building placement handling to the canvas click event
gameCanvas.addEventListener('click', (e) => {
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
      
      // Perform the repair - use gradual repair system instead of instant repair
      gameState.money -= repairCost;
      moneyEl.textContent = gameState.money;
      productionQueue.tryResumeProduction();
      // Create repair info for factory
      if (!gameState.buildingsUnderRepair) {
        gameState.buildingsUnderRepair = [];
      }
      
      const healthToRepair = playerFactory.maxHealth - playerFactory.health;
      
      // Base repair duration on factory cost (same calculation as in buildingRepairHandler.js)
      const baseDuration = 1000; // 1 second base duration
      const factoryCost = 5000;
      const buildDuration = baseDuration * (factoryCost / 500);
      const repairDuration = buildDuration * 2.0; // 2x build time
      
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
          showNotification(`Building repaired for $${result.cost}`);
          playSound('construction_started');
          moneyEl.textContent = gameState.money;
          productionQueue.tryResumeProduction();
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

        // ** ADDED: Update button states after successful placement **
        updateVehicleButtonStates();
        updateBuildingButtonStates();
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
});

// Add mousemove event to show building placement overlay
gameCanvas.addEventListener('mousemove', (e) => {
  if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
    const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x;
    const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y;
    
    // Update cursor position for the overlay renderer
    gameState.cursorX = mouseX;
    gameState.cursorY = mouseY;
    
    // Force a redraw
    requestAnimationFrame(() => {
      renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, gameState.buildings,
        gameState.scrollOffset, gameState.selectionActive, 
        gameState.selectionStart, gameState.selectionEnd, gameState);
    });
  }
});

// Handle escape key to cancel building placement
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && gameState.buildingPlacementMode) {
    productionQueue.cancelBuildingPlacement();
  }
});

// Add repair button functionality
document.getElementById('repairBtn').addEventListener('click', () => {
  gameState.repairMode = !gameState.repairMode;
  // Update button appearance
  const repairBtn = document.getElementById('repairBtn');
  if (gameState.repairMode) {
    repairBtn.classList.add('active');
    showNotification('Repair mode activated. Click on a building to repair it.');
    
    // Turn off sell mode if it's active
    if (gameState.sellMode) {
      gameState.sellMode = false;
      document.getElementById('sellBtn').classList.remove('active');
    }
    
    // Use CSS class for cursor
    gameCanvas.classList.add('repair-mode');
  } else {
    repairBtn.classList.remove('active');
    showNotification('Repair mode deactivated.');
    
    // Remove CSS cursor class
    gameCanvas.classList.remove('repair-mode', 'repair-blocked-mode');
    
    // Reset cursor to default
    gameCanvas.style.cursor = 'default';
  }
  // Cancel building placement mode if active
  if (gameState.buildingPlacementMode) {
    productionQueue.cancelBuildingPlacement();
  }
});

// Add sell button functionality
document.getElementById('sellBtn').addEventListener('click', () => {
  gameState.sellMode = !gameState.sellMode;
  // Update button appearance
  const sellBtn = document.getElementById('sellBtn');
  if (gameState.sellMode) {
    sellBtn.classList.add('active');
    showNotification('Sell mode activated. Click on a building to sell it for 70% of build price.');
    
    // Turn off repair mode if it's active
    if (gameState.repairMode) {
      gameState.repairMode = false;
      document.getElementById('repairBtn').classList.remove('active');
    }
    
    // Use CSS class for cursor
    gameCanvas.classList.add('sell-mode');
  } else {
    sellBtn.classList.remove('active');
    showNotification('Sell mode deactivated.');
    
    // Remove CSS cursor class
    gameCanvas.classList.remove('sell-mode', 'sell-blocked-mode');
    
    // Reset cursor to default
    gameCanvas.style.cursor = 'default';
  }
  // Cancel building placement mode if active
  if (gameState.buildingPlacementMode) {
    productionQueue.cancelBuildingPlacement();
  }
});

// Add building repair handling to the canvas click event
gameCanvas.addEventListener('click', (e) => buildingRepairHandler(e, gameState, gameCanvas, mapGrid, units, factories, productionQueue, moneyEl));

// Add building sell handling to the canvas click event
gameCanvas.addEventListener('click', (e) => {
  const sold = buildingSellHandler(e, gameState, gameCanvas, mapGrid, units, factories, moneyEl);
  // If a building was successfully sold, update button states
  if (sold) {
    updateVehicleButtonStates();
    updateBuildingButtonStates();
  }
});

// Helper function to show notifications
export function showNotification(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.position = 'absolute';
  notification.style.top = '10px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = 'rgba(0,0,0,0.7)';
  notification.style.color = 'white';
  notification.style.padding = '10px 15px';
  notification.style.borderRadius = '5px';
  notification.style.zIndex = '1000';
  
  document.body.appendChild(notification);
  
  // Fade out and remove
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    setTimeout(() => notification.remove(), 500);
  }, duration);
}

// Add function to save player building patterns to localStorage
export function savePlayerBuildPatterns(buildingType) {
  try {
    // Initialize player build history if it doesn't exist
    if (!gameState.playerBuildHistory) {
      // First try to load from localStorage
      const savedHistory = localStorage.getItem('playerBuildHistory');
      gameState.playerBuildHistory = savedHistory ? JSON.parse(savedHistory) : [];
    }
    
    // Get current game session ID (create one if it doesn't exist)
    if (!gameState.currentSessionId) {
      gameState.currentSessionId = Date.now().toString();
    }
    
    // Get the current session's build order
    let currentSession = gameState.playerBuildHistory.find(session => 
      session.id === gameState.currentSessionId
    );
    
    if (!currentSession) {
      // Create a new session
      currentSession = {
        id: gameState.currentSessionId,
        buildings: []
      };
      gameState.playerBuildHistory.push(currentSession);
    }
    
    // Add this building to the current session
    currentSession.buildings.push(buildingType);
    
    // Limit to last 20 sessions
    if (gameState.playerBuildHistory.length > 20) {
      gameState.playerBuildHistory = gameState.playerBuildHistory.slice(-20);
    }
    
    // Save to localStorage
    localStorage.setItem('playerBuildHistory', JSON.stringify(gameState.playerBuildHistory));
    
    console.log(`Saved building ${buildingType} to player build patterns. Session: ${gameState.currentSessionId}`);
  } catch (error) {
    console.error("Error saving player build patterns:", error);
  }
}
