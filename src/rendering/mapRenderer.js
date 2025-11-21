// rendering/mapRenderer.js
import { TILE_SIZE, TILE_COLORS, USE_TEXTURES } from '../config.js'

const UNDISCOVERED_COLOR = '#111111'
const FOG_OVERLAY_STYLE = 'rgba(30, 30, 30, 0.6)'
const SHADOW_GRADIENT_SIZE = 6

export class MapRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager
    this.chunkSize = 32
    this.chunkPadding = 2
    this.chunkCache = new Map()
    this.cachedUseTexture = null
    this.cachedMapWidth = 0
    this.cachedMapHeight = 0
    this.canUseOffscreen = typeof document !== 'undefined' && typeof document.createElement === 'function'
  }

  invalidateAllChunks() {
    if (this.chunkCache.size) {
      this.chunkCache.clear()
    }
  }

  markTileDirty(tileX, tileY) {
    if (!this.canUseOffscreen || !this.chunkCache.size) return
    const chunkX = Math.floor(tileX / this.chunkSize)
    const chunkY = Math.floor(tileY / this.chunkSize)

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = this.getChunkKey(chunkX + dx, chunkY + dy)
        const chunk = this.chunkCache.get(key)
        if (chunk) {
          chunk.signature = null
          chunk.lastWaterFrameIndex = null
        }
      }
    }
  }

  getChunkKey(chunkX, chunkY) {
    return `${chunkX},${chunkY}`
  }

  ensureCacheValidity(mapGrid, useTexture) {
    const mapHeight = mapGrid.length
    const mapWidth = mapGrid[0]?.length || 0

    if (mapWidth !== this.cachedMapWidth || mapHeight !== this.cachedMapHeight) {
      this.invalidateAllChunks()
      this.cachedMapWidth = mapWidth
      this.cachedMapHeight = mapHeight
    }

    if (this.cachedUseTexture !== useTexture) {
      this.invalidateAllChunks()
      this.cachedUseTexture = useTexture
    }
  }

  getOrCreateChunk(chunkX, chunkY, startX, startY, endX, endY) {
    const key = this.getChunkKey(chunkX, chunkY)
    let chunk = this.chunkCache.get(key)
    if (!chunk) {
      const canvas = this.canUseOffscreen ? document.createElement('canvas') : null
      const ctx = canvas ? canvas.getContext('2d') : null
      chunk = {
        canvas,
        ctx,
        startX,
        startY,
        endX,
        endY,
        signature: null,
        lastUseTexture: null,
        lastWaterFrameIndex: null,
        containsWaterAnimation: false,
        padding: this.chunkPadding,
        offsetX: startX * TILE_SIZE - this.chunkPadding,
        offsetY: startY * TILE_SIZE - this.chunkPadding
      }
      this.chunkCache.set(key, chunk)
    } else {
      chunk.startX = startX
      chunk.startY = startY
      chunk.endX = endX
      chunk.endY = endY
      chunk.padding = this.chunkPadding
    }

    chunk.offsetX = startX * TILE_SIZE - chunk.padding
    chunk.offsetY = startY * TILE_SIZE - chunk.padding
    return chunk
  }

  computeChunkSignature(mapGrid, startX, startY, endX, endY) {
    const mapHeight = mapGrid.length
    const mapWidth = mapGrid[0]?.length || 0
    const extraStartX = Math.max(0, startX - 1)
    const extraStartY = Math.max(0, startY - 1)
    const extraEndX = Math.min(mapWidth, endX + 1)
    const extraEndY = Math.min(mapHeight, endY + 1)

    const parts = []
    let containsWater = false
    for (let y = extraStartY; y < extraEndY; y++) {
      const row = mapGrid[y]
      for (let x = extraStartX; x < extraEndX; x++) {
        const tile = row[x]
        parts.push(tile.type, tile.ore ? 1 : 0, tile.seedCrystal ? 1 : 0, tile.noBuild || 0)
        if (tile.type === 'water') containsWater = true
      }
    }

    return { signature: parts.join('|'), containsWater }
  }

  updateChunkCache(chunk, mapGrid, useTexture, currentWaterFrame) {
    if (!chunk.canvas || !chunk.ctx) return

    const { signature, containsWater } = this.computeChunkSignature(
      mapGrid,
      chunk.startX,
      chunk.startY,
      chunk.endX,
      chunk.endY
    )

    const hasWaterAnimation = containsWater && this.textureManager.waterFrames.length > 0
    const waterFrameIndex = hasWaterAnimation ? this.textureManager.waterFrameIndex : null

    const needsRedraw =
      chunk.signature !== signature ||
      chunk.lastUseTexture !== useTexture ||
      chunk.containsWaterAnimation !== hasWaterAnimation ||
      (hasWaterAnimation && chunk.lastWaterFrameIndex !== waterFrameIndex)

    if (!needsRedraw) return

    const tileWidth = chunk.endX - chunk.startX
    const tileHeight = chunk.endY - chunk.startY
    const width = tileWidth * TILE_SIZE + chunk.padding * 2 + 1
    const height = tileHeight * TILE_SIZE + chunk.padding * 2 + 1

    if (chunk.canvas.width !== width || chunk.canvas.height !== height) {
      chunk.canvas.width = width
      chunk.canvas.height = height
      chunk.ctx = chunk.canvas.getContext('2d')
    } else {
      chunk.ctx.clearRect(0, 0, width, height)
    }

    chunk.ctx.imageSmoothingEnabled = false
    this.drawBaseLayer(
      chunk.ctx,
      mapGrid,
      chunk.startX,
      chunk.startY,
      chunk.endX,
      chunk.endY,
      chunk.offsetX,
      chunk.offsetY,
      useTexture,
      currentWaterFrame
    )

    chunk.signature = signature
    chunk.lastUseTexture = useTexture
    chunk.containsWaterAnimation = hasWaterAnimation
    chunk.lastWaterFrameIndex = hasWaterAnimation ? waterFrameIndex : null
  }

  renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY, gameState) {
    // Disable image smoothing to prevent antialiasing gaps between tiles
    ctx.imageSmoothingEnabled = false

    const useTexture = USE_TEXTURES && this.textureManager.allTexturesLoaded
    const currentWaterFrame = this.textureManager.waterFrames.length
      ? this.textureManager.getCurrentWaterFrame()
      : null

    if (!this.canUseOffscreen) {
      this.drawBaseLayer(
        ctx,
        mapGrid,
        startTileX,
        startTileY,
        endTileX,
        endTileY,
        scrollOffset.x,
        scrollOffset.y,
        useTexture,
        currentWaterFrame
      )
      ctx.imageSmoothingEnabled = true
      return
    }

    this.ensureCacheValidity(mapGrid, useTexture)

    const mapWidth = mapGrid[0]?.length || 0
    const mapHeight = mapGrid.length

    const startChunkX = Math.max(0, Math.floor(startTileX / this.chunkSize))
    const startChunkY = Math.max(0, Math.floor(startTileY / this.chunkSize))
    const endChunkX = Math.ceil(endTileX / this.chunkSize)
    const endChunkY = Math.ceil(endTileY / this.chunkSize)

    for (let chunkY = startChunkY; chunkY < endChunkY; chunkY++) {
      const chunkStartY = chunkY * this.chunkSize
      if (chunkStartY >= mapHeight) break
      const chunkEndY = Math.min(mapHeight, chunkStartY + this.chunkSize)

      for (let chunkX = startChunkX; chunkX < endChunkX; chunkX++) {
        const chunkStartX = chunkX * this.chunkSize
        if (chunkStartX >= mapWidth) break
        const chunkEndX = Math.min(mapWidth, chunkStartX + this.chunkSize)

        const chunk = this.getOrCreateChunk(chunkX, chunkY, chunkStartX, chunkStartY, chunkEndX, chunkEndY)

        if (!chunk.canvas || !chunk.ctx) {
          this.drawBaseLayer(
            ctx,
            mapGrid,
            chunkStartX,
            chunkStartY,
            chunkEndX,
            chunkEndY,
            scrollOffset.x,
            scrollOffset.y,
            useTexture,
            currentWaterFrame
          )
          continue
        }

        this.updateChunkCache(chunk, mapGrid, useTexture, currentWaterFrame)

        const drawX = Math.floor(chunkStartX * TILE_SIZE - scrollOffset.x) - chunk.padding
        const drawY = Math.floor(chunkStartY * TILE_SIZE - scrollOffset.y) - chunk.padding
        ctx.drawImage(chunk.canvas, drawX, drawY)
      }
    }

    // Re-enable image smoothing for other rendering
    ctx.imageSmoothingEnabled = true
  }

  drawBaseLayer(ctx, mapGrid, startTileX, startTileY, endTileX, endTileY, offsetX, offsetY, useTexture, currentWaterFrame) {
    if (!mapGrid.length || !mapGrid[0]?.length) return

    const sotApplied = new Set()
    const scrollOffset = { x: offsetX, y: offsetY }

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = mapGrid[y][x]
        const screenX = Math.floor(x * TILE_SIZE - offsetX)
        const screenY = Math.floor(y * TILE_SIZE - offsetY)

        this.drawTileBase(ctx, x, y, tile.type, screenX, screenY, useTexture, currentWaterFrame)

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
            this.drawSOT(ctx, x, y, orientation, scrollOffset, useTexture, sotApplied, overlayType, currentWaterFrame)
          }
        }

        if (tile.seedCrystal) {
          this.drawSeedOverlay(ctx, x, y, screenX, screenY, useTexture)
        } else if (tile.ore) {
          this.drawOreOverlay(ctx, x, y, screenX, screenY, useTexture)
        }
      }
    }
  }

  drawTileBase(ctx, tileX, tileY, type, screenX, screenY, useTexture, currentWaterFrame) {
    if (type === 'water' && this.textureManager.waterFrames.length) {
      const frame = currentWaterFrame || this.textureManager.getCurrentWaterFrame()
      if (frame) {
        ctx.drawImage(frame, screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
        return
      }
    }

    if (useTexture && this.textureManager.tileTextureCache[type]) {
      const cache = this.textureManager.tileTextureCache[type]
      if (cache && cache.length) {
        const idx = this.textureManager.getTileVariation(type, tileX, tileY)
        if (idx >= 0 && idx < cache.length) {
          const info = cache[idx]
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
    }

    ctx.fillStyle = TILE_COLORS[type]
    ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
  }

  drawOreOverlay(ctx, tileX, tileY, screenX, screenY, useTexture) {
    const cache = this.textureManager.tileTextureCache.ore
    if (useTexture && cache && cache.length) {
      const idx = this.textureManager.getTileVariation('ore', tileX, tileY)
      if (idx >= 0 && idx < cache.length) {
        const info = cache[idx]
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

  drawSeedOverlay(ctx, tileX, tileY, screenX, screenY, useTexture) {
    const cache = this.textureManager.tileTextureCache.seedCrystal
    if (useTexture && cache && cache.length) {
      const idx = this.textureManager.getTileVariation('seedCrystal', tileX, tileY)
      if (idx >= 0 && idx < cache.length) {
        const info = cache[idx]
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

  applyVisibilityOverlay(ctx, mapGrid, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState) {
    const visibilityMap = gameState?.visibilityMap
    const shadowEnabled = Boolean(gameState?.shadowOfWarEnabled && visibilityMap && visibilityMap.length)

    if (!shadowEnabled) return

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tileVisibility = visibilityMap[y] ? visibilityMap[y][x] : null
        const screenX = Math.floor(x * TILE_SIZE - scrollOffset.x)
        const screenY = Math.floor(y * TILE_SIZE - scrollOffset.y)

        if (!tileVisibility || !tileVisibility.discovered) {
          this.drawUndiscoveredOverlay(ctx, x, y, screenX, screenY, visibilityMap)
          continue
        }

        if (!tileVisibility.visible) {
          ctx.fillStyle = FOG_OVERLAY_STYLE
          ctx.fillRect(screenX, screenY, TILE_SIZE + 1, TILE_SIZE + 1)
        }
      }
    }
  }

  drawUndiscoveredOverlay(ctx, tileX, tileY, screenX, screenY, visibilityMap) {
    const tilePixelSize = TILE_SIZE + 1
    ctx.fillStyle = UNDISCOVERED_COLOR
    ctx.fillRect(screenX, screenY, tilePixelSize, tilePixelSize)

    if (SHADOW_GRADIENT_SIZE <= 0) return

    const gradientWidth = Math.min(SHADOW_GRADIENT_SIZE, Math.floor(tilePixelSize / 2))
    const mapHeight = visibilityMap.length
    const mapWidth = visibilityMap[0]?.length || 0

    if (!gradientWidth || !mapHeight || !mapWidth) return

    const neighborDiscovered = {
      left: tileX > 0 && Boolean(visibilityMap[tileY]?.[tileX - 1]?.discovered),
      right: tileX < mapWidth - 1 && Boolean(visibilityMap[tileY]?.[tileX + 1]?.discovered),
      top: tileY > 0 && Boolean(visibilityMap[tileY - 1]?.[tileX]?.discovered),
      bottom: tileY < mapHeight - 1 && Boolean(visibilityMap[tileY + 1]?.[tileX]?.discovered)
    }

    if (!neighborDiscovered.left && !neighborDiscovered.right && !neighborDiscovered.top && !neighborDiscovered.bottom) {
      return
    }

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

  /**
   * Draw a Smoothening Overlay Texture (SOT) on a single tile
   */
  drawSOT(ctx, tileX, tileY, orientation, scrollOffset, useTexture, sotApplied, type = 'street', currentWaterFrame = null) {
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
      const frame = currentWaterFrame || this.textureManager.getCurrentWaterFrame()
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
    if (!gameState.occupancyVisible || !occupancyMap) return

    const mode = gameState.occupancyMapViewMode || 'players'
    const mineOverlay = this.buildMineOverlay(mode, gameState.mines)

    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        if (y < 0 || y >= occupancyMap.length || x < 0 || x >= occupancyMap[0].length) continue

        const tileOccupied = Boolean(occupancyMap[y][x])
        const tileKey = `${x},${y}`
        const mineBlocked = mineOverlay && mineOverlay.has(tileKey)
        if (tileOccupied || mineBlocked) {
          const tileX = Math.floor(x * TILE_SIZE - scrollOffset.x)
          const tileY = Math.floor(y * TILE_SIZE - scrollOffset.y)
          ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE)
        }
      }
    }
  }

  buildMineOverlay(mode, mines) {
    if (!mode || mode === 'off' || !Array.isArray(mines) || mines.length === 0) return null

    const overlay = new Set()
    const showAll = mode === 'players'
    const specialOwner = showAll ? null : mode

    mines.forEach(mine => {
      if (!mine || !mine.active) return
      if (showAll || mine.owner === specialOwner) {
        overlay.add(`${mine.tileX},${mine.tileY}`)
      }
    })

    return overlay
  }

  render(ctx, mapGrid, scrollOffset, gameCanvas, gameState, occupancyMap = null, options = {}) {
    const { skipBaseLayer = false } = options || {}
    // Calculate visible tile range - improved for better performance
    const startTileX = Math.max(0, Math.floor(scrollOffset.x / TILE_SIZE))
    const startTileY = Math.max(0, Math.floor(scrollOffset.y / TILE_SIZE))
    const tilesX = Math.ceil(gameCanvas.width / TILE_SIZE) + 1
    const tilesY = Math.ceil(gameCanvas.height / TILE_SIZE) + 1
    const endTileX = Math.min(mapGrid[0].length, startTileX + tilesX)
    const endTileY = Math.min(mapGrid.length, startTileY + tilesY)

    if (!skipBaseLayer) {
      this.renderTiles(ctx, mapGrid, scrollOffset, startTileX, startTileY, endTileX, endTileY, gameState)
    }
    this.applyVisibilityOverlay(ctx, mapGrid, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
    this.renderGrid(ctx, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
    this.renderOccupancyMap(ctx, occupancyMap, startTileX, startTileY, endTileX, endTileY, scrollOffset, gameState)
  }
}
