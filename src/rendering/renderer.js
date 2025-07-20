// rendering/renderer.js
import { TextureManager } from './textureManager.js'
import { MapRenderer } from './mapRenderer.js'
import { BuildingRenderer } from './buildingRenderer.js'
import { UnitRenderer } from './unitRenderer.js'
import { EffectsRenderer } from './effectsRenderer.js'
import { MovementTargetRenderer } from './movementTargetRenderer.js'
import { RetreatTargetRenderer } from './retreatTargetRenderer.js'
import { GuardRenderer } from './guardRenderer.js'
import { PathPlanningRenderer } from "./pathPlanningRenderer.js"
import { UIRenderer } from './uiRenderer.js'
import { MinimapRenderer } from './minimapRenderer.js'
import { HarvesterHUD } from '../ui/harvesterHUD.js'
import { preloadTankImages } from './tankImageRenderer.js'

export class Renderer {
  constructor() {
    this.textureManager = new TextureManager()
    this.mapRenderer = new MapRenderer(this.textureManager)
    this.buildingRenderer = new BuildingRenderer()
    this.unitRenderer = new UnitRenderer()
    this.effectsRenderer = new EffectsRenderer()
    this.uiRenderer = new UIRenderer()
    this.minimapRenderer = new MinimapRenderer()
    this.movementTargetRenderer = new MovementTargetRenderer()
    this.retreatTargetRenderer = new RetreatTargetRenderer()
    this.guardRenderer = new GuardRenderer()
    this.pathPlanningRenderer = new PathPlanningRenderer()
    this.harvesterHUD = new HarvesterHUD()
  }

  // Initialize texture loading
  preloadTextures(callback) {
    // Load both tile textures and tank images in parallel
    let texturesLoaded = false
    let tankImagesLoaded = false

    const checkAllLoaded = () => {
      if (texturesLoaded && tankImagesLoaded) {
        if (callback) callback()
      }
    }

    // Load tile textures
    this.textureManager.preloadAllTextures(() => {
      texturesLoaded = true
      checkAllLoaded()
    })

    // Load tank images
    preloadTankImages((success) => {
      if (!success) {
        console.warn('Tank images failed to load, falling back to original rendering')
      }
      tankImagesLoaded = true
      checkAllLoaded()
    })
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

    // Build occupancy map for visualization if needed
    let occupancyMap = null
    if (gameState.occupancyVisible) {
      occupancyMap = gameState.occupancyMap
    }
    
    this.mapRenderer.render(gameCtx, mapGrid, scrollOffset, gameCanvas, gameState, occupancyMap)
    this.buildingRenderer.renderBases(gameCtx, buildings, mapGrid, scrollOffset)
    // Render initial construction yards using the same renderer
    this.buildingRenderer.renderBases(gameCtx, factories, mapGrid, scrollOffset)
    this.unitRenderer.renderBases(gameCtx, units, scrollOffset)
    this.effectsRenderer.render(gameCtx, bullets, gameState, units, scrollOffset)
    
    // Render movement target indicators (green triangles)
    this.movementTargetRenderer.render(gameCtx, units, scrollOffset)
    this.pathPlanningRenderer.render(gameCtx, units, scrollOffset)
    
    // Render retreat target indicators (orange circles)
    this.retreatTargetRenderer.renderRetreatTargets(gameCtx, units, scrollOffset)

    // Render guard mode indicators
    this.guardRenderer.render(gameCtx, units, scrollOffset)
    
    // Render harvester HUD overlay (if enabled)
    this.harvesterHUD.render(gameCtx, units, gameState, scrollOffset)

    this.buildingRenderer.renderOverlays(gameCtx, buildings, scrollOffset)
    this.buildingRenderer.renderOverlays(gameCtx, factories, scrollOffset)
    this.unitRenderer.renderOverlays(gameCtx, units, scrollOffset)

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
