// gameLoop.js
// Handle game loop and animation management

import { gameState } from '../gameState.js'
import { updateGame } from '../updateGame.js'
import { renderGame, renderMinimap } from '../rendering.js'
import { updateBuildingsUnderRepair, updateBuildingsAwaitingRepair } from '../buildings.js'
import { updateEnergyBar } from '../ui/energyBar.js'
import { milestoneSystem } from './milestoneSystem.js'
import { FPSDisplay } from '../ui/fpsDisplay.js'
import { logPerformance } from '../performanceUtils.js'
import { pauseAllSounds, resumeAllSounds } from '../sound.js'
import { updateMapScrolling } from './gameStateManager.js'

export class GameLoop {
  constructor(canvasManager, productionController, mapGrid, factories, units, bullets, productionQueue, moneyEl, gameTimeEl) {
    this.canvasManager = canvasManager
    this.productionController = productionController
    this.mapGrid = mapGrid
    this.factories = factories
    this.units = units
    this.bullets = bullets
    this.productionQueue = productionQueue
    this.moneyEl = moneyEl
    this.gameTimeEl = gameTimeEl

    this.lastFrameTime = null
    this.gameInitialized = false
    this.allAssetsLoaded = false
    this.running = false
    this.animationId = null
    this.fpsDisplay = new FPSDisplay()
    this.forceRender = false

    // Track last UI update values to avoid unnecessary DOM writes
    this.lastMoneyDisplayed = null
    this.lastMoneyUpdate = 0
    this.lastGameTimeUpdate = 0
    this.lastEnergyUpdate = 0

    // Set the production controller reference in milestone system
    milestoneSystem.setProductionController(productionController)

    // Track pause state to manage audio playback
    this.wasPaused = gameState.gamePaused
  }

  setAssetsLoaded(loaded) {
    this.allAssetsLoaded = loaded
  }

  start() {
    this.running = true
    this.lastFrameTime = null
    this.forceRender = true
    this.scheduleNextFrame()
  }

  stop() {
    this.running = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  requestRender() {
    if (!this.running) {
      return
    }
    this.scheduleNextFrame()
  }

  scheduleNextFrame() {
    if (!this.running || this.animationId) {
      return
    }
    this.animationId = requestAnimationFrame((timestamp) => this.animate(timestamp))
  }

  hasActiveScrollActivity() {
    const velocityThreshold = 0.02
    const velocityX = Math.abs(gameState.dragVelocity.x)
    const velocityY = Math.abs(gameState.dragVelocity.y)
    const keyScrollActive = gameState.keyScroll.up || gameState.keyScroll.down || gameState.keyScroll.left || gameState.keyScroll.right
    const velocityActive = velocityX > velocityThreshold || velocityY > velocityThreshold

    return gameState.isRightDragging || keyScrollActive || velocityActive
  }

  handlePausedFrame(now, gameCtx, gameCanvas, pauseStateChanged) {
    this.lastFrameTime = null

    const minimapCtx = this.canvasManager.getMinimapContext()
    const minimapCanvas = this.canvasManager.getMinimapCanvas()

    const prevOffsetX = gameState.scrollOffset.x
    const prevOffsetY = gameState.scrollOffset.y

    if (!gameState.isRightDragging) {
      updateMapScrolling(gameState, this.mapGrid)

      const velocitySnapThreshold = 0.02
      if (Math.abs(gameState.dragVelocity.x) < velocitySnapThreshold) {
        gameState.dragVelocity.x = 0
      }
      if (Math.abs(gameState.dragVelocity.y) < velocitySnapThreshold) {
        gameState.dragVelocity.y = 0
      }
    }

    const offsetChanged = prevOffsetX !== gameState.scrollOffset.x || prevOffsetY !== gameState.scrollOffset.y
    const shouldRenderFrame = this.forceRender || pauseStateChanged || offsetChanged || gameState.isRightDragging

    if (shouldRenderFrame) {
      renderGame(
        gameCtx,
        gameCanvas,
        this.mapGrid,
        this.factories,
        this.units,
        this.bullets,
        gameState.buildings,
        gameState.scrollOffset,
        gameState.selectionActive,
        gameState.selectionStart,
        gameState.selectionEnd,
        gameState
      )

      renderMinimap(
        minimapCtx,
        minimapCanvas,
        this.mapGrid,
        gameState.scrollOffset,
        gameCanvas,
        this.units,
        gameState.buildings,
        gameState
      )
    }

    this.fpsDisplay.render(gameCtx, gameCanvas)

    this.forceRender = false

    if (this.hasActiveScrollActivity()) {
      this.scheduleNextFrame()
    }
  }

  animate = logPerformance((timestamp) => {
    // Stop if the loop has been stopped
    if (!this.running) {
      return
    }

    this.animationId = null

    // Get current time and canvas contexts (used throughout the function)
    const now = timestamp || performance.now()
    const gameCtx = this.canvasManager.getGameContext()
    const gameCanvas = this.canvasManager.getGameCanvas()

    // Always update FPS tracking
    this.fpsDisplay.updateFPS(now)

    const pauseStateChanged = gameState.gamePaused !== this.wasPaused
    // Pause or resume sounds when game pause state changes
    if (pauseStateChanged) {
      this.wasPaused = gameState.gamePaused
      if (gameState.gamePaused) {
        pauseAllSounds()
      } else {
        resumeAllSounds()
        this.lastFrameTime = now
      }
    }

    if (!gameState.gameStarted) {
      this.fpsDisplay.render(gameCtx, gameCanvas)
      this.scheduleNextFrame()
      return
    }

    if (gameState.gamePaused) {
      this.handlePausedFrame(now, gameCtx, gameCanvas, pauseStateChanged)
      return
    }

    // Calculate delta time with a maximum to avoid spiral of doom on slow frames
    if (!this.lastFrameTime) this.lastFrameTime = now
    const delta = Math.min(now - this.lastFrameTime, 33) // Cap at ~30 FPS equivalent
    this.lastFrameTime = now

    // Check if game is over
    if (gameState.gameOver) {
      gameState.gamePaused = true
    }

    // Update production progress
    this.productionQueue.updateProgress(timestamp)

    // Update buildings under repair
    updateBuildingsUnderRepair(gameState, timestamp)

    // Update buildings awaiting repair (countdown for buildings under attack)
    updateBuildingsAwaitingRepair(gameState, timestamp)

    // Update energy bar display at most once per second
    if (now - this.lastEnergyUpdate >= 1000) {
      updateEnergyBar()
      this.lastEnergyUpdate = now
    }

    // Increment frame counter
    gameState.frameCount++

    // Check for milestones periodically (every 60 frames)
    if (gameState.frameCount % 60 === 0) {
      milestoneSystem.checkMilestones(gameState)
    }

    // Update game elements
    updateGame(delta, this.mapGrid, this.factories, this.units, this.bullets, gameState)

    // Refresh production buttons if a building was destroyed
    if (gameState.pendingButtonUpdate) {
      this.productionController.updateVehicleButtonStates()
      this.productionController.updateBuildingButtonStates()
      gameState.pendingButtonUpdate = false
    }

    // Get minimap contexts for rendering
    const minimapCtx = this.canvasManager.getMinimapContext()
    const minimapCanvas = this.canvasManager.getMinimapCanvas()

    renderGame(gameCtx, gameCanvas, this.mapGrid, this.factories, this.units, this.bullets, gameState.buildings,
      gameState.scrollOffset, gameState.selectionActive,
      gameState.selectionStart, gameState.selectionEnd, gameState)

    // Render minimap with low energy effects if applicable
    renderMinimap(minimapCtx, minimapCanvas, this.mapGrid,
      gameState.scrollOffset, gameCanvas, this.units, gameState.buildings, gameState)

    // Render FPS overlay on top of everything when game is running
    this.fpsDisplay.render(gameCtx, gameCanvas)

    this.forceRender = false

    // Update money display at most every 333ms and only when the value changes
    const currentMoney = Math.floor(gameState.money)
    if (
      currentMoney !== this.lastMoneyDisplayed &&
      now - this.lastMoneyUpdate >= 333
    ) {
      this.moneyEl.textContent = `$${currentMoney}`
      this.lastMoneyDisplayed = currentMoney
      this.lastMoneyUpdate = now
    }

    // Update game time display at most once per second
    if (now - this.lastGameTimeUpdate >= 1000) {
      const gameTimeSeconds = Math.floor(gameState.gameTime)
      const minutes = Math.floor(gameTimeSeconds / 60)
      const seconds = gameTimeSeconds % 60
      this.gameTimeEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
      this.lastGameTimeUpdate = now
    }

    // Use setTimeout to ensure we don't overload the browser
    if (this.units.length > 20) {
      // For large number of units, use setTimeout to give browser breathing room
      setTimeout(() => {
        if (this.running) {
          this.scheduleNextFrame()
        }
      }, 5)
    } else {
      this.scheduleNextFrame()
    }
  }, false, 'animate')

  // Legacy game loop for compatibility (if needed)
  legacyGameLoop(timestamp) {
    // Stop if the loop has been stopped
    if (!this.running) {
      return
    }

    // Update FPS tracking in legacy loop too
    this.fpsDisplay.updateFPS(timestamp || performance.now())

    if (!this.gameInitialized) {
      // Wait for assets to be loaded before initializing and starting the game loop
      if (!this.allAssetsLoaded) {
        // Display a loading message or spinner
        const gameCtx = this.canvasManager.getGameContext()
        const gameCanvas = this.canvasManager.getGameCanvas()
        gameCtx.fillStyle = '#000'
        gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height)
        gameCtx.font = '20px Arial'
        gameCtx.fillStyle = '#fff'
        gameCtx.textAlign = 'center'
        gameCtx.fillText('Loading assets, please wait...', gameCanvas.width / (2 * (window.devicePixelRatio || 1)), gameCanvas.height / (2 * (window.devicePixelRatio || 1)))
        if (this.running) {
          this.animationId = requestAnimationFrame((timestamp) => this.legacyGameLoop(timestamp))
        }
        return
      }
      // Assets are loaded, perform one-time initializations
      this.gameInitialized = true
      this.lastTime = timestamp // Initialize lastTime
      // Call initial button state updates
      this.productionController.updateVehicleButtonStates()
      this.productionController.updateBuildingButtonStates()
    }

    const deltaTime = (timestamp - this.lastTime) * gameState.speedMultiplier
    this.lastTime = timestamp

    if (!gameState.gameOver) {
      if (!gameState.gamePaused) {
        updateGame(deltaTime, gameState, this.units, this.factories, this.bullets, this.mapGrid, this.productionQueue, this.moneyEl, this.gameTimeEl)
        updateBuildingsUnderRepair(gameState, performance.now())

        if (gameState.pendingButtonUpdate) {
          this.productionController.updateVehicleButtonStates()
          this.productionController.updateBuildingButtonStates()
          gameState.pendingButtonUpdate = false
        }
      }
    }

    const gameCtx = this.canvasManager.getGameContext()
    const gameCanvas = this.canvasManager.getGameCanvas()
    const minimapCtx = this.canvasManager.getMinimapContext()
    const minimapCanvas = this.canvasManager.getMinimapCanvas()

    renderGame(gameCtx, gameCanvas, this.mapGrid, this.factories, this.units, this.bullets, gameState.buildings, gameState.scrollOffset, gameState.selectionActive, gameState.selectionStart, gameState.selectionEnd, gameState)
    renderMinimap(minimapCtx, minimapCanvas, this.mapGrid, gameState.scrollOffset, gameCanvas, this.units, gameState.buildings, gameState)

    // Render FPS overlay on top of everything in legacy loop too
    this.fpsDisplay.render(gameCtx, gameCanvas)

    // Update money and time less frequently in legacy loop
    const legacyMoney = Math.floor(gameState.money)
    if (
      legacyMoney !== this.lastMoneyDisplayed &&
      timestamp - this.lastMoneyUpdate >= 333
    ) {
      this.moneyEl.textContent = `${legacyMoney}`
      this.lastMoneyDisplayed = legacyMoney
      this.lastMoneyUpdate = timestamp
    }

    if (timestamp - this.lastGameTimeUpdate >= 1000) {
      this.gameTimeEl.textContent = Math.floor(gameState.gameTime)
      this.lastGameTimeUpdate = timestamp
    }

    if (this.running) {
      this.animationId = requestAnimationFrame((timestamp) => this.legacyGameLoop(timestamp))
    }
  }
}
