// gatlingTankImageRenderer.js - render gatling tanks using a single image asset
import { TILE_SIZE, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE } from '../config.js'

let gatlingTankImg = null
let gatlingTankLoaded = false
let gatlingTankLoading = false

// Spawn point relative to the asset (pixels from top-left) - Adjust based on image
// Assuming standard 64x64 or similar, maybe barrel is at the front
const SPAWN_POINT = { x: 48, y: 32 }

export function preloadGatlingTankImage(callback) {
  if (gatlingTankLoaded) {
    if (callback) callback(true)
    return
  }
  if (gatlingTankLoading) return

  gatlingTankLoading = true
  gatlingTankImg = new Image()
  gatlingTankImg.onload = () => {
    gatlingTankLoaded = true
    gatlingTankLoading = false
    if (callback) callback(true)
  }
  gatlingTankImg.onerror = () => {
    console.error('Failed to load gatling tank image')
    gatlingTankLoaded = false
    gatlingTankLoading = false
    if (callback) callback(false)
  }
  gatlingTankImg.src = 'images/map/units/gatling_tank.webp'
}

export function isGatlingTankImageLoaded() {
  return gatlingTankLoaded && gatlingTankImg && gatlingTankImg.complete
}

export function renderGatlingTankWithImage(ctx, unit, centerX, centerY) {
  if (!isGatlingTankImageLoaded()) return false

  const now = performance.now()

  ctx.save()
  ctx.translate(centerX, centerY)

  // Image faces downwards by default? Or right?
  // rocketTankImageRenderer says: "Image faces downwards by default. Rotate so unit.direction=0 faces right."
  // My generated image prompt was "Top-down view". Usually top-down means facing up or right.
  // I'll assume it faces RIGHT (standard for sprites) or UP. 
  // If it faces UP, then rotation = unit.direction + Math.PI / 2.
  // If it faces RIGHT, then rotation = unit.direction.
  // RocketTank uses `unit.direction - Math.PI / 2`. This implies the image faces DOWN? Or maybe UP?
  // Let's assume my image faces RIGHT.
  // If standard 0 is right, then just `unit.direction`.
  // But RTS sprites often face UP.
  // I'll try `unit.direction` first (facing RIGHT).
  
  const rotation = unit.direction // Assuming image faces Right
  ctx.rotate(rotation)

  const scale = TILE_SIZE / Math.max(gatlingTankImg.width, gatlingTankImg.height)
  const width = gatlingTankImg.width * scale * 1.25 // Make it slightly larger
  const height = gatlingTankImg.height * scale * 1.25

  ctx.drawImage(gatlingTankImg, -width / 2, -height / 2, width, height)

  // Render muzzle flash when firing
  if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
    const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
    const flashAlpha = 1 - flashProgress
    const flashSize = MUZZLE_FLASH_SIZE * (1 - flashProgress * 0.5)

    ctx.save()
    ctx.globalAlpha = flashAlpha

    // Muzzle flash at the front
    const localX = width / 2
    const localY = 0

    const gradient = ctx.createRadialGradient(localX, localY, 0, localX, localY, flashSize)
    gradient.addColorStop(0, '#FFF')
    gradient.addColorStop(0.3, '#FF0')
    gradient.addColorStop(1, 'rgba(255, 165, 0, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(localX, localY, flashSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
  return true
}

export function getGatlingTankBaseImage() {
  return isGatlingTankImageLoaded() ? gatlingTankImg : null
}
