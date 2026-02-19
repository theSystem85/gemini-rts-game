/**
 * Test utilities for headless game testing
 *
 * Provides utilities for creating test game states and running
 * the game loop without rendering
 */

// Import config first (no dependencies)
import { MAX_BUILDING_GAP_TILES, DEFAULT_MAP_TILES_X, DEFAULT_MAP_TILES_Y } from '../src/config.js'

// Import gameState (minimal dependencies)
import { gameState } from '../src/gameState.js'

// Import buildingData from the data module (avoids circular import issues)
import { buildingData } from '../src/data/buildingData.js'

// Import the validation functions from the dedicated validation module
// This avoids the circular import issues that occur when importing from buildings.js
import { canPlaceBuilding as canPlaceBuildingBase, isNearExistingBuilding } from '../src/validation/buildingPlacement.js'

// Wrapper that passes gameState.mapEditMode to the validation function
function canPlaceBuilding(type, tileX, tileY, mapGrid, units, buildings, factories, owner = 'player') {
  return canPlaceBuildingBase(type, tileX, tileY, mapGrid, units, buildings, factories, owner, {
    mapEditMode: gameState.mapEditMode
  })
}

/**
 * Creates a clean test map grid
 * @param {number} width - Map width in tiles
 * @param {number} height - Map height in tiles
 * @returns {Array<Array<Object>>} - 2D map grid array
 */
export function createTestMapGrid(width = DEFAULT_MAP_TILES_X, height = DEFAULT_MAP_TILES_Y) {
  const mapGrid = []

  for (let y = 0; y < height; y++) {
    mapGrid[y] = []
    for (let x = 0; x < width; x++) {
      mapGrid[y][x] = {
        type: 'grass',
        x: x,
        y: y,
        ore: 0,
        building: null,
        seedCrystal: false,
        noBuild: false
      }
    }
  }

  return mapGrid
}

/**
 * Resets the game state to initial values for testing
 * @returns {Object} - The reset game state
 */
export function resetGameState() {
  // Reset all arrays
  gameState.buildings = []
  gameState.units = []
  gameState.factories = []
  gameState.mapGrid = []
  gameState.explosions = []
  gameState.smokeParticles = []
  gameState.dustParticles = []
  gameState.unitWrecks = []
  gameState.mines = []
  gameState.blueprints = []

  // Reset numeric values
  gameState.money = 12000
  gameState.gameTime = 0
  gameState.frameCount = 0

  // Reset power tracking
  gameState.powerSupply = 0
  gameState.playerPowerSupply = 0
  gameState.playerTotalPowerProduction = 0
  gameState.playerPowerConsumption = 0
  gameState.enemyPowerSupply = 0
  gameState.enemyTotalPowerProduction = 0
  gameState.enemyPowerConsumption = 0

  // Reset game flags
  gameState.gameStarted = true
  gameState.gamePaused = false
  gameState.gameOver = false
  gameState.mapEditMode = false
  gameState.frameLimiterEnabled = true

  // Reset scroll offset
  gameState.scrollOffset = { x: 0, y: 0 }

  // Reset remote control state
  gameState.remoteControl = {
    forward: 0,
    backward: 0,
    turnLeft: 0,
    turnRight: 0,
    turretLeft: 0,
    turretRight: 0,
    fire: 0,
    ascend: 0,
    descend: 0,
    strafeLeft: 0,
    strafeRight: 0
  }
  gameState.remoteControlSources = {}
  gameState.remoteControlAbsolute = {
    wagonDirection: null,
    wagonSpeed: 0,
    turretDirection: null,
    turretTurnFactor: 0
  }
  gameState.remoteControlAbsoluteSources = {}

  return gameState
}

/**
 * Creates a test construction yard (factory) at specified position
 * @param {number} x - X position in tiles
 * @param {number} y - Y position in tiles
 * @param {string} owner - Owner identifier (default: 'player')
 * @param {Array<Array<Object>>} mapGrid - The map grid to mark as occupied
 * @returns {Object} - The created factory object
 */
export function createTestFactory(x, y, owner = 'player', mapGrid = null) {
  const factory = {
    id: owner,
    owner: owner,
    type: 'constructionYard',
    x: x,
    y: y,
    width: buildingData.constructionYard.width,
    height: buildingData.constructionYard.height,
    health: buildingData.constructionYard.health,
    maxHealth: buildingData.constructionYard.health,
    rallyPoint: null,
    selected: false
  }

  // Mark tiles as occupied in map grid
  if (mapGrid) {
    for (let dy = 0; dy < factory.height; dy++) {
      for (let dx = 0; dx < factory.width; dx++) {
        if (mapGrid[y + dy] && mapGrid[y + dy][x + dx]) {
          mapGrid[y + dy][x + dx].building = factory
        }
      }
    }
  }

  return factory
}

/**
 * Creates a test building at specified position
 * @param {string} type - Building type
 * @param {number} x - X position in tiles
 * @param {number} y - Y position in tiles
 * @param {string} owner - Owner identifier (default: 'player')
 * @param {Array<Array<Object>>} mapGrid - The map grid to mark as occupied
 * @returns {Object} - The created building object
 */
export function createTestBuilding(type, x, y, owner = 'player', mapGrid = null) {
  const data = buildingData[type]
  if (!data) {
    throw new Error(`Unknown building type: ${type}`)
  }

  const building = {
    id: `${type}-${x}-${y}-${Date.now()}`,
    owner: owner,
    type: type,
    x: x,
    y: y,
    width: data.width,
    height: data.height,
    health: data.health,
    maxHealth: data.health,
    power: data.power || 0
  }

  // Mark tiles as occupied in map grid
  if (mapGrid) {
    for (let dy = 0; dy < building.height; dy++) {
      for (let dx = 0; dx < building.width; dx++) {
        if (mapGrid[y + dy] && mapGrid[y + dy][x + dx]) {
          mapGrid[y + dy][x + dx].building = building
        }
      }
    }
  }

  return building
}

/**
 * Test context for running integration tests with game loop
 */
export class TestGameContext {
  constructor(options = {}) {
    this.mapWidth = options.mapWidth || 50
    this.mapHeight = options.mapHeight || 50
    this.mapGrid = createTestMapGrid(this.mapWidth, this.mapHeight)
    this.units = []
    this.buildings = []
    this.factories = []
    this.bullets = []

    // Reset and configure game state
    resetGameState()
    gameState.mapGrid = this.mapGrid
    gameState.units = this.units
    gameState.buildings = this.buildings
    gameState.factories = this.factories
    gameState.mapTilesX = this.mapWidth
    gameState.mapTilesY = this.mapHeight

    this.tickCount = 0
    this.elapsedTime = 0
  }

  /**
   * Add a construction yard (factory) to the test context
   * @param {number} x - X position in tiles
   * @param {number} y - Y position in tiles
   * @param {string} owner - Owner identifier
   * @returns {Object} - The created factory
   */
  addFactory(x, y, owner = 'player') {
    const factory = createTestFactory(x, y, owner, this.mapGrid)
    this.factories.push(factory)
    this.buildings.push(factory)
    gameState.factories = this.factories
    gameState.buildings = this.buildings
    return factory
  }

  /**
   * Add a building to the test context
   * @param {string} type - Building type
   * @param {number} x - X position in tiles
   * @param {number} y - Y position in tiles
   * @param {string} owner - Owner identifier
   * @returns {Object} - The created building
   */
  addBuilding(type, x, y, owner = 'player') {
    const building = createTestBuilding(type, x, y, owner, this.mapGrid)
    this.buildings.push(building)
    gameState.buildings = this.buildings
    return building
  }

  /**
   * Check if a building can be placed at the specified position
   * @param {string} type - Building type
   * @param {number} x - X position in tiles
   * @param {number} y - Y position in tiles
   * @param {string} owner - Owner identifier
   * @returns {boolean} - Whether the building can be placed
   */
  canPlaceBuilding(type, x, y, owner = 'player') {
    return canPlaceBuilding(
      type,
      x,
      y,
      this.mapGrid,
      this.units,
      this.buildings,
      this.factories,
      owner
    )
  }

  /**
   * Check distance from a position to nearest building
   * @param {number} x - X position in tiles
   * @param {number} y - Y position in tiles
   * @param {string} owner - Owner identifier
   * @returns {boolean} - Whether position is near existing building
   */
  isNearBuilding(x, y, owner = 'player') {
    return isNearExistingBuilding(
      x,
      y,
      this.buildings,
      this.factories,
      MAX_BUILDING_GAP_TILES,
      owner
    )
  }

  /**
   * Run the game loop for a specified number of ticks
   * This simulates game progression without rendering
   * @param {number} ticks - Number of game ticks to run
   * @param {number} deltaMs - Milliseconds per tick (default: 16.67 for 60fps)
   * @param {Function} onTick - Optional callback called each tick
   */
  async runTicks(ticks, deltaMs = 16.67, onTick = null) {
    for (let i = 0; i < ticks; i++) {
      this.tickCount++
      this.elapsedTime += deltaMs
      gameState.gameTime = this.elapsedTime / 1000
      gameState.frameCount = this.tickCount

      if (onTick) {
        await onTick(this.tickCount, this.elapsedTime)
      }

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  /**
   * Clean up the test context
   */
  cleanup() {
    resetGameState()
    this.mapGrid = []
    this.units = []
    this.buildings = []
    this.factories = []
    this.bullets = []
  }
}

/**
 * Calculate the Chebyshev distance between two points
 * @param {number} x1 - First X coordinate
 * @param {number} y1 - First Y coordinate
 * @param {number} x2 - Second X coordinate
 * @param {number} y2 - Second Y coordinate
 * @returns {number} - The Chebyshev distance
 */
export function chebyshevDistance(x1, y1, x2, y2) {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
}

/**
 * Get the maximum building gap in tiles
 * @returns {number} - MAX_BUILDING_GAP_TILES constant
 */
export function getMaxBuildingGap() {
  return MAX_BUILDING_GAP_TILES
}

/**
 * Get building data for a specific type
 * @param {string} type - Building type
 * @returns {Object} - Building data
 */
export function getBuildingData(type) {
  return buildingData[type]
}
