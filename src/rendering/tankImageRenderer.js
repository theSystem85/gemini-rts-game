// rendering/tankImageRenderer.js
// Image-based tank rendering system using 3 separate image assets
import { TILE_SIZE, RECOIL_DISTANCE, RECOIL_DURATION, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE } from '../config.js'
import tankImageConfigData from '../tankImageConfig.json'

// Tank image asset cache
const tankImageCache = {
  wagon: null,
  turret: null,
  barrel: null
}

// Track loading state
let tankImagesLoaded = false
let tankImagesLoading = false

// Load tank image configuration
const tankImageConfig = tankImageConfigData.tankImageConfig

// Runtime adjustable recoil offset (for debugging)
let runtimeRecoilOffsetDegrees = tankImageConfig.recoilRotationOffset.degrees

/**
 * Preload all tank image assets
 * @param {Function} callback - Called when all images are loaded
 */
export function preloadTankImages(callback) {
  if (tankImagesLoaded) {
    if (callback) callback(true)
    return
  }

  if (tankImagesLoading) {
    // Already loading, add callback to queue if needed
    return
  }

  tankImagesLoading = true
  let loadedCount = 0
  const totalImages = 3

  const checkAllLoaded = () => {
    loadedCount++
    if (loadedCount === totalImages) {
      tankImagesLoaded = true
      tankImagesLoading = false
      if (callback) callback(true)
    }
  }

  const handleLoadError = (imageName) => {
    console.error(`Failed to load tank image: ${imageName}`)
    tankImagesLoading = false
    if (callback) callback(false)
  }

  // Load tank wagon
  const wagonImg = new Image()
  wagonImg.onload = checkAllLoaded
  wagonImg.onerror = () => handleLoadError('tank_wagon.png')
  wagonImg.src = 'images/map/units/tank_wagon.png'
  tankImageCache.wagon = wagonImg

  // Load turret (without barrel)
  const turretImg = new Image()
  turretImg.onload = checkAllLoaded
  turretImg.onerror = () => handleLoadError('turret_no_barrel.png')
  turretImg.src = 'images/map/units/turret_no_barrel.png'
  tankImageCache.turret = turretImg

  // Load gun barrel
  const barrelImg = new Image()
  barrelImg.onload = checkAllLoaded
  barrelImg.onerror = () => handleLoadError('gun_barrel.png')
  barrelImg.src = 'images/map/units/gun_barrel.png'
  tankImageCache.barrel = barrelImg
}

/**
 * Check if tank images are available for rendering
 * @returns {boolean} True if all tank images are loaded
 */
export function areTankImagesLoaded() {
  return tankImagesLoaded && tankImageCache.wagon && tankImageCache.turret && tankImageCache.barrel
}

/**
 * Render a tank using 3 separate image assets
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} unit - Tank unit object
 * @param {number} centerX - Center X position in screen coordinates
 * @param {number} centerY - Center Y position in screen coordinates
 */
export function renderTankWithImages(ctx, unit, centerX, centerY) {
  if (!areTankImagesLoaded()) {
    return false // Images not ready, caller should fall back to original rendering
  }

  const now = performance.now()

  // Save context state
  ctx.save()

  // Move to tank center
  ctx.translate(centerX, centerY)

  // 1. Render tank wagon (chassis)
  ctx.save()
  
  // The wagon image faces down by default, but unit.direction = 0 means facing right
  // So we need to subtract π/2 to align the image with the unit direction
  // unit.direction = 0 (right) → rotate by -π/2 to make down-facing image face right
  // unit.direction = π/2 (down) → rotate by 0 to keep down-facing image facing down
  // unit.direction = π (left) → rotate by π/2 to make down-facing image face left  
  // unit.direction = 3π/2 (up) → rotate by π to make down-facing image face up
  const wagonRotation = unit.direction - Math.PI / 2
  ctx.rotate(wagonRotation)
  
  // Don't change aspect ratio - use original image dimensions scaled proportionally
  // Keep original size relationships - scale wagon to fit tile, others maintain relative size
  const wagonImg = tankImageCache.wagon
  const wagonScale = TILE_SIZE / Math.max(wagonImg.width, wagonImg.height)
  const wagonWidth = wagonImg.width * wagonScale
  const wagonHeight = wagonImg.height * wagonScale
  
  ctx.drawImage(
    wagonImg, 
    -wagonWidth / 2, 
    -wagonHeight / 2, 
    wagonWidth, 
    wagonHeight
  )
  ctx.restore()

  // Skip turret/barrel for harvesters and rocket tanks
  if (unit.type === 'harvester' || unit.type === 'rocketTank') {
    ctx.restore()
    return true
  }

  // 2. Calculate recoil offset for turret/barrel
  let recoilOffset = 0
  if (unit.recoilStartTime && now - unit.recoilStartTime <= RECOIL_DURATION) {
    const progress = (now - unit.recoilStartTime) / RECOIL_DURATION
    const easedProgress = 1 - Math.pow(1 - progress, 3)
    recoilOffset = RECOIL_DISTANCE * (1 - easedProgress)
  }

  // 3. Determine turret rotation
  let turretRotation
  if (unit.target && unit.turretDirection !== undefined) {
    // Tank is targeting something - turret rotates independently to track target
    // But we also need to account for the wagon rotation offset
    turretRotation = unit.turretDirection - Math.PI / 2
  } else {
    // No target - turret follows wagon direction
    turretRotation = wagonRotation
  }

  // 4. Calculate turret position using configurable mount point
  // Convert mount point from image coordinates to world coordinates
  // The mount point is where the CENTER of the turret should be positioned
  const turretMountX = (tankImageConfig.turretMountPoint.x - wagonImg.width / 2) * wagonScale
  const turretMountY = (tankImageConfig.turretMountPoint.y - wagonImg.height / 2) * wagonScale
  
  // Rotate mount point by wagon rotation
  const rotatedMountX = turretMountX * Math.cos(wagonRotation) - turretMountY * Math.sin(wagonRotation)
  const rotatedMountY = turretMountX * Math.sin(wagonRotation) + turretMountY * Math.cos(wagonRotation)

  // 5. Render turret (without barrel)
  ctx.save()
  ctx.translate(rotatedMountX, rotatedMountY)
  ctx.rotate(turretRotation)
  
  // Don't change aspect ratio for turret - maintain original size relationship to wagon
  const turretImg = tankImageCache.turret
  const turretScale = wagonScale // Use same scale as wagon to maintain original size relationships
  const turretWidth = turretImg.width * turretScale
  const turretHeight = turretImg.height * turretScale
  
  // Center the turret on the mount point (no recoil - recoil is applied to barrel only)
  ctx.drawImage(
    turretImg, 
    -turretWidth / 2, 
    -turretHeight / 2, 
    turretWidth, 
    turretHeight
  )

  // Position barrel using configurable mount point on turret
  // The mount point is relative to the turret image's top-left, but we need it relative to center
  const barrelMountX = (tankImageConfig.barrelMountPoint.x - turretImg.width / 2) * turretScale
  const barrelMountY = (tankImageConfig.barrelMountPoint.y - turretImg.height / 2) * turretScale
  
  // Apply recoil offset to barrel only - recoil goes backward along turret's X-axis
  // Add configurable rotation offset for debugging/tweaking
  const recoilOffsetRadians = (runtimeRecoilOffsetDegrees * Math.PI) / 180
  const recoilLocalX = -recoilOffset * Math.cos(recoilOffsetRadians)
  const recoilLocalY = -recoilOffset * Math.sin(recoilOffsetRadians)
  
  // Don't change aspect ratio for barrel - barrel can extend beyond tile (this is OK)
  const barrelImg = tankImageCache.barrel
  const barrelScale = wagonScale // Use same scale as wagon to maintain original size relationships
  const barrelWidth = barrelImg.width * barrelScale
  const barrelHeight = barrelImg.height * barrelScale
  
  // Center the barrel on its mount point with recoil offset in local coordinates
  ctx.drawImage(
    barrelImg,
    barrelMountX - barrelWidth / 2 + recoilLocalX,
    barrelMountY - barrelHeight / 2 + recoilLocalY,
    barrelWidth,
    barrelHeight
  )

  // 7. Render muzzle flash if active
  if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
    const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
    const flashAlpha = 1 - flashProgress
    const flashSize = MUZZLE_FLASH_SIZE * (1 - flashProgress * 0.5)
    
    ctx.save()
    ctx.globalAlpha = flashAlpha
    
    // Position muzzle flash using configurable offset relative to barrel
    // The flash should also be affected by recoil (same local coordinate system)
    const flashX = barrelMountX + (tankImageConfig.muzzleFlashOffset.x - barrelImg.width / 2) * barrelScale + recoilLocalX
    const flashY = barrelMountY + (tankImageConfig.muzzleFlashOffset.y - barrelImg.height / 2) * barrelScale + recoilLocalY
    
    // Create radial gradient for muzzle flash
    const gradient = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, flashSize)
    gradient.addColorStop(0, '#FFF')
    gradient.addColorStop(0.3, '#FF0')
    gradient.addColorStop(1, 'rgba(255, 165, 0, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(flashX, flashY, flashSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore() // Restore turret transformation
  ctx.restore() // Restore main transformation

  return true // Successfully rendered with images
}

/**
 * Get tank image configuration for external access
 * @returns {Object} Tank image configuration object
 */
export function getTankImageConfig() {
  return tankImageConfig
}

/**
 * Get cache statistics for debugging
 * @returns {Object} Cache statistics
 */
export function getTankImageCacheStats() {
  return {
    loaded: tankImagesLoaded,
    loading: tankImagesLoading,
    images: {
      wagon: tankImageCache.wagon !== null,
      turret: tankImageCache.turret !== null,
      barrel: tankImageCache.barrel !== null
    }
  }
}

/**
 * Clear the tank image cache (for testing/memory management)
 */
export function clearTankImageCache() {
  tankImageCache.wagon = null
  tankImageCache.turret = null
  tankImageCache.barrel = null
  tankImagesLoaded = false
  tankImagesLoading = false
}

/**
 * Console debugging functions for recoil offset adjustment
 * Use these in browser console to find the correct recoil direction
 */

/**
 * Set recoil rotation offset in degrees
 * @param {number} degrees - Offset in degrees (0-360)
 */
export function setRecoilOffset(degrees) {
  runtimeRecoilOffsetDegrees = degrees
  console.log(`Recoil offset set to ${degrees} degrees`)
  console.log('Fire your tank to see the recoil direction')
}

/**
 * Get current recoil offset
 * @returns {number} Current offset in degrees
 */
export function getRecoilOffset() {
  console.log(`Current recoil offset: ${runtimeRecoilOffsetDegrees} degrees`)
  return runtimeRecoilOffsetDegrees
}

/**
 * Test different recoil offsets quickly
 * @param {number} startDegrees - Starting offset
 * @param {number} step - Step size in degrees
 */
export function testRecoilOffsets(startDegrees = 0, step = 45) {
  console.log('Testing recoil offsets:')
  for (let i = 0; i < 8; i++) {
    const degrees = (startDegrees + i * step) % 360
    console.log(`  ${i + 1}. setRecoilOffset(${degrees}) - ${degrees}°`)
  }
  console.log('Copy and paste any command above to test that offset')
}

// Expose functions to window for easy console access
if (typeof window !== 'undefined') {
  window.tankRecoilDebug = {
    setOffset: setRecoilOffset,
    getOffset: getRecoilOffset,
    test: testRecoilOffsets
  }
  
  console.log('🔫 Tank Recoil Debug Functions Available:')
  console.log('  tankRecoilDebug.setOffset(degrees) - Set recoil offset')
  console.log('  tankRecoilDebug.getOffset() - Get current offset')
  console.log('  tankRecoilDebug.test() - Show test values')
  console.log('Example: tankRecoilDebug.setOffset(180)')
}
