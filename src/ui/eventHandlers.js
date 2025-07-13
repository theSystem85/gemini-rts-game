// eventHandlers.js
// Handle game control and building placement event handlers

import { gameState } from '../gameState.js'
import { productionQueue } from '../productionQueue.js'
import { toggleBackgroundMusic, bgMusicAudio, setMasterVolume, getMasterVolume } from '../sound.js'
import { buildingRepairHandler } from '../buildingRepairHandler.js'
import { buildingSellHandler } from '../buildingSellHandler.js'
import { showNotification } from './notifications.js'
import { milestoneSystem } from '../game/milestoneSystem.js'
import { isInputFieldFocused } from '../utils/inputUtils.js'
import {
  canPlaceBuilding,
  createBuilding,
  placeBuilding,
  updatePowerSupply,
  buildingData,
  isTileValid
} from '../buildings.js'
import { playSound } from '../sound.js'
import { savePlayerBuildPatterns } from '../savePlayerBuildPatterns.js'
import { TILE_SIZE } from '../config.js'

export class EventHandlers {
  constructor(canvasManager, factories, units, mapGrid, moneyEl, gameInstance = null) {
    this.canvasManager = canvasManager
    this.factories = factories
    this.units = units
    this.mapGrid = mapGrid
    this.moneyEl = moneyEl
    this.gameInstance = gameInstance

    this.setupGameControls()
    this.setupBuildingPlacement()
    this.setupRepairAndSellModes()
    this.setupVolumeControl()
  }

  setupGameControls() {
    const pauseBtn = document.getElementById('pauseBtn')
    const restartBtn = document.getElementById('restartBtn')
    const musicControlButton = document.getElementById('musicControl')

    // Pause/resume functionality
    pauseBtn.addEventListener('click', () => {
      gameState.gamePaused = !gameState.gamePaused

      // Update button icon based on game state
      const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
      if (playPauseIcon) {
        playPauseIcon.textContent = gameState.gamePaused ? '▶' : '⏸'
      }

      // If the game was just unpaused, resume any pending productions
      if (!gameState.gamePaused) {
        productionQueue.resumeProductionAfterUnpause()
      }
    })

    // Set initial button state
    const playPauseIcon = document.querySelector('.play-pause-icon')
    if (playPauseIcon) {
      playPauseIcon.textContent = gameState.gamePaused ? '▶' : '⏸'
    }

    // Restart functionality
    restartBtn.addEventListener('click', async () => {
      try {
        // Use the stored game instance first, fallback to dynamic import, then window
        let gameInstance = this.gameInstance
        
        if (!gameInstance) {
          // Fallback 1: Get the current game instance via dynamic import
          try {
            const module = await import('../main.js')
            gameInstance = module.getCurrentGame()
          } catch (importErr) {
            console.warn('Import failed:', importErr)
          }
        }
        
        if (!gameInstance) {
          // Fallback 2: Try window.gameInstance
          gameInstance = window.gameInstance
        }
        
        if (gameInstance && typeof gameInstance.resetGame === 'function') {
          await gameInstance.resetGame()
          showNotification('Game restarted while preserving win/loss statistics')
        } else {
          console.warn('Game instance not found or resetGame method missing, falling back to page reload')
          window.location.reload()
        }
      } catch (err) {
        console.error('Error in restart handler, falling back to page reload:', err)
        window.location.reload()
      }
    })

    // Background music initialization and control
    if (musicControlButton) {
      musicControlButton.addEventListener('click', async () => {
        await toggleBackgroundMusic()

        // Toggle music icon
        const musicIcon = musicControlButton.querySelector('.music-icon')
        if (musicIcon) {
          // If background music is available and we can check its state
          if (typeof bgMusicAudio !== 'undefined' && bgMusicAudio) {
            musicIcon.textContent = bgMusicAudio.paused ? '♪' : '🔇'
          } else {
            // Toggle based on previous state if audio object isn't available
            musicIcon.textContent = musicIcon.textContent === '♪' ? '🔇' : '♪'
          }
        }
      })
    }

    // Handle escape key to exit building placement mode (without canceling the building)
    document.addEventListener('keydown', (e) => {
      // Don't handle keyboard shortcuts if an input field is focused
      if (isInputFieldFocused()) {
        return
      }
      
      if (e.key === 'Escape' && gameState.buildingPlacementMode) {
        e.preventDefault()
        e.stopPropagation()
        productionQueue.exitBuildingPlacementMode()
      }
    })
  }

  setupBuildingPlacement() {
    const gameCanvas = this.canvasManager.getGameCanvas()

    // Add building placement handling to the canvas click event
    gameCanvas.addEventListener('click', (e) => {
      if (gameState.chainBuildMode) {
        this.handleChainBuildingPlacement(e)
      } else {
        this.handleBuildingPlacement(e)
      }
    })

    // Add mousemove event to show building placement overlay
    gameCanvas.addEventListener('mousemove', (e) => {
      if (gameState.chainBuildMode) {
        this.handleChainBuildingOverlay(e)
      } else {
        this.handleBuildingPlacementOverlay(e)
      }
    })

    // Drag and drop placement
    gameCanvas.addEventListener('dragover', (e) => {
      if (gameState.draggedBuildingType) {
        e.preventDefault()
        gameState.buildingPlacementMode = true
        gameState.currentBuildingType = gameState.draggedBuildingType
        this.handleBuildingPlacementOverlay(e)
      }
    })

    gameCanvas.addEventListener('dragleave', () => {
      if (gameState.draggedBuildingType) {
        gameState.buildingPlacementMode = false
      }
    })

    gameCanvas.addEventListener('drop', (e) => {
      if (gameState.draggedBuildingType) {
        e.preventDefault()
        const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
        const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y
        const tileX = Math.floor(mouseX / TILE_SIZE)
        const tileY = Math.floor(mouseY / TILE_SIZE)
        const type = gameState.draggedBuildingType
        const button = gameState.draggedBuildingButton
        if (canPlaceBuilding(type, tileX, tileY, this.mapGrid, this.units, gameState.buildings, this.factories, gameState.humanPlayer)) {
          const blueprint = { type, x: tileX, y: tileY }
          gameState.blueprints.push(blueprint)
          productionQueue.addItem(type, button, true, blueprint)
          showNotification(`Blueprint placed for ${buildingData[type].displayName}`)

          if (gameState.chainBuildPrimed && gameState.shiftKeyDown) {
            gameState.chainBuildMode = true
            gameState.chainStartX = tileX
            gameState.chainStartY = tileY
            gameState.chainBuildingType = type
            gameState.chainBuildingButton = button
            gameState.chainBuildPrimed = false
          }
        } else {
          showNotification('Invalid blueprint location')
        }
        gameState.buildingPlacementMode = false
        gameState.currentBuildingType = null
        gameState.draggedBuildingType = null
        gameState.draggedBuildingButton = null
      }
    })

    // Add building repair handling to the canvas click event
    gameCanvas.addEventListener('click', (e) =>
      buildingRepairHandler(e, gameState, gameCanvas, this.mapGrid, this.units, this.factories, productionQueue, this.moneyEl)
    )

    // Add building sell handling to the canvas click event
    gameCanvas.addEventListener('click', (e) => {
      const sold = buildingSellHandler(e, gameState, gameCanvas, this.mapGrid, this.units, this.factories, this.moneyEl)
      // If a building was successfully sold, update button states
      if (sold && this.productionController) {
        this.productionController.updateVehicleButtonStates()
        this.productionController.updateBuildingButtonStates()
      }
    })
  }

  handleBuildingPlacement(e) {
    const gameCanvas = this.canvasManager.getGameCanvas()

    if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
      const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
      const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

      // Convert to tile coordinates
      const tileX = Math.floor(mouseX / TILE_SIZE)
      const tileY = Math.floor(mouseY / TILE_SIZE)

      // Get building data
      const buildingType = gameState.currentBuildingType

      try {
        // Check if placement is valid - pass buildings and factories arrays
        if (canPlaceBuilding(buildingType, tileX, tileY, this.mapGrid, this.units, gameState.buildings, this.factories, gameState.humanPlayer)) {
          // Create and place the building
          const newBuilding = createBuilding(buildingType, tileX, tileY)

          // Add owner property to the building
          newBuilding.owner = gameState.humanPlayer

          // Add the building to gameState.buildings
          if (!gameState.buildings) {
            gameState.buildings = []
          }
          gameState.buildings.push(newBuilding)

          // Mark building tiles in the map grid
          placeBuilding(newBuilding, this.mapGrid)

          // Update power supply
          updatePowerSupply(gameState.buildings, gameState)

          // Exit placement mode
          gameState.buildingPlacementMode = false
          gameState.currentBuildingType = null

          // Remove ready-for-placement class from the button
          document.querySelectorAll('.ready-for-placement').forEach(button => {
            button.classList.remove('ready-for-placement')
          })          // Remove the placed building from the completed buildings array
          const completedBuildingIndex = productionQueue.completedBuildings.findIndex(
            building => building.type === buildingType
          )
          let placedBuildingButton = null
          if (completedBuildingIndex !== -1) {
            placedBuildingButton = productionQueue.completedBuildings[completedBuildingIndex].button
            productionQueue.completedBuildings.splice(completedBuildingIndex, 1)
          }

          // Update the ready counter for the button that had a building placed
          if (placedBuildingButton) {
            productionQueue.updateReadyBuildingCounter(placedBuildingButton)
          }

          // Restore ready-for-placement class for buttons that still have completed buildings
          productionQueue.completedBuildings.forEach(building => {
            if (!building.button.classList.contains('ready-for-placement')) {
              building.button.classList.add('ready-for-placement')
            }
            // Update ready building counter for remaining buildings
            productionQueue.updateReadyBuildingCounter(building.button)
          })

          // Play placement sound
          playSound('buildingPlaced')

          // Show notification
          showNotification(`${buildingData[buildingType].displayName} constructed`)

          // Check for milestones after building placement
          milestoneSystem.checkMilestones(gameState)

          // Save player building patterns
          savePlayerBuildPatterns(buildingType)

          // UPDATE: Update button states after successful placement
          if (this.productionController) {
            this.productionController.updateVehicleButtonStates()
            this.productionController.updateBuildingButtonStates()
          }
        } else {
          // Play error sound for invalid placement
          playSound('construction_obstructed', 1.0, 0, true)
        }
      } catch (error) {
        console.error('Error during building placement:', error)
        showNotification('Error placing building: ' + error.message, 5000)
        playSound('error')
      }
    }
  }

  handleBuildingPlacementOverlay(e) {
    const gameCanvas = this.canvasManager.getGameCanvas()

    if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
      const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
      const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

      // Update cursor position for the overlay renderer
      gameState.cursorX = mouseX
      gameState.cursorY = mouseY

      // Force a redraw to show the overlay - this will be handled by the game loop
      // No need to manually trigger rendering here as the game loop handles it
    }
  }

  computeChainPositions(startX, startY, endX, endY, info) {
    const dx = endX - startX
    const dy = endY - startY
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const stepX = horizontal ? (dx >= 0 ? info.width : -info.width) : 0
    const stepY = horizontal ? 0 : (dy >= 0 ? info.height : -info.height)
    const count = horizontal
      ? Math.floor(Math.abs(dx) / info.width)
      : Math.floor(Math.abs(dy) / info.height)
    const positions = []
    for (let i = 1; i <= count; i++) {
      positions.push({ x: startX + stepX * i, y: startY + stepY * i })
    }
    return positions
  }

  handleChainBuildingPlacement(e) {
    const gameCanvas = this.canvasManager.getGameCanvas()

    if (!gameState.chainBuildMode || !gameState.chainBuildingType) return

    const mouseX =
      e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
    const mouseY =
      e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

    const tileX = Math.floor(mouseX / TILE_SIZE)
    const tileY = Math.floor(mouseY / TILE_SIZE)

    const info = buildingData[gameState.chainBuildingType]
    const positions = this.computeChainPositions(
      gameState.chainStartX,
      gameState.chainStartY,
      tileX,
      tileY,
      info
    )

    const occ = new Set()
    gameState.blueprints.forEach(bp => {
      const bi = buildingData[bp.type]
      for (let y = 0; y < bi.height; y++) {
        for (let x = 0; x < bi.width; x++) {
          occ.add(`${bp.x + x},${bp.y + y}`)
        }
      }
    })

    const validPositions = []
    for (const pos of positions) {
      let valid = true
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const tx = pos.x + x
          const ty = pos.y + y
          if (!isTileValid(tx, ty, this.mapGrid, this.units, [], []) || occ.has(`${tx},${ty}`)) {
            valid = false
            break
          }
        }
        if (!valid) break
      }
      if (!valid) break
      validPositions.push(pos)
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          occ.add(`${pos.x + x},${pos.y + y}`)
        }
      }
    }

    validPositions.forEach(p => {
      const bp = { type: gameState.chainBuildingType, x: p.x, y: p.y }
      gameState.blueprints.push(bp)
      productionQueue.addItem(gameState.chainBuildingType, gameState.chainBuildingButton, true, bp)
    })

    if (validPositions.length > 0) {
      const last = validPositions[validPositions.length - 1]
      gameState.chainStartX = last.x
      gameState.chainStartY = last.y
    }
  }

  handleChainBuildingOverlay(e) {
    const gameCanvas = this.canvasManager.getGameCanvas()

    if (gameState.chainBuildMode && gameState.chainBuildingType) {
      const mouseX =
        e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
      const mouseY =
        e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

      gameState.cursorX = mouseX
      gameState.cursorY = mouseY
    }
  }

  setupRepairAndSellModes() {
    const gameCanvas = this.canvasManager.getGameCanvas()

    // Add repair button functionality
    document.getElementById('repairBtn').addEventListener('click', () => {
      gameState.repairMode = !gameState.repairMode
      // Update button appearance
      const repairBtn = document.getElementById('repairBtn')
      if (gameState.repairMode) {
        repairBtn.classList.add('active')
        showNotification('Repair mode activated. Click on a building to repair it.')

        // Turn off sell mode if it's active
        if (gameState.sellMode) {
          gameState.sellMode = false
          document.getElementById('sellBtn').classList.remove('active')
        }

        // Use CSS class for cursor
        gameCanvas.classList.add('repair-mode')
      } else {
        repairBtn.classList.remove('active')
        showNotification('Repair mode deactivated.')

        // Remove CSS cursor class
        gameCanvas.classList.remove('repair-mode', 'repair-blocked-mode')

        // Reset cursor to default
        gameCanvas.style.cursor = 'default'
      }
      // Exit building placement mode if active (don't cancel the building)
      if (gameState.buildingPlacementMode) {
        productionQueue.exitBuildingPlacementMode()
      }
    })

    // Add sell button functionality
    document.getElementById('sellBtn').addEventListener('click', () => {
      gameState.sellMode = !gameState.sellMode
      // Update button appearance
      const sellBtn = document.getElementById('sellBtn')
      if (gameState.sellMode) {
        sellBtn.classList.add('active')
        showNotification('Sell mode activated. Click on a building to sell it for 70% of build price.')

        // Turn off repair mode if it's active
        if (gameState.repairMode) {
          gameState.repairMode = false
          document.getElementById('repairBtn').classList.remove('active')
        }

        // Use CSS class for cursor
        gameCanvas.classList.add('sell-mode')
      } else {
        sellBtn.classList.remove('active')
        showNotification('Sell mode deactivated.')

        // Remove CSS cursor class
        gameCanvas.classList.remove('sell-mode', 'sell-blocked-mode')

        // Reset cursor to default
        gameCanvas.style.cursor = 'default'
      }
      // Exit building placement mode if active (don't cancel the building)
      if (gameState.buildingPlacementMode) {
        productionQueue.exitBuildingPlacementMode()
      }
    })
  }

  setProductionController(productionController) {
    this.productionController = productionController
  }

  setupVolumeControl() {
    const volumeSlider = document.getElementById('masterVolumeSlider')
    const volumeValue = document.getElementById('volumeValue')
    
    if (volumeSlider && volumeValue) {
      // Set initial values based on current master volume
      const currentVolume = Math.round(getMasterVolume() * 100)
      volumeSlider.value = currentVolume
      volumeValue.textContent = currentVolume + '%'
      
      // Handle volume changes
      volumeSlider.addEventListener('input', (e) => {
        const volumePercent = parseInt(e.target.value)
        const volumeDecimal = volumePercent / 100
        
        // Update master volume
        setMasterVolume(volumeDecimal)
        
        // Update display
        volumeValue.textContent = volumePercent + '%'
        
        // Play a brief test sound to give feedback
        if (volumePercent > 0) {
          playSound('confirmed', 0.3)
        }
      })
    }
  }
}
