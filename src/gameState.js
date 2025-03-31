// gameState.js
export const gameState = {
  money: 10000,
  gameTime: 0,
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
  speedMultiplier: 0.25,  // Changed from 1.0 to 0.5
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
  
  // Aim-ahead function (AAF) calibration factor
  aimAheadCalibrationFactor: 1.0,
  
  // Radar station status - initialize to false (no radar at game start)
  radarActive: false
}
