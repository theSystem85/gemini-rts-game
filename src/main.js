// main.js
// Refactored main game orchestrator

import { setupInputHandlers, selectedUnits } from './inputHandler.js'
import { unitCosts, initializeOccupancyMap, rebuildOccupancyMapWithTextures } from './units.js'
import { gameState } from './gameState.js'
import { buildingData } from './buildings.js'
import { productionQueue } from './productionQueue.js'
import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y, ORE_SPREAD_ENABLED, setOreSpreadEnabled } from './config.js'
import { initFactories } from './factories.js'
import { initializeGameAssets, generateMap as generateMapFromSetup, cleanupOreFromBuildings } from './gameSetup.js'
import { initSaveGameSystem } from './saveGame.js'
import { showNotification } from './ui/notifications.js'
import { resetAttackDirections } from './ai/enemyStrategies.js'
import { getTextureManager, preloadTileTextures } from './rendering.js'
import { milestoneSystem } from './game/milestoneSystem.js'

// Import new modules
import { CanvasManager } from './rendering/canvasManager.js'
import { ProductionController } from './ui/productionController.js'
import { EventHandlers } from './ui/eventHandlers.js'
import { GameLoop } from './game/gameLoop.js'
import { setupMinimapHandlers } from './ui/minimap.js'
import { addPowerIndicator } from './ui/energyBar.js'

const MAP_SEED_STORAGE_KEY = 'rts-map-seed'
const PLAYER_COUNT_STORAGE_KEY = 'rts-player-count'

function loadPersistedSettings() {
  try {
    const seedInput = document.getElementById('mapSeed')
    const storedSeed = localStorage.getItem(MAP_SEED_STORAGE_KEY)
    if (seedInput && storedSeed !== null) {
      seedInput.value = storedSeed
    }
  } catch (e) {
    console.warn('Failed to load map seed from localStorage:', e)
  }

  try {
    const playerInput = document.getElementById('playerCount')
    const storedCount = localStorage.getItem(PLAYER_COUNT_STORAGE_KEY)
    if (playerInput && storedCount !== null) {
      const parsed = parseInt(storedCount)
      if (!isNaN(parsed) && parsed >= 2 && parsed <= 4) {
        playerInput.value = parsed
        gameState.playerCount = parsed
      }
    }
  } catch (e) {
    console.warn('Failed to load player count from localStorage:', e)
  }
}

// Initialize loading states
let allAssetsLoaded = false

// Global game instance for save/load system
let gameInstance = null

// Export function to get current game instance
export function getCurrentGame() {
  return gameInstance
}

// Game class to orchestrate everything
class Game {
  constructor() {
    this.canvasManager = new CanvasManager()
    this.productionController = new ProductionController()

    gameInstance = this
    this.initializeGame()
  }

  async initializeGame() {
    // Initialize game assets
    await this.loadAssets()

    // Setup game world
    this.setupGameWorld()

    // Setup UI components
    this.setupUI()

    // Start game loop
    this.startGameLoop()
  }

  async loadAssets() {
    return new Promise((resolve) => {
      initializeGameAssets(() => {
        allAssetsLoaded = true
        
        // Load textures and rebuild occupancy map once they're loaded
        preloadTileTextures(() => {
          console.log('Textures loaded, rebuilding occupancy map...')
          const newOccupancyMap = rebuildOccupancyMapWithTextures(units, mapGrid, getTextureManager())
          if (newOccupancyMap) {
            gameState.occupancyMap = newOccupancyMap
            console.log('Occupancy map updated with impassable grass tiles')
          }
        })
        
        resolve()
      })
    })
  }

  setupGameWorld() {
    // Generate map
    generateMapFromSetup(document.getElementById('mapSeed').value, mapGrid, MAP_TILES_X, MAP_TILES_Y)
    
    // Sync mapGrid with gameState
    gameState.mapGrid.length = 0
    gameState.mapGrid.push(...mapGrid)

    // Initialize factories and units
    initFactories(factories, mapGrid)
    
    // Sync factories with gameState
    gameState.factories.length = 0
    gameState.factories.push(...factories)
    // Treat initial factories as standard buildings
    gameState.buildings.push(...factories)
    
    // Ensure no ore overlaps with buildings or factories
    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)

    // Initialize rally points as null
    factories.forEach(factory => {
      factory.rallyPoint = null
      factory.selected = false
    })

    // Also initialize rally points for vehicle factories only
    gameState.buildings.forEach(building => {
      if (building.type === 'vehicleFactory') {
        building.rallyPoint = null
      }
    })

    // Reset enemy AI attack directions for fresh game
    resetAttackDirections()

    // Center viewport on player factory
    this.centerOnPlayerFactory()

    // Setup input handlers
    setupInputHandlers(units, factories, mapGrid)

    // Initialize leveling for any existing units
    units.forEach(unit => {
      if (unit.type !== 'harvester') {
        unit.level = unit.level || 0
        unit.experience = unit.experience || 0
        const unitCosts = {
          tank: 1000,
          rocketTank: 2000,
          'tank-v2': 2000,
          'tank-v3': 3000,
          tank_v1: 1000
        }
        unit.baseCost = unit.baseCost || unitCosts[unit.type] || 1000
      }
    })

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
  }

  centerOnPlayerFactory() {
    const humanPlayer = gameState.humanPlayer || 'player1'
    const playerFactory = factories.find(f => f.id === humanPlayer) || factories.find(f => f.id === 'player')
    if (playerFactory) {
      const factoryPixelX = playerFactory.x * TILE_SIZE
      const factoryPixelY = playerFactory.y * TILE_SIZE

      const gameCanvas = this.canvasManager.getGameCanvas()
      const logicalCanvasWidth = parseInt(gameCanvas.style.width, 10) || gameCanvas.width
      const logicalCanvasHeight = parseInt(gameCanvas.style.height, 10) || gameCanvas.height

      gameState.scrollOffset.x = Math.max(0, Math.min(
        factoryPixelX - logicalCanvasWidth / 2,
        MAP_TILES_X * TILE_SIZE - logicalCanvasWidth
      ))
      gameState.scrollOffset.y = Math.max(0, Math.min(
        factoryPixelY - logicalCanvasHeight / 2,
        MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight
      ))
    }
  }

  setupUI() {
    // Get UI elements
    const moneyEl = document.getElementById('money')
    // Store these elements for potential future use
    document.getElementById('gameTime')
    document.getElementById('wins')
    document.getElementById('losses')
    const sidebar = document.getElementById('sidebar')

    // Hide start button and style sidebar
    const startBtn = document.getElementById('startBtn')
    if (startBtn) {
      startBtn.style.display = 'none'
    }
    sidebar.style.backgroundColor = '#333'
    sidebar.style.color = '#fff'

    // Initialize energy bar
    addPowerIndicator()

    // Setup speed control
    this.setupSpeedControl()

    // Setup player count control
    this.setupPlayerCountControl()

    // Setup map shuffle
    this.setupMapShuffle()

    // Setup map settings
    this.setupMapSettings()

    // Setup production tabs and buttons
    this.productionController.initProductionTabs()
    this.productionController.setupAllProductionButtons()

    // Setup event handlers
    this.eventHandlers = new EventHandlers(
      this.canvasManager,
      factories,
      units,
      mapGrid,
      moneyEl,
      this // Pass the game instance
    )
    this.eventHandlers.setProductionController(this.productionController)

    // Setup minimap handlers
    setupMinimapHandlers(this.canvasManager.getGameCanvas())

    // Initialize save game system
    initSaveGameSystem()

    // Set game state
    gameState.gameStarted = true

    // Background music is loaded on demand via the music control button
  }

  setupSpeedControl() {
    const speedMultiplier = document.getElementById('speedMultiplier')
    if (speedMultiplier) {
      speedMultiplier.value = gameState.speedMultiplier
      speedMultiplier.addEventListener('change', (e) => {
        const value = parseFloat(e.target.value)
        if (value >= 0.25 && value <= 4) {
          gameState.speedMultiplier = value
        } else {
          e.target.value = gameState.speedMultiplier
        }
      })
    }
  }

  setupPlayerCountControl() {
    const playerCountInput = document.getElementById('playerCount')
    if (playerCountInput) {
      playerCountInput.value = gameState.playerCount || 2
      playerCountInput.addEventListener('change', (e) => {
        const value = parseInt(e.target.value)
        if (value >= 2 && value <= 4) {
          gameState.playerCount = value
          try {
            localStorage.setItem(PLAYER_COUNT_STORAGE_KEY, value.toString())
          } catch (err) {
            console.warn('Failed to save player count to localStorage:', err)
          }
          // Note: Map will be regenerated on next shuffle
        } else {
          e.target.value = gameState.playerCount || 2
        }
      })
    }
  }

  setupMapShuffle() {
    const seedInput = document.getElementById('mapSeed')
    if (seedInput) {
      seedInput.addEventListener('change', (e) => {
        try {
          localStorage.setItem(MAP_SEED_STORAGE_KEY, e.target.value)
        } catch (err) {
          console.warn('Failed to save map seed to localStorage:', err)
        }
      })
    }

    document.getElementById('shuffleMapBtn').addEventListener('click', () => {
      const seed = seedInput ? seedInput.value || '1' : '1'
      try {
        localStorage.setItem(MAP_SEED_STORAGE_KEY, seed)
      } catch (err) {
        console.warn('Failed to save map seed to localStorage:', err)
      }
      this.resetGameWithNewMap(seed)
    })
  }

  setupMapSettings() {
    const settingsBtn = document.getElementById('mapSettingsBtn')
    const settingsMenu = document.getElementById('mapSettingsMenu')
    const oreCheckbox = document.getElementById('oreSpreadCheckbox')

    if (!settingsBtn || !settingsMenu || !oreCheckbox) return

    oreCheckbox.checked = ORE_SPREAD_ENABLED
    settingsBtn.addEventListener('click', () => {
      settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none'
    })

    oreCheckbox.addEventListener('change', (e) => {
      setOreSpreadEnabled(e.target.checked)
    })
  }

  resetGameWithNewMap(seed) {
    // Clear existing buildings before generating new map
    gameState.buildings.length = 0
    gameState.powerSupply = 0
    gameState.buildingPlacementMode = false
    gameState.currentBuildingType = null
    gameState.repairMode = false
    
    generateMapFromSetup(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y)
    
    // Sync mapGrid with gameState
    gameState.mapGrid.length = 0
    gameState.mapGrid.push(...mapGrid)
    
    factories.length = 0
    initFactories(factories, mapGrid)
    
    // Sync factories with gameState
    gameState.factories.length = 0
    gameState.factories.push(...factories)
    gameState.buildings.push(...factories)

    // Ensure no ore overlaps with buildings or factories
    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)

    units.length = 0
    bullets.length = 0

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())

    this.centerOnPlayerFactory()

    gameState.gameTime = 0
    gameState.gameOver = false
    gameState.gameStarted = true
    gameState.gamePaused = false  // Auto-start the game immediately

    // Update pause button to show pause icon since game is now running
    const pauseBtn = document.getElementById('pauseBtn')
    const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
    if (playPauseIcon) {
      playPauseIcon.textContent = '⏸'
    }
    
    // Resume production after unpause since game is now running
    productionQueue.resumeProductionAfterUnpause()

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())
  }

  async resetGame() {
    console.log('Resetting game...')
    
    // Stop existing game loop to prevent conflicts
    if (this.gameLoop) {
      if (typeof this.gameLoop.stop === 'function') {
        this.gameLoop.stop()
      }
      this.gameLoop = null
    }
    
    // Preserve win/loss statistics
    const preservedWins = gameState.wins
    const preservedLosses = gameState.losses
    
    // Reset game state
    gameState.money = 10000
    gameState.gameTime = 0
    gameState.frameCount = 0
    gameState.gameStarted = true  // Auto-start the game
    gameState.gamePaused = false  // Make sure it's not paused
    gameState.gameOver = false
    gameState.gameOverMessage = null
    gameState.gameResult = null
    gameState.playerUnitsDestroyed = 0
    gameState.enemyUnitsDestroyed = 0
    gameState.playerBuildingsDestroyed = 0
    gameState.enemyBuildingsDestroyed = 0
    gameState.totalMoneyEarned = 0

    // Reset other game state properties
    gameState.buildings = []
    gameState.powerSupply = 0
    gameState.buildingPlacementMode = false
    gameState.currentBuildingType = null
    gameState.repairMode = false
    gameState.radarActive = false
    gameState.targetedOreTiles = {}
    gameState.refineryStatus = {}
    gameState.defeatedPlayers = new Set() // Reset defeated players tracking

    // Restore preserved statistics
    gameState.wins = preservedWins
    gameState.losses = preservedLosses

    // Reset map and units
    generateMapFromSetup(Date.now(), mapGrid, MAP_TILES_X, MAP_TILES_Y)
    
    // Sync mapGrid with gameState
    gameState.mapGrid.length = 0
    gameState.mapGrid.push(...mapGrid)
    
    factories.length = 0
    initFactories(factories, mapGrid)
    
    // Sync factories with gameState
    gameState.factories.length = 0
    gameState.factories.push(...factories)
    gameState.buildings.push(...factories)

    // Ensure no ore overlaps with buildings or factories
    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)
    
    units.length = 0
    bullets.length = 0

    // Reinitialize occupancy map for the fresh map
    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())

    // Reset production queue and clear all pending items
    if (typeof productionQueue !== 'undefined') {
      productionQueue.unitItems.length = 0
      productionQueue.buildingItems.length = 0
      productionQueue.completedBuildings.length = 0
      productionQueue.currentUnit = null
      productionQueue.currentBuilding = null
      productionQueue.pausedUnit = false
      productionQueue.pausedBuilding = false
      productionQueue.unitPaid = 0
      productionQueue.buildingPaid = 0
    }

    // Reset milestone system
    try {
      if (milestoneSystem) {
        milestoneSystem.reset()
      }
    } catch (err) {
      console.warn('Could not reset milestone system:', err)
    }

    // Reset UI elements
    this.updateUIAfterReset()

    // Center camera on player factory
    this.centerOnPlayerFactory()

    // Update win/loss display to show preserved statistics
    this.updateStatsDisplay()

    // Start new game loop with a small delay to ensure cleanup is complete
    setTimeout(() => {
      this.startGameLoop()
      console.log('Game reset complete!')
    }, 100)
  }

  updateUIAfterReset() {
    // Reset production button states
    if (this.productionController) {
      this.productionController.updateVehicleButtonStates()
      this.productionController.updateBuildingButtonStates()
    }

    // Reset pause button state for auto-start
    const pauseBtn = document.getElementById('pauseBtn')
    if (pauseBtn) {
      const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
      if (playPauseIcon) {
        playPauseIcon.textContent = '⏸'  // Show pause icon since game is running
      }
    }

    // Clear all progress bars and counters
    document.querySelectorAll('.production-progress').forEach(bar => {
      bar.style.width = '0%'
    })
    
    document.querySelectorAll('.batch-counter').forEach(counter => {
      counter.style.display = 'none'
    })

    document.querySelectorAll('.ready-counter').forEach(counter => {
      counter.style.display = 'none'
    })

    // Remove active states from production buttons
    document.querySelectorAll('.production-button').forEach(button => {
      button.classList.remove('active', 'paused', 'ready-for-placement')
    })
  }

  updateStatsDisplay() {
    // Update wins/losses display
    const winsEl = document.getElementById('wins')
    const lossesEl = document.getElementById('losses')
    
    if (winsEl) {
      winsEl.textContent = gameState.wins
    }
    
    if (lossesEl) {
      lossesEl.textContent = gameState.losses
    }
  }

  startGameLoop() {
    // Ensure any existing game loop is stopped first
    if (this.gameLoop) {
      if (typeof this.gameLoop.stop === 'function') {
        this.gameLoop.stop()
      }
      this.gameLoop = null
    }
    
    this.gameLoop = new GameLoop(
      this.canvasManager,
      this.productionController,
      mapGrid,
      factories,
      units,
      bullets,
      productionQueue,
      document.getElementById('money'),
      document.getElementById('gameTime')
    )

    this.gameLoop.setAssetsLoaded(allAssetsLoaded)
    this.gameLoop.start()
  }
}

// Seeded random generator
// eslint-disable-next-line no-unused-vars
function seededRandom(seed) {
  const m = 0x80000000, a = 1103515245, c = 12345
  let state = seed
  return function() {
    state = (a * state + c) % m
    return state / (m - 1)
  }
}

// Export game data for use by other modules
export const mapGrid = []
export const factories = []
export const units = []
export const bullets = []

// Add buildingCosts based on our building data
export const buildingCosts = {}
for (const [type, data] of Object.entries(buildingData)) {
  buildingCosts[type] = data.cost
}

// Add factory repair cost
buildingCosts['factory'] = 5000

// Export for backward compatibility
export { unitCosts }
export { showNotification }

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedSettings()
  gameInstance = new Game()
  
  // Also make it available globally for debugging
  window.gameInstance = gameInstance
  window.gameInstance.units = units
})

// Debug helper to access selectedUnits
window.debugGetSelectedUnits = () => selectedUnits

// Debug helper to test narrated sound stacking
import { testNarratedSounds, playSound, preloadSounds, getSoundCacheStatus, clearSoundCache } from './sound.js'
window.testNarratedSounds = testNarratedSounds
window.debugPlaySound = playSound
window.getSoundCacheStatus = getSoundCacheStatus
window.clearSoundCache = clearSoundCache

// Preload all sound files for optimal performance (async)
preloadSounds().then(() => {
  console.log('Sound preloading completed')
}).catch(e => {
  console.error('Sound preloading failed:', e)
})

// Export functions for backward compatibility - these are now handled by ProductionController
export function updateVehicleButtonStates() {
  // This function is now handled by ProductionController
  console.warn('updateVehicleButtonStates called from main.js - should use ProductionController instead')
}

export function updateBuildingButtonStates() {
  // This function is now handled by ProductionController
  console.warn('updateBuildingButtonStates called from main.js - should use ProductionController instead')
}
