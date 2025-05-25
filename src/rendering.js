// --- Tesla Coil Lightning Rendering ---
function drawTeslaCoilLightning(gameCtx, fromX, fromY, toX, toY, scatterRadius = TILE_SIZE, colorStops = [
  { color: 'rgba(255,255,128,0.95)', pos: 0 },
  { color: 'rgba(0,200,255,0.7)', pos: 0.5 },
  { color: 'rgba(255,255,255,1)', pos: 1 }
], boltWidth = 5) {
  // Draw a jagged, glowing lightning bolt with some randomness
  const numSegments = 12
  const points = [{ x: fromX, y: fromY }]
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments
    const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 18
    const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 18
    points.push({ x, y })
  }
  points.push({ x: toX, y: toY })


  // Glow effect (keep shadow for glow only)
  for (let glow = 18; glow > 0; glow -= 6) {
    gameCtx.save()
    gameCtx.strokeStyle = 'rgba(255,255,128,0.18)' // Increased alpha for visibility
    gameCtx.shadowColor = '#fff'
    gameCtx.shadowBlur = glow
    gameCtx.lineWidth = boltWidth + glow
    gameCtx.beginPath()
    gameCtx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      gameCtx.lineTo(points[i].x, points[i].y)
    }
    gameCtx.stroke()
    gameCtx.restore()
  }

  // Main bolt (NO shadow, solid gradient)
  gameCtx.save()
  const grad = gameCtx.createLinearGradient(fromX, fromY, toX, toY)
  colorStops.forEach(stop => grad.addColorStop(stop.pos, stop.color))
  gameCtx.strokeStyle = grad
  gameCtx.shadowBlur = 0
  gameCtx.lineWidth = boltWidth
  gameCtx.beginPath()
  gameCtx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    gameCtx.lineTo(points[i].x, points[i].y)
  }
  gameCtx.stroke()
  gameCtx.restore()

  // Impact scatter
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = scatterRadius * (0.5 + Math.random() * 0.5)
    const ex = toX + Math.cos(angle) * r
    const ey = toY + Math.sin(angle) * r
    gameCtx.save()
    gameCtx.strokeStyle = 'rgba(0,200,255,0.7)'
    gameCtx.lineWidth = 2
    gameCtx.beginPath()
    gameCtx.moveTo(toX, toY)
    gameCtx.lineTo(ex, ey)
    gameCtx.stroke()
    gameCtx.restore()
  }
}
// rendering.js
import { TILE_SIZE, TILE_COLORS, TILE_IMAGES, HARVESTER_CAPPACITY, USE_TEXTURES, TEXTURE_VARIATIONS } from './config.js'
import { tileToPixel } from './utils.js'
import { buildingData, isTileValid, isNearExistingBuilding } from './buildings.js'
import { getBuildingImage } from './buildingImageMap.js'

// Create an image cache to avoid repeated loading
const imageCache = {}

// Create a tile texture cache with variations for randomization
const tileTextureCache = {}

// Track loading state to avoid redundant requests
const loadingImages = {}

// Variation cache for each tile position
const tileVariationMap = {}

// Flag to track if all textures are loaded
let allTexturesLoaded = false
let loadingStarted = false

// Get device pixel ratio for high-DPI rendering
const getDevicePixelRatio = () => {
  return window.devicePixelRatio || 1
}

// Helper function to load images once
function getOrLoadImage(baseName, extensions = ['jpg', 'webp', 'png'], callback) {
  // Check if image is already in cache
  if (imageCache[baseName]) {
    callback(imageCache[baseName])
    return
  }

  // Check if this image is already being loaded
  if (loadingImages[baseName]) {
    // Add this callback to the queue
    loadingImages[baseName].push(callback)
    return
  }

  // Start loading this image and create callback queue
  loadingImages[baseName] = [callback]

  // Try loading with different extensions
  const tryLoadImage = (baseName, extensions, index = 0) => {
    if (index >= extensions.length) {
      // Nothing worked - notify all callbacks with failure
      while (loadingImages[baseName].length > 0) {
        const cb = loadingImages[baseName].shift()
        cb(null)
      }
      delete loadingImages[baseName]
      console.warn(`Failed to load image: ${baseName}`)
      return
    }

    const img = new Image()
    img.onload = () => {
      // Cache the loaded image
      imageCache[baseName] = img

      // Notify all waiting callbacks
      while (loadingImages[baseName].length > 0) {
        const cb = loadingImages[baseName].shift()
        cb(img)
      }
      delete loadingImages[baseName]
    }

    img.onerror = () => {
      // Try next extension
      console.log(`Failed to load ${baseName}.${extensions[index]}, trying next format...`)
      tryLoadImage(baseName, extensions, index + 1)
    }

    // The public directory is served at the root
    img.src = `${baseName}.${extensions[index]}`
  }

  tryLoadImage(baseName, extensions, 0)
}

// Create rotated/transformed variations of a texture
// Added shouldRotate parameter that defaults to true for backward compatibility
function createTextureVariations(baseTexture, count, shouldRotate = true) {
  const variations = [baseTexture] // First variation is the original

  // If rotation is disabled, just return the original texture
  if (!shouldRotate || count <= 1) {
    return variations
  }

  const pixelRatio = getDevicePixelRatio()

  // Create a temporary canvas for manipulations
  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE * pixelRatio
  canvas.height = TILE_SIZE * pixelRatio
  const ctx = canvas.getContext('2d')

  // Create additional variations
  for (let i = 1; i < count; i++) {
    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply pixel ratio scaling first
    ctx.scale(pixelRatio, pixelRatio)

    // Apply random transformation
    ctx.translate(TILE_SIZE / 2, TILE_SIZE / 2)

    // For variation 1 & 3: rotate
    if (i % 2 === 1) {
      const angle = (i === 1) ? Math.PI / 2 : Math.PI * 3 / 2
      ctx.rotate(angle)
    }

    // For variation 2 & 3: flip horizontally
    if (i >= 2) {
      ctx.scale(-1, 1)
    }

    ctx.translate(-TILE_SIZE / 2, -TILE_SIZE / 2)

    // Enable high-quality image scaling
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Draw the base texture with the transformation applied
    ctx.drawImage(baseTexture, 0, 0, TILE_SIZE, TILE_SIZE)

    // Create a new canvas to store this variation
    const variationCanvas = document.createElement('canvas')
    variationCanvas.width = TILE_SIZE * pixelRatio
    variationCanvas.height = TILE_SIZE * pixelRatio

    // Set display size (CSS) to maintain aspect
    variationCanvas.style.width = `${TILE_SIZE}px`
    variationCanvas.style.height = `${TILE_SIZE}px`

    const varCtx = variationCanvas.getContext('2d')
    varCtx.drawImage(canvas, 0, 0)

    variations.push(variationCanvas)
  }

  return variations
}

// Preload all tile textures at startup
function preloadAllTextures(callback) {
  if (loadingStarted) return
  loadingStarted = true
  console.log('Starting texture preloading...')

  // Count total textures to load
  let totalTextures = 0
  let loadedTextures = 0

  for (const [, tileInfo] of Object.entries(TILE_IMAGES)) {
    const paths = tileInfo.paths || []
    if (paths.length === 0) continue
    totalTextures += paths.length
  }

  if (totalTextures === 0) {
    console.log('No textures to preload.')
    allTexturesLoaded = true
    if (callback) callback()
    return
  }

  // For each tile type
  for (const [tileType, tileInfo] of Object.entries(TILE_IMAGES)) {
    // Get the image paths and rotation setting
    const paths = tileInfo.paths || []
    const shouldRotate = tileInfo.rotate !== undefined ? tileInfo.rotate : true

    // Skip if no images defined
    if (paths.length === 0) continue

    tileTextureCache[tileType] = []

    // For each image path for this tile type
    for (const imagePath of paths) {
      getOrLoadImage(imagePath, ['jpg', 'webp', 'png'], (img) => {
        if (img) {
          console.log(`Loaded texture: ${imagePath} (rotation: ${shouldRotate ? 'enabled' : 'disabled'})`)

          const pixelRatio = getDevicePixelRatio()

          // Create a canvas for the texture at the correct size, accounting for pixel ratio
          const baseCanvas = document.createElement('canvas')
          baseCanvas.width = TILE_SIZE * pixelRatio
          baseCanvas.height = TILE_SIZE * pixelRatio

          // Set display size (CSS) to maintain aspect
          baseCanvas.style.width = `${TILE_SIZE}px`
          baseCanvas.style.height = `${TILE_SIZE}px`

          const baseCtx = baseCanvas.getContext('2d')

          // Apply high-quality image rendering
          baseCtx.imageSmoothingEnabled = true
          baseCtx.imageSmoothingQuality = 'high'

          // Apply pixel ratio scaling
          baseCtx.scale(pixelRatio, pixelRatio)

          // Use a two-step scaling process for better quality
          // First draw to an intermediate canvas at 2x size for better downscaling
          const tempCanvas = document.createElement('canvas')
          const tempSize = TILE_SIZE * 2
          tempCanvas.width = tempSize
          tempCanvas.height = tempSize

          const tempCtx = tempCanvas.getContext('2d')
          tempCtx.imageSmoothingEnabled = true
          tempCtx.imageSmoothingQuality = 'high'

          // Draw original image to the intermediate canvas, maintaining aspect ratio
          const aspectRatio = img.width / img.height
          let drawWidth, drawHeight

          if (aspectRatio > 1) {
            // Image is wider than tall
            drawWidth = tempSize
            drawHeight = tempSize / aspectRatio
          } else {
            // Image is taller than wide
            drawWidth = tempSize * aspectRatio
            drawHeight = tempSize
          }

          // Center the image in the canvas
          tempCtx.drawImage(img, (tempSize - drawWidth) / 2, (tempSize - drawHeight) / 2, drawWidth, drawHeight)

          // Draw from the intermediate canvas to the final canvas
          baseCtx.drawImage(tempCanvas, 0, 0, TILE_SIZE, TILE_SIZE)

          // Generate variations and add them to the cache - respect the rotation setting
          const variations = createTextureVariations(baseCanvas, TEXTURE_VARIATIONS, shouldRotate)
          tileTextureCache[tileType] = tileTextureCache[tileType].concat(variations)
        }

        loadedTextures++
        console.log(`Texture loading progress: ${loadedTextures}/${totalTextures}`)

        if (loadedTextures === totalTextures) {
          console.log('All textures loaded successfully!')
          allTexturesLoaded = true
          if (callback) callback()
        }
      })
    }
  }
}

// Get a consistent tile variation based on position
function getTileVariation(tileType, x, y) {
  // Create unique key for this tile position
  const key = `${tileType}_${x}_${y}`

  // If we already determined a variation for this tile, use it
  if (tileVariationMap[key] !== undefined) {
    return tileVariationMap[key]
  }

  // If no variations available, return -1 to use color fallback
  if (!tileTextureCache[tileType] || tileTextureCache[tileType].length === 0) {
    return -1
  }

  // Generate a deterministic but seemingly random variation based on position
  // This ensures the same tile always gets the same variation
  const hash = Math.abs((x * 73) ^ (y * 151)) % tileTextureCache[tileType].length

  // Store the variation for this position
  tileVariationMap[key] = hash

  return hash
}

export function renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, buildings, scrollOffset, selectionActive, selectionStart, selectionEnd, gameState) {

  if (!gameState) {
    return
  }

  // If texture loading hasn't started yet, start it (this should only happen once)
  if (!loadingStarted) {
    preloadAllTextures()
  }

  // If game over, render win/lose overlay and stop drawing further
  if (gameState?.gameOver && gameState?.gameOverMessage) {
    const messageX = gameCanvas.width / 2
    const messageY = gameCanvas.height / 2
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height)
    gameCtx.font = 'bold 32px Arial'
    gameCtx.textAlign = 'center'
    gameCtx.fillStyle = '#FFFFFF'
    gameCtx.fillText(gameState.gameOverMessage, messageX, messageY)
    gameCtx.font = '20px Arial'
    gameCtx.fillText('Press R to start a new game', messageX, messageY + 50)
    return
  }

  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)

  // Calculate visible tile range - improved for better performance
  const startTileX = Math.max(0, Math.floor(scrollOffset.x / TILE_SIZE))
  const startTileY = Math.max(0, Math.floor(scrollOffset.y / TILE_SIZE))
  const tilesX = Math.ceil(gameCanvas.width / TILE_SIZE) + 1
  const tilesY = Math.ceil(gameCanvas.height / TILE_SIZE) + 1
  const endTileX = Math.min(mapGrid[0].length, startTileX + tilesX)
  const endTileY = Math.min(mapGrid.length, startTileY + tilesY)

  // Draw map tiles - optimized rendering
  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = mapGrid[y][x]
      const tileType = tile.type
      const tileX = x * TILE_SIZE - scrollOffset.x
      const tileY = y * TILE_SIZE - scrollOffset.y

      // Try to use texture if available and enabled - IMPORTANT: Don't try to load here!
      if (USE_TEXTURES && allTexturesLoaded && tileTextureCache[tileType]) {
        // Get consistent variation for this tile position
        const variationIndex = getTileVariation(tileType, x, y)

        // If valid variation found, draw it
        if (variationIndex >= 0 && variationIndex < tileTextureCache[tileType].length) {
          gameCtx.drawImage(tileTextureCache[tileType][variationIndex], tileX, tileY, TILE_SIZE, TILE_SIZE)
          continue // Skip to next tile, no need for fallback
        }
      }

      // Fall back to color if texture not available or disabled
      gameCtx.fillStyle = TILE_COLORS[tileType]
      gameCtx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE)
    }
  }

  // Draw grid lines only if zoomed in closely enough for better performance
  if (TILE_SIZE > 8 && gameState.gridVisible) { // Only draw grid when tiles are big enough to see and grid is enabled
    gameCtx.strokeStyle = 'rgba(0,0,0,0.1)'
    gameCtx.beginPath()

    // Draw vertical grid lines
    for (let x = startTileX; x <= endTileX; x++) {
      const lineX = x * TILE_SIZE - scrollOffset.x
      gameCtx.moveTo(lineX, startTileY * TILE_SIZE - scrollOffset.y)
      gameCtx.lineTo(lineX, endTileY * TILE_SIZE - scrollOffset.y)
    }

    // Draw horizontal grid lines
    for (let y = startTileY; y <= endTileY; y++) {
      const lineY = y * TILE_SIZE - scrollOffset.y
      gameCtx.moveTo(startTileX * TILE_SIZE - scrollOffset.x, lineY)
      gameCtx.lineTo(endTileX * TILE_SIZE - scrollOffset.x, lineY)
    }

    gameCtx.stroke()
  }

  // Draw buildings if they exist
  if (buildings && buildings.length > 0) {
    buildings.forEach(building => {
      const screenX = building.x * TILE_SIZE - scrollOffset.x
      const screenY = building.y * TILE_SIZE - scrollOffset.y
      const width = building.width * TILE_SIZE
      const height = building.height * TILE_SIZE

      // Use the building image if available
      getBuildingImage(building.type, width, height, (img) => {
        if (img) {
          // Draw the building image
          gameCtx.drawImage(img, screenX, screenY, width, height)
        } else {
          // Fallback to the old rectangle rendering if no image is available
          gameCtx.fillStyle = '#777'
          gameCtx.fillRect(screenX, screenY, width, height)

          // Draw building outline
          gameCtx.strokeStyle = '#000'
          gameCtx.lineWidth = 2
          gameCtx.strokeRect(screenX, screenY, width, height)

          // Draw building type identifier as text
          gameCtx.fillStyle = '#fff'
          gameCtx.font = '10px Arial'
          gameCtx.textAlign = 'center'
          gameCtx.fillText(building.type, screenX + width / 2, screenY + height / 2)
        }
      })

      // Draw turret for defensive buildings
      if (building.type === 'rocketTurret' || building.type.startsWith('turretGun') || building.type === 'teslaCoil') {
        const centerX = screenX + width / 2
        const centerY = screenY + height / 2

        // For Tesla Coil, draw a special base and range indicator
        if (building.type === 'teslaCoil') {
          // Draw Tesla Coil base
          gameCtx.save()
          gameCtx.translate(centerX, centerY)
          // Draw coil base
          gameCtx.fillStyle = '#222'
          gameCtx.beginPath()
          gameCtx.arc(0, 0, 14, 0, Math.PI * 2)
          gameCtx.fill()
          // Draw coil core
          gameCtx.fillStyle = '#ff0'
          gameCtx.beginPath()
          gameCtx.arc(0, 0, 7, 0, Math.PI * 2)
          gameCtx.fill()
          // Draw blue electric ring
          gameCtx.strokeStyle = '#0cf'
          gameCtx.lineWidth = 3
          gameCtx.beginPath()
          gameCtx.arc(0, 0, 11, 0, Math.PI * 2)
          gameCtx.stroke()
          gameCtx.restore()

          // Draw range indicator if selected
          if (building.selected) {
            gameCtx.save()
            gameCtx.strokeStyle = 'rgba(255, 255, 0, 0.25)'
            gameCtx.lineWidth = 2
            gameCtx.beginPath()
            gameCtx.arc(centerX, centerY, building.fireRange * TILE_SIZE, 0, Math.PI * 2)
            gameCtx.stroke()
            gameCtx.restore()
          }
        }
        // For rocket turret, don't draw the rotating barrel
        else if (building.type.startsWith('turretGun')) {
          // Draw turret with rotation
          gameCtx.save()
          gameCtx.translate(centerX, centerY)
          gameCtx.rotate(building.turretDirection || 0)

          // Draw the turret barrel with different styles based on turret type
          if (building.type === 'turretGunV1') {
            // V1 - Basic turret
            gameCtx.strokeStyle = '#00F'
            gameCtx.lineWidth = 3
            gameCtx.beginPath()
            gameCtx.moveTo(0, 0)
            gameCtx.lineTo(TILE_SIZE * 0.7, 0)
            gameCtx.stroke()
          } else if (building.type === 'turretGunV2') {
            // V2 - Advanced targeting turret
            gameCtx.strokeStyle = '#0FF'
            gameCtx.lineWidth = 3
            gameCtx.beginPath()
            gameCtx.moveTo(0, 0)
            gameCtx.lineTo(TILE_SIZE * 0.8, 0)
            gameCtx.stroke()

            // Add targeting reticle
            gameCtx.strokeStyle = '#0FF'
            gameCtx.beginPath()
            gameCtx.arc(TILE_SIZE * 0.4, 0, 4, 0, Math.PI * 2)
            gameCtx.stroke()
          } else if (building.type === 'turretGunV3') {
            // V3 - Heavy burst fire turret
            gameCtx.strokeStyle = '#FF0'
            gameCtx.lineWidth = 4
            gameCtx.beginPath()
            gameCtx.moveTo(0, 0)
            gameCtx.lineTo(TILE_SIZE * 0.9, 0)
            gameCtx.stroke()

            // Draw double barrel
            gameCtx.strokeStyle = '#FF0'
            gameCtx.lineWidth = 2
            gameCtx.beginPath()
            gameCtx.moveTo(TILE_SIZE * 0.3, -3)
            gameCtx.lineTo(TILE_SIZE * 0.9, -3)
            gameCtx.moveTo(TILE_SIZE * 0.3, 3)
            gameCtx.lineTo(TILE_SIZE * 0.9, 3)
            gameCtx.stroke()
          }

          // Draw turret base
          gameCtx.fillStyle = '#222'
          gameCtx.beginPath()
          gameCtx.arc(0, 0, 8, 0, Math.PI * 2)
          gameCtx.fill()

          // Draw ready indicator if the turret can fire
          if (!building.lastShotTime || performance.now() - building.lastShotTime >= building.fireCooldown) {
            gameCtx.fillStyle = '#0F0'
            gameCtx.beginPath()
            gameCtx.arc(0, 0, 4, 0, Math.PI * 2)
            gameCtx.fill()
          }

          gameCtx.restore()
        } else if (building.type === 'rocketTurret') {
          // For rocket turret, only draw the ready indicator in bottom left corner
          if (!building.lastShotTime || performance.now() - building.lastShotTime >= building.fireCooldown) {
            gameCtx.fillStyle = '#0F0'
            gameCtx.beginPath()
            gameCtx.arc(screenX + 10, screenY + height - 10, 5, 0, Math.PI * 2)
            gameCtx.fill()
          }
        }

        // Draw range indicator if selected
        if (building.selected) {
          gameCtx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
          gameCtx.beginPath()
          gameCtx.arc(centerX, centerY, building.fireRange * TILE_SIZE, 0, Math.PI * 2)
          gameCtx.stroke()
        }
      }

      // Draw selection outline if building is selected
      if (building.selected) {
        gameCtx.strokeStyle = '#FF0'
        gameCtx.lineWidth = 3
        gameCtx.strokeRect(
          screenX - 2,
          screenY - 2,
          width + 4,
          height + 4
        )
      }

      // Draw health bar if damaged
      if (building.health < building.maxHealth) {
        const healthBarWidth = width
        const healthBarHeight = 5
        const healthPercentage = building.health / building.maxHealth

        // Background
        gameCtx.fillStyle = '#333'
        gameCtx.fillRect(screenX, screenY - 10, healthBarWidth, healthBarHeight)

        // Health
        gameCtx.fillStyle = healthPercentage > 0.6 ? '#0f0' :
          healthPercentage > 0.3 ? '#ff0' : '#f00'
        gameCtx.fillRect(screenX, screenY - 10, healthBarWidth * healthPercentage, healthBarHeight)
      }

      // Draw owner indicator
      const ownerColor = building.owner === 'player' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'
      gameCtx.fillStyle = ownerColor
      gameCtx.fillRect(
        screenX + 2,
        screenY + 2,
        8,
        8
      )
    })
  }

  // Draw factories.
  factories.forEach(factory => {
    if (factory.destroyed) return
    const pos = tileToPixel(factory.x, factory.y)
    const screenX = pos.x - scrollOffset.x
    const screenY = pos.y - scrollOffset.y
    const width = factory.width * TILE_SIZE
    const height = factory.height * TILE_SIZE

    // Use the construction yard image for factories
    getBuildingImage('constructionYard', width, height, (img) => {
      if (img) {
        // Draw the construction yard image without color overlay
        gameCtx.drawImage(img, screenX, screenY, width, height)

        // Draw a small colored indicator in the corner instead of an overlay
        const indicatorColor = factory.id === 'player' ? '#0A0' : '#A00'
        gameCtx.fillStyle = indicatorColor
        gameCtx.fillRect(
          screenX + 4,
          screenY + 4,
          12,
          12
        )

        // Add border around the indicator
        gameCtx.strokeStyle = '#000'
        gameCtx.lineWidth = 1
        gameCtx.strokeRect(
          screenX + 4,
          screenY + 4,
          12,
          12
        )
      } else {
        // Fallback to the original colored rectangle if image fails to load
        gameCtx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00'
        gameCtx.fillRect(screenX, screenY, width, height)
      }
    })

    // Draw health bar
    const barWidth = factory.width * TILE_SIZE
    const healthRatio = factory.health / factory.maxHealth
    gameCtx.fillStyle = '#0F0'
    gameCtx.fillRect(screenX, screenY - 10, barWidth * healthRatio, 5)
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(screenX, screenY - 10, barWidth, 5)

    // Draw yellow selection outline for selected factories
    if (factory.selected) {
      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 3
      gameCtx.strokeRect(
        screenX - 2,
        screenY - 2,
        width + 4,
        height + 4
      )
    }

    // Show what the enemy is currently building (if anything)
    if (factory.id === 'enemy' && factory.currentlyBuilding) {
      // Calculate center of factory for image placement
      const centerX = screenX + (width / 2)
      const centerY = screenY + (height / 2)

      // Draw image or icon of what's being built
      const iconSize = TILE_SIZE * 2 // Keep the 2x size

      // Create a backdrop/background for the icon
      gameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      gameCtx.fillRect(
        centerX - iconSize / 2,
        centerY - iconSize / 2,
        iconSize,
        iconSize
      )

      // Simplified and more direct image name determination
      let imageName

      // Handle unit types
      if (factory.currentlyBuilding === 'tank') {
        imageName = 'tank'
      } else if (factory.currentlyBuilding === 'tank-v2') {
        imageName = 'tank_v2'
      } else if (factory.currentlyBuilding === 'rocketTank') {
        imageName = 'rocket_tank'
      } else if (factory.currentlyBuilding === 'harvester') {
        imageName = 'harvester'
      }
      // Handle building types
      else if (factory.currentlyBuilding.startsWith('turretGun')) {
        const version = factory.currentlyBuilding.slice(-2).toLowerCase()
        imageName = `turret_gun_${version}`
      } else {
        // For other buildings, use the type directly
        imageName = factory.currentlyBuilding
      }

      // Use the image cache function instead of creating a new Image every time
      getOrLoadImage(`images/${imageName}`, ['jpg', 'webp', 'png'], (img) => {
        if (img) {
          gameCtx.drawImage(img,
            centerX - iconSize / 2,
            centerY - iconSize / 2,
            iconSize,
            iconSize
          )
        } else {
          // Fallback if no image could be loaded
          gameCtx.fillStyle = '#FFF'
          gameCtx.font = '16px Arial'
          gameCtx.textAlign = 'center'
          gameCtx.fillText(
            factory.currentlyBuilding,
            centerX,
            centerY
          )
        }
      })

      // Add a "building" progress border
      const now = performance.now()
      const progress = Math.min((now - factory.buildStartTime) / factory.buildDuration, 1)

      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 3

      // Draw progress border segments - scaled with iconSize
      if (progress < 0.25) {
        // First segment (top)
        gameCtx.beginPath()
        gameCtx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX - iconSize / 2 + iconSize * (progress * 4), centerY - iconSize / 2)
        gameCtx.stroke()
      } else if (progress < 0.5) {
        // Top complete, drawing right side
        gameCtx.beginPath()
        gameCtx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2 + iconSize * ((progress - 0.25) * 4))
        gameCtx.stroke()
      } else if (progress < 0.75) {
        // Right complete, drawing bottom
        gameCtx.beginPath()
        gameCtx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2, centerY + iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2 - iconSize * ((progress - 0.5) * 4), centerY + iconSize / 2)
        gameCtx.stroke()
      } else {
        // Bottom complete, drawing left
        gameCtx.beginPath()
        gameCtx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2)
        gameCtx.lineTo(centerX + iconSize / 2, centerY + iconSize / 2)
        gameCtx.lineTo(centerX - iconSize / 2, centerY + iconSize / 2)
        gameCtx.lineTo(centerX - iconSize / 2, centerY + iconSize / 2 - iconSize * ((progress - 0.75) * 4))
        gameCtx.stroke()
      }
    }

    if (factory.id === 'enemy' && factory.budget !== undefined) {
      gameCtx.fillStyle = '#FFF'
      gameCtx.font = '12px Arial'
      gameCtx.fillText(`Budget: ${factory.budget}`, screenX, screenY - 20)
    }
  })

  // Draw units.
  units.forEach(unit => {
    if (unit.health <= 0) return

    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y

    // Set fill color based on unit type
    if (unit.type === 'tank' || unit.type === 'tank_v1') {
      gameCtx.fillStyle = unit.owner === 'player' ? '#0000FF' : '#FF0000'  // Blue for player, red for enemy
    } else if (unit.type === 'tank-v2') {
      gameCtx.fillStyle = unit.owner === 'player' ? '#FFFFFF' : '#FFB6C1'  // White for player, light pink for enemy
    } else if (unit.type === 'tank-v3') {
      gameCtx.fillStyle = unit.owner === 'player' ? '#32CD32' : '#90EE90'  // Lime green for player, light green for enemy
    } else if (unit.type === 'harvester') {
      gameCtx.fillStyle = unit.owner === 'player' ? '#9400D3' : '#DDA0DD'  // Purple for player, light purple for enemy
    } else if (unit.type === 'rocketTank') {
      gameCtx.fillStyle = unit.owner === 'player' ? '#800000' : '#F08080'  // Dark red for player, light red for enemy
    } else {
      // Fallback color
      gameCtx.fillStyle = unit.owner === 'player' ? '#0000FF' : '#FF0000'
    }

    // Draw rectangular body instead of circle
    const bodyWidth = TILE_SIZE * 0.7
    const bodyHeight = TILE_SIZE * 0.5

    // Save the current context state
    gameCtx.save()

    // Translate to center of unit and rotate
    gameCtx.translate(centerX, centerY)
    gameCtx.rotate(unit.direction)

    // Draw the rectangular body centered on the unit position
    gameCtx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight)

    // Draw front direction indicator (triangle)
    gameCtx.fillStyle = unit.owner === 'player' ? '#00FF00' : '#FFFF00'
    gameCtx.beginPath()
    gameCtx.moveTo(bodyWidth / 2, 0)
    gameCtx.lineTo(bodyWidth / 2 - 8, -8)
    gameCtx.lineTo(bodyWidth / 2 - 8, 8)
    gameCtx.closePath()
    gameCtx.fill()

    // Restore the context to its original state
    gameCtx.restore()

    // Draw selection circle if unit is selected
    if (unit.selected) {
      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(centerX, centerY, TILE_SIZE / 3 + 3, 0, 2 * Math.PI)
      gameCtx.stroke()
    }

    // If unit is alert, draw an outer red circle.
    if (unit.alertMode && unit.type === 'tank-v2') {
      gameCtx.strokeStyle = 'red'
      gameCtx.lineWidth = 3
      gameCtx.beginPath()
      gameCtx.arc(centerX, centerY, TILE_SIZE / 2, 0, 2 * Math.PI)
      gameCtx.stroke()
    }

    // Draw turret - use the turretDirection for rotation
    gameCtx.save()
    gameCtx.translate(centerX, centerY)
    gameCtx.rotate(unit.turretDirection)

    gameCtx.strokeStyle = '#000'
    gameCtx.lineWidth = 3
    gameCtx.beginPath()
    gameCtx.moveTo(0, 0)
    gameCtx.lineTo(TILE_SIZE / 2, 0)
    gameCtx.stroke()

    gameCtx.restore()

    // Draw health bar. For enemy units, force red fill.
    const unitHealthRatio = unit.health / unit.maxHealth
    const healthBarWidth = TILE_SIZE * 0.8
    const healthBarHeight = 4
    const healthBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - healthBarWidth / 2
    const healthBarY = unit.y - 10 - scrollOffset.y
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight)

    // Use green for player units, red for enemy units.
    gameCtx.fillStyle = (unit.owner === 'enemy') ? '#F00' : '#0F0'
    gameCtx.fillRect(healthBarX, healthBarY, healthBarWidth * unitHealthRatio, healthBarHeight)

    // Draw ore carried indicator for harvesters
    if (unit.type === 'harvester') {
      let progress = 0
      if (unit.harvesting) {
        progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1)
      }
      if (unit.oreCarried >= HARVESTER_CAPPACITY) {
        progress = 1
      }
      const progressBarWidth = TILE_SIZE * 0.8
      const progressBarHeight = 3
      const progressBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - progressBarWidth / 2
      const progressBarY = unit.y - 5 - scrollOffset.y
      gameCtx.fillStyle = '#FFD700'
      gameCtx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight)
      gameCtx.strokeStyle = '#000'
      gameCtx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
    }

    // NEW: Draw group number if assigned.
    if (unit.groupNumber) {
      // Use green color if formation mode is active, else default white.
      gameCtx.fillStyle = unit.formationActive ? 'green' : '#FFF'
      gameCtx.font = '10px Arial'
      gameCtx.textAlign = 'left'
      // Position at bottom left of unit rectangle.
      gameCtx.fillText(
        unit.groupNumber,
        unit.x + 2 - scrollOffset.x,
        unit.y + TILE_SIZE - 2 - scrollOffset.y
      )
    }
  })

  // Draw bullets.
  bullets.forEach(bullet => {
    gameCtx.fillStyle = '#FFF'
    gameCtx.beginPath()
    gameCtx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI)
    gameCtx.fill()
  })

  // Draw explosion effects.
  if (gameState?.explosions && gameState?.explosions.length > 0) {
    const currentTime = performance.now()
    gameState.explosions.forEach(exp => {
      const progress = (currentTime - exp.startTime) / exp.duration
      const currentRadius = exp.maxRadius * progress
      const alpha = Math.max(0, 1 - progress)
      gameCtx.strokeStyle = `rgba(255,165,0,${alpha})`
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(exp.x - scrollOffset.x, exp.y - scrollOffset.y, currentRadius, 0, 2 * Math.PI)
      gameCtx.stroke()
    })
  }

  // --- Render Tesla Coil Lightning Effects ON TOP ---
  if (units && units.length > 0) {
    const now = performance.now()
    for (const unit of units) {
      if (unit.teslaCoilHit && now - unit.teslaCoilHit.impactTime < 400) {
        // Draw the lightning bolt for a short time after impact
        drawTeslaCoilLightning(
          gameCtx,
          unit.teslaCoilHit.fromX - scrollOffset.x,
          unit.teslaCoilHit.fromY - scrollOffset.y,
          unit.teslaCoilHit.toX - scrollOffset.x,
          unit.teslaCoilHit.toY - scrollOffset.y,
          TILE_SIZE
        )
      }
    }
  }

  // Draw selection rectangle if active.
  if (selectionActive && selectionStart && selectionEnd) {
    const rectX = Math.min(selectionStart.x, selectionEnd.x) - scrollOffset.x
    const rectY = Math.min(selectionStart.y, selectionEnd.y) - scrollOffset.y
    const rectWidth = Math.abs(selectionEnd.x - selectionStart.x)
    const rectHeight = Math.abs(selectionEnd.y - selectionStart.y)
    gameCtx.strokeStyle = '#FF0'
    gameCtx.lineWidth = 2
    gameCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  }

  // Draw rally point flag if any factory has one
  factories.forEach(factory => {
    if (factory.rallyPoint && factory.id === 'player') {
      const flagX = factory.rallyPoint.x * TILE_SIZE - scrollOffset.x
      const flagY = factory.rallyPoint.y * TILE_SIZE - scrollOffset.y

      // Draw flag pole
      gameCtx.strokeStyle = '#8B4513' // Brown color for pole
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.moveTo(flagX + TILE_SIZE / 2, flagY + TILE_SIZE)
      gameCtx.lineTo(flagX + TILE_SIZE / 2, flagY)
      gameCtx.stroke()

      // Draw triangular flag
      gameCtx.fillStyle = '#FFFF00' // Yellow flag
      gameCtx.beginPath()
      gameCtx.moveTo(flagX + TILE_SIZE / 2, flagY)
      gameCtx.lineTo(flagX + TILE_SIZE, flagY + TILE_SIZE / 3)
      gameCtx.lineTo(flagX + TILE_SIZE / 2, flagY + TILE_SIZE / 2)
      gameCtx.closePath()
      gameCtx.fill()

      // Draw outline around the rally point tile
      gameCtx.strokeStyle = '#FFFF00'
      gameCtx.lineWidth = 1
      gameCtx.strokeRect(flagX, flagY, TILE_SIZE, TILE_SIZE)
    }
  })

  // Draw building placement overlay if in placement mode
  if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
    const buildingInfo = buildingData[gameState.currentBuildingType]

    if (buildingInfo) {
      const mouseX = gameState.cursorX
      const mouseY = gameState.cursorY

      // Get tile position based on mouse coordinates
      const tileX = Math.floor(mouseX / TILE_SIZE)
      const tileY = Math.floor(mouseY / TILE_SIZE)

      // Check if any tile is in range of existing building
      let isAnyTileInRange = false
      for (let y = 0; y < buildingInfo.height; y++) {
        for (let x = 0; x < buildingInfo.width; x++) {
          const currentTileX = tileX + x
          const currentTileY = tileY + y

          if (isNearExistingBuilding(currentTileX, currentTileY, buildings, factories)) {
            isAnyTileInRange = true
            break
          }
        }
        if (isAnyTileInRange) break
      }

      // Draw placement grid
      for (let y = 0; y < buildingInfo.height; y++) {
        for (let x = 0; x < buildingInfo.width; x++) {
          const currentTileX = tileX + x
          const currentTileY = tileY + y

          // Calculate screen coordinates
          const screenX = currentTileX * TILE_SIZE - scrollOffset.x
          const screenY = currentTileY * TILE_SIZE - scrollOffset.y

          // Check if valid placement for this tile (terrain/units check only)
          const isValid = isTileValid(currentTileX, currentTileY, mapGrid, units, buildings, factories)

          // Determine final color: Red if not valid or not in range, Green if both valid and in range
          const validColor = isAnyTileInRange ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'
          gameCtx.fillStyle = isValid ? validColor : 'rgba(255, 0, 0, 0.5)'
          gameCtx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

          // Draw tile outline
          gameCtx.strokeStyle = '#fff'
          gameCtx.lineWidth = 1
          gameCtx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
        }
      }

      // Draw building name above cursor
      gameCtx.fillStyle = '#fff'
      gameCtx.font = '14px Arial'
      gameCtx.textAlign = 'center'
      gameCtx.fillText(
        buildingInfo.displayName,
        tileX * TILE_SIZE + (buildingInfo.width * TILE_SIZE / 2) - scrollOffset.x,
        tileY * TILE_SIZE - 10 - scrollOffset.y
      )
    }
  }
}

export function renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units, buildings, gameState) {
  // Get the pixel ratio and CSS dimensions
  const pixelRatio = window.devicePixelRatio || 1

  // Clear the entire canvas with proper scaling
  minimapCtx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)

  // Use logical/CSS dimensions for calculations
  const minimapLogicalWidth = parseInt(minimapCanvas.style.width, 10) || 250
  const minimapLogicalHeight = parseInt(minimapCanvas.style.height, 10) || 150

  // Calculate scale based on logical dimensions
  const scaleX = minimapLogicalWidth / (mapGrid[0].length * TILE_SIZE)
  const scaleY = minimapLogicalHeight / (mapGrid.length * TILE_SIZE)

  // Apply pixel ratio scaling
  minimapCtx.scale(pixelRatio, pixelRatio)

  // Modified: Check if radar is active instead of lowEnergyMode to determine visibility
  // Only draw the minimap if we have radar capability
  if (gameState && gameState.radarActive === false) {
    // If radar is disabled, draw a static/noise pattern instead of the actual map
    minimapCtx.fillStyle = '#333'
    minimapCtx.fillRect(0, 0, minimapLogicalWidth, minimapLogicalHeight)

    // Draw "No signal" text
    minimapCtx.fillStyle = '#f00'
    minimapCtx.font = '16px Arial'
    minimapCtx.textAlign = 'center'
    minimapCtx.fillText('RADAR OFFLINE', minimapLogicalWidth / 2, minimapLogicalHeight / 2)

    // Draw some static noise pattern
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * minimapLogicalWidth
      const y = Math.random() * minimapLogicalHeight
      const size = Math.random() * 3 + 1
      minimapCtx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`
      minimapCtx.fillRect(x, y, size, size)
    }

    return // Skip the rest of the rendering
  }

  // Draw map tiles
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      // For minimap, always use color for simplicity and performance
      minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type]
      minimapCtx.fillRect(
        x * TILE_SIZE * scaleX,
        y * TILE_SIZE * scaleY,
        TILE_SIZE * scaleX,
        TILE_SIZE * scaleY
      )
    }
  }

  // Draw units
  units.forEach(unit => {
    minimapCtx.fillStyle = unit.owner === 'player' ? '#00F' : '#F00'
    const unitX = (unit.x + TILE_SIZE / 2) * scaleX
    const unitY = (unit.y + TILE_SIZE / 2) * scaleY
    minimapCtx.beginPath()
    minimapCtx.arc(unitX, unitY, 3, 0, 2 * Math.PI)
    minimapCtx.fill()
  })

  // Draw buildings if they exist
  if (buildings && buildings.length > 0) {
    buildings.forEach(building => {
      // Use different colors for player vs enemy buildings
      minimapCtx.fillStyle = building.owner === 'player' ? '#0A0' : '#A00'
      minimapCtx.fillRect(
        building.x * TILE_SIZE * scaleX,
        building.y * TILE_SIZE * scaleY,
        building.width * TILE_SIZE * scaleX,
        building.height * TILE_SIZE * scaleY
      )
    })
  }

  // Get logical canvas dimensions for viewport calculation
  const gameLogicalWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
  const gameLogicalHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight

  // Draw viewport border
  minimapCtx.strokeStyle = '#FF0'
  minimapCtx.lineWidth = 2
  minimapCtx.strokeRect(
    scrollOffset.x * scaleX,
    scrollOffset.y * scaleY,
    gameLogicalWidth * scaleX,
    gameLogicalHeight * scaleY
  )
}

// Export the preload function so it can be called from main.js
export function preloadTileTextures(callback) {
  preloadAllTextures(callback)
}
