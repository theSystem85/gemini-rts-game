// gameState.js
import { DEFAULT_MAP_TILES_X, DEFAULT_MAP_TILES_Y } from './config.js'

export const gameState = {
  money: 12000,
  gameTime: 0,
  frameCount: 0, // Add frame counter for milestone checking
  wins: 0,
  losses: 0,
  gameStarted: false,
  gamePaused: true, // Changed from false to true to start paused
  gameOver: false,
  gameOverMessage: null,
  gameResult: null, // 'victory' or 'defeat'

  // Statistics tracking for game over screen
  playerUnitsDestroyed: 0,
  enemyUnitsDestroyed: 0,
  playerBuildingsDestroyed: 0,
  enemyBuildingsDestroyed: 0,
  totalMoneyEarned: 0,
  scrollOffset: { x: 0, y: 0 },
  dragVelocity: { x: 0, y: 0 },
  mapTilesX: DEFAULT_MAP_TILES_X,
  mapTilesY: DEFAULT_MAP_TILES_Y,
  // Arrow key scrolling state
  keyScroll: { up: false, down: false, left: false, right: false },
  // ID of the unit the camera should follow when auto-focus is enabled
  cameraFollowUnitId: null,
  isRightDragging: false,
  lastDragPos: { x: 0, y: 0 },
  enemyLastProductionTime: performance.now(),
  lastOreUpdate: performance.now(),
  explosions: [],  // Initialized empty explosions array for visual effects.
  smokeParticles: [], // Smoke particles emitted by damaged units
  unitWrecks: [], // Destroyed unit remnants that can be recovered or recycled
  selectedWreckId: null, // Currently selected wreck (for UI feedback)
  speedMultiplier: 1.0,  // Set to 1.0 as requested
  // Building related properties
  buildings: [],
  factories: [], // Add factories array to gameState
  mapGrid: [], // Add mapGrid array to gameState
  occupancyMap: [], // Global occupancy map updated incrementally
  powerSupply: 0,
  // Separate power tracking for each side
  playerPowerSupply: 0,
  playerTotalPowerProduction: 0,
  playerPowerConsumption: 0,
  enemyPowerSupply: 0,
  enemyTotalPowerProduction: 0,
  enemyPowerConsumption: 0,
  // Build speed modifiers start at normal speed
  playerBuildSpeedModifier: 1.0,
  enemyBuildSpeedModifier: 1.0,
  buildingPlacementMode: false,
  currentBuildingType: null,
  cursorX: 0,
  cursorY: 0,
  draggedBuildingType: null,
  draggedBuildingButton: null,
  // Drag and drop rally point for units
  draggedUnitType: null,
  draggedUnitButton: null,
  blueprints: [],
  // Chain build mode state
  chainBuildPrimed: false,
  chainBuildMode: false,
  chainStartX: 0,
  chainStartY: 0,
  chainBuildingType: null,
  chainBuildingButton: null,
  shiftKeyDown: false,
  // Track option/alt key state for path planning
  altKeyDown: false,

  // Remote control key states for tanks
  remoteControl: {
    forward: false,
    backward: false,
    turnLeft: false,
    turnRight: false,
    turretLeft: false,
    turretRight: false,
    fire: false
  },

  // Repair mode
  repairMode: false,
  buildingsUnderRepair: [],

  // Enemy AI learning
  playerBuildHistory: null,  // Will be initialized from localStorage if available
  currentSessionId: null,    // Will be set when first building is placed
  enemyLastBuildingTime: 0,  // Track when enemy last built something

  // Radar station status - initialize to false (no radar at game start)
  radarActive: false,

  // Shadow of war visibility state
  shadowOfWarEnabled: true,
  visibilityMap: [],

  // Grid visibility toggle - initialize to false (grid hidden by default)
  gridVisible: false,

  // Occupancy map visibility toggle
  occupancyVisible: false,

  // Performance dialog visibility toggle
  performanceVisible: false,

  dangerZoneMaps: {},
  dzmOverlayIndex: -1,

  // FPS display toggle and tracking
  fpsVisible: false,
  fpsCounter: {
    frameCount: 0,
    lastTime: 0,
    fps: 0,
    frameTimes: [],  // Store last 60 frame times for smooth averaging
    avgFrameTime: 0,
    minFrameTime: 0,
    maxFrameTime: 0
  },

  // Tank image rendering toggle - initialize from config
  useTankImages: true,

  // Turret image rendering toggle - initialize from config
  useTurretImages: true,

  // Cheat dialog state
  cheatDialogOpen: false,

  // Index for round-robin vehicle spawning
  nextVehicleFactoryIndex: 0,

  // Refinery state tracking
  refineryStatus: {}, // Tracks which refineries are being used and by which harvester

  // Attack Group Feature (AGF) state
  attackGroupMode: false,
  attackGroupStart: { x: 0, y: 0 },
  attackGroupEnd: { x: 0, y: 0 },
  attackGroupTargets: [], // Array of enemy units to be attacked
  disableAGFRendering: false, // Flag to temporarily disable AGF rendering

  // Shared AI attack point updated periodically
  globalAttackPoint: null,
  lastGlobalAttackDecision: 0,

  // Multiplayer settings
  playerCount: 2,  // Number of players (2-4)
  humanPlayer: 'player1',  // Which player is controlled by human

  // Track defeated players for sound effects
  defeatedPlayers: new Set(),

  // Initially no units are available (require vehicle factory), only basic buildings
  availableUnitTypes: new Set([]),
  availableBuildingTypes: new Set(['constructionYard', 'oreRefinery', 'powerPlant', 'vehicleFactory', 'vehicleWorkshop', 'radarStation', 'hospital', 'gasStation', 'turretGunV1', 'concreteWall']),
  newUnitTypes: new Set(),
  newBuildingTypes: new Set(),

  // Flag to refresh production buttons after building destruction
  pendingButtonUpdate: false,

  // Store current map seed so map generation stays consistent across restarts
  mapSeed: '1'
}
