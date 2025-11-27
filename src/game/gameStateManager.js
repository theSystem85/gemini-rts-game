// Game State Management Module - Handles win/loss conditions, cleanup, and map scrolling
import {
  INERTIA_DECAY,
  INERTIA_STOP_THRESHOLD,
  TILE_SIZE,
  KEYBOARD_SCROLL_SPEED,
  ORE_SPREAD_INTERVAL,
  ORE_SPREAD_PROBABILITY,
  ORE_SPREAD_ENABLED,
  WIND_DIRECTION,
  WIND_STRENGTH
} from '../config.js'
import { resolveUnitCollisions, removeUnitOccupancy } from '../units.js'
import { explosions, triggerExplosion } from '../logic.js'
import { playSound, playPositionalSound, audioContext } from '../sound.js'
import { triggerDistortionEffect } from '../ui/distortionEffect.js'
import { clearFactoryFromMapGrid } from '../factories.js'
import { logPerformance } from '../performanceUtils.js'
import { registerUnitWreck, releaseWreckAssignment } from './unitWreckManager.js'
import { removeSmokeParticle } from '../utils/smokeUtils.js'
import {
  getPlayableViewportHeight,
  getPlayableViewportWidth
} from '../utils/layoutMetrics.js'
import { detonateTankerTruck } from './tankerTruckUtils.js'
import { detonateAmmunitionTruck } from './ammunitionTruckLogic.js'
import { distributeMineLayerPayload } from './mineSystem.js'

const MINIMAP_SCROLL_SMOOTHING = 0.2
const MINIMAP_SCROLL_STOP_DISTANCE = 0.75

/**
 * Updates map scrolling with inertia
 * @param {Object} gameState - Game state object
 * @param {Array} mapGrid - 2D array representing the map
 */
export function updateMapScrolling(gameState, mapGrid) {
  if (!Array.isArray(mapGrid) || mapGrid.length === 0 || !Array.isArray(mapGrid[0]) || mapGrid[0].length === 0) {
    return
  }

  const gameCanvas = typeof document !== 'undefined' ? document.getElementById('gameCanvas') : null
  const viewportWidth = getPlayableViewportWidth(gameCanvas)
  const viewportHeight = getPlayableViewportHeight(gameCanvas)
  const maxScrollX = Math.max(0, mapGrid[0].length * TILE_SIZE - viewportWidth)
  const maxScrollY = Math.max(0, mapGrid.length * TILE_SIZE - viewportHeight)

  const smoothState = gameState.smoothScroll
  const keyScrollActive = gameState.keyScroll.left || gameState.keyScroll.right ||
    gameState.keyScroll.up || gameState.keyScroll.down

  if (smoothState) {
    if (gameState.isRightDragging || keyScrollActive) {
      smoothState.active = false
    } else {
      smoothState.targetX = Math.max(0, Math.min(smoothState.targetX, maxScrollX))
      smoothState.targetY = Math.max(0, Math.min(smoothState.targetY, maxScrollY))
    }
  }

  if (!gameState.isRightDragging) {
    const smoothingActive = !!(smoothState && smoothState.active)
    if (!smoothingActive) {
      if (gameState.keyScroll.left) {
        gameState.dragVelocity.x = KEYBOARD_SCROLL_SPEED
      } else if (gameState.keyScroll.right) {
        gameState.dragVelocity.x = -KEYBOARD_SCROLL_SPEED
      } else {
        gameState.dragVelocity.x *= INERTIA_DECAY
        if (Math.abs(gameState.dragVelocity.x) < INERTIA_STOP_THRESHOLD) {
          gameState.dragVelocity.x = 0
        }
      }

      if (gameState.keyScroll.up) {
        gameState.dragVelocity.y = KEYBOARD_SCROLL_SPEED
      } else if (gameState.keyScroll.down) {
        gameState.dragVelocity.y = -KEYBOARD_SCROLL_SPEED
      } else {
        gameState.dragVelocity.y *= INERTIA_DECAY
        if (Math.abs(gameState.dragVelocity.y) < INERTIA_STOP_THRESHOLD) {
          gameState.dragVelocity.y = 0
        }
      }

      gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - gameState.dragVelocity.x, maxScrollX))
      gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - gameState.dragVelocity.y, maxScrollY))
    } else {
      gameState.dragVelocity.x *= INERTIA_DECAY
      if (Math.abs(gameState.dragVelocity.x) < INERTIA_STOP_THRESHOLD) {
        gameState.dragVelocity.x = 0
      }
      gameState.dragVelocity.y *= INERTIA_DECAY
      if (Math.abs(gameState.dragVelocity.y) < INERTIA_STOP_THRESHOLD) {
        gameState.dragVelocity.y = 0
      }
    }
  } else if (smoothState) {
    smoothState.active = false
  }

  if (!gameState.isRightDragging && smoothState && smoothState.active) {
    const dx = smoothState.targetX - gameState.scrollOffset.x
    const dy = smoothState.targetY - gameState.scrollOffset.y
    const distance = Math.hypot(dx, dy)

    if (distance <= MINIMAP_SCROLL_STOP_DISTANCE) {
      gameState.scrollOffset.x = smoothState.targetX
      gameState.scrollOffset.y = smoothState.targetY
      smoothState.active = false
    } else {
      gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x + dx * MINIMAP_SCROLL_SMOOTHING, maxScrollX))
      gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y + dy * MINIMAP_SCROLL_SMOOTHING, maxScrollY))
    }
  } else {
    gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x, maxScrollX))
    gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y, maxScrollY))
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
export function updateSmokeParticles(gameState) {
  const now = performance.now()

  for (let i = gameState.smokeParticles.length - 1; i >= 0; i--) {
    const p = gameState.smokeParticles[i]

    // Safety check: remove particles with invalid properties
    if (!p || typeof p.startTime !== 'number' || typeof p.duration !== 'number' || !p.size || p.size <= 0) {
      removeSmokeParticle(gameState, i)
      continue
    }

    const progress = (now - p.startTime) / p.duration
    if (progress >= 1) {
      removeSmokeParticle(gameState, i)
      continue
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
      p.alpha = Math.max(0, (1 - progress) * p.alpha)

      // Smoke expands as it rises (reduced expansion rate)
      if (!p.originalSize || p.originalSize <= 0) {
        p.originalSize = Math.max(0.1, p.size || 8) // Fallback to a minimum safe size
      }
      p.size = p.originalSize * (1 + progress * 0.3) // Reduced expansion to 30%
    }
  }
}

/**
 * Updates dust particle effects
 * @param {Object} gameState - Game state object
 */
export function updateDustParticles(gameState) {
  const now = performance.now()

  if (!gameState.dustParticles) return

  for (let i = gameState.dustParticles.length - 1; i >= 0; i--) {
    const p = gameState.dustParticles[i]

    if (!p || typeof p.startTime !== 'number' || typeof p.lifetime !== 'number') {
      gameState.dustParticles.splice(i, 1)
      continue
    }

    const progress = (now - p.startTime) / p.lifetime
    if (progress >= 1) {
      gameState.dustParticles.splice(i, 1)
      continue
    } else {
      // Update position
      p.x += p.velocity.x
      p.y += p.velocity.y

      // Fade out alpha
      p.alpha = 1 - progress
      
      // Expand size slightly
      p.currentSize = p.size * (1 + progress * 0.5)
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

      if (unit.type === 'ammunitionTruck') {
        detonateAmmunitionTruck(unit, units, gameState.factories || [], gameState)
      }

      if (unit.type === 'mineLayer') {
        distributeMineLayerPayload(unit, units, gameState.buildings)
      }

      // Register a wreck so the destroyed unit leaves recoverable remnants
      if (unit.type !== 'apache' && unit.type !== 'ammunitionTruck') {
        registerUnitWreck(unit, gameState)
      }

      if (unit.type === 'tankerTruck') {
        detonateTankerTruck(unit, units, gameState.factories || [], gameState)
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
      const maxDimension = Math.max(factory.width || 1, factory.height || 1)
      const explosionRadius = Math.max(TILE_SIZE * 2, maxDimension * TILE_SIZE * 1.2)

      gameState.explosions.push({
        x: explosionX,
        y: explosionY,
        startTime: performance.now(),
        duration: 1000,
        maxRadius: explosionRadius,
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
 * In multiplayer, defeated human players can continue as spectators
 * @param {Array} factories - Array of factory objects
 * @param {Object} gameState - Game state object
 * @returns {boolean} - True if game should end (for this player)
 */
export function checkGameEndConditions(factories, gameState) {
  if (gameState.gameOver) return true
  if (!gameState.buildings) return false

  const shouldCountBuilding = (building) => {
    if (!building || building.health <= 0) return false
    return building.type !== 'concreteWall'
  }

  // In multiplayer, check if the local player is already a spectator
  const isMultiplayer = gameState.multiplayerSession?.isRemote || 
    (gameState.partyStates && gameState.partyStates.some(p => !p.aiActive))

  // Count remaining buildings AND factories for human player (excluding concrete walls)
  const humanPlayerBuildings = gameState.buildings.filter(
    b => b.owner === gameState.humanPlayer && shouldCountBuilding(b)
  )
  const humanPlayerFactories = factories.filter(
    f => (f.id === gameState.humanPlayer || f.owner === gameState.humanPlayer) && shouldCountBuilding(f)
  )
  const totalHumanPlayerBuildings = humanPlayerBuildings.length + humanPlayerFactories.length

  // Check if human player has no buildings left
  if (totalHumanPlayerBuildings === 0 && !gameState.isSpectator) {
    // In multiplayer, show defeat modal but allow spectator mode
    // Don't set gameOver = true immediately in multiplayer - let the modal handle it
    if (isMultiplayer) {
      // Mark player as defeated but don't end the game globally
      gameState.localPlayerDefeated = true
      gameState.gameResult = 'defeat'
      gameState.gameOverMessage = 'DEFEAT - All your buildings have been destroyed!'
      gameState.losses++
      // Play battle lost sound and human player defeat sound
      playSound('battleLost', 1.0, 0, true)
      // Add to defeated players set
      if (!(gameState.defeatedPlayers instanceof Set)) {
        gameState.defeatedPlayers = new Set(gameState.defeatedPlayers || [])
      }
      gameState.defeatedPlayers.add(gameState.humanPlayer)
      return false // Don't end the game globally in multiplayer
    } else {
      // Single player - end the game
      gameState.gameOver = true
      gameState.gameResult = 'defeat'
      gameState.gameOverMessage = 'DEFEAT - All your buildings have been destroyed!'
      gameState.losses++
      // Play battle lost sound and human player defeat sound
      playSound('battleLost', 1.0, 0, true)
      return true
    }
  }

  // Count remaining players (including human players in multiplayer)
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  const otherPlayerIds = allPlayers.filter(p => p !== gameState.humanPlayer)

  let remainingOtherPlayers = 0
  const defeatedPlayers = []

  for (const playerId of otherPlayerIds) {
    const playerBuildings = gameState.buildings.filter(
      b => b.owner === playerId && shouldCountBuilding(b)
    )
    const playerFactories = factories.filter(
      f => (f.id === playerId || f.owner === playerId) && shouldCountBuilding(f)
    )
    const totalPlayerBuildings = playerBuildings.length + playerFactories.length

    if (totalPlayerBuildings > 0) {
      remainingOtherPlayers++
    } else {
      // Check if this player was just defeated (not already marked as defeated)
      if (!(gameState.defeatedPlayers instanceof Set)) {
        gameState.defeatedPlayers = new Set(gameState.defeatedPlayers || [])
      }
      if (!gameState.defeatedPlayers.has(playerId)) {
        defeatedPlayers.push(playerId)
        gameState.defeatedPlayers.add(playerId)
      }
    }
  }

  // Play defeat sounds for newly defeated players
  defeatedPlayers.forEach((playerId, index) => {
    setTimeout(() => {
      playSound(getPlayerDefeatSound(playerId), 1.0, 0, true)
    }, index * 500) // Stagger the defeat sounds by 500ms each
  })

  // Check if human player has eliminated all other players (and is not a spectator)
  if (remainingOtherPlayers === 0 && otherPlayerIds.length > 0 && !gameState.isSpectator) {
    gameState.gameOver = true
    gameState.gameResult = 'victory'
    gameState.gameOverMessage = 'VICTORY - All enemy buildings destroyed!'
    gameState.wins++
    // Play battle won sound
    playSound('battleWon', 0.8, 0, true)
    return true
  }

  // In spectator mode, check if the game should end for everyone
  if (gameState.isSpectator) {
    // Count all remaining players
    let totalRemainingPlayers = 0
    for (const playerId of allPlayers) {
      const playerBuildings = gameState.buildings.filter(
        b => b.owner === playerId && shouldCountBuilding(b)
      )
      const playerFactories = factories.filter(
        f => (f.id === playerId || f.owner === playerId) && shouldCountBuilding(f)
      )
      if (playerBuildings.length + playerFactories.length > 0) {
        totalRemainingPlayers++
      }
    }
    
    // If only one player remains, that player wins
    if (totalRemainingPlayers <= 1) {
      gameState.gameOver = true
      // Find the winner
      const winner = allPlayers.find(playerId => {
        const playerBuildings = gameState.buildings.filter(
          b => b.owner === playerId && shouldCountBuilding(b)
        )
        const playerFactories = factories.filter(
          f => (f.id === playerId || f.owner === playerId) && shouldCountBuilding(f)
        )
        return playerBuildings.length + playerFactories.length > 0
      })
      gameState.gameResult = 'spectator_end'
      gameState.gameOverMessage = winner 
        ? `GAME OVER - ${winner.replace('player', 'Player ')} wins!`
        : 'GAME OVER - No survivors!'
      return true
    }
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

  const gameCanvas = document.getElementById('gameCanvas')
  if (!gameCanvas) return
  const pixelRatio = window.devicePixelRatio || 1
  const logicalWidth = gameCanvas.width / pixelRatio
  const logicalHeight = gameCanvas.height / pixelRatio

  const maxScrollX = mapGrid[0].length * TILE_SIZE - logicalWidth
  const maxScrollY = mapGrid.length * TILE_SIZE - logicalHeight

  gameState.scrollOffset.x = Math.max(0, Math.min(followUnit.x - logicalWidth / 2, maxScrollX))
  gameState.scrollOffset.y = Math.max(0, Math.min(followUnit.y - logicalHeight / 2, maxScrollY))
  gameState.dragVelocity = { x: 0, y: 0 }
}
