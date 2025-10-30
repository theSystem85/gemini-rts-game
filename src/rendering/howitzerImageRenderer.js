// howitzerImageRenderer.js - render howitzers using a single image asset
import { TILE_SIZE, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE } from '../config.js'

let howitzerImg = null
let howitzerLoaded = false
let howitzerLoading = false

// Approximate muzzle flash location relative to the texture (pixels from top-left)
const MUZZLE_POINT = { x: 46, y: 14 }

export function preloadHowitzerImage(callback) {
  if (howitzerLoaded) {
    if (callback) callback(true)
    return
  }

  if (howitzerLoading) return

  howitzerLoading = true
  howitzerImg = new Image()
  howitzerImg.onload = () => {
    howitzerLoaded = true
    howitzerLoading = false
    if (callback) callback(true)
  }
  howitzerImg.onerror = () => {
    console.error('Failed to load howitzer image')
    howitzerLoaded = false
    howitzerLoading = false
    if (callback) callback(false)
  }
  howitzerImg.src = 'images/map/units/howitzer_map.webp'
}

export function isHowitzerImageLoaded() {
  return howitzerLoaded && howitzerImg && howitzerImg.complete
}

export function renderHowitzerWithImage(ctx, unit, centerX, centerY) {
  if (!isHowitzerImageLoaded()) return false

  const now = performance.now()

  ctx.save()
  ctx.translate(centerX, centerY)

  // Image faces downward by default. Rotate so direction=0 points right.
  const rotation = unit.direction - Math.PI / 2
  ctx.rotate(rotation)

  const scale = TILE_SIZE / Math.max(howitzerImg.width, howitzerImg.height)
  const width = howitzerImg.width * scale
  const height = howitzerImg.height * scale

  ctx.drawImage(howitzerImg, -width / 2, -height / 2, width, height)

  if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
    const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
    const flashAlpha = 1 - flashProgress
    const flashSize = MUZZLE_FLASH_SIZE * (1 - flashProgress * 0.5)

    ctx.save()
    ctx.globalAlpha = flashAlpha

    const localX = (MUZZLE_POINT.x - howitzerImg.width / 2) * scale
    const localY = (MUZZLE_POINT.y - howitzerImg.height / 2) * scale

    const gradient = ctx.createRadialGradient(localX, localY, 0, localX, localY, flashSize)
    gradient.addColorStop(0, '#FFF')
    gradient.addColorStop(0.3, '#FF0')
    gradient.addColorStop(1, 'rgba(255, 140, 0, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(localX, localY, flashSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
  return true
}

export function getHowitzerBaseImage() {
  return isHowitzerImageLoaded() ? howitzerImg : null
}
