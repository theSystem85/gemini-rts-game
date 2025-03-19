// main.js
import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { gameState } from './gameState.js'
import { setupInputHandlers, selectionActive, selectionStartExport, selectionEndExport } from './inputHandler.js'
import { renderGame, renderMinimap } from './rendering.js'
import { spawnUnit, findPath } from './units.js'
import { initFactories } from './factories.js'
import { playSound, initBackgroundMusic, toggleBackgroundMusic } from './sound.js'
import { updateGame } from './updateGame.js'
import { findClosestOre } from './logic.js'

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

// Create speed control element
const speedControl = document.createElement('div')
speedControl.innerHTML = `
  <label style="display: flex; align-items: center; margin: 10px 0;">
    Game Speed: 
    <input type="number" 
           min="0.25" 
           max="4" 
           step="0.25" 
           value="1" 
           style="width: 70px; margin-left: 10px;"
           id="speedMultiplier">
  </label>
`

// Insert speed control at the beginning of sidebar
if (sidebar.firstChild) {
  sidebar.insertBefore(speedControl, sidebar.firstChild)
} else {
  sidebar.appendChild(speedControl)
}

// New: Add shuffle map control with a seed input
const shuffleControl = document.createElement('div')
shuffleControl.innerHTML = `
  <label style="display: flex; align-items: center; margin: 10px 0;">
    Seed:
    <input type="number" id="mapSeed" value="1" style="width: 70px; margin-left: 10px;">
  </label>
  <button id="shuffleMapBtn" style="margin: 10px 0;">Shuffle Map</button>
`
sidebar.appendChild(shuffleControl)

// Add speed control handler
const speedMultiplier = document.getElementById('speedMultiplier')
speedMultiplier.value = gameState.speedMultiplier // Set initial value to match gameState
speedMultiplier.addEventListener('change', (e) => {
  const value = parseFloat(e.target.value)
  if (value >= 0.25 && value <= 4) {
    gameState.speedMultiplier = value
  } else {
    e.target.value = gameState.speedMultiplier
  }
})

function resizeCanvases() {
  gameCanvas.width = window.innerWidth - 250
  gameCanvas.height = window.innerHeight
  minimapCanvas.width = 250
  minimapCanvas.height = 150
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
    const radius = Math.floor(rand() * 4) + 4; // radius between 4 and 7
    lakeCenters.push({ x: centerX, y: centerY, radius });
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
  generateMap(seed)
  factories.length = 0
  initFactories(factories, mapGrid)
  units.length = 0
  bullets.length = 0
  const playerFactory = factories.find(f => f.id === 'player')
  if (playerFactory) {
    const factoryPixelX = playerFactory.x * TILE_SIZE
    const factoryPixelY = playerFactory.y * TILE_SIZE
    gameState.scrollOffset.x = Math.max(0, Math.min(
      factoryPixelX - gameCanvas.width / 2,
      MAP_TILES_X * TILE_SIZE - gameCanvas.width
    ))
    gameState.scrollOffset.y = Math.max(0, Math.min(
      factoryPixelY - gameCanvas.height / 2,
      MAP_TILES_Y * TILE_SIZE - gameCanvas.height
    ))
  }
  gameState.gameTime = 0
  gameState.gameOver = false
  gameState.gameStarted = true
  gameState.gamePaused = false
  pauseBtn.textContent = 'Pause'
  // ...existing code to restart/update the game loop if necessary...
}

// Add event listener for the shuffle map button using the entered seed
document.getElementById('shuffleMapBtn').addEventListener('click', () => {
  const seedInput = document.getElementById('mapSeed')
  const seed = seedInput.value || '1'
  resetGameWithNewMap(seed)
})

// Replace the original static map generation with the seeded generation on initial load
generateMap(document.getElementById('mapSeed').value)

const factories = []
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
  
  // Center the factory in the viewport
  gameState.scrollOffset.x = Math.max(0, Math.min(
    factoryPixelX - gameCanvas.width / 2,
    MAP_TILES_X * TILE_SIZE - gameCanvas.width
  ))
  gameState.scrollOffset.y = Math.max(0, Math.min(
    factoryPixelY - gameCanvas.height / 2,
    MAP_TILES_Y * TILE_SIZE - gameCanvas.height
  ))
}

const units = []
const bullets = []

setupInputHandlers(units, factories, mapGrid)

const unitCosts = {
  tank: 1000,
  rocketTank: 2000,
  harvester: 500,
  'tank-v2': 2000
}

// Enhanced production queue system
const productionQueue = {
  items: [],
  current: null,
  paused: false,
  
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
  
  addItem: function(unitType, button) {
    const cost = unitCosts[unitType] || 0;
    // Immediately deduct cost when button is clicked
    if (gameState.money < cost) {
      // Optionally show an error feedback here
      return;
    }
    gameState.money -= cost;
    // Add to queue
    this.items.push({ unitType, button });
    let currentCount = this.items.filter(item => item.button === button).length;
    this.updateBatchCounter(button, currentCount);
    if (!this.current && !this.paused) {
      this.startNextProduction();
    }
  },
  
  startNextProduction: function() {
    if (this.items.length === 0 || this.paused) return;
    const item = this.items[0];
    const cost = unitCosts[item.unitType] || 0;
    // Set production duration proportional to cost.
    // For example: harvester (cost 500) takes 3000ms, so duration = 3000 * (cost/500)
    const baseDuration = 3000;
    const duration = baseDuration * (cost / 500);
    this.current = {
      unitType: item.unitType,
      button: item.button,
      progress: 0,
      startTime: performance.now(),
      duration: duration
    }
    // Mark button as active
    item.button.classList.add('active');
    playSound('productionStart');
  },
  
  updateProgress: function(timestamp) {
    if (!this.current || this.paused) return;
    const elapsed = timestamp - this.current.startTime;
    const progress = Math.min(elapsed / this.current.duration, 1);
    this.current.progress = progress;
    const progressBar = this.current.button.querySelector('.production-progress');
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`;
    }
    if (progress >= 1) {
      this.completeCurrentProduction();
    }
  },
  
  completeCurrentProduction: function() {
    if (!this.current) return;
    const unitType = this.current.unitType;
    // Remove item from queue
    this.items.shift();
    this.updateBatchCounter(this.current.button, this.items.filter(item => item.button === this.current.button).length);
    
    // Spawn the unit
    const playerFactory = factories.find(f => f.id === 'player');
    if (playerFactory) {
      const newUnit = spawnUnit(playerFactory, unitType, units, mapGrid);
      if (newUnit) {
        units.push(newUnit);
        playSound('productionReady');
        // If the produced unit is a harvester, automatically send it to harvest.
        if (newUnit.type === 'harvester') {
          // Assume findClosestOre and findPath have been imported.
          const orePos = findClosestOre(newUnit, mapGrid);
          if (orePos) {
            const newPath = findPath({ x: newUnit.tileX, y: newUnit.tileY }, orePos, mapGrid, null);
            if (newPath.length > 1) {
              newUnit.path = newPath.slice(1);
            }
          }
        }
      } else {
        console.warn("Failed to spawn unit - refunding cost");
        gameState.money += unitCosts[unitType] || 0;
      }
    }
    this.current = null;
    if (this.items.length > 0) {
      this.startNextProduction();
    }
    playSound('productionComplete');
    // Remove active/paused classes from button
    this.current && this.current.button.classList.remove('active', 'paused');
  },
  
  togglePause: function() {
    this.paused = !this.paused
    
    if (this.current) {
      this.current.button.classList.toggle('paused', this.paused)
      
      if (!this.paused) {
        // Reset the start time to account for the pause
        this.current.startTime = performance.now() - (this.current.progress * this.current.duration)
        this.startNextProduction()
      } else {
        playSound('productionPaused') // Play pause sound
      }
    }
  },
  cancelProduction: function() {
    if (!this.current) return
    
    const button = this.current.button
    const unitType = this.current.unitType
    
    // Play cancel sound before cancelling
    playSound('productionCancelled')
    
    // Return money for the current production
    gameState.money += unitCosts[unitType] || 0
    
    // Remove item from queue
    this.items.shift()
    
    // Count remaining items of this type
    let remainingCount = this.items.filter(item => item.button === button).length;
    
    // Update batch counter
    this.updateBatchCounter(button, remainingCount);
    
    // Reset the progress bar
    const progressBar = button.querySelector('.production-progress')
    if (progressBar) {
      progressBar.style.width = '0%'
    }
    
    // Clear current production
    this.current = null
    this.paused = false
    
    // Start next item in queue if available
    if (this.items.length > 0) {
      this.startNextProduction()
    }
  }
}

// Replace the existing event listener setup for production buttons with this updated version
// that targets both tabs of production buttons
function setupProductionButtonListeners() {
  // Select all unit production buttons from the units tab
  const allProductionButtons = document.querySelectorAll('.production-button[data-unit-type]');
  
  allProductionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const unitType = button.getAttribute('data-unit-type');
      const cost = unitCosts[unitType] || 0;
      
      if (gameState.money < cost) {
        // Show visual feedback for not enough money
        button.classList.add('error');
        setTimeout(() => button.classList.remove('error'), 300);
        return;
      }
      
      // Add to production queue
      productionQueue.addItem(unitType, button);
    });
    
    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      // Check if this button has the current production
      if (productionQueue.current && productionQueue.current.button === button) {
        if (!productionQueue.paused) {
          // First right-click pauses
          productionQueue.togglePause();
        } else {
          // Second right-click cancels
          productionQueue.cancelProduction();
        }
      } else {
        // Find the last queued item of this type
        for (let i = productionQueue.items.length - 1; i >= 0; i--) {
          if (productionQueue.items[i].button === button) {
            // Return money for the cancelled production
            gameState.money += unitCosts[productionQueue.items[i].unitType] || 0;
            
            // Remove from queue
            productionQueue.items.splice(i, 1);
            
            // Update batch counter
            const remainingCount = productionQueue.items.filter(
              item => item.button === button
            ).length + (productionQueue.current && productionQueue.current.button === button ? 1 : 0);
            
            productionQueue.updateBatchCounter(button, remainingCount);
            
            break; // Only remove one at a time
          }
        }
      }
    });
  });
}

// Add a DOMContentLoaded event listener to ensure the buttons exist before attaching listeners
document.addEventListener('DOMContentLoaded', () => {
  setupProductionButtonListeners();
});

// Remove or comment out the old code that's causing the error
// productionButtons.querySelectorAll('.production-button').forEach(button => { ... });

pauseBtn.addEventListener('click', () => {
  gameState.gamePaused = !gameState.gamePaused
  pauseBtn.textContent = gameState.gamePaused ? 'Resume' : 'Pause'
})

restartBtn.addEventListener('click', () => {
  window.location.reload()
})

gameState.gameStarted = true
gameState.gamePaused = false
pauseBtn.textContent = 'Pause'

// Instead of auto-playing background music immediately,
// wait for the first user interaction.
document.addEventListener('click', initBackgroundMusic, { once: true })

const musicControlButton = document.getElementById('musicControl')
if (musicControlButton) {
  musicControlButton.addEventListener('click', () => {
    toggleBackgroundMusic()
    musicControlButton.textContent = musicControlButton.textContent === "Pause Music" ? "Play Music" : "Pause Music"
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

  window.addEventListener('mouseup', () => {
    isMinimapDragging = false;
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
  
  // Calculate click position relative to minimap
  const clickX = (e.clientX - minimapRect.left) / minimapRect.width
  const clickY = (e.clientY - minimapRect.top) / minimapRect.height
  
  // Calculate new scroll position
  const newX = clickX * (MAP_TILES_X * TILE_SIZE - gameCanvas.width)
  const newY = clickY * (MAP_TILES_Y * TILE_SIZE - gameCanvas.height)
  
  // Update gameState.scrollOffset instead of cameraPosition
  gameState.scrollOffset.x = Math.max(0, Math.min(newX, MAP_TILES_X * TILE_SIZE - gameCanvas.width))
  gameState.scrollOffset.y = Math.max(0, Math.min(newY, MAP_TILES_Y * TILE_SIZE - gameCanvas.height))
}

let lastTime = performance.now()
function gameLoop(time) {
  try {
    const delta = (time - lastTime) * gameState.speedMultiplier
    lastTime = time
    
    if (gameState.gameStarted && !gameState.gamePaused) {
      updateGame(delta, mapGrid, factories, units, bullets, gameState)
    }
    
    renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, 
              gameState.scrollOffset, selectionActive, 
              selectionStartExport, selectionEndExport, gameState)
    renderMinimap(minimapCtx, minimapCanvas, mapGrid, 
                 gameState.scrollOffset, gameCanvas, units)
    
    moneyEl.textContent = gameState.money
    gameTimeEl.textContent = Math.floor(gameState.gameTime)
    winsEl.textContent = gameState.wins
    lossesEl.textContent = gameState.losses
    
    requestAnimationFrame(gameLoop)
  } catch (error) {
    console.error("Critical error in game loop:", error)
    // Try to recover by requesting next frame
    requestAnimationFrame(gameLoop)
  }
}

// Modify the animation loop to update production progress
function animate(timestamp) {
  if (!gameState.gameStarted || gameState.gamePaused) {
    requestAnimationFrame(animate)
    return
  }
  
  // Calculate delta time with a maximum to avoid spiral of doom on slow frames
  const now = timestamp || performance.now()
  if (!lastFrameTime) lastFrameTime = now
  const delta = Math.min(now - lastFrameTime, 33) // Cap at ~30 FPS equivalent
  lastFrameTime = now
  
  // Check if game is over
  if (gameState.gameOver) {
    gameState.gamePaused = true
  }
  
  // Update production progress
  productionQueue.updateProgress(timestamp)
  
  // Update game elements
  updateGame(delta / 1000, mapGrid, factories, units, bullets, gameState)
  
  // Render game
  renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, 
    gameState.scrollOffset, gameState.selectionActive, 
    gameState.selectionStart, gameState.selectionEnd, gameState)
  
  // Render minimap
  renderMinimap(minimapCtx, minimapCanvas, mapGrid, 
    gameState.scrollOffset, gameCanvas, units)
  
  // Update money display
  moneyEl.textContent = `$${Math.floor(gameState.money)}`
  
  // Update game time display
  const gameTimeSeconds = Math.floor(gameState.gameTime)
  const minutes = Math.floor(gameTimeSeconds / 60)
  const seconds = gameTimeSeconds % 60
  gameTimeEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  
  // Use setTimeout to ensure we don't overload the browser
  if (units.length > 20) {
    // For large number of units, use setTimeout to give browser breathing room
    setTimeout(() => requestAnimationFrame(animate), 5)
  } else {
    requestAnimationFrame(animate)
  }
}

// Helper function to check valid position
function isValidPosition(x, y, mapGrid) {
  return y >= 0 && y < mapGrid.length && 
         x >= 0 && x < mapGrid[0].length && 
         mapGrid[y][x].type !== 'water' && 
         mapGrid[y][x].type !== 'rock'
}

// Initialize animation loop
let lastFrameTime = null
requestAnimationFrame(animate)

gameLoop(performance.now())

// Initialize production tabs
function initProductionTabs() {
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
      document.getElementById(`${tabName}TabContent`).classList.add('active');
    });
  });
  
  // Setup building buttons
  setupBuildingButtons();
}

function setupBuildingButtons() {
  const buildingButtons = document.querySelectorAll('[data-building-type]');
  
  buildingButtons.forEach(button => {
    button.addEventListener('click', () => {
      const buildingType = button.getAttribute('data-building-type');
      // We'll implement actual building production logic later
      console.log(`Attempting to build: ${buildingType}`);
      
      // For now, we'll just show a message that this feature is coming soon
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = `Building ${buildingType} - Feature coming soon!`;
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
      
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => notification.remove(), 500);
      }, 2000);
    });
  });
}

// Make sure to initialize the tabs
document.addEventListener('DOMContentLoaded', () => {
  initProductionTabs();
});
