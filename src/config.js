// config.js
export const TILE_SIZE = 32
export const MAP_TILES_X = 100
export const MAP_TILES_Y = 100
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE
export const SAFE_RANGE_ENABLED = false

// HARVESTER_CAPPACITY is now 1 (so a harvester unloads as soon as it harvests one unit)
export const HARVESTER_CAPPACITY = 1

// Fallback colors for tiles when images aren't available
export const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700'
}

// Image paths for tile types, with variations to select from randomly and rotation setting
export const TILE_IMAGES = {
  land: {
    paths: ['images/map/grass01'],
    rotate: true // Land can be rotated for variety
  },
  water: {
    paths: ['images/map/water01'],
    rotate: true // Water can be rotated for variety
  },
  rock: {
    paths: ['images/map/rock_on_grass01', 'images/map/rock01', 'images/map/rock02', 'images/map/rock03', 'images/map/rock04', 'images/map/rock05'],
    rotate: false // Rocks should not be rotated to maintain their natural shape
  },
  street: {
    paths: ['images/map/street01'],
    rotate: false // Streets shouldn't be rotated as they have directional features
  },
  ore: {
    paths: ['images/map/ore01', 'images/map/ore02', 'images/map/ore03', 'images/map/ore04'],
    rotate: false // Ore should not be rotated
  }
}

// Enable/disable texture usage (for performance testing/fallback)
export const USE_TEXTURES = true

// Number of texture variations to generate for each tile type
export const TEXTURE_VARIATIONS = 4

export const INERTIA_DECAY = 0.983  // Increased from 0.95 to make inertia 3x longer

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

// Aim-Ahead Function (AAF) calibration factor
// Adjust this value in the browser console using:
// window.gameState.aimAheadCalibrationFactor = newValue;
export const AIM_AHEAD_CALIBRATION_FACTOR = 1.0
