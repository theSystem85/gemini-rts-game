// recoveryTankImageRenderer.js - render recovery tanks using a single image asset
import { TILE_SIZE } from '../config.js'

let recoveryImg = null
let recoveryLoaded = false
let recoveryLoading = false

export function preloadRecoveryTankImage(callback) {
  if (recoveryLoaded) {
    if (callback) callback(true)
    return
  }
  if (recoveryLoading) return
  recoveryLoading = true
  recoveryImg = new Image()
  recoveryImg.onload = () => {
    recoveryLoaded = true
    recoveryLoading = false
    if (callback) callback(true)
  }
  recoveryImg.onerror = () => {
    console.error('Failed to load recovery tank image')
    recoveryLoaded = false
    recoveryLoading = false
    if (callback) callback(false)
  }
  recoveryImg.src = 'images/map/units/recovery_tank.webp'
}

export function isRecoveryTankImageLoaded() {
  return recoveryLoaded && recoveryImg && recoveryImg.complete
}

export function renderRecoveryTankWithImage(ctx, unit, centerX, centerY) {
  if (!isRecoveryTankImageLoaded()) return false
  ctx.save()
  ctx.translate(centerX, centerY)
  const rotation = unit.direction - Math.PI / 2
  ctx.rotate(rotation)
  const scale = TILE_SIZE / Math.max(recoveryImg.width, recoveryImg.height)
  const width = recoveryImg.width * scale
  const height = recoveryImg.height * scale
  ctx.drawImage(recoveryImg, -width / 2, -height / 2, width, height)
  ctx.restore()
  return true
}
