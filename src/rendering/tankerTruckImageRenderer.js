// tankerTruckImageRenderer.js - render tanker trucks using a single image asset
import { TILE_SIZE } from '../config.js'

let tankerImg = null
let tankerLoaded = false
let tankerLoading = false

export function preloadTankerTruckImage(callback) {
  if (tankerLoaded) { if (callback) callback(true); return }
  if (tankerLoading) return
  tankerLoading = true
  tankerImg = new Image()
  tankerImg.onload = () => { tankerLoaded = true; tankerLoading = false; if (callback) callback(true) }
  tankerImg.onerror = () => { console.error('Failed to load tanker truck image'); tankerLoaded = false; tankerLoading = false; if (callback) callback(false) }
  tankerImg.src = 'images/map/units/tanker_truck.webp'
}

export function isTankerTruckImageLoaded() {
  return tankerLoaded && tankerImg && tankerImg.complete
}

export function renderTankerTruckWithImage(ctx, unit, centerX, centerY) {
  if (!isTankerTruckImageLoaded()) return false
  ctx.save()
  ctx.translate(centerX, centerY)
  const rotation = unit.direction - Math.PI / 2
  ctx.rotate(rotation)
  const scale = TILE_SIZE / Math.max(tankerImg.width, tankerImg.height)
  const width = tankerImg.width * scale
  const height = tankerImg.height * scale
  ctx.drawImage(tankerImg, -width / 2, -height / 2, width, height)
  ctx.restore()
  return true
}
