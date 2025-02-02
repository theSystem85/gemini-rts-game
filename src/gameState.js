export const gameState = {
    money: 10000,
    gameTime: 0,
    wins: 0,
    losses: 0,
    gameStarted: false,
    gamePaused: false,
    scrollOffset: { x: 0, y: 0 },
    dragVelocity: { x: 0, y: 0 },
    // For input handling (these can be used by inputHandler as well)
    isRightDragging: false,
    lastDragPos: { x: 0, y: 0 },
    
    // For enemy production (we update this in logic.js)
    enemyLastProductionTime: performance.now()
  }
  