import { TILE_SIZE } from './config.js'

// Convert tile coordinates to pixel coordinates
export function tileToPixel(tileX, tileY) {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }
}

// Simple unique ID generator
export function getUniqueId() {
  return Date.now() + Math.random()
}
