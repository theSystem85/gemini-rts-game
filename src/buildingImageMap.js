// buildingImageMap.js
// Maps building types to their image assets

// Building image cache to store loaded images
const buildingImageCache = {}

// Map building types to their image paths
export const buildingImageMap = {
  powerPlant: 'images/map/buildings/power_plant.jpg',
  oreRefinery: 'images/map/buildings/refinery.jpg',
  vehicleFactory: 'images/map/buildings/vehicle_factory.jpg',
  radarStation: 'images/map/buildings/radar_station.jpg',
  turretGunV1: 'images/map/buildings/turret01.jpg',
  turretGunV2: 'images/map/buildings/turret02.jpg',
  turretGunV3: 'images/map/buildings/turret02.jpg', // Using turret02 as fallback
  rocketTurret: 'images/map/buildings/rocket_gun.png',
  teslaCoil: 'images/map/buildings/teslacoil.jpg',
  constructionYard: 'images/map/buildings/construction_yard.png',
  concreteWall: 'images/map/buildings/turret01.jpg' // Using turret01 as a fallback
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

  // Load the source image
  const img = new Image()
  img.onload = () => {
    // Store the original image in the cache
    buildingImageCache[buildingType] = img

    // Return the original image
    if (callback) callback(img)
  }

  img.onerror = () => {
    console.error(`Failed to load building image: ${imagePath}`)
    if (callback) callback(null)
  }

  img.src = imagePath
  return null // Return null for async loading
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
  console.log('Preloading building images...')

  // Count total images to preload
  const totalImages = Object.keys(buildingImageMap).length
  let loadedImages = 0

  // For each building type
  for (const buildingType of Object.keys(buildingImageMap)) {
    getBuildingImage(buildingType, (_img) => {
      loadedImages++
      console.log(`Preloaded building image: ${buildingType} (${loadedImages}/${totalImages})`)

      if (loadedImages === totalImages) {
        console.log('All building images preloaded successfully!')
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
