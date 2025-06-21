// gameState.js
export const gameState = {
  money: 10000,
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
  isRightDragging: false,
  lastDragPos: { x: 0, y: 0 },
  enemyLastProductionTime: performance.now(),
  lastOreUpdate: performance.now(),
  explosions: [],  // Initialized empty explosions array for visual effects.
  speedMultiplier: 1.0,  // Set to 1.0 as requested
  // Building related properties
  buildings: [],
  factories: [], // Add factories array to gameState
  mapGrid: [], // Add mapGrid array to gameState
  powerSupply: 0,
  buildingPlacementMode: false,
  currentBuildingType: null,
  cursorX: 0,
  cursorY: 0,

  // Repair mode
  repairMode: false,

  // Enemy AI learning
  playerBuildHistory: null,  // Will be initialized from localStorage if available
  currentSessionId: null,    // Will be set when first building is placed
  enemyLastBuildingTime: 0,  // Track when enemy last built something

  // Radar station status - initialize to false (no radar at game start)
  radarActive: false,

  // Grid visibility toggle - initialize to false (grid hidden by default)
  gridVisible: false,

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

  // Multiplayer settings
  playerCount: 2,  // Number of players (2-4)
  humanPlayer: 'player1',  // Which player is controlled by human
  
  // Track defeated players for sound effects
  defeatedPlayers: new Set()
}
