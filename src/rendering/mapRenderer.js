// rendering/mapRenderer.js
import { TILE_SIZE, TILE_COLORS, USE_TEXTURES } from '../config.js'

export class MapRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager
  }

  renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY) {
    // Disable image smoothing to prevent antialiasing gaps between tiles
    ctx.imageSmoothingEnabled = false

    const useTexture = USE_TEXTURES && this.textureManager.allTexturesLoaded

    const drawTile = (x, y, type) => {
      const screenX = Math.floor(x * TILE_SIZE - scrollOffset.x)
      const screenY = Math.floor(y * TILE_SIZE - scrollOffset.y)

      if (useTexture && this.textureManager.tileTextureCache[type]) {
        const idx = this.textureManager.getTileVariation(type, x, y)
        if (idx >= 0 && idx < this.textureManager.tileTextureCache[type].length) {
          ctx.drawImage(this.textureManager.tileTextureCache[type][idx], screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
        } else {
          ctx.fillStyle = TILE_COLORS[type]
          ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
        }
      } else {
        ctx.fillStyle = TILE_COLORS[type]
        ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
      }
    }

    // Base layers: land, water, streets
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        if (mapGrid[y][x].type === 'land') drawTile(x, y, 'land')
      }
    }
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        if (mapGrid[y][x].type === 'water') drawTile(x, y, 'water')
      }
    }
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        if (mapGrid[y][x].type === 'street') drawTile(x, y, 'street')
      }
    }

    // Smoothening Overlay Textures (SOT) above streets
    const sotApplied = new Set()
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = mapGrid[y][x]
        if (tile.type !== 'land') continue

        const top = y > 0 ? mapGrid[y - 1][x] : null
        const left = x > 0 ? mapGrid[y][x - 1] : null
        const bottom = y < mapGrid.length - 1 ? mapGrid[y + 1][x] : null
        const right = x < mapGrid[0].length - 1 ? mapGrid[y][x + 1] : null

        if (top && left && top.type === 'street' && left.type === 'street') {
          this.drawSOT(ctx, x, y, 'top-left', scrollOffset, useTexture, sotApplied)
        } else if (top && right && top.type === 'street' && right.type === 'street') {
          this.drawSOT(ctx, x, y, 'top-right', scrollOffset, useTexture, sotApplied)
        } else if (bottom && left && bottom.type === 'street' && left.type === 'street') {
          this.drawSOT(ctx, x, y, 'bottom-left', scrollOffset, useTexture, sotApplied)
        } else if (bottom && right && bottom.type === 'street' && right.type === 'street') {
          this.drawSOT(ctx, x, y, 'bottom-right', scrollOffset, useTexture, sotApplied)
        }
      }
    }

    // Rocks layer
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        if (mapGrid[y][x].type === 'rock') drawTile(x, y, 'rock')
      }
    }

    // Ore overlay
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = mapGrid[y][x]
        if (!tile.ore) continue
        const screenX = Math.floor(x * TILE_SIZE - scrollOffset.x)
        const screenY = Math.floor(y * TILE_SIZE - scrollOffset.y)
        if (useTexture && this.textureManager.tileTextureCache.ore) {
          const idx = this.textureManager.getTileVariation('ore', x, y)
          if (idx >= 0 && idx < this.textureManager.tileTextureCache.ore.length) {
            ctx.drawImage(this.textureManager.tileTextureCache.ore[idx], screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
          } else {
            ctx.fillStyle = TILE_COLORS.ore
            ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
          }
        } else {
          ctx.fillStyle = TILE_COLORS.ore
          ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
        }
      }
    }

    // Re-enable image smoothing for other rendering
    ctx.imageSmoothingEnabled = true
  }

  /**
   * Draw a Smoothening Overlay Texture (SOT) on a single tile
   */
  drawSOT(ctx, tileX, tileY, orientation, scrollOffset, useTexture, sotApplied) {
    const key = `${tileX},${tileY}`
    if (sotApplied.has(key)) return
    sotApplied.add(key)

    // Offset SOT slightly to hide gaps on left/top edges and expand a bit
    const screenX = tileX * TILE_SIZE - scrollOffset.x - 1
    const screenY = tileY * TILE_SIZE - scrollOffset.y - 1
    const size = TILE_SIZE + 3

    ctx.save()
    ctx.beginPath()
    switch (orientation) {
      case 'top-left':
        ctx.moveTo(screenX, screenY)
        ctx.lineTo(screenX + size, screenY)
        ctx.lineTo(screenX, screenY + size)
        break
      case 'top-right':
        ctx.moveTo(screenX + size, screenY)
        ctx.lineTo(screenX, screenY)
        ctx.lineTo(screenX + size, screenY + size)
        break
      case 'bottom-left':
        ctx.moveTo(screenX, screenY + size)
        ctx.lineTo(screenX, screenY)
        ctx.lineTo(screenX + size, screenY + size)
        break
      case 'bottom-right':
        ctx.moveTo(screenX + size, screenY + size)
        ctx.lineTo(screenX, screenY + size)
        ctx.lineTo(screenX + size, screenY)
        break
    }
    ctx.closePath()
    ctx.clip()

    if (useTexture) {
      const idx = this.textureManager.getTileVariation('street', tileX, tileY)
      if (idx >= 0 && idx < this.textureManager.tileTextureCache.street.length) {
        ctx.drawImage(this.textureManager.tileTextureCache.street[idx], screenX, screenY, size, size)
      } else {
        ctx.fillStyle = TILE_COLORS.street
        ctx.fill()
      }
    } else {
      ctx.fillStyle = TILE_COLORS.street
      ctx.fill()
    }
    ctx.restore()
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
