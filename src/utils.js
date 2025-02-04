// utils.js
import { TILE_SIZE } from './config.js';

// Convert tile coordinates to pixel coordinates.
export function tileToPixel(tileX, tileY) {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE };
}

// Generate a unique ID for each unit.
export function getUniqueId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 5);
}
