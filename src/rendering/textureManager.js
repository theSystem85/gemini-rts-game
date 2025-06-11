// rendering/textureManager.js
import { TILE_SIZE, TILE_IMAGES, TEXTURE_VARIATIONS } from '../config.js'
import { buildingImageMap } from '../buildingImageMap.js'
import { getDevicePixelRatio } from './renderingUtils.js'

// Map unit types to their image paths
const unitImageMap = {
  tank: 'images/tank.webp',
  tank_v1: 'images/tank.webp',
  'tank-v2': 'images/tank_v2.jpg',
  tank_v2: 'images/tank_v2.jpg',
  rocketTank: 'images/rocket_tank.webp',
  harvester: 'images/harvester.webp',
  artilleryTank: 'images/artillery_tank.jpg'
}

export class TextureManager {
  constructor() {
    this.imageCache = {}
    this.loadingImages = {}
    this.tileTextureCache = {}
    this.tileVariationMap = {}
    this.allTexturesLoaded = false
    this.loadingStarted = false
  }

  // Helper function to load images once
  getOrLoadImage(baseName, extensions = ['jpg', 'webp', 'png'], callback) {
    // Check if image is already in cache
    if (this.imageCache[baseName]) {
      callback(this.imageCache[baseName])
      return
    }

    // Check if this image is already being loaded
    if (this.loadingImages[baseName]) {
      // Add this callback to the queue
      this.loadingImages[baseName].push(callback)
      return
    }

    // Start loading this image and create callback queue
    this.loadingImages[baseName] = [callback]

    // Try loading with different extensions
    const tryLoadImage = (baseName, extensions, index = 0) => {
      if (index >= extensions.length) {
        // Nothing worked - notify all callbacks with failure
        while (this.loadingImages[baseName].length > 0) {
          const cb = this.loadingImages[baseName].shift()
          cb(null)
        }
        delete this.loadingImages[baseName]
        console.warn(`Failed to load image: ${baseName}. Tried extensions: ${extensions.join(', ')}`)
        // Show which image maps contain this asset for debugging
        if (buildingImageMap && Object.values(buildingImageMap).includes(baseName)) {
          console.info('Note: This image is referenced in buildingImageMap')
        }
        if (unitImageMap && Object.values(unitImageMap).includes(baseName)) {
          console.info('Note: This image is referenced in unitImageMap')
        }
        return
      }

      const img = new Image()
      img.onload = () => {
        // Cache the loaded image
        this.imageCache[baseName] = img

        // Notify all waiting callbacks
        while (this.loadingImages[baseName].length > 0) {
          const cb = this.loadingImages[baseName].shift()
          cb(img)
        }
        delete this.loadingImages[baseName]
      }

      img.onerror = () => {
        // Try next extension
        tryLoadImage(baseName, extensions, index + 1)
      }

      // The public directory is served at the root
      img.src = `${baseName}.${extensions[index]}`
    }

    tryLoadImage(baseName, extensions, 0)
  }

  // Create rotated/transformed variations of a texture
  createTextureVariations(baseTexture, count, shouldRotate = true) {
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
  preloadAllTextures(callback) {
    if (this.loadingStarted) return
    this.loadingStarted = true
    
    // Count total textures to load
    let totalTextures = 0
    let loadedTextures = 0

    for (const [, tileInfo] of Object.entries(TILE_IMAGES)) {
      const paths = tileInfo.paths || []
      if (paths.length === 0) continue
      totalTextures += paths.length
    }

    if (totalTextures === 0) {
      this.allTexturesLoaded = true
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

      this.tileTextureCache[tileType] = []

      // For each image path for this tile type
      for (const imagePath of paths) {
        this.getOrLoadImage(imagePath, ['jpg', 'webp', 'png'], (img) => {
          if (img) {
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
            const variations = this.createTextureVariations(baseCanvas, TEXTURE_VARIATIONS, shouldRotate)
            this.tileTextureCache[tileType] = this.tileTextureCache[tileType].concat(variations)
          }

          loadedTextures++
          
          if (loadedTextures === totalTextures) {
            this.allTexturesLoaded = true
            if (callback) callback()
          }
        })
      }
    }
  }

  // Get a consistent tile variation based on position
  getTileVariation(tileType, x, y) {
    // Create unique key for this tile position
    const key = `${tileType}_${x}_${y}`

    // If we already determined a variation for this tile, use it
    if (this.tileVariationMap[key] !== undefined) {
      return this.tileVariationMap[key]
    }

    // If no variations available, return -1 to use color fallback
    if (!this.tileTextureCache[tileType] || this.tileTextureCache[tileType].length === 0) {
      return -1
    }

    // Generate a deterministic but seemingly random variation based on position
    // This ensures the same tile always gets the same variation
    const hash = Math.abs((x * 73) ^ (y * 151)) % this.tileTextureCache[tileType].length

    // Store the variation for this position
    this.tileVariationMap[key] = hash

    return hash
  }

  // Export getter for unit image map for compatibility
  getUnitImageMap() {
    return unitImageMap
  }
}
