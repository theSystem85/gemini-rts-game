// rendering/textureManager.js
import { TILE_SIZE, TILE_IMAGES, GRASS_DECORATIVE_RATIO, GRASS_IMPASSABLE_RATIO } from '../config.js'
import { buildingImageMap } from '../buildingImageMap.js'
import { getDevicePixelRatio } from './renderingUtils.js'
import { discoverGrassTiles } from '../utils/grassTileDiscovery.js'

// Map unit types to their image paths
const unitImageMap = {
  tank: 'images/tank.png',
  tank_v1: 'images/tank.png',
  'tank-v2': 'images/tank_v2.png',
  tank_v2: 'images/tank_v2.png',
  'tank-v3': 'images/tank_v3.png',
  tank_v3: 'images/tank_v3.png',
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
        console.debug(`✅ Successfully loaded: ${baseName}.${extensions[index]}`)

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



  // Preload all tile textures at startup
  async preloadAllTextures(callback) {
    if (this.loadingStarted) return
    this.loadingStarted = true
    
    console.log('🎨 Starting texture preloading...')
    console.log(`📊 Texture types to load: ${Object.keys(TILE_IMAGES).join(', ')}`)
    
    // First, handle grass tile discovery for land tiles
    let grassTileData = null
    const landTileInfo = TILE_IMAGES.land
    if (landTileInfo && landTileInfo.useGrassTileDiscovery) {
      try {
        grassTileData = await discoverGrassTiles()
        console.log('✅ Successfully loaded grass tiles from JSON configuration')
      } catch (error) {
        console.error('❌ CRITICAL: Failed to discover grass tiles from JSON. This will result in no land textures:', error)
        console.error('❌ Please ensure grass_tiles.json exists and is accessible')
        // Continue without grass tiles - will use color fallback
        grassTileData = null
      }
    }
    
    // Count total textures to load
    let totalTextures = 0
    let loadedTextures = 0

    for (const [tileType, tileInfo] of Object.entries(TILE_IMAGES)) {
      if (tileType === 'land' && grassTileData) {
        // Use discovered grass tiles
        totalTextures += grassTileData.passablePaths.length + grassTileData.decorativePaths.length + grassTileData.impassablePaths.length
      } else if (tileInfo.passablePaths && tileInfo.impassablePaths) {
        // Handle legacy hardcoded grass tiles structure
        totalTextures += tileInfo.passablePaths.length + tileInfo.impassablePaths.length
      }
      // Also handle legacy structure with single paths array
      if (tileInfo.paths) {
        totalTextures += tileInfo.paths.length
      }
    }

    if (totalTextures === 0) {
      this.allTexturesLoaded = true
      if (callback) callback()
      return
    }

    // For each tile type
    for (const [tileType, tileInfo] of Object.entries(TILE_IMAGES)) {
      this.tileTextureCache[tileType] = []
      
      // Store grass tile metadata for later use in variation selection
      if (tileType === 'land' && grassTileData) {
        this.grassTileMetadata = {
          passableCount: grassTileData.passablePaths.length,
          decorativeCount: grassTileData.decorativePaths.length,
          impassableCount: grassTileData.impassablePaths.length
        }
        
        // Log the distribution for debugging
        console.log(`Grass tile distribution:`)
        console.log(`- Passable: ${this.grassTileMetadata.passableCount} tiles (indices 0-${this.grassTileMetadata.passableCount-1})`)
        console.log(`- Decorative: ${this.grassTileMetadata.decorativeCount} tiles (indices ${this.grassTileMetadata.passableCount}-${this.grassTileMetadata.passableCount + this.grassTileMetadata.decorativeCount-1})`)
        console.log(`- Impassable: ${this.grassTileMetadata.impassableCount} tiles (indices ${this.grassTileMetadata.passableCount + this.grassTileMetadata.decorativeCount}-${this.grassTileMetadata.passableCount + this.grassTileMetadata.decorativeCount + this.grassTileMetadata.impassableCount-1})`)
        console.log(`- Total expected in cache: ${this.grassTileMetadata.passableCount + this.grassTileMetadata.decorativeCount + this.grassTileMetadata.impassableCount}`)
        console.log(`- Decorative ratio: 1 in ${GRASS_DECORATIVE_RATIO} tiles`)
        console.log(`- Impassable ratio: 1 in ${GRASS_IMPASSABLE_RATIO} tiles`)
        console.log(`- Note: Impassable has priority over decorative when both ratios match`)
      }

      // Handle legacy structure with single paths array first
      if (tileInfo.paths) {
        console.log(`🎨 Loading ${tileInfo.paths.length} textures for ${tileType}: ${tileInfo.paths.join(', ')}`)
        for (const imagePath of tileInfo.paths) {
          this.loadSingleTexture(imagePath, tileType, () => {
            loadedTextures++
            console.log(`📦 Loaded texture ${loadedTextures}/${totalTextures} for ${tileType}: ${imagePath}`)
            if (loadedTextures === totalTextures) {
              this.allTexturesLoaded = true
              
              // Debug: Log cache sizes for each tile type
              console.log('📊 Tile texture cache sizes:')
              for (const cacheType of Object.keys(this.tileTextureCache)) {
                const count = this.tileTextureCache[cacheType] ? this.tileTextureCache[cacheType].length : 0
                console.log(`   ${cacheType}: ${count} textures`)
              }
              
              if (callback) callback()
            }
          })
        }
      }

      // Handle discovered grass tiles for land
      if (tileType === 'land' && grassTileData) {
        // Load passable grass tiles
        for (const imagePath of grassTileData.passablePaths) {
          this.loadSingleTexture(imagePath, tileType, () => {
            loadedTextures++
            if (loadedTextures === totalTextures) {
              this.allTexturesLoaded = true
              console.log(`✅ All ${totalTextures} textures loaded successfully!`)
              
              // Debug: Log cache sizes for each tile type
              console.log('📊 Tile texture cache sizes:')
              for (const tileType of Object.keys(this.tileTextureCache)) {
                const count = this.tileTextureCache[tileType] ? this.tileTextureCache[tileType].length : 0
                console.log(`   ${tileType}: ${count} textures`)
              }
              
              if (callback) callback()
            }
          })
        }
        
        // Load decorative grass tiles
        for (const imagePath of grassTileData.decorativePaths) {
          this.loadSingleTexture(imagePath, tileType, () => {
            loadedTextures++
            if (loadedTextures === totalTextures) {
              this.allTexturesLoaded = true
              if (callback) callback()
            }
          })
        }
        
        // Load impassable grass tiles
        for (const imagePath of grassTileData.impassablePaths) {
          this.loadSingleTexture(imagePath, tileType, () => {
            loadedTextures++
            if (loadedTextures === totalTextures) {
              this.allTexturesLoaded = true
              if (callback) callback()
            }
          })
        }
      } else if (tileInfo.passablePaths && tileInfo.impassablePaths) {
        // Handle legacy hardcoded grass tiles structure
        // Load passable grass tiles
        for (const imagePath of tileInfo.passablePaths) {
          this.loadSingleTexture(imagePath, tileType, () => {
            loadedTextures++
            if (loadedTextures === totalTextures) {
              this.allTexturesLoaded = true
              if (callback) callback()
            }
          })
        }
        
        // Load impassable grass tiles
        for (const imagePath of tileInfo.impassablePaths) {
          this.loadSingleTexture(imagePath, tileType, () => {
            loadedTextures++
            if (loadedTextures === totalTextures) {
              this.allTexturesLoaded = true
              if (callback) callback()
            }
          })
        }
      }
    }
  }

  // Helper method to load a single texture
  loadSingleTexture(imagePath, tileType, onComplete) {
    // Determine appropriate extensions based on tile type and path
    let extensions = ['jpg', 'webp', 'png'] // Default order
    
    // For ore and seed crystal files, try webp first since they're primarily webp
    if (imagePath.includes('ore') || tileType === 'ore' || tileType === 'seedCrystal') {
      extensions = ['webp', 'jpg', 'png']
    }
    // For grass tiles, try png first since they're png files
    else if (imagePath.includes('grass_tiles') || tileType === 'land') {
      extensions = ['png', 'jpg', 'webp']
    }
    
    this.getOrLoadImage(imagePath, extensions, (img) => {
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

        // Add the single texture to the cache (no variations)
        this.tileTextureCache[tileType].push(baseCanvas)
      }

      onComplete()
    })
  }

  // Get a consistent tile variation based on position
  getTileVariation(tileType, x, y) {
    // Create unique key for this tile position and type
    const key = `${tileType}_${x}_${y}`

    // If we already determined a variation for this tile, use it
    if (this.tileVariationMap[key] !== undefined) {
      return this.tileVariationMap[key]
    }

    // If no variations available, return -1 to use color fallback
    if (!this.tileTextureCache[tileType] || this.tileTextureCache[tileType].length === 0) {
      return -1
    }

    // Special handling for land tiles with dynamically discovered grass tiles
    if (tileType === 'land' && this.grassTileMetadata) {
      const { passableCount, decorativeCount, impassableCount } = this.grassTileMetadata
      
      // Better hash function - more random but still reliable
      // Mix x and y coordinates in a non-linear way to avoid patterns
      let hash = ((x * 73856093) ^ (y * 19349663) ^ ((x + y) * 83492791)) >>> 0
      hash = ((hash >>> 16) ^ hash) * 0x45d9f3b
      hash = ((hash >>> 16) ^ hash) * 0x45d9f3b
      hash = (hash >>> 16) ^ hash
      hash = Math.abs(hash)
      
      // Simple ratio-based selection
      // Check for impassable first (rarer)
      if (hash % GRASS_IMPASSABLE_RATIO === 0) {
        // Select from impassable tiles (they start after passable + decorative)
        const impassableStartIndex = passableCount + decorativeCount
        const selectedIndex = impassableStartIndex + (hash % impassableCount)
        
        // Bounds check
        if (selectedIndex >= this.tileTextureCache[tileType].length) {
          console.warn(`Impassable index out of bounds: ${selectedIndex} >= ${this.tileTextureCache[tileType].length}`)
          return 0 // Default to first tile
        }
        
        this.tileVariationMap[key] = selectedIndex
        return selectedIndex
      }
      
      // Check for decorative second  
      if (hash % GRASS_DECORATIVE_RATIO === 0) {
        // Select from decorative tiles (they start after passable)
        const decorativeStartIndex = passableCount
        const selectedIndex = decorativeStartIndex + (hash % decorativeCount)
        
        // Bounds check
        if (selectedIndex >= this.tileTextureCache[tileType].length) {
          console.warn(`Decorative index out of bounds: ${selectedIndex} >= ${this.tileTextureCache[tileType].length}`)
          return 0 // Default to first tile
        }
        
        this.tileVariationMap[key] = selectedIndex
        return selectedIndex
      }
      
      // Default to passable tiles
      const selectedIndex = hash % passableCount
      
      // Bounds check
      if (selectedIndex >= this.tileTextureCache[tileType].length) {
        console.warn(`Passable index out of bounds: ${selectedIndex} >= ${this.tileTextureCache[tileType].length}`)
        return 0 // Default to first tile
      }
      
      this.tileVariationMap[key] = selectedIndex
      
      return selectedIndex
    }
    
    // Legacy handling for hardcoded grass tiles
    if (tileType === 'land') {
      const tileInfo = TILE_IMAGES[tileType]
      if (tileInfo && tileInfo.passablePaths && tileInfo.impassablePaths) {
        // Calculate how many textures we have for each type (no multiplier needed)
        const legacyCount = tileInfo.paths ? tileInfo.paths.length : 0
        const passableCount = tileInfo.passablePaths.length
        const impassableCount = tileInfo.impassablePaths.length
        
        // Better hash function for good randomness without patterns
        let hash = ((x * 73856093) ^ (y * 19349663) ^ ((x + y) * 83492791)) >>> 0
        hash = ((hash >>> 16) ^ hash) * 0x45d9f3b
        hash = ((hash >>> 16) ^ hash) * 0x45d9f3b
        hash = (hash >>> 16) ^ hash
        hash = Math.abs(hash)
        
        // Create weighted selection: prefer new grass tiles over legacy
        // If we have new tiles, use 50:1 ratio for passable:impassable
        // Total weight = 50 (passable) + 1 (impassable) = 51
        const weightedChoice = hash % 51
        
        let selectedIndex
        if (weightedChoice < 50) {
          // Select from passable tiles (0-49 out of 51)
          selectedIndex = legacyCount + (hash % passableCount)
        } else {
          // Select from impassable tiles (50 out of 51)
          selectedIndex = legacyCount + passableCount + (hash % impassableCount)
        }
        
        // Ensure we don't exceed the available textures
        selectedIndex = selectedIndex % this.tileTextureCache[tileType].length
        
        // Store the variation for this position
        this.tileVariationMap[key] = selectedIndex
        return selectedIndex
      }
    }

    // For all other tile types, use improved randomization
    // Generate a deterministic but more random variation based on position
    // Better hash function that provides good randomness without visible patterns
    // This ensures the same tile always gets the same variation but without diagonal lines
    let hash = ((x * 73856093) ^ (y * 19349663) ^ ((x + y) * 83492791)) >>> 0
    hash = ((hash >>> 16) ^ hash) * 0x45d9f3b
    hash = ((hash >>> 16) ^ hash) * 0x45d9f3b
    hash = (hash >>> 16) ^ hash
    hash = Math.abs(hash)

    const variationIndex = hash % this.tileTextureCache[tileType].length

    // Store the variation for this position
    this.tileVariationMap[key] = variationIndex

    return variationIndex
  }

  // Check if a land tile at given position uses an impassable grass texture
  isLandTileImpassable(x, y) {
    if (!this.grassTileMetadata || !this.allTexturesLoaded) {
      return false // Return false if grass tiles aren't loaded yet
    }
    
    const key = `land_${x}_${y}`
    let selectedIndex = this.tileVariationMap[key]
    
    if (selectedIndex === undefined) {
      // Calculate the index if not cached yet
      selectedIndex = this.getTileVariation('land', x, y)
    }
    
    if (selectedIndex === -1) return false
    
    const { passableCount, decorativeCount, impassableCount } = this.grassTileMetadata
    const impassableStartIndex = passableCount + decorativeCount
    const totalTextureCount = passableCount + decorativeCount + impassableCount
    
    // Check if the selected index falls in the impassable range
    return selectedIndex >= impassableStartIndex && selectedIndex < totalTextureCount
  }

  // Export getter for unit image map for compatibility
  getUnitImageMap() {
    return unitImageMap
  }
}
