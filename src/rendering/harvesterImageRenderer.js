// harvesterImageRenderer.js - Renders harvesters using a single image asset
import { TILE_SIZE } from '../config.js'

let harvesterImg = null
let harvesterLoaded = false
let harvesterLoading = false

export function preloadHarvesterImage(callback) {
  if (harvesterLoaded) {
    if (callback) callback(true)
    return
  }

  if (harvesterLoading) {
    return
  }

  harvesterLoading = true
  harvesterImg = new Image()
  harvesterImg.onload = () => {
    harvesterLoaded = true
    harvesterLoading = false
    if (callback) callback(true)
  }
  harvesterImg.onerror = () => {
    console.error('Failed to load harvester image')
    harvesterLoaded = false
    harvesterLoading = false
    if (callback) callback(false)
  }
  harvesterImg.src = 'images/map/units/harvester.webp'
}

export function isHarvesterImageLoaded() {
  return harvesterLoaded && harvesterImg && harvesterImg.complete
}

export function renderHarvesterWithImage(ctx, unit, centerX, centerY) {
  if (!isHarvesterImageLoaded()) {
    return false
  }

  ctx.save()
  ctx.translate(centerX, centerY)

  // Image faces down by default; rotate so unit.direction=0 faces right
  const rotation = unit.direction - Math.PI / 2
  ctx.rotate(rotation)

  const scale = TILE_SIZE / Math.max(harvesterImg.width, harvesterImg.height)
  const width = harvesterImg.width * scale
  const height = harvesterImg.height * scale

  ctx.drawImage(harvesterImg, -width / 2, -height / 2, width, height)

  // Draw sparks when harvesting
  if (unit.harvesting) {
    renderHarvestingSparks(ctx, width, height)
  }

  ctx.restore()
  return true
}

function renderHarvestingSparks(ctx, width, height) {
  const now = performance.now()
  const startX = (14 - harvesterImg.width / 2) * (width / harvesterImg.width)
  const endX = (50 - harvesterImg.width / 2) * (width / harvesterImg.width)
  const y = (58 - harvesterImg.height / 2) * (height / harvesterImg.height)
  const sparkCount = 4
  ctx.fillStyle = '#FFD700'
  for (let i = 0; i < sparkCount; i++) {
    const t = ((now / 100) + i / sparkCount) % 1
    const x = startX + (endX - startX) * t
    ctx.fillRect(x - 1, y - 1, 2, 2)
  }
}
