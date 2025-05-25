// gameLoop.js
// Handle game loop and animation management

import { gameState } from '../gameState.js';
import { updateGame } from '../updateGame.js';
import { renderGame, renderMinimap } from '../rendering.js';
import { updateBuildingsUnderRepair } from '../buildings.js';
import { updateEnergyBar } from '../ui/energyBar.js';

export class GameLoop {
  constructor(canvasManager, productionController, mapGrid, factories, units, bullets, productionQueue, moneyEl, gameTimeEl) {
    this.canvasManager = canvasManager;
    this.productionController = productionController;
    this.mapGrid = mapGrid;
    this.factories = factories;
    this.units = units;
    this.bullets = bullets;
    this.productionQueue = productionQueue;
    this.moneyEl = moneyEl;
    this.gameTimeEl = gameTimeEl;
    
    this.lastFrameTime = null;
    this.gameInitialized = false;
    this.allAssetsLoaded = false;
  }

  setAssetsLoaded(loaded) {
    this.allAssetsLoaded = loaded;
  }

  start() {
    requestAnimationFrame((timestamp) => this.animate(timestamp));
  }

  animate(timestamp) {
    if (!gameState.gameStarted || gameState.gamePaused) {
      requestAnimationFrame((timestamp) => this.animate(timestamp));
      return;
    }
    
    // Calculate delta time with a maximum to avoid spiral of doom on slow frames
    const now = timestamp || performance.now();
    if (!this.lastFrameTime) this.lastFrameTime = now;
    const delta = Math.min(now - this.lastFrameTime, 33); // Cap at ~30 FPS equivalent
    this.lastFrameTime = now;
    
    // Check if game is over
    if (gameState.gameOver) {
      gameState.gamePaused = true;
    }
    
    // Update production progress
    this.productionQueue.updateProgress(timestamp);
    
    // Update buildings under repair
    updateBuildingsUnderRepair(gameState, timestamp);
    
    // Update energy bar display
    updateEnergyBar();
    
    // Update game elements
    updateGame(delta / 1000, this.mapGrid, this.factories, this.units, this.bullets, gameState);
    
    // Render game with low energy effects if applicable
    const gameCtx = this.canvasManager.getGameContext();
    const gameCanvas = this.canvasManager.getGameCanvas();
    const minimapCtx = this.canvasManager.getMinimapContext();
    const minimapCanvas = this.canvasManager.getMinimapCanvas();

    renderGame(gameCtx, gameCanvas, this.mapGrid, this.factories, this.units, this.bullets, gameState.buildings,
      gameState.scrollOffset, gameState.selectionActive, 
      gameState.selectionStart, gameState.selectionEnd, gameState);
    
    // Render minimap with low energy effects if applicable
    renderMinimap(minimapCtx, minimapCanvas, this.mapGrid, 
      gameState.scrollOffset, gameCanvas, this.units, gameState.buildings, gameState);
    
    // Update money display
    this.moneyEl.textContent = `$${Math.floor(gameState.money)}`;
    
    // Update game time display
    const gameTimeSeconds = Math.floor(gameState.gameTime);
    const minutes = Math.floor(gameTimeSeconds / 60);
    const seconds = gameTimeSeconds % 60;
    this.gameTimeEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    // Use setTimeout to ensure we don't overload the browser
    if (this.units.length > 20) {
      // For large number of units, use setTimeout to give browser breathing room
      setTimeout(() => requestAnimationFrame((timestamp) => this.animate(timestamp)), 5);
    } else {
      requestAnimationFrame((timestamp) => this.animate(timestamp));
    }
  }

  // Legacy game loop for compatibility (if needed)
  legacyGameLoop(timestamp) {
    if (!this.gameInitialized) {
      // Wait for assets to be loaded before initializing and starting the game loop
      if (!this.allAssetsLoaded) {
        // Display a loading message or spinner
        const gameCtx = this.canvasManager.getGameContext();
        const gameCanvas = this.canvasManager.getGameCanvas();
        gameCtx.fillStyle = '#000';
        gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
        gameCtx.font = '20px Arial';
        gameCtx.fillStyle = '#fff';
        gameCtx.textAlign = 'center';
        gameCtx.fillText('Loading assets, please wait...', gameCanvas.width / (2 * (window.devicePixelRatio || 1)), gameCanvas.height / (2 * (window.devicePixelRatio || 1)));
        requestAnimationFrame((timestamp) => this.legacyGameLoop(timestamp));
        return;
      }
      // Assets are loaded, perform one-time initializations
      console.log("Game initialized and starting loop.");
      this.gameInitialized = true;
      this.lastTime = timestamp; // Initialize lastTime
      // Call initial button state updates
      this.productionController.updateVehicleButtonStates();
      this.productionController.updateBuildingButtonStates();
    }

    const deltaTime = (timestamp - this.lastTime) * gameState.speedMultiplier;
    this.lastTime = timestamp;

    if (!gameState.gameOver) {
      if (!gameState.gamePaused) {
        updateGame(deltaTime, gameState, this.units, this.factories, this.bullets, this.mapGrid, this.productionQueue, this.moneyEl, this.gameTimeEl);
        updateBuildingsUnderRepair(gameState, performance.now());
      }
    }

    const gameCtx = this.canvasManager.getGameContext();
    const gameCanvas = this.canvasManager.getGameCanvas();
    const minimapCtx = this.canvasManager.getMinimapContext();
    const minimapCanvas = this.canvasManager.getMinimapCanvas();

    renderGame(gameCtx, gameCanvas, this.mapGrid, this.factories, this.units, this.bullets, gameState.buildings, gameState.scrollOffset, gameState.selectionActive, gameState.selectionStart, gameState.selectionEnd, gameState);
    renderMinimap(minimapCtx, minimapCanvas, this.mapGrid, gameState.scrollOffset, gameCanvas, this.units, gameState.buildings, gameState);
    
    this.moneyEl.textContent = gameState.money;
    this.gameTimeEl.textContent = Math.floor(gameState.gameTime);
    
    requestAnimationFrame((timestamp) => this.legacyGameLoop(timestamp));
  }
}