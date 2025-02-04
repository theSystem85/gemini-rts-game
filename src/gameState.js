// gameState.js
export const gameState = {
  money: 10000,
  gameTime: 0,
  wins: 0,
  losses: 0,
  gameStarted: false,
  gamePaused: false,
  scrollOffset: { x: 0, y: 0 },
  dragVelocity: { x: 0, y: 0 },
  isRightDragging: false,
  lastDragPos: { x: 0, y: 0 },
  enemyLastProductionTime: performance.now(),
  lastOreUpdate: performance.now() // for ore spreading logic
};
