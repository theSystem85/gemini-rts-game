// buildingImageMap.js
// Maps building types to their image assets

// Building image cache to store adjusted/processed images
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

// Get device pixel ratio for high-DPI rendering
const getDevicePixelRatio = () => {
  return window.devicePixelRatio || 1
}

// Get cached building image or load and cache it
export function getBuildingImage(buildingType, width, height, callback) {
  const cacheKey = `${buildingType}_${width}_${height}`

  // Return cached image if available
  if (buildingImageCache[cacheKey]) {
    callback(buildingImageCache[cacheKey])
    return
  }

  // Get the image path from the mapping
  const imagePath = buildingImageMap[buildingType]

  if (!imagePath) {
    console.warn(`No image mapping found for building type: ${buildingType}`)
    callback(null)
    return
  }

  // Load the source image
  const img = new Image()
  img.onload = () => {
    // Get the device pixel ratio
    const pixelRatio = getDevicePixelRatio()

    // Create a high-resolution canvas to resize/process the image
    const canvas = document.createElement('canvas')
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio

    // Set display size (CSS) to desired dimensions
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')

    // Enable high-quality image scaling
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Scale all drawing operations by the pixel ratio
    ctx.scale(pixelRatio, pixelRatio)

    // Use a two-step scaling process for better quality
    // First draw to an intermediate canvas at 2x size for better downscaling
    const tempCanvas = document.createElement('canvas')
    const tempSize = Math.max(width, height) * 2
    tempCanvas.width = tempSize
    tempCanvas.height = tempSize

    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.imageSmoothingEnabled = true
    tempCtx.imageSmoothingQuality = 'high'

    // Draw original image to the intermediate canvas
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
    ctx.drawImage(tempCanvas, 0, 0, width, height)

    // Store the processed image in the cache
    buildingImageCache[cacheKey] = canvas

    // Return the processed image
    callback(canvas)
  }

  img.onerror = () => {
    console.error(`Failed to load building image: ${imagePath}`)
    callback(null)
  }

  img.src = imagePath
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

  // Default tile size to preload (typically these will be cached and resized later)
  const defaultWidth = 64
  const defaultHeight = 64

  // For each building type
  for (const buildingType of Object.keys(buildingImageMap)) {
    getBuildingImage(buildingType, defaultWidth, defaultHeight, (_img) => {
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
