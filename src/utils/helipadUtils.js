import { TILE_SIZE } from '../config.js'

export const HELIPAD_LANDING_CENTER_OFFSET = Object.freeze({ x: 25, y: 44 })

export function getHelipadLandingCenter(helipad) {
  if (!helipad || typeof helipad.x !== 'number' || typeof helipad.y !== 'number') {
    return null
  }
  const originX = helipad.x * TILE_SIZE
  const originY = helipad.y * TILE_SIZE
  return {
    x: originX + HELIPAD_LANDING_CENTER_OFFSET.x,
    y: originY + HELIPAD_LANDING_CENTER_OFFSET.y
  }
}

export function getHelipadLandingTile(helipad) {
  const center = getHelipadLandingCenter(helipad)
  if (!center) {
    return null
  }
  return {
    x: Math.floor(center.x / TILE_SIZE),
    y: Math.floor(center.y / TILE_SIZE)
  }
}

export function getHelipadLandingTopLeft(helipad) {
  const center = getHelipadLandingCenter(helipad)
  if (!center) {
    return null
  }
  return {
    x: center.x - TILE_SIZE / 2,
    y: center.y - TILE_SIZE / 2
  }
}
