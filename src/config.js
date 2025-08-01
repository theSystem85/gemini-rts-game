// Experience system multiplier (adjusts how quickly units gain XP)
export const XP_MULTIPLIER = 3
// config.js
export const TILE_SIZE = 32
export const MAP_TILES_X = 100
export const MAP_TILES_Y = 100
export const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
export const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE
// Approximate real world length of one tile in meters
export const TILE_LENGTH_METERS = 1000
export const SAFE_RANGE_ENABLED = false
export const CREW_KILL_CHANCE = 0.25 // 25% chance to kill a crew member on hit

// Toggle to allow selecting enemy units to view their HUD only
export let ENABLE_ENEMY_SELECTION = true

export function setEnemySelectionEnabled(value) {
  ENABLE_ENEMY_SELECTION = value
}

// Toggle to allow issuing commands to enemy units when selected
export let ENABLE_ENEMY_CONTROL = false

export function setEnemyControlEnabled(value) {
  ENABLE_ENEMY_CONTROL = value
}

// Sound configuration
export const MASTER_VOLUME = 0.25  // Default to 50% volume

// Targeting spread for tanks and turrets (in pixels, about 3/4 of a tile for more noticeable inaccuracy)
export const TARGETING_SPREAD = TILE_SIZE * 0.75

// HARVESTER_CAPPACITY is now 1 (so a harvester unloads as soon as it harvests one unit)
export const HARVESTER_CAPPACITY = 1

// Harvester unload time (in milliseconds)
export const HARVESTER_UNLOAD_TIME = 5000  // 5 seconds (2x faster than before)
// Capacity of tanker truck supply tank
export const TANKER_SUPPLY_CAPACITY = 40000

// Fallback colors for tiles when images aren't available
export const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700',
  seedCrystal: '#FF5555',
  building: 'transparent' // Buildings should be transparent so background shows through
}

// Image paths for tile types
export const TILE_IMAGES = {
  land: {
    // Use programmatic discovery for grass tiles
    useGrassTileDiscovery: true
  },
  water: {
    animated: true
  },
  rock: {
    paths: ['images/map/rock_on_grass01', 'images/map/rock01', 'images/map/rock02', 'images/map/rock03', 'images/map/rock04', 'images/map/rock05']
  },
  street: {
    paths: ['images/map/street01']
  },
  ore: {
    paths: ['images/map/ore01', 'images/map/ore02', 'images/map/ore03', 'images/map/ore04']
  },
  seedCrystal: {
    paths: ['images/map/ore1_red']
  }
}

// Sprite sheet and mapping for map tiles
export const TILE_SPRITE_SHEET = 'images/map/map_sprites.webp'
export const TILE_SPRITE_MAP = 'images/map/map_sprites.json'

// Enable/disable texture usage (for performance testing/fallback)
export const USE_TEXTURES = true

// Enable/disable tank image-based rendering (T key to toggle during gameplay)
export const USE_TANK_IMAGES = true

// Grass tile ratio configuration (higher numbers = rarer)
// 1 out of X tiles will be decorative/impassable
export const GRASS_DECORATIVE_RATIO = 33  // 1 in x tiles will be decorative
export const GRASS_IMPASSABLE_RATIO = 50  // 1 in x tiles will be impassable

export const INERTIA_DECAY = 0.983  // Increased from 0.95 to make inertia 3x longer
// Scroll speed when using arrow keys (pixels per frame)
export const KEYBOARD_SCROLL_SPEED = 8

// Increase tank range by 50% (for example, from 6 to 9 tiles)
export const TANK_FIRE_RANGE = 9

// Tank constants
export const DEFAULT_ROTATION_SPEED = 0.05 // Radians per frame
export const FAST_ROTATION_SPEED = 0.1 // Radians per frame
export const TANK_BULLET_SPEED = 8 // Radians per frame

// Hit zone damage multipliers for tanks
export const HIT_ZONE_DAMAGE_MULTIPLIERS = {
  FRONT: 1.0,   // Normal damage from front
  SIDE: 1.25,    // 30% more damage from sides
  REAR: 1.5     // 100% more damage from behind (critical hit)
}

// Critical damage sound cooldown (30 seconds)
export const CRITICAL_DAMAGE_SOUND_COOLDOWN = 30000

// Separate rotation rates for tank components
export const TANK_WAGON_ROT = 0.05 // Radians per frame for tank body/wagon movement
// Reduced turret rotation speed to make artillery tracking more deliberate
// 70% slower than before (was 0.08)
export const TANK_TURRET_ROT = 0.024 // Radians per frame for turret aiming

// Aiming precision threshold (in radians) - turret must be within this angle to fire
export const TURRET_AIMING_THRESHOLD = 0.1 // About 5.7 degrees

// Recoil and muzzle flash animation constants
export const RECOIL_DISTANCE = 8 // pixels to move back during recoil
export const RECOIL_DURATION = 300 // milliseconds
export const MUZZLE_FLASH_DURATION = 150 // milliseconds
export const MUZZLE_FLASH_SIZE = 12 // radius of muzzle flash
export const TURRET_RECOIL_DISTANCE = 6 // pixels for building turrets
export const SMOKE_PARTICLE_LIFETIME = 4500 // milliseconds (increased for longer-lasting building smoke)
export const SMOKE_EMIT_INTERVAL = 120 // milliseconds between puffs (slightly less frequent)
export const SMOKE_PARTICLE_SIZE = 8 // radius of smoke particles (reduced from 12)

// Duration of the building sell animation (in milliseconds)
export const BUILDING_SELL_DURATION = 3000

// Wind effects for smoke particles
export const WIND_DIRECTION = { x: 0.3, y: -0.1 } // Slight eastward and upward wind
export const WIND_STRENGTH = 0.008 // How much wind affects particle movement

export const ORE_SPREAD_INTERVAL = 30000  // 30 seconds (3x faster than before)
export const ORE_SPREAD_PROBABILITY = 0.06
// Toggle ore spreading to improve performance when disabled
export let ORE_SPREAD_ENABLED = true

export function setOreSpreadEnabled(value) {
  ORE_SPREAD_ENABLED = value
}

// New: Path recalculation interval (in milliseconds)
export const PATH_CALC_INTERVAL = 2000

// Attack/chase pathfinding interval - throttled to prevent excessive recalculation (in milliseconds)
export const ATTACK_PATH_CALC_INTERVAL = 3000

// General AI decision interval for heavy logic like target selection (in milliseconds)
export const AI_DECISION_INTERVAL = 5000  // Reduced from 200ms to 5s to prevent wiggling

// Smoke emission for buildings
export const BUILDING_SMOKE_EMIT_INTERVAL = 1000 // ms between puffs

// Distance threshold for using occupancy map in pathfinding (in tiles)
export const PATHFINDING_THRESHOLD = 10

// How close a unit needs to be (in tiles) to consider a move target reached
export const MOVE_TARGET_REACHED_THRESHOLD = 1.5

// Unit stuck detection and productivity check intervals (in milliseconds)
export const STUCK_CHECK_INTERVAL = 500  // Check every 0.5 seconds for stuck units
export const HARVESTER_PRODUCTIVITY_CHECK_INTERVAL = 500  // Check harvester productivity every 0.5 seconds
export const STUCK_THRESHOLD = 500  // Consider units stuck after 0.5 seconds
export const STUCK_HANDLING_COOLDOWN = 1250  // Cooldown between stuck handling attempts
export const DODGE_ATTEMPT_COOLDOWN = 500  // Cooldown between dodge attempts

// Street movement and pathfinding modifiers
export const STREET_SPEED_MULTIPLIER = 1.5  // Units move 50% faster on streets
export const STREET_PATH_COST = 1 / STREET_SPEED_MULTIPLIER  // Prefer streets in pathfinding

// Unit costs
export const UNIT_COSTS = {
  tank: 1000,
  rocketTank: 2000,
  harvester: 1500,
  'tank-v2': 2000,
  'tank-v3': 3000,
  ambulance: 500,
  tankerTruck: 300,
  recoveryTank: 3000
}

// Unit properties
export const UNIT_PROPERTIES = {
  // Base properties
  base: {
    health: 100,
    maxHealth: 100,
    speed: 0.25,  // 50% slower: 0.5 * 0.5 = 0.25
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: TANK_TURRET_ROT
  },
  // Harvester properties
  harvester: {
    health: 150,
    maxHealth: 150,
    speed: 0.4,  // 50% slower: 0.8 * 0.5 = 0.4
    rotationSpeed: 0.2,
    armor: 3
  },
  // Tank properties
  tank_v1: {
    health: 100,
    maxHealth: 100,
    speed: 0.33,  // 50% slower: 0.66 * 0.5 = 0.33
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: TANK_TURRET_ROT
  },
  // Tank V2 properties
  'tank-v2': {
    health: 150,
    maxHealth: 150,
    speed: 0.3,  // 50% slower: 0.6 * 0.5 = 0.3
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: TANK_TURRET_ROT,
    alertMode: true
  },
  // Tank V3 properties
  'tank-v3': {
    health: 200,
    maxHealth: 200,
    speed: 0.25,  // 50% slower: 0.5 * 0.5 = 0.25
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: TANK_TURRET_ROT * 1.5, // 50% faster turret rotation for better tracking
    alertMode: true
  },
  // Rocket tank properties
  rocketTank: {
    health: 100,
    maxHealth: 100,
    speed: 0.35,  // 50% slower: 0.7 * 0.5 = 0.35
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: TANK_TURRET_ROT
  },
  recoveryTank: {
    health: 150,
    maxHealth: 150,
    speed: 0.525, // 50% faster than rocket tank when unloaded
    loadedSpeed: 0.33, // Same as tank speed when towing
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: TANK_TURRET_ROT,
    armor: 3
  },
  ambulance: {
    health: 25,
    maxHealth: 25,
    speed: 0.5, // Base speed (1.5x tank v1 on grass: 0.33 * 1.5 = 0.495)
    streetSpeedMultiplier: 4.0,
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: 0,
    maxMedics: 10,
    medics: 10 // Initial crew capacity
  },
  tankerTruck: {
    health: 20,
    maxHealth: 20,
    speed: 0.66,
    rotationSpeed: TANK_WAGON_ROT,
    turretRotationSpeed: 0
  }
}

// Tank V3 burst fire configuration
export const TANK_V3_BURST = {
  COUNT: 2,     // Number of bullets per burst
  DELAY: 300    // Delay between bullets in milliseconds
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
  rocketTank: 120
}

// Attack Group Feature (AGF) constants
export const ATTACK_TARGET_INDICATOR_SIZE = 8 // Size of the red triangle indicator above targeted units
export const ATTACK_TARGET_BOUNCE_SPEED = 0.003 // Speed of bouncing animation for target indicators

// Movement target indicator constants
export const MOVE_TARGET_INDICATOR_SIZE = 8 // Size of the green triangle indicator for movement targets
export const MOVE_TARGET_BOUNCE_SPEED = 0.003 // Speed of bouncing animation for movement target indicators

// Unit type colors (same for all players/enemies of same type)
export const UNIT_TYPE_COLORS = {
  tank: '#0000FF',        // Blue
  tank_v1: '#0000FF',     // Blue
  'tank-v2': '#FFFFFF',   // White
  'tank-v3': '#32CD32',   // Lime green
  harvester: '#9400D3',   // Purple
  rocketTank: '#800000',
  ambulance: '#00FFFF',   // Dark red
  tankerTruck: '#FFA500',
  recoveryTank: '#FFD700' // Gold
}

// Party/owner colors for indicators (4 distinct colors for multiplayer)
export const PARTY_COLORS = {
  player1: '#00FF00',     // Green (Human player by default)
  player2: '#FF0000',     // Red
  player3: '#0080FF',     // Blue
  player4: '#FFFF00',     // Yellow
  // Legacy aliases for backwards compatibility
  player: '#00FF00',      // Green
  enemy: '#FF0000'        // Red
}

// Player position constants for 4-corner setup
export const PLAYER_POSITIONS = {
  player1: { x: 0.1, y: 0.9 },   // Bottom-left (current player position)
  player2: { x: 0.9, y: 0.1 },   // Top-right (current enemy position)
  player3: { x: 0.1, y: 0.1 },   // Top-left
  player4: { x: 0.9, y: 0.9 }    // Bottom-right
}

// Default number of players
export const DEFAULT_PLAYER_COUNT = 2

// Gas system configuration
export const GAS_REFILL_TIME = 7000 // ms to fully refill at station
export const GAS_REFILL_COST = 50

export const UNIT_GAS_PROPERTIES = {
  tank_v1: { tankSize: 1900, consumption: 450 },
  'tank-v2': { tankSize: 1900, consumption: 450 },
  'tank-v3': { tankSize: 1900, consumption: 450 },
  rocketTank: { tankSize: 1900, consumption: 450 },
  // Recovery tanks consume the same fuel as standard tanks
  recoveryTank: { tankSize: 1900, consumption: 450 },
  harvester: { tankSize: 2650, consumption: 30, harvestConsumption: 100 },
  ambulance: { tankSize: 75, consumption: 25 },
  tankerTruck: { tankSize: 700, consumption: 150 }
}
