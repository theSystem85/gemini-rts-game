// rendering/mapRenderer.js
import { TILE_SIZE, TILE_COLORS, USE_TEXTURES } from '../config.js'

const UNDISCOVERED_COLOR = '#111111'
const FOG_OVERLAY_STYLE = 'rgba(30, 30, 30, 0.6)'
const SHADOW_GRADIENT_SIZE = 6

export class MapRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager
  }

  renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY, gameState) {
    // Disable image smoothing to prevent antialiasing gaps between tiles
    ctx.imageSmoothingEnabled = false

    const useTexture = USE_TEXTURES && this.textureManager.allTexturesLoaded
    const sotApplied = new Set()
    const visibilityMap = gameState?.visibilityMap
    const shadowEnabled = Boolean(gameState?.shadowOfWarEnabled && visibilityMap && visibilityMap.length)

    const drawTile = (x, y, type, screenX, screenY) => {
      if (type === 'water' && this.textureManager.waterFrames.length) {
        const frame = this.textureManager.getCurrentWaterFrame()
        if (frame) {
          ctx.drawImage(frame, screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
          return
        }
      }

      if (useTexture && this.textureManager.tileTextureCache[type]) {
        const idx = this.textureManager.getTileVariation(type, x, y)
        if (idx >= 0 && idx < this.textureManager.tileTextureCache[type].length) {
          const info = this.textureManager.tileTextureCache[type][idx]
          ctx.drawImage(
            this.textureManager.spriteImage,
            info.x,
            info.y,
            info.width,
            info.height,
            screenX,
            screenY,
            TILE_SIZE + 1,
            TILE_SIZE + 1
          )
          return
        }
      }

      ctx.fillStyle = TILE_COLORS[type]
      ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
    }

    const drawOreOverlay = (x, y, screenX, screenY) => {
      if (useTexture && this.textureManager.tileTextureCache.ore) {
        const idx = this.textureManager.getTileVariation('ore', x, y)
        if (idx >= 0 && idx < this.textureManager.tileTextureCache.ore.length) {
          const info = this.textureManager.tileTextureCache.ore[idx]
          ctx.drawImage(
            this.textureManager.spriteImage,
            info.x,
            info.y,
            info.width,
            info.height,
            screenX,
            screenY,
            TILE_SIZE + 1,
            TILE_SIZE + 1
          )
          return
        }
      }

      ctx.fillStyle = TILE_COLORS.ore
      ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
    }

    const drawSeedOverlay = (x, y, screenX, screenY) => {
      if (useTexture && this.textureManager.tileTextureCache.seedCrystal) {
        const idx = this.textureManager.getTileVariation('seedCrystal', x, y)
        if (idx >= 0 && idx < this.textureManager.tileTextureCache.seedCrystal.length) {
          const info = this.textureManager.tileTextureCache.seedCrystal[idx]
          ctx.drawImage(
            this.textureManager.spriteImage,
            info.x,
            info.y,
            info.width,
            info.height,
            screenX,
            screenY,
            TILE_SIZE + 1,
            TILE_SIZE + 1
          )
          return
        }
      }

      ctx.fillStyle = TILE_COLORS.seedCrystal
      ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
    }

    // Single pass rendering: process all layers for each tile in one iteration
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = mapGrid[y][x]
        const screenX = Math.floor(x * TILE_SIZE - scrollOffset.x)
        const screenY = Math.floor(y * TILE_SIZE - scrollOffset.y)
        const tileVisibility = shadowEnabled && visibilityMap[y] ? visibilityMap[y][x] : null

        if (shadowEnabled && (!tileVisibility || !tileVisibility.discovered)) {
          // Draw the base tile first so gradients reveal a subtle hint of terrain near the fog border
          drawTile(x, y, tile.type, screenX, screenY)

          const tilePixelSize = TILE_SIZE + 1
          ctx.fillStyle = UNDISCOVERED_COLOR
          ctx.fillRect(screenX, screenY, tilePixelSize, tilePixelSize)

          if (SHADOW_GRADIENT_SIZE > 0) {
            const gradientWidth = Math.min(SHADOW_GRADIENT_SIZE, Math.floor(tilePixelSize / 2))
            const mapHeight = visibilityMap.length
            const mapWidth = visibilityMap[0]?.length || 0
            if (gradientWidth > 0 && mapHeight && mapWidth) {
              const neighborDiscovered = {
                left: x > 0 && Boolean(visibilityMap[y]?.[x - 1]?.discovered),
                right: x < mapWidth - 1 && Boolean(visibilityMap[y]?.[x + 1]?.discovered),
                top: y > 0 && Boolean(visibilityMap[y - 1]?.[x]?.discovered),
                bottom: y < mapHeight - 1 && Boolean(visibilityMap[y + 1]?.[x]?.discovered)
              }

              if (neighborDiscovered.left || neighborDiscovered.right || neighborDiscovered.top || neighborDiscovered.bottom) {
                ctx.save()
                ctx.globalCompositeOperation = 'destination-out'

                if (neighborDiscovered.left) {
                  const gradient = ctx.createLinearGradient(screenX, screenY, screenX + gradientWidth, screenY)
                  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
                  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
                  ctx.fillStyle = gradient
                  ctx.fillRect(screenX, screenY, gradientWidth, tilePixelSize)
                }

                if (neighborDiscovered.right) {
                  const gradient = ctx.createLinearGradient(screenX + tilePixelSize, screenY, screenX + tilePixelSize - gradientWidth, screenY)
                  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
                  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
                  ctx.fillStyle = gradient
                  ctx.fillRect(screenX + tilePixelSize - gradientWidth, screenY, gradientWidth, tilePixelSize)
                }

                if (neighborDiscovered.top) {
                  const gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + gradientWidth)
                  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
                  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
                  ctx.fillStyle = gradient
                  ctx.fillRect(screenX, screenY, tilePixelSize, gradientWidth)
                }

                if (neighborDiscovered.bottom) {
                  const gradient = ctx.createLinearGradient(screenX, screenY + tilePixelSize, screenX, screenY + tilePixelSize - gradientWidth)
                  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
                  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
                  ctx.fillStyle = gradient
                  ctx.fillRect(screenX, screenY + tilePixelSize - gradientWidth, tilePixelSize, gradientWidth)
                }

                ctx.restore()
              }
            }
          }

          continue
        }

        // Render base tile layer
        drawTile(x, y, tile.type, screenX, screenY)

        // Process SOT (Smoothening Overlay Textures) for land tiles adjacent to streets or water
        if (tile.type === 'land') {
          const top = y > 0 ? mapGrid[y - 1][x] : null
          const left = x > 0 ? mapGrid[y][x - 1] : null
          const bottom = y < mapGrid.length - 1 ? mapGrid[y + 1][x] : null
          const right = x < mapGrid[0].length - 1 ? mapGrid[y][x + 1] : null

          let orientation = null
          let overlayType = null

          if (top && left && top.type === 'street' && left.type === 'street') {
            orientation = 'top-left'
            overlayType = 'street'
          } else if (top && right && top.type === 'street' && right.type === 'street') {
            orientation = 'top-right'
            overlayType = 'street'
          } else if (bottom && left && bottom.type === 'street' && left.type === 'street') {
            orientation = 'bottom-left'
            overlayType = 'street'
          } else if (bottom && right && bottom.type === 'street' && right.type === 'street') {
            orientation = 'bottom-right'
            overlayType = 'street'
          } else if (top && left && top.type === 'water' && left.type === 'water') {
            orientation = 'top-left'
            overlayType = 'water'
          } else if (top && right && top.type === 'water' && right.type === 'water') {
            orientation = 'top-right'
            overlayType = 'water'
          } else if (bottom && left && bottom.type === 'water' && left.type === 'water') {
            orientation = 'bottom-left'
            overlayType = 'water'
          } else if (bottom && right && bottom.type === 'water' && right.type === 'water') {
            orientation = 'bottom-right'
            overlayType = 'water'
          }

          if (orientation) {
            this.drawSOT(ctx, x, y, orientation, scrollOffset, useTexture, sotApplied, overlayType)
          }
        }

        // Render ore or seed overlays if present
        if (tile.seedCrystal) {
          drawSeedOverlay(x, y, screenX, screenY)
        } else if (tile.ore) {
          drawOreOverlay(x, y, screenX, screenY)
        }

        if (shadowEnabled && tileVisibility && !tileVisibility.visible) {
          ctx.fillStyle = FOG_OVERLAY_STYLE
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
  drawSOT(ctx, tileX, tileY, orientation, scrollOffset, useTexture, sotApplied, type = 'street') {
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

    if (type === 'water' && this.textureManager.waterFrames.length) {
      const frame = this.textureManager.getCurrentWaterFrame()
      if (frame) {
        ctx.drawImage(frame, screenX, screenY, size, size)
      } else {
        ctx.fillStyle = TILE_COLORS[type]
        ctx.fill()
      }
    } else if (useTexture) {
      const idx = this.textureManager.getTileVariation(type, tileX, tileY)
      if (idx >= 0 && idx < this.textureManager.tileTextureCache[type].length) {
        const info = this.textureManager.tileTextureCache[type][idx]
        ctx.drawImage(
          this.textureManager.spriteImage,
          info.x,
          info.y,
          info.width,
          info.height,
          screenX,
          screenY,
          size,
          size
        )
      } else {
        ctx.fillStyle = TILE_COLORS[type]
        ctx.fill()
      }
    } else {
      ctx.fillStyle = TILE_COLORS[type]
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

    this.renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY, gameState)
    this.renderGrid(ctx, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
    this.renderOccupancyMap(ctx, occupancyMap, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
  }
}
