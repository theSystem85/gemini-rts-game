// rendering.js - Refactored to use modular components
import { Renderer } from './rendering/renderer.js'

// Create a single renderer instance
const gameRenderer = new Renderer()
// Export main rendering functions for compatibility with existing code
export function renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, buildings, scrollOffset, selectionActive, selectionStart, selectionEnd, gameState) {
  return gameRenderer.renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, buildings, scrollOffset, selectionActive, selectionStart, selectionEnd, gameState)
}

export function renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units, buildings, gameState) {
  return gameRenderer.renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units, buildings, gameState)
}

// Export the preload function so it can be called from main.js
export function preloadTileTextures(callback) {
  gameRenderer.preloadTextures(callback)
}

// Export the textureManager for accessing texture-related functions
export function getTextureManager() {
  return gameRenderer.textureManager
}
