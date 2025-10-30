const configRegistry = new Map()
const activeOverrides = new Map()

export const CONFIG_OVERRIDE_FILENAME = 'config-overrides.json'

const CONFIG_OVERRIDE_STORAGE_KEY = 'rts-config-overrides'
const EXTERNAL_OVERRIDE_PATH = `/${CONFIG_OVERRIDE_FILENAME}`

let overridesLoaded = false
let overridesLoadPromise = null

function registerConfigVariable(name) {
  const defaultValue = eval(name)
  configRegistry.set(name, {
    name,
    get value() {
      return eval(name)
    },
    type: typeof defaultValue,
    defaultValue
  })
}

function getConfigEntry(name) {
  const entry = configRegistry.get(name)
  if (!entry) {
    throw new Error(`Unknown config value: ${name}`)
  }
  return entry
}

function assertNumericEntry(entry) {
  if (entry.type !== 'number') {
    throw new Error(`Config value ${entry.name} is not numeric and cannot be updated`)
  }
}

function serializeForEval(value) {
  if (typeof value === 'number') {
    if (Object.is(value, -0)) {
      return '-0'
    }
    return String(value)
  }
  return JSON.stringify(value)
}

function assignConfigValue(name, value) {
  const serialized = serializeForEval(value)
  eval(`${name} = ${serialized}`)
}

function setNumericConfigValue(entry, numericValue, { persistLocal = false } = {}) {
  assertNumericEntry(entry)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Value for ${entry.name} must be a finite number`)
  }

  assignConfigValue(entry.name, numericValue)

  const updatedValue = entry.value
  if (Object.is(updatedValue, entry.defaultValue)) {
    activeOverrides.delete(entry.name)
  } else {
    activeOverrides.set(entry.name, updatedValue)
  }

  if (persistLocal) {
    saveOverridesToLocalStorage()
  }

  return updatedValue
}

export function listConfigVariables() {
  return Array.from(configRegistry.values()).map((entry) => ({
    name: entry.name,
    type: entry.type,
    value: entry.value,
    defaultValue: entry.defaultValue,
    editable: entry.type === 'number',
    overridden: entry.type === 'number' && activeOverrides.has(entry.name)
  }))
}

export function getConfigValue(name) {
  return getConfigEntry(name).value
}

export function updateConfigValue(name, rawValue) {
  const entry = getConfigEntry(name)
  const numericValue = Number(rawValue)
  return setNumericConfigValue(entry, numericValue, { persistLocal: true })
}

export function isConfigValueOverridden(name) {
  const entry = getConfigEntry(name)
  return entry.type === 'number' && activeOverrides.has(entry.name)
}

export function getConfigOverrides() {
  const overrides = {}
  activeOverrides.forEach((value, key) => {
    const entry = configRegistry.get(key)
    if (!entry || entry.type !== 'number') {
      activeOverrides.delete(key)
      return
    }

    const currentValue = entry.value
    if (Object.is(currentValue, entry.defaultValue)) {
      activeOverrides.delete(key)
      return
    }

    overrides[key] = currentValue

    if (!Object.is(currentValue, value)) {
      activeOverrides.set(key, currentValue)
    }
  })
  return overrides
}

export async function ensureConfigOverridesLoaded() {
  if (overridesLoaded) {
    return
  }

  if (!overridesLoadPromise) {
    overridesLoadPromise = (async () => {
      await loadOverridesFromFile()
      loadOverridesFromLocalStorage()
      overridesLoaded = true
    })()
  }

  return overridesLoadPromise
}

function applyOverridesFromObject(overrides, { persistLocal = false } = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return
  }

  Object.entries(overrides).forEach(([name, value]) => {
    if (!configRegistry.has(name)) {
      console.warn(`Ignoring unknown config override: ${name}`)
      return
    }

    const entry = configRegistry.get(name)
    if (entry.type !== 'number') {
      console.warn(`Ignoring override for non-numeric config value: ${name}`)
      return
    }

    const numericValue = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numericValue)) {
      console.warn(`Ignoring non-finite override for ${name}`)
      return
    }

    setNumericConfigValue(entry, numericValue, { persistLocal })
  })
}

function saveOverridesToLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    if (activeOverrides.size === 0) {
      window.localStorage.removeItem(CONFIG_OVERRIDE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      CONFIG_OVERRIDE_STORAGE_KEY,
      JSON.stringify(getConfigOverrides())
    )
  } catch (err) {
    console.warn('Failed to persist config overrides to localStorage:', err)
  }
}

function loadOverridesFromLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  let raw
  try {
    raw = window.localStorage.getItem(CONFIG_OVERRIDE_STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to read config overrides from localStorage:', err)
    return
  }

  if (!raw) {
    return
  }

  try {
    const parsed = JSON.parse(raw)
    applyOverridesFromObject(parsed)
  } catch (err) {
    console.warn('Failed to parse config overrides from localStorage:', err)
  }
}

async function loadOverridesFromFile() {
  if (typeof fetch !== 'function') {
    return
  }

  try {
    const response = await fetch(EXTERNAL_OVERRIDE_PATH, { cache: 'no-store' })
    if (!response.ok) {
      return
    }

    const data = await response.json()
    applyOverridesFromObject(data)
  } catch (err) {
    console.warn('Failed to load config overrides file:', err)
  }
}

// Experience system multiplier (adjusts how quickly units gain XP)
export let XP_MULTIPLIER = 3

export function setXpMultiplier(value) {
  XP_MULTIPLIER = value
}

// config.js
export let TILE_SIZE = 32
export let MIN_MAP_TILES = 32
export let DEFAULT_MAP_TILES_X = 100
export let DEFAULT_MAP_TILES_Y = 100
export let MAP_TILES_X = DEFAULT_MAP_TILES_X
export let MAP_TILES_Y = DEFAULT_MAP_TILES_Y

export function setMapDimensions(widthTiles, heightTiles) {
  const normalizedWidth = Number.isFinite(widthTiles) ? Math.floor(widthTiles) : DEFAULT_MAP_TILES_X
  const normalizedHeight = Number.isFinite(heightTiles) ? Math.floor(heightTiles) : DEFAULT_MAP_TILES_Y

  MAP_TILES_X = Math.max(MIN_MAP_TILES, normalizedWidth)
  MAP_TILES_Y = Math.max(MIN_MAP_TILES, normalizedHeight)

  return { width: MAP_TILES_X, height: MAP_TILES_Y }
}

export function getMapDimensions() {
  return { width: MAP_TILES_X, height: MAP_TILES_Y }
}

export function getMapWidth() {
  return MAP_TILES_X * TILE_SIZE
}

export function getMapHeight() {
  return MAP_TILES_Y * TILE_SIZE
}
// Approximate real world length of one tile in meters
export let TILE_LENGTH_METERS = 1000
export let SAFE_RANGE_ENABLED = false
export let CREW_KILL_CHANCE = 0.25 // 25% chance to kill a crew member on hit

export function setCrewKillChance(value) {
  CREW_KILL_CHANCE = value
}

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
export let MASTER_VOLUME = 0.25  // Default to 50% volume

// Targeting spread for tanks and turrets (in pixels, about 3/4 of a tile for more noticeable inaccuracy)
export let TARGETING_SPREAD = TILE_SIZE * 0.75

export function setTargetingSpread(value) {
  TARGETING_SPREAD = value
}

// HARVESTER_CAPPACITY is now 1 (so a harvester unloads as soon as it harvests one unit)
export let HARVESTER_CAPPACITY = 1

export function setHarvesterCapacity(value) {
  HARVESTER_CAPPACITY = value
}

// Harvester unload time (in milliseconds)
export let HARVESTER_UNLOAD_TIME = 5000  // 5 seconds (2x faster than before)

export function setHarvesterUnloadTime(value) {
  HARVESTER_UNLOAD_TIME = value
}

// Capacity of tanker truck supply tank
export let TANKER_SUPPLY_CAPACITY = 40000

export function setTankerSupplyCapacity(value) {
  TANKER_SUPPLY_CAPACITY = value
}

// Fallback colors for tiles when images aren't available
export let TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700',
  seedCrystal: '#FF5555',
  building: 'transparent' // Buildings should be transparent so background shows through
}

// Image paths for tile types
export let TILE_IMAGES = {
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
export let TILE_SPRITE_SHEET = 'images/map/map_sprites.webp'
export let TILE_SPRITE_MAP = 'images/map/map_sprites.json'

// Enable/disable texture usage (for performance testing/fallback)
export let USE_TEXTURES = true

// Enable/disable tank image-based rendering (T key to toggle during gameplay)
export let USE_TANK_IMAGES = true

// Grass tile ratio configuration (higher numbers = rarer)
// 1 out of X tiles will be decorative/impassable
export let GRASS_DECORATIVE_RATIO = 33  // 1 in x tiles will be decorative
export let GRASS_IMPASSABLE_RATIO = 50  // 1 in x tiles will be impassable

export let INERTIA_DECAY = 0.983  // Increased from 0.95 to make inertia 3x longer
export let INERTIA_STOP_THRESHOLD = 1  // Velocity magnitude below this stops inertia entirely

export function setInertiaStopThreshold(value) {
  INERTIA_STOP_THRESHOLD = value
}
// Wreck impact physics tuning (bullet/explosion impacts)
export let WRECK_IMPACT_FORCE_MULTIPLIER = 0.02 // Scales how far wrecks are tossed per point of damage
export let WRECK_INERTIA_DECAY = 0.92 // Controls how quickly tossed wrecks slow down

// Collision bounce tuning (unit vs unit)
export let COLLISION_BOUNCE_REMOTE_BOOST = 1.5 // Extra impulse when player is actively remote-controlling
export let COLLISION_BOUNCE_SPEED_FACTOR = 0.8 // Contribution of speed to impulse
export let COLLISION_BOUNCE_OVERLAP_FACTOR = 0.2 // Contribution of overlap to impulse
export let COLLISION_BOUNCE_MIN = 0.3 // Clamp min impulse
export let COLLISION_BOUNCE_MAX = 2.2 // Clamp max impulse
export let COLLISION_RECOIL_FACTOR_FAST = 0.35 // Portion of impulse applied as recoil to the faster unit
export let COLLISION_RECOIL_MAX_FAST = 0.8 // Max recoil magnitude for faster unit
export let COLLISION_RECOIL_PUSH_OTHER_FACTOR = 0.25 // Portion of impulse nudging the faster unit when the slower bounces (for separation)
export let COLLISION_RECOIL_PUSH_OTHER_MAX = 0.6 // Max of that nudge
export let COLLISION_SEPARATION_SCALE = 0.6 // How much to separate positions based on overlap
export let COLLISION_SEPARATION_MAX = 4 // Max separation distance
export let COLLISION_SEPARATION_MIN = 0.5 // Min separation distance
export let COLLISION_NORMAL_DAMPING_MULT = 1.1 // How strongly to damp velocity along collision normal
export let COLLISION_NORMAL_DAMPING_MAX = 1.2 // Max damping amount

// Collision bounce tuning (unit vs wreck)
export let WRECK_COLLISION_REMOTE_BOOST = 1.1 // Stronger boost when remote-controlling
export let WRECK_COLLISION_SPEED_FACTOR = 0.75
export let WRECK_COLLISION_OVERLAP_FACTOR = 0.1
export let WRECK_COLLISION_MIN = 0.4
export let WRECK_COLLISION_MAX = 2.5
export let WRECK_COLLISION_RECOIL_FACTOR_UNIT = 0.25 // Recoil applied to unit when wreck is slower
export let WRECK_COLLISION_RECOIL_MAX_UNIT = 0.6
// Scroll speed when using arrow keys (pixels per frame)
export let KEYBOARD_SCROLL_SPEED = 8

export function setKeyboardScrollSpeed(value) {
  KEYBOARD_SCROLL_SPEED = value
}

// Increase tank range by 50% (for example, from 6 to 9 tiles)
export let TANK_FIRE_RANGE = 9

export function setTankFireRange(value) {
  const previous = TANK_FIRE_RANGE
  TANK_FIRE_RANGE = value
  if (SERVICE_DISCOVERY_RANGE === previous) {
    SERVICE_DISCOVERY_RANGE = value
  }
}

// Service vehicle detection range when in alert mode (defaults to tank fire range)
export let SERVICE_DISCOVERY_RANGE = TANK_FIRE_RANGE

export function setServiceDiscoveryRange(value) {
  SERVICE_DISCOVERY_RANGE = value
}

// Effective service range for utility vehicles (defaults to close support distance)
export let SERVICE_SERVING_RANGE = Math.SQRT2

export function setServiceServingRange(value) {
  SERVICE_SERVING_RANGE = value
}

// Maximum allowed empty tile gap between connected buildings (Chebyshev distance)
export let MAX_BUILDING_GAP_TILES = 3
// Backwards-compatible export for systems that still consume the old name
export let BUILDING_PROXIMITY_RANGE = MAX_BUILDING_GAP_TILES

// Shadow of War configuration
export let SHADOW_OF_WAR_CONFIG = {
  tilePadding: 0.5,
  rocketRangeMultiplier: 1.5,
  defaultNonCombatRange: 2,
  harvesterRange: 5,
  initialBaseDiscoveryRadius: 10,
  baseVisibilityBorder: 4
}

// Tank constants
export let DEFAULT_ROTATION_SPEED = 0.05 // Radians per frame

export function setDefaultRotationSpeed(value) {
  DEFAULT_ROTATION_SPEED = value
}

export let FAST_ROTATION_SPEED = 0.1 // Radians per frame

export function setFastRotationSpeed(value) {
  FAST_ROTATION_SPEED = value
}

export let TANK_BULLET_SPEED = 8 // Radians per frame

export function setTankBulletSpeed(value) {
  TANK_BULLET_SPEED = value
}

// Hit zone damage multipliers for tanks
export let HIT_ZONE_DAMAGE_MULTIPLIERS = {
  FRONT: 1.0,   // Normal damage from front
  SIDE: 1.25,    // 30% more damage from sides
  REAR: 1.5     // 100% more damage from behind (critical hit)
}

// Critical damage sound cooldown (30 seconds)
export let CRITICAL_DAMAGE_SOUND_COOLDOWN = 30000

// Separate rotation rates for tank components
export let TANK_WAGON_ROT = 0.05 // Radians per frame for tank body/wagon movement

export function setTankWagonRot(value) {
  TANK_WAGON_ROT = value
}

// Reduced turret rotation speed to make artillery tracking more deliberate
// 70% slower than before (was 0.08)
export let TANK_TURRET_ROT = 0.024 // Radians per frame for turret aiming

export function setTankTurretRot(value) {
  TANK_TURRET_ROT = value
}

// Aiming precision threshold (in radians) - turret must be within this angle to fire
export let TURRET_AIMING_THRESHOLD = 0.1 // About 5.7 degrees

export function setTurretAimingThreshold(value) {
  TURRET_AIMING_THRESHOLD = value
}

// Howitzer configuration
export let HOWITZER_COST = 2500
export let HOWITZER_SPEED = 0.22 // ~33% slower than a standard tank
export let HOWITZER_ROTATION_SPEED = 0.04 // Slightly slower hull rotation
export let HOWITZER_FIREPOWER = 80 // Less than defensive artillery turret (100)
export let HOWITZER_RANGE_TILES = 30 // Slightly lower than artillery turret (36)
export let HOWITZER_MIN_RANGE_TILES = 4
export let HOWITZER_RELOAD_TIME = 6000 // ms
export let HOWITZER_PROJECTILE_SPEED = 0.85
export let HOWITZER_EXPLOSION_RADIUS_TILES = 2.5
export let HOWITZER_VISION_RANGE_TILES = 18 // Needs scouts to reach full range
export let HOWITZER_ARMOR = 2
export let HOWITZER_HEALTH = 180
export let HOWITZER_ACCELERATION_MULTIPLIER = 0.75

export function setHowitzerCost(value) {
  HOWITZER_COST = value
  UNIT_COSTS.howitzer = value
}

export function setHowitzerSpeed(value) {
  HOWITZER_SPEED = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.speed = value
  }
}

export function setHowitzerRotationSpeed(value) {
  HOWITZER_ROTATION_SPEED = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.rotationSpeed = value
    UNIT_PROPERTIES.howitzer.turretRotationSpeed = value
  }
}

export function setHowitzerFirepower(value) {
  HOWITZER_FIREPOWER = value
}

export function setHowitzerRange(value) {
  HOWITZER_RANGE_TILES = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.range = value
  }
}

export function setHowitzerMinRange(value) {
  HOWITZER_MIN_RANGE_TILES = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.minRange = value
  }
}

export function setHowitzerReloadTime(value) {
  HOWITZER_RELOAD_TIME = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.reloadTime = value
  }
}

export function setHowitzerProjectileSpeed(value) {
  HOWITZER_PROJECTILE_SPEED = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.projectileSpeed = value
  }
}

export function setHowitzerExplosionRadius(value) {
  HOWITZER_EXPLOSION_RADIUS_TILES = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.explosionRadiusTiles = value
  }
}

export function setHowitzerVisionRange(value) {
  HOWITZER_VISION_RANGE_TILES = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.visionRange = value
  }
}

export function setHowitzerArmor(value) {
  HOWITZER_ARMOR = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.armor = value
  }
}

export function setHowitzerHealth(value) {
  HOWITZER_HEALTH = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.health = value
    UNIT_PROPERTIES.howitzer.maxHealth = value
  }
}

export function setHowitzerAccelerationMultiplier(value) {
  HOWITZER_ACCELERATION_MULTIPLIER = value
  if (UNIT_PROPERTIES.howitzer) {
    UNIT_PROPERTIES.howitzer.accelerationMultiplier = value
  }
}

// Recoil and muzzle flash animation constants
export let RECOIL_DISTANCE = 8 // pixels to move back during recoil
export let RECOIL_DURATION = 300 // milliseconds
export let MUZZLE_FLASH_DURATION = 150 // milliseconds
export let MUZZLE_FLASH_SIZE = 12 // radius of muzzle flash
export let TURRET_RECOIL_DISTANCE = 6 // pixels for building turrets
export let SMOKE_PARTICLE_LIFETIME = 4500 // milliseconds (increased for longer-lasting building smoke)
export let SMOKE_EMIT_INTERVAL = 120 // milliseconds between puffs (slightly less frequent)
export let SMOKE_PARTICLE_SIZE = 8 // radius of smoke particles (reduced from 12)
export let MAX_SMOKE_PARTICLES = 600 // Upper limit to keep smoke rendering performant

export function setMaxSmokeParticles(value) {
  MAX_SMOKE_PARTICLES = value
}

// Duration of the building sell animation (in milliseconds)
export let BUILDING_SELL_DURATION = 3000

// Wind effects for smoke particles
export let WIND_DIRECTION = { x: 0.3, y: -0.1 } // Slight eastward and upward wind
export let WIND_STRENGTH = 0.008 // How much wind affects particle movement

export let ORE_SPREAD_INTERVAL = 30000  // 30 seconds (3x faster than before)

export function setOreSpreadInterval(value) {
  ORE_SPREAD_INTERVAL = value
}

export let ORE_SPREAD_PROBABILITY = 0.06

export function setOreSpreadProbability(value) {
  ORE_SPREAD_PROBABILITY = value
}

// Toggle ore spreading to improve performance when disabled
export let ORE_SPREAD_ENABLED = true

export function setOreSpreadEnabled(value) {
  ORE_SPREAD_ENABLED = value
}

// New: Path recalculation interval (in milliseconds)
export let PATH_CALC_INTERVAL = 2000

export function setPathCalcInterval(value) {
  PATH_CALC_INTERVAL = value
}

// Attack/chase pathfinding interval - throttled to prevent excessive recalculation (in milliseconds)
export let ATTACK_PATH_CALC_INTERVAL = 3000

export function setAttackPathCalcInterval(value) {
  ATTACK_PATH_CALC_INTERVAL = value
}

// General AI decision interval for heavy logic like target selection (in milliseconds)
export let AI_DECISION_INTERVAL = 5000  // Reduced from 200ms to 5s to prevent wiggling

export function setAiDecisionInterval(value) {
  AI_DECISION_INTERVAL = value
}

// Recovery tank ratio: 1 recovery tank per X combat units
export let RECOVERY_TANK_RATIO = 5

export function setRecoveryTankRatio(value) {
  RECOVERY_TANK_RATIO = value
}

// Smoke emission for buildings
export let BUILDING_SMOKE_EMIT_INTERVAL = 1000 // ms between puffs

// Distance threshold for using occupancy map in pathfinding (in tiles)
export let PATHFINDING_THRESHOLD = 10

export function setPathfindingThreshold(value) {
  PATHFINDING_THRESHOLD = value
}

// How close a unit needs to be (in tiles) to consider a move target reached
export let MOVE_TARGET_REACHED_THRESHOLD = 1.5

export function setMoveTargetReachedThreshold(value) {
  MOVE_TARGET_REACHED_THRESHOLD = value
}

// Unit stuck detection and productivity check intervals (in milliseconds)
export let STUCK_CHECK_INTERVAL = 500  // Check every 0.5 seconds for stuck units

export function setStuckCheckInterval(value) {
  STUCK_CHECK_INTERVAL = value
}

export let HARVESTER_PRODUCTIVITY_CHECK_INTERVAL = 500  // Check harvester productivity every 0.5 seconds
export let STUCK_THRESHOLD = 500  // Consider units stuck after 0.5 seconds

export function setStuckThreshold(value) {
  STUCK_THRESHOLD = value
}

export let STUCK_HANDLING_COOLDOWN = 1250  // Cooldown between stuck handling attempts

export function setStuckHandlingCooldown(value) {
  STUCK_HANDLING_COOLDOWN = value
}

export let DODGE_ATTEMPT_COOLDOWN = 500  // Cooldown between dodge attempts

export function setDodgeAttemptCooldown(value) {
  DODGE_ATTEMPT_COOLDOWN = value
}

// Street movement and pathfinding modifiers
export let STREET_SPEED_MULTIPLIER = 1.5  // Units move 50% faster on streets

export function setStreetSpeedMultiplier(value) {
  STREET_SPEED_MULTIPLIER = value
}

export let STREET_PATH_COST = 1 / STREET_SPEED_MULTIPLIER  // Prefer streets in pathfinding

// Unit costs
export let UNIT_COSTS = {
  tank: 1000,
  tank_v1: 1000, // Alias for tank (used by AI)
  rocketTank: 2000,
  harvester: 1500,
  'tank-v2': 2000,
  'tank-v3': 3000,
  ambulance: 500,
  tankerTruck: 300,
  recoveryTank: 3000,
  howitzer: HOWITZER_COST
}

// Unit properties
export let UNIT_PROPERTIES = {
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
  },
  howitzer: {
    health: HOWITZER_HEALTH,
    maxHealth: HOWITZER_HEALTH,
    speed: HOWITZER_SPEED,
    rotationSpeed: HOWITZER_ROTATION_SPEED,
    turretRotationSpeed: HOWITZER_ROTATION_SPEED,
    armor: HOWITZER_ARMOR,
    minRange: HOWITZER_MIN_RANGE_TILES,
    range: HOWITZER_RANGE_TILES,
    firepower: HOWITZER_FIREPOWER,
    reloadTime: HOWITZER_RELOAD_TIME,
    projectileSpeed: HOWITZER_PROJECTILE_SPEED,
    explosionRadiusTiles: HOWITZER_EXPLOSION_RADIUS_TILES,
    visionRange: HOWITZER_VISION_RANGE_TILES,
    accelerationMultiplier: HOWITZER_ACCELERATION_MULTIPLIER
  }
}

// Tank V3 burst fire configuration
export let TANK_V3_BURST = {
  COUNT: 2,     // Number of bullets per burst
  DELAY: 300    // Delay between bullets in milliseconds
}

// Pathfinding constants
export let PATHFINDING_LIMIT = 1000

// Movement directions for pathfinding and position search
export let DIRECTIONS = [
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
export let MAX_SPAWN_SEARCH_DISTANCE = 10

export let BULLET_DAMAGES = {
  tank_v1: 20,
  tank_v2: 24,
  tank_v3: 30,
  rocketTank: 120,
  howitzer: HOWITZER_FIREPOWER
}

// Attack Group Feature (AGF) constants
export let ATTACK_TARGET_INDICATOR_SIZE = 8 // Size of the red triangle indicator above targeted units
export let ATTACK_TARGET_BOUNCE_SPEED = 0.003 // Speed of bouncing animation for target indicators

// Movement target indicator constants
export let MOVE_TARGET_INDICATOR_SIZE = 8 // Size of the green triangle indicator for movement targets
export let MOVE_TARGET_BOUNCE_SPEED = 0.003 // Speed of bouncing animation for movement target indicators

export const UTILITY_SERVICE_INDICATOR_SIZE = 8
export const UTILITY_SERVICE_INDICATOR_BOUNCE_SPEED = 0.003

// Unit type colors (same for all players/enemies of same type)
export let UNIT_TYPE_COLORS = {
  tank: '#0000FF',        // Blue
  tank_v1: '#0000FF',     // Blue
  'tank-v2': '#FFFFFF',   // White
  'tank-v3': '#32CD32',   // Lime green
  harvester: '#9400D3',   // Purple
  rocketTank: '#800000',
  ambulance: '#00FFFF',   // Dark red
  tankerTruck: '#FFA500',
  recoveryTank: '#FFD700', // Gold
  howitzer: '#FF8C00'      // Dark orange
}

// Party/owner colors for indicators (4 distinct colors for multiplayer)
export let PARTY_COLORS = {
  player1: '#00FF00',     // Green (Human player by default)
  player2: '#FF0000',     // Red
  player3: '#0080FF',     // Blue
  player4: '#FFFF00',     // Yellow
  // Legacy aliases for backwards compatibility
  player: '#00FF00',      // Green
  enemy: '#FF0000'        // Red
}

// Player position constants for 4-corner setup
export let PLAYER_POSITIONS = {
  player1: { x: 0.1, y: 0.9 },   // Bottom-left (current player position)
  player2: { x: 0.9, y: 0.1 },   // Top-right (current enemy position)
  player3: { x: 0.1, y: 0.1 },   // Top-left
  player4: { x: 0.9, y: 0.9 }    // Bottom-right
}

// Default number of players
export let DEFAULT_PLAYER_COUNT = 2

// Gas system configuration
export let GAS_REFILL_TIME = 7000 // ms to fully refill at station

export function setGasRefillTime(value) {
  GAS_REFILL_TIME = value
}

export let GAS_REFILL_COST = 50

export function setGasRefillCost(value) {
  GAS_REFILL_COST = value
}

const REMOTE_CONTROL_ALLOWED_ACTIONS = [
  'forward',
  'backward',
  'turnLeft',
  'turnRight',
  'turretLeft',
  'turretRight',
  'fire'
]

const TURRET_TANK_TYPES = new Set([
  'tank',
  'tank_v1',
  'tank_v2',
  'tank_v3',
  'tank-v2',
  'tank-v3',
  'rocketTank',
  'howitzer'
])

const DEFAULT_TANK_JOYSTICK_MAPPING = {
  left: {
    up: ['forward'],
    down: ['backward'],
    left: ['turretLeft'],
    right: ['turretRight'],
    tap: []
  },
  right: {
    up: [],
    down: [],
    left: ['turnLeft'],
    right: ['turnRight'],
    tap: ['fire']
  }
}

const DEFAULT_VEHICLE_JOYSTICK_MAPPING = {
  left: {
    up: ['forward'],
    down: ['backward'],
    left: [],
    right: [],
    tap: []
  },
  right: {
    up: [],
    down: [],
    left: ['turnLeft'],
    right: ['turnRight'],
    tap: []
  }
}

function cloneJoystickMapping(mapping) {
  return JSON.parse(JSON.stringify(mapping))
}

function normalizeActionList(value) {
  if (value === null || value === undefined) {
    return []
  }

  let actions
  if (Array.isArray(value)) {
    actions = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      return []
    }
    actions = trimmed.split(',').map(item => item.trim()).filter(Boolean)
  } else {
    throw new Error('Joystick mapping values must be strings or arrays of actions')
  }

  const uniqueActions = []
  for (const action of actions) {
    const normalized = String(action).trim()
    if (!normalized) {
      continue
    }
    if (!REMOTE_CONTROL_ALLOWED_ACTIONS.includes(normalized)) {
      throw new Error(`Unsupported joystick action: ${normalized}`)
    }
    if (!uniqueActions.includes(normalized)) {
      uniqueActions.push(normalized)
    }
  }
  return uniqueActions
}

function normalizeJoystickMapping(mapping, fallback) {
  if (!mapping || typeof mapping !== 'object') {
    throw new Error('Joystick mapping must be an object')
  }

  const normalized = { left: {}, right: {} }
  const sides = ['left', 'right']
  const directions = ['up', 'down', 'left', 'right', 'tap']

  for (const side of sides) {
    const inputSide = mapping[side] && typeof mapping[side] === 'object' ? mapping[side] : {}
    const fallbackSide = fallback[side] || {}
    normalized[side] = {}

    for (const direction of directions) {
      const rawValue =
        inputSide[direction] !== undefined ? inputSide[direction] : fallbackSide[direction]
      normalized[side][direction] = normalizeActionList(rawValue)
    }
  }

  return normalized
}

function parseJoystickMappingInput(value, fallback) {
  let mapping = value
  if (typeof mapping === 'string') {
    const trimmed = mapping.trim()
    mapping = trimmed ? JSON.parse(trimmed) : {}
  }

  return normalizeJoystickMapping(mapping, fallback)
}

export let MOBILE_TANK_JOYSTICK_MAPPING = cloneJoystickMapping(DEFAULT_TANK_JOYSTICK_MAPPING)
export let MOBILE_VEHICLE_JOYSTICK_MAPPING = cloneJoystickMapping(DEFAULT_VEHICLE_JOYSTICK_MAPPING)

export function setMobileTankJoystickMapping(value) {
  MOBILE_TANK_JOYSTICK_MAPPING = parseJoystickMappingInput(value, DEFAULT_TANK_JOYSTICK_MAPPING)
}

export function setMobileVehicleJoystickMapping(value) {
  MOBILE_VEHICLE_JOYSTICK_MAPPING = parseJoystickMappingInput(value, DEFAULT_VEHICLE_JOYSTICK_MAPPING)
}

export function getMobileTankJoystickMapping() {
  return MOBILE_TANK_JOYSTICK_MAPPING
}

export function getMobileVehicleJoystickMapping() {
  return MOBILE_VEHICLE_JOYSTICK_MAPPING
}

export function getMobileJoystickMapping(profile) {
  return profile === 'tank' ? MOBILE_TANK_JOYSTICK_MAPPING : MOBILE_VEHICLE_JOYSTICK_MAPPING
}

export function isTurretTankUnitType(unitType) {
  return TURRET_TANK_TYPES.has(unitType)
}

export let UNIT_GAS_PROPERTIES = {
  tank_v1: { tankSize: 1900, consumption: 450 },
  'tank-v2': { tankSize: 1900, consumption: 450 },
  'tank-v3': { tankSize: 1900, consumption: 450 },
  rocketTank: { tankSize: 1900, consumption: 450 },
  // Recovery tanks consume the same fuel as standard tanks
  recoveryTank: { tankSize: 1900, consumption: 450 },
  howitzer: { tankSize: 1900, consumption: 450 },
  harvester: { tankSize: 2650, consumption: 30, harvestConsumption: 100 },
  ambulance: { tankSize: 75, consumption: 25 },
  tankerTruck: { tankSize: 700, consumption: 150 }
}

const EXPORTED_CONFIG_VARIABLES = [
  'XP_MULTIPLIER',
  'TILE_SIZE',
  'MIN_MAP_TILES',
  'DEFAULT_MAP_TILES_X',
  'DEFAULT_MAP_TILES_Y',
  'MAP_TILES_X',
  'MAP_TILES_Y',
  'TILE_LENGTH_METERS',
  'SAFE_RANGE_ENABLED',
  'CREW_KILL_CHANCE',
  'ENABLE_ENEMY_SELECTION',
  'ENABLE_ENEMY_CONTROL',
  'MASTER_VOLUME',
  'TARGETING_SPREAD',
  'HARVESTER_CAPPACITY',
  'HARVESTER_UNLOAD_TIME',
  'TANKER_SUPPLY_CAPACITY',
  'TILE_COLORS',
  'TILE_IMAGES',
  'TILE_SPRITE_SHEET',
  'TILE_SPRITE_MAP',
  'USE_TEXTURES',
  'USE_TANK_IMAGES',
  'GRASS_DECORATIVE_RATIO',
  'GRASS_IMPASSABLE_RATIO',
  'INERTIA_DECAY',
  'INERTIA_STOP_THRESHOLD',
  'WRECK_IMPACT_FORCE_MULTIPLIER',
  'WRECK_INERTIA_DECAY',
  'COLLISION_BOUNCE_REMOTE_BOOST',
  'COLLISION_BOUNCE_SPEED_FACTOR',
  'COLLISION_BOUNCE_OVERLAP_FACTOR',
  'COLLISION_BOUNCE_MIN',
  'COLLISION_BOUNCE_MAX',
  'COLLISION_RECOIL_FACTOR_FAST',
  'COLLISION_RECOIL_MAX_FAST',
  'COLLISION_RECOIL_PUSH_OTHER_FACTOR',
  'COLLISION_RECOIL_PUSH_OTHER_MAX',
  'COLLISION_SEPARATION_SCALE',
  'COLLISION_SEPARATION_MAX',
  'COLLISION_SEPARATION_MIN',
  'COLLISION_NORMAL_DAMPING_MULT',
  'COLLISION_NORMAL_DAMPING_MAX',
  'WRECK_COLLISION_REMOTE_BOOST',
  'WRECK_COLLISION_SPEED_FACTOR',
  'WRECK_COLLISION_OVERLAP_FACTOR',
  'WRECK_COLLISION_MIN',
  'WRECK_COLLISION_MAX',
  'WRECK_COLLISION_RECOIL_FACTOR_UNIT',
  'WRECK_COLLISION_RECOIL_MAX_UNIT',
  'KEYBOARD_SCROLL_SPEED',
  'TANK_FIRE_RANGE',
  'SERVICE_DISCOVERY_RANGE',
  'SERVICE_SERVING_RANGE',
  'MAX_BUILDING_GAP_TILES',
  'BUILDING_PROXIMITY_RANGE',
  'SHADOW_OF_WAR_CONFIG',
  'DEFAULT_ROTATION_SPEED',
  'FAST_ROTATION_SPEED',
  'TANK_BULLET_SPEED',
  'HIT_ZONE_DAMAGE_MULTIPLIERS',
  'CRITICAL_DAMAGE_SOUND_COOLDOWN',
  'TANK_WAGON_ROT',
  'TANK_TURRET_ROT',
  'TURRET_AIMING_THRESHOLD',
  'HOWITZER_COST',
  'HOWITZER_SPEED',
  'HOWITZER_ROTATION_SPEED',
  'HOWITZER_FIREPOWER',
  'HOWITZER_RANGE_TILES',
  'HOWITZER_MIN_RANGE_TILES',
  'HOWITZER_RELOAD_TIME',
  'HOWITZER_PROJECTILE_SPEED',
  'HOWITZER_EXPLOSION_RADIUS_TILES',
  'HOWITZER_VISION_RANGE_TILES',
  'HOWITZER_ARMOR',
  'HOWITZER_HEALTH',
  'HOWITZER_ACCELERATION_MULTIPLIER',
  'RECOIL_DISTANCE',
  'RECOIL_DURATION',
  'MUZZLE_FLASH_DURATION',
  'MUZZLE_FLASH_SIZE',
  'TURRET_RECOIL_DISTANCE',
  'SMOKE_PARTICLE_LIFETIME',
  'SMOKE_EMIT_INTERVAL',
  'SMOKE_PARTICLE_SIZE',
  'BUILDING_SELL_DURATION',
  'WIND_DIRECTION',
  'WIND_STRENGTH',
  'ORE_SPREAD_INTERVAL',
  'ORE_SPREAD_PROBABILITY',
  'ORE_SPREAD_ENABLED',
  'PATH_CALC_INTERVAL',
  'ATTACK_PATH_CALC_INTERVAL',
  'AI_DECISION_INTERVAL',
  'RECOVERY_TANK_RATIO',
  'BUILDING_SMOKE_EMIT_INTERVAL',
  'PATHFINDING_THRESHOLD',
  'MOVE_TARGET_REACHED_THRESHOLD',
  'STUCK_CHECK_INTERVAL',
  'HARVESTER_PRODUCTIVITY_CHECK_INTERVAL',
  'STUCK_THRESHOLD',
  'STUCK_HANDLING_COOLDOWN',
  'DODGE_ATTEMPT_COOLDOWN',
  'STREET_SPEED_MULTIPLIER',
  'STREET_PATH_COST',
  'UNIT_COSTS',
  'UNIT_PROPERTIES',
  'TANK_V3_BURST',
  'PATHFINDING_LIMIT',
  'DIRECTIONS',
  'MAX_SPAWN_SEARCH_DISTANCE',
  'BULLET_DAMAGES',
  'ATTACK_TARGET_INDICATOR_SIZE',
  'ATTACK_TARGET_BOUNCE_SPEED',
  'MOVE_TARGET_INDICATOR_SIZE',
  'MOVE_TARGET_BOUNCE_SPEED',
  'UNIT_TYPE_COLORS',
  'PARTY_COLORS',
  'PLAYER_POSITIONS',
  'DEFAULT_PLAYER_COUNT',
  'GAS_REFILL_TIME',
  'GAS_REFILL_COST',
  'UNIT_GAS_PROPERTIES'
]

// The old eval-based config system has been removed because it cannot work in production
// builds where variable names get minified. Use configRegistry.js instead, which uses
// direct function references that work correctly with minification.

export const CONFIG_VARIABLE_NAMES = [...EXPORTED_CONFIG_VARIABLES]
