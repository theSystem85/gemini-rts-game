// config.js
export const TILE_SIZE = 32
export const MAP_TILES_X = 100
export const MAP_TILES_Y = 100
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE
export const SAFE_RANGE_ENABLED = false

// HARVESTER_CAPPACITY is now 1 (so a harvester unloads as soon as it harvests one unit)
export const HARVESTER_CAPPACITY = 1

export const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700'
}

export const INERTIA_DECAY = 0.95

// Increase tank range by 50% (for example, from 6 to 9 tiles)
export const TANK_FIRE_RANGE = 9

// Tank rotation constants
export const DEFAULT_ROTATION_SPEED = 0.05 // Radians per frame
export const FAST_ROTATION_SPEED = 0.1 // Radians per frame

export const ORE_SPREAD_INTERVAL = 90000
export const ORE_SPREAD_PROBABILITY = 0.06

// New: Path recalculation interval (in milliseconds)
export const PATH_CALC_INTERVAL = 2000

// Distance threshold for using occupancy map in pathfinding (in tiles)
export const PATHFINDING_THRESHOLD = 10
