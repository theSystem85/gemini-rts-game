// config.js
export const TILE_SIZE = 32
export const MAP_TILES_X = 100
export const MAP_TILES_Y = 100
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE
export const SAFE_RANGE_ENABLED = false

// Targeting spread for tanks and turrets (in pixels, about 3/4 of a tile for more noticeable inaccuracy)
export const TARGETING_SPREAD = TILE_SIZE * 0.75

// HARVESTER_CAPPACITY is now 1 (so a harvester unloads as soon as it harvests one unit)
export const HARVESTER_CAPPACITY = 1

// Harvester unload time (in milliseconds)
export const HARVESTER_UNLOAD_TIME = 5000  // 5 seconds (2x faster than before)

// Fallback colors for tiles when images aren't available
export const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700',
  building: 'transparent' // Buildings should be transparent so background shows through
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

// Tank constants
export const DEFAULT_ROTATION_SPEED = 0.05 // Radians per frame
export const FAST_ROTATION_SPEED = 0.1 // Radians per frame
export const TANK_BULLET_SPEED = 8 // Radians per frame

// Recoil and muzzle flash animation constants
export const RECOIL_DISTANCE = 8 // pixels to move back during recoil
export const RECOIL_DURATION = 300 // milliseconds
export const MUZZLE_FLASH_DURATION = 150 // milliseconds
export const MUZZLE_FLASH_SIZE = 12 // radius of muzzle flash
export const TURRET_RECOIL_DISTANCE = 6 // pixels for building turrets

export const ORE_SPREAD_INTERVAL = 30000  // 30 seconds (3x faster than before)
export const ORE_SPREAD_PROBABILITY = 0.06

// New: Path recalculation interval (in milliseconds)
export const PATH_CALC_INTERVAL = 2000

// Distance threshold for using occupancy map in pathfinding (in tiles)
export const PATHFINDING_THRESHOLD = 10

// Unit costs
export const UNIT_COSTS = {
  tank: 1000,
  rocketTank: 2000,
  harvester: 500,
  'tank-v2': 2000
}

// Unit properties
export const UNIT_PROPERTIES = {
  // Base properties
  base: {
    health: 100,
    maxHealth: 100,
    speed: 0.5,
    rotationSpeed: 0.1
  },
  // Harvester properties
  harvester: {
    health: 150,
    maxHealth: 150,
    speed: 0.8,
    rotationSpeed: 0.2,
    armor: 3
  },
  // Tank properties
  tank_v1: {
    health: 100,
    maxHealth: 100,
    speed: 0.66,
    rotationSpeed: 0.15
  },
  // Tank V2 properties
  'tank-v2': {
    health: 130,
    maxHealth: 130,
    speed: 0.66,
    rotationSpeed: 0.15,
    alertMode: true
  },
  // Tank V3 properties
  'tank-v3': {
    health: 169,
    maxHealth: 169,
    speed: 0.66,
    rotationSpeed: 0.15,
    alertMode: true
  },
  // Rocket tank properties
  rocketTank: {
    health: 100,
    maxHealth: 100,
    speed: 0.7,
    rotationSpeed: 0.12
  }
}

// Pathfinding constants
export const PATHFINDING_LIMIT = 1000

// Movement directions for pathfinding and position search
export const DIRECTIONS = [
  { x: 0, y: -1 },  // north
  { x: 1, y: 0 },   // east
  { x: 0, y: 1 },   // south
  { x: -1, y: 0 },  // west
  { x: 1, y: -1 },  // northeast
  { x: 1, y: 1 },   // southeast
  { x: -1, y: 1 },  // southwest
  { x: -1, y: -1 }  // northwest
]

// Maximum search distance for spawn positions
export const MAX_SPAWN_SEARCH_DISTANCE = 10

export const BULLET_DAMAGES = {
  tank_v1: 20,
  tank_v2: 24,
  tank_v3: 30,
  rocketTank: 60
}

// Attack Group Feature (AGF) constants
export const ATTACK_GROUP_MIN_DRAG_DISTANCE = 10 // Minimum pixels to drag before attack group mode activates
export const ATTACK_TARGET_INDICATOR_SIZE = 8 // Size of the red triangle indicator above targeted units
export const ATTACK_TARGET_BOUNCE_SPEED = 0.003 // Speed of bouncing animation for target indicators
