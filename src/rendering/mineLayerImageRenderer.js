// mineLayerImageRenderer.js - render mine layer trucks using a single image asset
import { TILE_SIZE } from '../config.js'

let mineLayerImg = null
let mineLayerLoaded = false
let mineLayerLoading = false

export function preloadMineLayerImage(callback) {
  if (mineLayerLoaded) {
    if (callback) callback(true)
    return
  }
  if (mineLayerLoading) return

  mineLayerLoading = true
  mineLayerImg = new Image()
  mineLayerImg.onload = () => {
    mineLayerLoaded = true
    mineLayerLoading = false
    if (callback) callback(true)
  }
  mineLayerImg.onerror = () => {
    console.error('Failed to load mine layer image')
    mineLayerLoaded = false
    mineLayerLoading = false
    if (callback) callback(false)
  }
  mineLayerImg.src = 'images/map/units/mine_layer_map.webp'
}

export function isMineLayerImageLoaded() {
  return mineLayerLoaded && mineLayerImg && mineLayerImg.complete
}

export function renderMineLayerWithImage(ctx, unit, centerX, centerY) {
  if (!isMineLayerImageLoaded()) return false

  ctx.save()
  ctx.translate(centerX, centerY)

  // Image faces upward by default. Rotate so unit.direction=0 faces right.
  const rotation = unit.direction + Math.PI / 2
  ctx.rotate(rotation)

  const scale = TILE_SIZE / Math.max(mineLayerImg.width, mineLayerImg.height)
  const width = mineLayerImg.width * scale
  const height = mineLayerImg.height * scale

  ctx.drawImage(mineLayerImg, -width / 2, -height / 2, width, height)

  ctx.restore()
  return true
}

export function getMineLayerBaseImage() {
  return isMineLayerImageLoaded() ? mineLayerImg : null
}
