// configRegistry.js
// Safe runtime configuration system that works with minified builds
// Instead of using eval(), we store direct references to getters/setters

import {
  XP_MULTIPLIER,
  ORE_SPREAD_ENABLED,
  setOreSpreadEnabled,
  ENABLE_ENEMY_CONTROL,
  setEnemyControlEnabled,
  ENABLE_ENEMY_SELECTION,
  setEnemySelectionEnabled,
  CREW_KILL_CHANCE,
  TARGETING_SPREAD,
  HARVESTER_CAPPACITY,
  HARVESTER_UNLOAD_TIME,
  TANKER_SUPPLY_CAPACITY,
  ORE_SPREAD_INTERVAL,
  ORE_SPREAD_PROBABILITY,
  TANK_FIRE_RANGE,
  DEFAULT_ROTATION_SPEED,
  FAST_ROTATION_SPEED,
  TANK_BULLET_SPEED,
  TANK_WAGON_ROT,
  TANK_TURRET_ROT,
  TURRET_AIMING_THRESHOLD,
  PATH_CALC_INTERVAL,
  ATTACK_PATH_CALC_INTERVAL,
  AI_DECISION_INTERVAL,
  PATHFINDING_THRESHOLD,
  MOVE_TARGET_REACHED_THRESHOLD,
  STUCK_CHECK_INTERVAL,
  STUCK_THRESHOLD,
  STUCK_HANDLING_COOLDOWN,
  DODGE_ATTEMPT_COOLDOWN,
  STREET_SPEED_MULTIPLIER,
  KEYBOARD_SCROLL_SPEED,
  GAS_REFILL_TIME,
  GAS_REFILL_COST
} from './config.js'

/**
 * Config registry entry
 * @typedef {Object} ConfigEntry
 * @property {string} name - User-friendly name for display
 * @property {string} description - Description of what the config does
 * @property {string} type - Type of value ('number', 'boolean', 'string')
 * @property {Function} get - Getter function that returns current value
 * @property {Function} [set] - Optional setter function (omit for read-only)
 * @property {number} [min] - Minimum value for numbers
 * @property {number} [max] - Maximum value for numbers
 * @property {number} [step] - Step increment for numbers
 * @property {string} category - Category for grouping settings
 */

/**
 * Registry of all runtime-configurable values
 * Keys are internal IDs, values are ConfigEntry objects
 */
export const configRegistry = {
  // Game Balance
  xpMultiplier: {
    name: 'XP Multiplier',
    description: 'Adjusts how quickly units gain experience',
    type: 'number',
    get: () => XP_MULTIPLIER,
    set: null, // Read-only const
    min: 0,
    max: 10,
    step: 0.5,
    category: 'Game Balance'
  },

  crewKillChance: {
    name: 'Crew Kill Chance',
    description: 'Probability of killing a crew member on hit',
    type: 'number',
    get: () => CREW_KILL_CHANCE,
    set: null, // Read-only const
    min: 0,
    max: 1,
    step: 0.05,
    category: 'Game Balance'
  },

  tankFireRange: {
    name: 'Tank Fire Range',
    description: 'Maximum firing range for tanks (in tiles)',
    type: 'number',
    get: () => TANK_FIRE_RANGE,
    set: null, // Read-only const
    min: 1,
    max: 20,
    step: 1,
    category: 'Game Balance'
  },

  // Enemy Control
  enableEnemyControl: {
    name: 'Enable Enemy Control',
    description: 'Allow issuing commands to enemy units when selected',
    type: 'boolean',
    get: () => ENABLE_ENEMY_CONTROL,
    set: setEnemyControlEnabled,
    category: 'Gameplay'
  },

  enableEnemySelection: {
    name: 'Enable Enemy Selection',
    description: 'Allow selecting enemy units to view their HUD',
    type: 'boolean',
    get: () => ENABLE_ENEMY_SELECTION,
    set: setEnemySelectionEnabled,
    category: 'Gameplay'
  },

  // Ore System
  oreSpreadEnabled: {
    name: 'Ore Spread Enabled',
    description: 'Toggle ore spreading for performance',
    type: 'boolean',
    get: () => ORE_SPREAD_ENABLED,
    set: setOreSpreadEnabled,
    category: 'Resources'
  },

  oreSpreadInterval: {
    name: 'Ore Spread Interval',
    description: 'Time between ore spread attempts (ms)',
    type: 'number',
    get: () => ORE_SPREAD_INTERVAL,
    set: null, // Read-only const
    min: 1000,
    max: 60000,
    step: 1000,
    category: 'Resources'
  },

  oreSpreadProbability: {
    name: 'Ore Spread Probability',
    description: 'Chance of ore spreading to adjacent tile',
    type: 'number',
    get: () => ORE_SPREAD_PROBABILITY,
    set: null, // Read-only const
    min: 0,
    max: 1,
    step: 0.01,
    category: 'Resources'
  },

  // Harvester
  harvesterCapacity: {
    name: 'Harvester Capacity',
    description: 'Amount of ore a harvester can carry',
    type: 'number',
    get: () => HARVESTER_CAPPACITY,
    set: null, // Read-only const
    min: 1,
    max: 10,
    step: 1,
    category: 'Resources'
  },

  harvesterUnloadTime: {
    name: 'Harvester Unload Time',
    description: 'Time to unload ore at refinery (ms)',
    type: 'number',
    get: () => HARVESTER_UNLOAD_TIME,
    set: null, // Read-only const
    min: 1000,
    max: 30000,
    step: 1000,
    category: 'Resources'
  },

  // Gas System
  tankerSupplyCapacity: {
    name: 'Tanker Supply Capacity',
    description: 'Fuel capacity of tanker truck',
    type: 'number',
    get: () => TANKER_SUPPLY_CAPACITY,
    set: null, // Read-only const
    min: 1000,
    max: 100000,
    step: 1000,
    category: 'Resources'
  },

  gasRefillTime: {
    name: 'Gas Refill Time',
    description: 'Time to fully refill at gas station (ms)',
    type: 'number',
    get: () => GAS_REFILL_TIME,
    set: null, // Read-only const
    min: 1000,
    max: 30000,
    step: 1000,
    category: 'Resources'
  },

  gasRefillCost: {
    name: 'Gas Refill Cost',
    description: 'Cost to refill fuel at gas station',
    type: 'number',
    get: () => GAS_REFILL_COST,
    set: null, // Read-only const
    min: 0,
    max: 500,
    step: 10,
    category: 'Resources'
  },

  // Combat
  targetingSpread: {
    name: 'Targeting Spread',
    description: 'Inaccuracy of tank fire (pixels)',
    type: 'number',
    get: () => TARGETING_SPREAD,
    set: null, // Read-only const
    min: 0,
    max: 64,
    step: 1,
    category: 'Combat'
  },

  tankBulletSpeed: {
    name: 'Tank Bullet Speed',
    description: 'Speed of tank projectiles',
    type: 'number',
    get: () => TANK_BULLET_SPEED,
    set: null, // Read-only const
    min: 1,
    max: 20,
    step: 0.5,
    category: 'Combat'
  },

  // Movement & Rotation
  defaultRotationSpeed: {
    name: 'Default Rotation Speed',
    description: 'Base rotation speed for units (radians/frame)',
    type: 'number',
    get: () => DEFAULT_ROTATION_SPEED,
    set: null, // Read-only const
    min: 0.01,
    max: 0.2,
    step: 0.01,
    category: 'Movement'
  },

  fastRotationSpeed: {
    name: 'Fast Rotation Speed',
    description: 'Fast rotation speed for units (radians/frame)',
    type: 'number',
    get: () => FAST_ROTATION_SPEED,
    set: null, // Read-only const
    min: 0.01,
    max: 0.3,
    step: 0.01,
    category: 'Movement'
  },

  tankWagonRotation: {
    name: 'Tank Wagon Rotation',
    description: 'Tank body rotation speed (radians/frame)',
    type: 'number',
    get: () => TANK_WAGON_ROT,
    set: null, // Read-only const
    min: 0.01,
    max: 0.2,
    step: 0.005,
    category: 'Movement'
  },

  tankTurretRotation: {
    name: 'Tank Turret Rotation',
    description: 'Tank turret rotation speed (radians/frame)',
    type: 'number',
    get: () => TANK_TURRET_ROT,
    set: null, // Read-only const
    min: 0.01,
    max: 0.2,
    step: 0.005,
    category: 'Movement'
  },

  turretAimingThreshold: {
    name: 'Turret Aiming Threshold',
    description: 'Angle tolerance for turret firing (radians)',
    type: 'number',
    get: () => TURRET_AIMING_THRESHOLD,
    set: null, // Read-only const
    min: 0.01,
    max: 0.5,
    step: 0.01,
    category: 'Movement'
  },

  streetSpeedMultiplier: {
    name: 'Street Speed Multiplier',
    description: 'Speed boost when moving on streets',
    type: 'number',
    get: () => STREET_SPEED_MULTIPLIER,
    set: null, // Read-only const
    min: 1,
    max: 3,
    step: 0.1,
    category: 'Movement'
  },

  keyboardScrollSpeed: {
    name: 'Keyboard Scroll Speed',
    description: 'Camera scroll speed with arrow keys (pixels/frame)',
    type: 'number',
    get: () => KEYBOARD_SCROLL_SPEED,
    set: null, // Read-only const
    min: 1,
    max: 32,
    step: 1,
    category: 'Controls'
  },

  // Pathfinding & AI
  pathCalcInterval: {
    name: 'Path Calculation Interval',
    description: 'Time between path recalculations (ms)',
    type: 'number',
    get: () => PATH_CALC_INTERVAL,
    set: null, // Read-only const
    min: 100,
    max: 10000,
    step: 100,
    category: 'AI & Pathfinding'
  },

  attackPathCalcInterval: {
    name: 'Attack Path Calc Interval',
    description: 'Time between attack path recalculations (ms)',
    type: 'number',
    get: () => ATTACK_PATH_CALC_INTERVAL,
    set: null, // Read-only const
    min: 500,
    max: 10000,
    step: 500,
    category: 'AI & Pathfinding'
  },

  aiDecisionInterval: {
    name: 'AI Decision Interval',
    description: 'Time between AI decisions (ms)',
    type: 'number',
    get: () => AI_DECISION_INTERVAL,
    set: null, // Read-only const
    min: 100,
    max: 10000,
    step: 100,
    category: 'AI & Pathfinding'
  },

  pathfindingThreshold: {
    name: 'Pathfinding Threshold',
    description: 'Distance to use occupancy map (tiles)',
    type: 'number',
    get: () => PATHFINDING_THRESHOLD,
    set: null, // Read-only const
    min: 1,
    max: 50,
    step: 1,
    category: 'AI & Pathfinding'
  },

  moveTargetReachedThreshold: {
    name: 'Move Target Threshold',
    description: 'Distance to consider target reached (tiles)',
    type: 'number',
    get: () => MOVE_TARGET_REACHED_THRESHOLD,
    set: null, // Read-only const
    min: 0.5,
    max: 5,
    step: 0.1,
    category: 'AI & Pathfinding'
  },

  // Stuck Detection
  stuckCheckInterval: {
    name: 'Stuck Check Interval',
    description: 'Time between stuck checks (ms)',
    type: 'number',
    get: () => STUCK_CHECK_INTERVAL,
    set: null, // Read-only const
    min: 100,
    max: 5000,
    step: 100,
    category: 'AI & Pathfinding'
  },

  stuckThreshold: {
    name: 'Stuck Threshold',
    description: 'Time before considering unit stuck (ms)',
    type: 'number',
    get: () => STUCK_THRESHOLD,
    set: null, // Read-only const
    min: 100,
    max: 5000,
    step: 100,
    category: 'AI & Pathfinding'
  },

  stuckHandlingCooldown: {
    name: 'Stuck Handling Cooldown',
    description: 'Cooldown between stuck handling (ms)',
    type: 'number',
    get: () => STUCK_HANDLING_COOLDOWN,
    set: null, // Read-only const
    min: 100,
    max: 5000,
    step: 100,
    category: 'AI & Pathfinding'
  },

  dodgeAttemptCooldown: {
    name: 'Dodge Attempt Cooldown',
    description: 'Cooldown between dodge attempts (ms)',
    type: 'number',
    get: () => DODGE_ATTEMPT_COOLDOWN,
    set: null, // Read-only const
    min: 100,
    max: 5000,
    step: 100,
    category: 'AI & Pathfinding'
  }
}

/**
 * Get all config categories
 * @returns {string[]} Array of category names
 */
export function getConfigCategories() {
  const categories = new Set()
  Object.values(configRegistry).forEach(entry => {
    categories.add(entry.category)
  })
  return Array.from(categories).sort()
}

/**
 * Get all config entries in a category
 * @param {string} category - Category name
 * @returns {Object} Map of config IDs to entries
 */
export function getConfigsByCategory(category) {
  const result = {}
  Object.entries(configRegistry).forEach(([id, entry]) => {
    if (entry.category === category) {
      result[id] = entry
    }
  })
  return result
}

/**
 * Get current value of a config
 * @param {string} configId - Config ID from registry
 * @returns {*} Current value
 */
export function getConfigValue(configId) {
  const entry = configRegistry[configId]
  if (!entry) {
    console.warn(`Config not found: ${configId}`)
    return null
  }
  return entry.get()
}

/**
 * Set value of a config (if mutable)
 * @param {string} configId - Config ID from registry
 * @param {*} value - New value
 * @returns {boolean} True if successful
 */
export function setConfigValue(configId, value) {
  const entry = configRegistry[configId]
  if (!entry) {
    console.warn(`Config not found: ${configId}`)
    return false
  }

  if (!entry.set) {
    console.warn(`Config is read-only: ${configId}`)
    return false
  }

  try {
    entry.set(value)
    return true
  } catch (error) {
    console.error(`Failed to set config ${configId}:`, error)
    return false
  }
}

/**
 * Check if a config is mutable
 * @param {string} configId - Config ID from registry
 * @returns {boolean} True if config can be modified
 */
export function isConfigMutable(configId) {
  const entry = configRegistry[configId]
  return entry && entry.set !== null && entry.set !== undefined
}
