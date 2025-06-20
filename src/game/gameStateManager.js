// Game State Management Module - Handles win/loss conditions, cleanup, and map scrolling
import { INERTIA_DECAY, TILE_SIZE, ORE_SPREAD_INTERVAL, ORE_SPREAD_PROBABILITY } from '../config.js'
import { resolveUnitCollisions } from '../units.js'
import { explosions } from '../logic.js'
import { playSound } from '../sound.js'

/**
 * Updates map scrolling with inertia
 * @param {Object} gameState - Game state object
 * @param {Array} mapGrid - 2D array representing the map
 */
export function updateMapScrolling(gameState, mapGrid) {
  if (!gameState.isRightDragging) {
    const maxScrollX = mapGrid[0].length * TILE_SIZE - (window.innerWidth - 250)
    const maxScrollY = mapGrid.length * TILE_SIZE - window.innerHeight
    gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - gameState.dragVelocity.x, maxScrollX))
    gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - gameState.dragVelocity.y, maxScrollY))
    gameState.dragVelocity.x *= INERTIA_DECAY
    gameState.dragVelocity.y *= INERTIA_DECAY
  }
}

/**
 * Updates ore spreading on the map
 * @param {Object} gameState - Game state object
 * @param {Array} mapGrid - 2D array representing the map
 */
export function updateOreSpread(gameState, mapGrid) {
  const now = performance.now()
  
  if (now - gameState.lastOreUpdate >= ORE_SPREAD_INTERVAL) {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ]
    
    for (let y = 0; y < mapGrid.length; y++) {
      for (let x = 0; x < mapGrid[0].length; x++) {
        if (mapGrid[y][x].ore) {
          directions.forEach(dir => {
            const nx = x + dir.x, ny = y + dir.y
            if (nx >= 0 && nx < mapGrid[0].length && ny >= 0 && ny < mapGrid.length) {
              // Only spread to land tiles that don't already have ore - prevent spreading to streets, water, or rock
              if (mapGrid[ny][nx].type === 'land' && !mapGrid[ny][nx].ore && Math.random() < ORE_SPREAD_PROBABILITY) {
                mapGrid[ny][nx].ore = true
              }
            }
          })
        }
      }
    }
    gameState.lastOreUpdate = now
  }
}

/**
 * Updates explosion effects
 * @param {Object} gameState - Game state object
 */
export function updateExplosions(gameState) {
  const now = performance.now()
  
  for (let i = explosions.length - 1; i >= 0; i--) {
    if (now - explosions[i].startTime > explosions[i].duration) {
      explosions.splice(i, 1)
    }
  }
  gameState.explosions = explosions
}

/**
 * Cleans up destroyed units from the game
 * @param {Array} units - Array of unit objects
 * @param {Object} gameState - Game state object
 */
export function cleanupDestroyedUnits(units, gameState) {
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i].health <= 0) {
      const unit = units[i]
      
      if (unit.owner === gameState.humanPlayer) {
        gameState.playerUnitsDestroyed++
      } else {
        gameState.enemyUnitsDestroyed++
        // Play enemy unit destroyed sound when an enemy unit is killed
        playSound('enemyUnitDestroyed', 1.0)
      }
      
      // Remove unit from cheat system tracking if it exists
      if (window.cheatSystem) {
        window.cheatSystem.removeUnitFromTracking(unit.id)
      }
      
      units.splice(i, 1)
    }
  }
}

/**
 * Resolves unit collisions to prevent units from overlapping
 * @param {Array} units - Array of unit objects
 * @param {Array} mapGrid - 2D array representing the map
 */
export function updateUnitCollisions(units, mapGrid) {
  resolveUnitCollisions(units, mapGrid)
}

/**
 * Checks for game win/loss conditions
 * @param {Array} factories - Array of factory objects
 * @param {Object} gameState - Game state object
 * @returns {boolean} - True if game should end
 */
export function checkGameEndConditions(factories, gameState) {
  if (!gameState.buildings) return false
  
  // Count remaining buildings for human player
  const humanPlayerBuildings = gameState.buildings.filter(b => b.owner === gameState.humanPlayer && b.health > 0)
  
  // Check if human player has no buildings left
  if (humanPlayerBuildings.length === 0) {
    gameState.gameOver = true
    gameState.gameResult = 'defeat'
    gameState.gameOverMessage = 'DEFEAT - All your buildings have been destroyed!'
    gameState.losses++
    return true
  }

  // Count remaining AI players (any player that isn't the human player)
  const aiPlayerIds = Object.keys(gameState.aiPlayerStates || {})
  let remainingAiPlayers = 0
  
  for (const aiPlayerId of aiPlayerIds) {
    const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId && b.health > 0)
    if (aiBuildings.length > 0) {
      remainingAiPlayers++
    }
  }
  
  // Check if human player has eliminated all AI players
  if (remainingAiPlayers === 0 && aiPlayerIds.length > 0) {
    gameState.gameOver = true
    gameState.gameResult = 'victory'
    gameState.gameOverMessage = 'VICTORY - All enemy buildings destroyed!'
    gameState.wins++
    return true
  }

  return false
}

/**
 * Updates game time
 * @param {Object} gameState - Game state object
 * @param {number} delta - Time delta in milliseconds
 */
export function updateGameTime(gameState, delta) {
  const scaledDelta = delta * gameState.speedMultiplier
  gameState.gameTime += scaledDelta / 1000
}

/**
 * Handles right-click deselection
 * @param {Object} gameState - Game state object
 * @param {Array} units - Array of unit objects
 */
export function handleRightClickDeselect(gameState, units) {
  if (gameState.rightClick && !gameState.isRightDragging) {
    units.forEach(unit => { unit.selected = false })
    gameState.rightClick = false // reset flag after processing
  }
}
