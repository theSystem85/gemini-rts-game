// buildingImageMap.js
// Maps building types to their image assets

// Building image cache to store loaded images
const buildingImageCache = {}

// Map building types to their image paths
import { loadSpriteSheet, getSprite, isSpriteSheetLoaded } from './spriteSheet.js'

export const buildingImageMap = {
  powerPlant: 'images/map/buildings/power_plant',
  oreRefinery: 'images/map/buildings/refinery',
  vehicleFactory: 'images/map/buildings/vehicle_factory',
  radarStation: 'images/map/buildings/radar_station',
  turretGunV1: 'images/map/buildings/turret01',
  turretGunV2: 'images/map/buildings/turret02',
  turretGunV3: 'images/map/buildings/turret02',
  rocketTurret: 'images/map/buildings/rocket_gun',
  teslaCoil: 'images/map/buildings/teslacoil',
  constructionYard: 'images/map/buildings/construction_yard',
  concreteWall: 'images/map/buildings/turret01',
  artilleryTurret: 'images/map/buildings/artillery_turret'
}

// Track loading state
let buildingImagesPreloaded = false
let buildingImagesLoading = false

// Get cached building image or load and cache it
export function getBuildingImage(buildingType, callback) {
  // Return cached image if available
  if (buildingImageCache[buildingType]) {
    if (callback) {
      callback(buildingImageCache[buildingType])
    }
    return buildingImageCache[buildingType]
  }

  // Get the image path from the mapping
  const imagePath = buildingImageMap[buildingType]

  if (!imagePath) {
    console.warn(`No image mapping found for building type: ${buildingType}`)
    if (callback) callback(null)
    return null
  }
  const load = async () => {
    if (!isSpriteSheetLoaded()) {
      await loadSpriteSheet()
    }
    const sprite = getSprite(imagePath)
    if (!sprite) {
      console.warn(`Sprite not found for building ${buildingType}`)
      if (callback) callback(null)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = sprite.width
    canvas.height = sprite.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(sprite.img, sprite.x, sprite.y, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height)
    buildingImageCache[buildingType] = canvas
    if (callback) callback(canvas)
  }

  load()
  return null
}

// Preload all building images
export function preloadBuildingImages(callback) {
  // Don't reload if already loaded or loading
  if (buildingImagesPreloaded || buildingImagesLoading) {
    if (callback && buildingImagesPreloaded) {
      callback()
    }
    return
  }

  buildingImagesLoading = true

  // Count total images to preload
  const totalImages = Object.keys(buildingImageMap).length
  let loadedImages = 0

  // For each building type
  for (const buildingType of Object.keys(buildingImageMap)) {
    getBuildingImage(buildingType, (_img) => {
      loadedImages++
      
      if (loadedImages === totalImages) {
        buildingImagesPreloaded = true
        buildingImagesLoading = false
        if (callback) callback()
      }
    })
  }
}

// Clear the cache (useful for memory management or testing)
export function clearBuildingImageCache() {
  for (const key in buildingImageCache) {
    delete buildingImageCache[key]
  }
  buildingImagesPreloaded = false
}

// Get cache stats for debugging
export function getBuildingImageCacheStats() {
  return {
    size: Object.keys(buildingImageCache).length,
    keys: Object.keys(buildingImageCache),
    preloaded: buildingImagesPreloaded
  }
}
