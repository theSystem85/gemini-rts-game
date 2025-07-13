// rendering/textureManager.js
import { TILE_SIZE, TILE_IMAGES, GRASS_DECORATIVE_RATIO, GRASS_IMPASSABLE_RATIO } from '../config.js'
import { loadSpriteSheet, getSprite, isSpriteSheetLoaded, getSpriteSheetImage } from '../spriteSheet.js'
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
    this.spriteSheet = null
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
    console.log('🎨 Starting texture preloading (sprite sheet)...')

    await loadSpriteSheet()
    this.spriteSheet = getSpriteSheetImage()

    // Handle grass tile discovery
    let grassTileData = null
    const landTileInfo = TILE_IMAGES.land
    if (landTileInfo && landTileInfo.useGrassTileDiscovery) {
      try {
        grassTileData = await discoverGrassTiles()
      } catch (error) {
        console.error('Failed to discover grass tiles from JSON:', error)
        grassTileData = null
      }
    }

    for (const [tileType, tileInfo] of Object.entries(TILE_IMAGES)) {
      this.tileTextureCache[tileType] = []

      if (tileType === 'land' && grassTileData) {
        this.grassTileMetadata = {
          passableCount: grassTileData.passablePaths.length,
          decorativeCount: grassTileData.decorativePaths.length,
          impassableCount: grassTileData.impassablePaths.length
        }

        for (const p of [
          ...grassTileData.passablePaths,
          ...grassTileData.decorativePaths,
          ...grassTileData.impassablePaths
        ]) {
          this.loadSingleTexture(p, tileType)
        }
      } else if (tileInfo.paths) {
        for (const p of tileInfo.paths) {
          this.loadSingleTexture(p, tileType)
        }
      } else if (tileInfo.passablePaths && tileInfo.impassablePaths) {
        for (const p of [...tileInfo.passablePaths, ...tileInfo.impassablePaths]) {
          this.loadSingleTexture(p, tileType)
        }
      }
    }

    this.allTexturesLoaded = true
    if (callback) callback()
  }

  // Helper method to load a single texture
  loadSingleTexture(imagePath, tileType) {
    const sprite = getSprite(imagePath)
    if (sprite) {
      this.tileTextureCache[tileType].push(sprite)
    }
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
