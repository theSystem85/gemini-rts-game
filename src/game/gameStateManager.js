// Game State Management Module - Handles win/loss conditions, cleanup, and map scrolling
import { INERTIA_DECAY, TILE_SIZE, KEYBOARD_SCROLL_SPEED, ORE_SPREAD_INTERVAL, ORE_SPREAD_PROBABILITY, ORE_SPREAD_ENABLED } from '../config.js'
import { resolveUnitCollisions, removeUnitOccupancy } from '../units.js'
import { explosions, triggerExplosion } from '../logic.js'
import { playSound, playPositionalSound, audioContext } from '../sound.js'
import { triggerDistortionEffect } from '../ui/distortionEffect.js'
import { clearFactoryFromMapGrid } from '../factories.js'
import { logPerformance } from '../performanceUtils.js'
import { registerUnitWreck, releaseWreckAssignment } from './unitWreckManager.js'
import { getVisibleCanvasDimensions } from '../utils/canvasUtils.js'

/**
 * Updates map scrolling with inertia
 * @param {Object} gameState - Game state object
 * @param {Array} mapGrid - 2D array representing the map
 */
export function updateMapScrolling(gameState, mapGrid) {
  if (!gameState.isRightDragging) {
    const visibleCanvas = getVisibleCanvasDimensions()
    const maxScrollX = mapGrid[0].length * TILE_SIZE - visibleCanvas.width
    const maxScrollY = mapGrid.length * TILE_SIZE - visibleCanvas.height
    // Update velocity based on arrow key input
    if (gameState.keyScroll.left) {
      gameState.dragVelocity.x = KEYBOARD_SCROLL_SPEED
    } else if (gameState.keyScroll.right) {
      gameState.dragVelocity.x = -KEYBOARD_SCROLL_SPEED
    } else {
      gameState.dragVelocity.x *= INERTIA_DECAY
    }

    if (gameState.keyScroll.up) {
      gameState.dragVelocity.y = KEYBOARD_SCROLL_SPEED
    } else if (gameState.keyScroll.down) {
      gameState.dragVelocity.y = -KEYBOARD_SCROLL_SPEED
    } else {
      gameState.dragVelocity.y *= INERTIA_DECAY
    }

    gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - gameState.dragVelocity.x, maxScrollX))
    gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - gameState.dragVelocity.y, maxScrollY))
  }
}

/**
 * Updates ore spreading on the map
 * @param {Object} gameState - Game state object
 * @param {Array} mapGrid - 2D array representing the map
 * @param {Array} factories - Array of factory objects
 */
export const updateOreSpread = logPerformance(function updateOreSpread(gameState, mapGrid, factories = []) {
  const now = performance.now()

  if (!ORE_SPREAD_ENABLED) {
    return
  }

  if (now - gameState.lastOreUpdate >= ORE_SPREAD_INTERVAL) {
    const occupancyMap = Array.isArray(gameState.occupancyMap) ? gameState.occupancyMap : null
    const buildings = Array.isArray(gameState.buildings) ? gameState.buildings : []
    const factoryList = Array.isArray(factories) ? factories : []

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ]

    for (let y = 0; y < mapGrid.length; y++) {
      for (let x = 0; x < mapGrid[0].length; x++) {
        if (mapGrid[y][x].ore || mapGrid[y][x].seedCrystal) {
          const spreadProb = (mapGrid[y][x].seedCrystal ? ORE_SPREAD_PROBABILITY * 2 : ORE_SPREAD_PROBABILITY)
          directions.forEach(dir => {
            const nx = x + dir.x, ny = y + dir.y
            if (nx >= 0 && nx < mapGrid[0].length && ny >= 0 && ny < mapGrid.length) {
              if ((occupancyMap?.[ny]?.[nx] || 0) > 0) {
                return
              }
              // Check if there's a building on this tile
              const hasBuilding = buildings.some(building => {
                const bx = building.x, by = building.y
                const bw = building.width || 1, bh = building.height || 1
                return nx >= bx && nx < bx + bw && ny >= by && ny < by + bh
              })

              // Check if there's a factory on this tile
              const hasFactory = factoryList.some(factory => {
                return nx >= factory.x && nx < factory.x + factory.width &&
                       ny >= factory.y && ny < factory.y + factory.height
              })

              // Only spread to land or street tiles that don't already have ore or seed crystals and don't have buildings or factories
              const tileType = mapGrid[ny][nx].type
              if ((tileType === 'land' || tileType === 'street') && !mapGrid[ny][nx].ore && !mapGrid[ny][nx].seedCrystal && !hasBuilding && !hasFactory && Math.random() < spreadProb) {
                mapGrid[ny][nx].ore = true
              }
            }
          })
        }
      }
    }
    gameState.lastOreUpdate = now
  }
}, false)

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
 * Updates smoke particle effects
 * @param {Object} gameState - Game state object
 */
import { WIND_DIRECTION, WIND_STRENGTH } from '../config.js'

/**
 * Updates smoke particle effects
 * @param {Object} gameState - Game state object
 */
export function updateSmokeParticles(gameState) {
  const now = performance.now()

  for (let i = gameState.smokeParticles.length - 1; i >= 0; i--) {
    const p = gameState.smokeParticles[i]

    // Safety check: remove particles with invalid properties
    if (!p || typeof p.startTime !== 'number' || typeof p.duration !== 'number' || !p.size || p.size <= 0) {
      gameState.smokeParticles.splice(i, 1)
      continue
    }

    const progress = (now - p.startTime) / p.duration
    if (progress >= 1) {
      gameState.smokeParticles.splice(i, 1)
    } else {
      // Update position with wind effect
      p.x += p.vx + WIND_DIRECTION.x * WIND_STRENGTH
      p.y += p.vy + WIND_DIRECTION.y * WIND_STRENGTH

      // Gradually slow down vertical movement (simulate air resistance)
      p.vy *= 0.997

      // Apply wind drift more gradually over time
      p.vx += WIND_DIRECTION.x * WIND_STRENGTH * 0.5
      p.vy += WIND_DIRECTION.y * WIND_STRENGTH * 0.5

      // Add slight turbulence for realism (reduced)
      p.vx += (Math.random() - 0.5) * 0.003
      p.vy += (Math.random() - 0.5) * 0.003

      // Fade out alpha and expand size over time (reduced expansion)
      p.alpha = (1 - progress) * p.alpha

      // Smoke expands as it rises (reduced expansion rate)
      if (!p.originalSize || p.originalSize <= 0) {
        p.originalSize = Math.max(0.1, p.size || 8) // Fallback to a minimum safe size
      }
      p.size = p.originalSize * (1 + progress * 0.3) // Reduced expansion to 30%
    }
  }
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

      // Release any wreck assignments if a recovery tank is destroyed
      if (unit.type === 'recoveryTank' && Array.isArray(gameState.unitWrecks)) {
        gameState.unitWrecks.forEach(wreck => {
          if (!wreck) return
          if (wreck.assignedTankId === unit.id || wreck.towedBy === unit.id) {
            releaseWreckAssignment(wreck)
          }
        })
      }

      // Register a wreck so the destroyed unit leaves recoverable remnants
      registerUnitWreck(unit, gameState)

      // Special explosion logic for tanker trucks based on remaining supply gas
      if (unit.type === 'tankerTruck') {
        const fillRatio = Math.max(0, Math.min(1, (unit.supplyGas || 0) / (unit.maxSupplyGas || 1)))
        const radius = TILE_SIZE * 3 * fillRatio
        const explosionX = unit.x + TILE_SIZE / 2
        const explosionY = unit.y + TILE_SIZE / 2
        if (radius > 0) {
          triggerExplosion(
            explosionX,
            explosionY,
            95,
            units,
            gameState.factories || [],
            null,
            performance.now(),
            undefined,
            radius,
            true
          )
          triggerDistortionEffect(explosionX, explosionY, radius, gameState)
        }
      }

      if (unit.owner === gameState.humanPlayer) {
        gameState.playerUnitsDestroyed++
      } else {
        gameState.enemyUnitsDestroyed++
        // Play enemy unit destroyed sound when an enemy unit is killed
        playSound('enemyUnitDestroyed', 1.0, 0, true)
      }

      // Remove unit from cheat system tracking if it exists
      if (window.cheatSystem) {
        window.cheatSystem.removeUnitFromTracking(unit.id)
      }

      if (!unit.occupancyRemoved) {
        removeUnitOccupancy(unit, gameState.occupancyMap)
      }

      if (unit.engineSound) {
        try {
          unit.engineSound.gainNode.gain.cancelScheduledValues(audioContext.currentTime)
          unit.engineSound.source.stop()
        } catch (e) {
          console.error('Error stopping engine sound:', e)
        }
        unit.engineSound = null
      }
      // Mark unit as destroyed so any pending async tasks can clean up
      unit.destroyed = true
      units.splice(i, 1)
    }
  }
}

/**
 * Cleans up destroyed factories from the game
 * @param {Array} factories - Array of factory objects
 * @param {Array} mapGrid - 2D array representing the map
 * @param {Object} gameState - Game state object
 */
export function cleanupDestroyedFactories(factories, mapGrid, gameState) {
  for (let i = factories.length - 1; i >= 0; i--) {
    const factory = factories[i]

    if (factory.destroyed || factory.health <= 0) {
      // Clear the factory from the map grid to unblock tiles for pathfinding
      clearFactoryFromMapGrid(factory, mapGrid)

      // Remove the factory from the factories array
      factories.splice(i, 1)

      // Trigger UI refresh for production buttons
      if (gameState) gameState.pendingButtonUpdate = true

      // Calculate explosion position for both sound and visual effects
      const explosionX = (factory.x + factory.width / 2) * TILE_SIZE
      const explosionY = (factory.y + factory.height / 2) * TILE_SIZE

      // Update statistics
      if (factory.id === gameState.humanPlayer || factory.owner === gameState.humanPlayer) {
        gameState.playerBuildingsDestroyed++
      } else {
        gameState.enemyBuildingsDestroyed++
        // Play enemy building destroyed sound when an enemy factory is destroyed
        playSound('enemyBuildingDestroyed', 1.0, 0, true)
      }

      // Play explosion sound with reduced volume (0.5)
      playPositionalSound('explosion', explosionX, explosionY, 0.5)

      // Add explosion effect at factory center
      gameState.explosions.push({
        x: explosionX,
        y: explosionY,
        startTime: performance.now(),
        duration: 1000,
        color: '#ff4444'
      })
    }
  }
}

/**
 * Resolves unit collisions to prevent units from overlapping
 * @param {Array} units - Array of unit objects
 * @param {Array} mapGrid - 2D array representing the map
 */
export const updateUnitCollisions = logPerformance(function updateUnitCollisions(units, mapGrid) {
  resolveUnitCollisions(units, mapGrid)
}, false)

/**
 * Gets the defeat sound for a specific player based on their color
 * @param {string} playerId - The player ID (player1, player2, etc.)
 * @returns {string} - The sound event name for player defeat
 */
function getPlayerDefeatSound(playerId) {
  const playerColorMap = {
    'player1': 'playerGreenDefeated',  // Green
    'player2': 'playerRedDefeated',    // Red
    'player3': 'playerBlueDefeated',   // Blue
    'player4': 'playerYellowDefeated'  // Yellow
  }
  return playerColorMap[playerId] || 'playerRedDefeated' // Default to red
}

/**
 * Checks for game win/loss conditions
 * @param {Array} factories - Array of factory objects
 * @param {Object} gameState - Game state object
 * @returns {boolean} - True if game should end
 */
export function checkGameEndConditions(factories, gameState) {
  if (gameState.gameOver) return true
  if (!gameState.buildings) return false

  // Count remaining buildings AND factories for human player
  const humanPlayerBuildings = gameState.buildings.filter(b => b.owner === gameState.humanPlayer && b.health > 0)
  const humanPlayerFactories = factories.filter(f => (f.id === gameState.humanPlayer || f.owner === gameState.humanPlayer) && f.health > 0)
  const totalHumanPlayerBuildings = humanPlayerBuildings.length + humanPlayerFactories.length

  // Check if human player has no buildings left
  if (totalHumanPlayerBuildings === 0) {
    gameState.gameOver = true
    gameState.gameResult = 'defeat'
    gameState.gameOverMessage = 'DEFEAT - All your buildings have been destroyed!'
    gameState.losses++
    // Play battle lost sound and human player defeat sound
    playSound('battleLost', 1.0, 0, true)
    return true
  }

  // Count remaining AI players (any player that isn't the human player)
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  const aiPlayerIds = allPlayers.filter(p => p !== gameState.humanPlayer)

  let remainingAiPlayers = 0
  const defeatedAiPlayers = []

  for (const aiPlayerId of aiPlayerIds) {
    const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId && b.health > 0)
    const aiFactories = factories.filter(f => (f.id === aiPlayerId || f.owner === aiPlayerId) && f.health > 0)
    const totalAiBuildings = aiBuildings.length + aiFactories.length

    if (totalAiBuildings > 0) {
      remainingAiPlayers++
    } else {
      // Check if this AI player was just defeated (not already marked as defeated)
      if (!(gameState.defeatedPlayers instanceof Set)) {
        gameState.defeatedPlayers = new Set(gameState.defeatedPlayers || [])
      }
      if (!gameState.defeatedPlayers.has(aiPlayerId)) {
        defeatedAiPlayers.push(aiPlayerId)
        gameState.defeatedPlayers.add(aiPlayerId)
      }
    }
  }

  // Play defeat sounds for newly defeated AI players
  defeatedAiPlayers.forEach((playerId, index) => {
    setTimeout(() => {
      playSound(getPlayerDefeatSound(playerId), 1.0, 0, true)
    }, index * 500) // Stagger the defeat sounds by 500ms each
  })

  // Check if human player has eliminated all AI players
  if (remainingAiPlayers === 0 && aiPlayerIds.length > 0) {
    gameState.gameOver = true
    gameState.gameResult = 'victory'
    gameState.gameOverMessage = 'VICTORY - All enemy buildings destroyed!'
    gameState.wins++
    // Play battle won sound
    playSound('battleWon', 0.8, 0, true)
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

/**
 * Keeps the camera centered on a followed unit if set.
 * Automatically clears follow mode when the unit is deselected or destroyed.
 * @param {Object} gameState - Game state object
 * @param {Array} units - Array of unit objects
 * @param {Array} mapGrid - 2D array representing the map
 */
export function updateCameraFollow(gameState, units, mapGrid) {
  if (!gameState.cameraFollowUnitId) return

  const followUnit = units.find(u => u.id === gameState.cameraFollowUnitId)
  if (!followUnit || !followUnit.selected) {
    gameState.cameraFollowUnitId = null
    return
  }

  const visibleCanvas = getVisibleCanvasDimensions()

  const maxScrollX = mapGrid[0].length * TILE_SIZE - visibleCanvas.width
  const maxScrollY = mapGrid.length * TILE_SIZE - visibleCanvas.height

  gameState.scrollOffset.x = Math.max(0, Math.min(followUnit.x - visibleCanvas.width / 2, maxScrollX))
  gameState.scrollOffset.y = Math.max(0, Math.min(followUnit.y - visibleCanvas.height / 2, maxScrollY))
  gameState.dragVelocity = { x: 0, y: 0 }
}
