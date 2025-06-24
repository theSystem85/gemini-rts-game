// rendering/mapRenderer.js
import { TILE_SIZE, TILE_COLORS, USE_TEXTURES } from '../config.js'

export class MapRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager
  }

  renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY) {
    // Disable image smoothing to prevent antialiasing gaps between tiles
    ctx.imageSmoothingEnabled = false
    
    // Draw map tiles - optimized rendering
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = mapGrid[y][x]
        const tileType = tile.type
        const tileX = Math.floor(x * TILE_SIZE - scrollOffset.x)
        const tileY = Math.floor(y * TILE_SIZE - scrollOffset.y)

        // Try to use texture if available and enabled - IMPORTANT: Don't try to load here!
        if (USE_TEXTURES && this.textureManager.allTexturesLoaded && this.textureManager.tileTextureCache[tileType]) {
          // Get consistent variation for this tile position
          const variationIndex = this.textureManager.getTileVariation(tileType, x, y)

          // If valid variation found, draw it with slight overlap to prevent gaps
          if (variationIndex >= 0 && variationIndex < this.textureManager.tileTextureCache[tileType].length) {
            ctx.drawImage(this.textureManager.tileTextureCache[tileType][variationIndex], tileX, tileY, TILE_SIZE + 1, TILE_SIZE + 1)
          } else {
            // Fall back to color if texture variation not available
            ctx.fillStyle = TILE_COLORS[tileType]
            ctx.fillRect(tileX, tileY, TILE_SIZE + 1, TILE_SIZE + 1)
          }
        } else {
          // Fall back to color if texture not available or disabled - also with slight overlap
          ctx.fillStyle = TILE_COLORS[tileType]
          ctx.fillRect(tileX, tileY, TILE_SIZE + 1, TILE_SIZE + 1)
        }

        // Render ore overlay if present
        if (tile.ore) {
          if (USE_TEXTURES && this.textureManager.allTexturesLoaded && this.textureManager.tileTextureCache['ore']) {
            // Get consistent variation for ore overlay
            const oreVariationIndex = this.textureManager.getTileVariation('ore', x, y)
            if (oreVariationIndex >= 0 && oreVariationIndex < this.textureManager.tileTextureCache['ore'].length) {
              ctx.drawImage(this.textureManager.tileTextureCache['ore'][oreVariationIndex], tileX, tileY, TILE_SIZE + 1, TILE_SIZE + 1)
            } else {
              // Fall back to color overlay for ore
              ctx.fillStyle = TILE_COLORS['ore']
              ctx.fillRect(tileX, tileY, TILE_SIZE + 1, TILE_SIZE + 1)
            }
          } else {
            // Fall back to color overlay for ore
            ctx.fillStyle = TILE_COLORS['ore']
            ctx.fillRect(tileX, tileY, TILE_SIZE + 1, TILE_SIZE + 1)
          }
        }
      }
    }
    
    // Re-enable image smoothing for other rendering
    ctx.imageSmoothingEnabled = true
  }

  renderGrid(ctx, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState) {
    // Draw grid lines only if zoomed in closely enough for better performance
    if (TILE_SIZE > 8 && gameState.gridVisible) { // Only draw grid when tiles are big enough to see and grid is enabled
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'
      ctx.beginPath()

      // Draw vertical grid lines
      for (let x = startTileX; x <= endTileX; x++) {
        const lineX = x * TILE_SIZE - scrollOffset.x
        ctx.moveTo(lineX, startTileY * TILE_SIZE - scrollOffset.y)
        ctx.lineTo(lineX, endTileY * TILE_SIZE - scrollOffset.y)
      }

      // Draw horizontal grid lines
      for (let y = startTileY; y <= endTileY; y++) {
        const lineY = y * TILE_SIZE - scrollOffset.y
        ctx.moveTo(startTileX * TILE_SIZE - scrollOffset.x, lineY)
        ctx.lineTo(endTileX * TILE_SIZE - scrollOffset.x, lineY)
      }

      ctx.stroke()
    }
  }

  renderOccupancyMap(ctx, occupancyMap, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState) {
    // Draw occupancy map overlay only if enabled
    if (gameState.occupancyVisible && occupancyMap) {
      // Set up the red glow effect
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)' // Semi-transparent red
      
      // Draw occupied tiles with red glow
      for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
          // Check bounds
          if (y >= 0 && y < occupancyMap.length && x >= 0 && x < occupancyMap[0].length) {
            // Only draw if tile is occupied
            if (occupancyMap[y][x]) {
              const tileX = Math.floor(x * TILE_SIZE - scrollOffset.x)
              const tileY = Math.floor(y * TILE_SIZE - scrollOffset.y)
              ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE)
            }
          }
        }
      }
    }
  }

  render(ctx, mapGrid, scrollOffset, gameCanvas, gameState, occupancyMap = null) {
    // Calculate visible tile range - improved for better performance
    const startTileX = Math.max(0, Math.floor(scrollOffset.x / TILE_SIZE))
    const startTileY = Math.max(0, Math.floor(scrollOffset.y / TILE_SIZE))
    const tilesX = Math.ceil(gameCanvas.width / TILE_SIZE) + 1
    const tilesY = Math.ceil(gameCanvas.height / TILE_SIZE) + 1
    const endTileX = Math.min(mapGrid[0].length, startTileX + tilesX)
    const endTileY = Math.min(mapGrid.length, startTileY + tilesY)

    this.renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY)
    this.renderGrid(ctx, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
    this.renderOccupancyMap(ctx, occupancyMap, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
  }
}
