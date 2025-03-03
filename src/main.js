// main.js
import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { gameState } from './gameState.js'
import { tileToPixel } from './utils.js'
import { setupInputHandlers, selectedUnits, selectionActive, selectionStartExport, selectionEndExport } from './inputHandler.js'
import { renderGame, renderMinimap } from './rendering.js'
import { spawnUnit } from './units.js'
import { initFactories } from './factories.js'
import { playSound, initBackgroundMusic, toggleBackgroundMusic } from './sound.js'
import { updateGame } from './logic.js'

const gameCanvas = document.getElementById('gameCanvas')
const gameCtx = gameCanvas.getContext('2d')
const minimapCanvas = document.getElementById('minimap')
const minimapCtx = minimapCanvas.getContext('2d')
const moneyEl = document.getElementById('money')
const gameTimeEl = document.getElementById('gameTime')
const winsEl = document.getElementById('wins')
const lossesEl = document.getElementById('losses')
const productionProgressEl = document.getElementById('productionProgress')
const pauseBtn = document.getElementById('pauseBtn')
const restartBtn = document.getElementById('restartBtn')
const sidebar = document.getElementById('sidebar')

const productionButtons = document.getElementById('productionButtons')

const startBtn = document.getElementById('startBtn')
if (startBtn) {
  startBtn.style.display = 'none'
}
sidebar.style.backgroundColor = '#333'
sidebar.style.color = '#fff'

function resizeCanvases() {
  gameCanvas.width = window.innerWidth - 250
  gameCanvas.height = window.innerHeight
  minimapCanvas.width = 250
  minimapCanvas.height = 150
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

export const mapGrid = []
for (let y = 0; y < MAP_TILES_Y; y++) {
  mapGrid[y] = []
  for (let x = 0; x < MAP_TILES_X; x++) {
    mapGrid[y][x] = { type: 'land' }
  }
}
for (let y = 45; y < 55; y++) {
  for (let x = 10; x < MAP_TILES_X - 10; x++) {
    mapGrid[y][x].type = 'water'
  }
}
for (let y = 20; y < 80; y++) {
  for (let x = 5; x < 15; x++) {
    mapGrid[y][x].type = 'rock'
  }
}
for (let y = 70; y < 75; y++) {
  for (let x = 50; x < MAP_TILES_X - 5; x++) {
    mapGrid[y][x].type = 'street'
  }
}
for (let i = 0; i < 100; i++) {
  const x = Math.floor(Math.random() * MAP_TILES_X)
  const y = Math.floor(Math.random() * MAP_TILES_Y)
  if (mapGrid[y][x].type === 'land') {
    mapGrid[y][x].type = 'ore'
  }
}

const factories = []
initFactories(factories, mapGrid)

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
  harvester: 500
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
    // Add to queue
    this.items.push({ unitType, button });
    
    // Count only queued items
    let currentCount = this.items.filter(item => item.button === button).length;
    
    // Update batch counter with the correct total
    this.updateBatchCounter(button, currentCount);
    
    // Start production if not already in progress
    if (!this.current && !this.paused) {
      this.startNextProduction();
    }
  },
  startNextProduction: function() {
    if (this.items.length === 0 || this.paused) return
    
    const item = this.items[0]
    const cost = unitCosts[item.unitType] || 0
    
    if (gameState.money < cost) {
      // Not enough money, check again later
      setTimeout(() => this.startNextProduction(), 1000)
      return
    }
    
    // Deduct the cost
    gameState.money -= cost
    
    // Start the production
    this.current = {
      unitType: item.unitType,
      button: item.button,
      progress: 0,
      startTime: performance.now(),
      duration: 3000 // 3 seconds
    }
    
    // Mark button as active
    item.button.classList.add('active')
    
    playSound('productionStart')
  },
  updateProgress: function(timestamp) {
    if (!this.current || this.paused) return
    
    const elapsed = timestamp - this.current.startTime
    const progress = Math.min(elapsed / this.current.duration, 1)
    this.current.progress = progress
    
    // Update the progress bar
    const progressBar = this.current.button.querySelector('.production-progress')
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`
    }
    
    if (progress >= 1) {
      // Production complete
      this.completeCurrentProduction()
    }
  },
  completeCurrentProduction: function() {
    if (!this.current) return
    
    const unitType = this.current.unitType
    const button = this.current.button
    
    // Remove item from queue and get count of remaining items of this type
    this.items.shift();
    let remainingCount = this.items.filter(item => item.button === button).length;
    
    // Update batch counter
    this.updateBatchCounter(button, remainingCount);
    
    // Reset the progress bar
    const progressBar = button.querySelector('.production-progress')
    if (progressBar) {
      progressBar.style.width = '0%'
    }
    
    // Spawn the unit with all required parameters
    const playerFactory = factories.find(f => f.id === 'player') // Changed from owner to id
    if (playerFactory) {
      const newUnit = spawnUnit(playerFactory, unitType, units, mapGrid)
      // Add the new unit to the units array if it was created successfully
      if (newUnit) {
        units.push(newUnit)
        playSound('productionReady') // Add sound feedback for unit creation
      } else {
        // If unit creation failed, refund the cost
        console.warn("Failed to spawn unit - refunding cost")
        gameState.money += unitCosts[unitType] || 0
      }
    }
    
    // Clear current production
    this.current = null
    
    // Start next item in queue if available
    if (this.items.length > 0) {
      setTimeout(() => this.startNextProduction(), 100)
    }
    
    playSound('productionComplete')
  },
  togglePause: function() {
    this.paused = !this.paused
    
    if (this.current) {
      this.current.button.classList.toggle('paused', this.paused)
      
      if (!this.paused) {
        // Reset the start time to account for the pause
        this.current.startTime = performance.now() - (this.current.progress * this.current.duration)
        this.startNextProduction()
      }
    }
  },
  cancelProduction: function() {
    if (!this.current) return
    
    const button = this.current.button
    const unitType = this.current.unitType
    
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

productionButtons.querySelectorAll('.production-button').forEach(button => {
  button.addEventListener('click', () => {
    const unitType = button.getAttribute('data-unit-type')
    const cost = unitCosts[unitType] || 0
    
    if (gameState.money < cost) {
      // Show visual feedback for not enough money
      button.classList.add('error')
      setTimeout(() => button.classList.remove('error'), 300)
      return
    }
    
    // Add to production queue
    productionQueue.addItem(unitType, button)
  })
  
  button.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    
    // Check if this button has the current production
    if (productionQueue.current && productionQueue.current.button === button) {
      if (!productionQueue.paused) {
        // First right-click pauses
        productionQueue.togglePause()
      } else {
        // Second right-click cancels
        productionQueue.cancelProduction()
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
  })
})

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
    const delta = time - lastTime
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
