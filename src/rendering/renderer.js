// rendering/renderer.js
import { TextureManager } from './textureManager.js'
import { MapRenderer } from './mapRenderer.js'
import { BuildingRenderer } from './buildingRenderer.js'
import { UnitRenderer } from './unitRenderer.js'
import { FactoryRenderer } from './factoryRenderer.js'
import { EffectsRenderer } from './effectsRenderer.js'
import { UIRenderer } from './uiRenderer.js'
import { MinimapRenderer } from './minimapRenderer.js'

export class Renderer {
  constructor() {
    this.textureManager = new TextureManager()
    this.mapRenderer = new MapRenderer(this.textureManager)
    this.buildingRenderer = new BuildingRenderer()
    this.unitRenderer = new UnitRenderer()
    this.factoryRenderer = new FactoryRenderer(this.textureManager)
    this.effectsRenderer = new EffectsRenderer()
    this.uiRenderer = new UIRenderer()
    this.minimapRenderer = new MinimapRenderer()
  }

  // Initialize texture loading
  preloadTextures(callback) {
    this.textureManager.preloadAllTextures(callback)
  }

  renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, buildings, scrollOffset, selectionActive, selectionStart, selectionEnd, gameState) {
    if (!gameState) {
      return
    }

    // If texture loading hasn't started yet, start it (this should only happen once)
    if (!this.textureManager.loadingStarted) {
      this.textureManager.preloadAllTextures()
    }

    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)

    // Check for game over first
    if (this.uiRenderer.renderGameOver(gameCtx, gameCanvas, gameState)) {
      return // Stop rendering if game is over
    }

    // Render all game elements in order
    this.mapRenderer.render(gameCtx, mapGrid, scrollOffset, gameCanvas, gameState)
    this.buildingRenderer.render(gameCtx, buildings, scrollOffset)
    this.factoryRenderer.render(gameCtx, factories, scrollOffset)
    this.unitRenderer.render(gameCtx, units, scrollOffset)
    this.effectsRenderer.render(gameCtx, bullets, gameState, units, scrollOffset)
    this.uiRenderer.render(gameCtx, gameCanvas, gameState, selectionActive, selectionStart, selectionEnd, scrollOffset, factories, buildings, mapGrid, units)
  }

  renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units, buildings, gameState) {
    this.minimapRenderer.render(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units, buildings, gameState)
  }

  // Expose texture manager methods for compatibility
  getOrLoadImage(baseName, extensions, callback) {
    return this.textureManager.getOrLoadImage(baseName, extensions, callback)
  }

  get allTexturesLoaded() {
    return this.textureManager.allTexturesLoaded
  }
}
