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

  // Index for round-robin vehicle spawning
  nextVehicleFactoryIndex: 0,

  // Refinery state tracking
  refineryStatus: {} // Tracks which refineries are being used and by which harvester
}
