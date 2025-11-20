// mineLayerBehavior.js - Mine Layer unit behaviors
import { TILE_SIZE, MINE_DEPLOY_STOP_TIME, UNIT_PROPERTIES } from '../config.js'
import { gameState } from '../gameState.js'
import { deployMine } from './mineSystem.js'

/**
 * Update Mine Layer behaviors - deployment mode, speed modulation, auto-refill
 * @param {Array} units - All game units
 * @param {number} now - Current timestamp
 */
export function updateMineLayerBehavior(units, now) {
  units.forEach(unit => {
    if (unit.type !== 'mineLayer') return

    // Check if unit is in deployment mode (has mine deployment commands queued)
    const isDeploying = unit.deployingMine || (unit.commandQueue && unit.commandQueue.some(cmd => cmd.type === 'deployMine'))

    // Update speed based on deployment mode
    if (isDeploying && unit.speed !== UNIT_PROPERTIES.mineLayer.deploySpeed) {
      unit.speed = UNIT_PROPERTIES.mineLayer.deploySpeed
    } else if (!isDeploying && unit.speed !== UNIT_PROPERTIES.mineLayer.speed) {
      unit.speed = UNIT_PROPERTIES.mineLayer.speed
    }

    // Handle active mine deployment
    if (unit.deployingMine) {
      const elapsedTime = now - unit.deployStartTime

      if (elapsedTime >= MINE_DEPLOY_STOP_TIME) {
        // Deployment time complete - deploy the mine
        const tileCenterX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
        const tileCenterY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

        if (unit.remainingMines > 0) {
          const mine = deployMine(tileCenterX, tileCenterY, unit.owner)
          if (mine) {
            unit.remainingMines--
            unit.deployingMine = false
            unit.deployStartTime = null
            unit.deploymentCompleted = true // Mark deployment as completed

            // Move away from the mined tile to avoid triggering the mine
            moveAwayFromMinedTile(unit, tileCenterX, tileCenterY)

            // Check if we need to auto-refill
            if (unit.remainingMines === 0 && unit.commandQueue && unit.commandQueue.length > 0) {
              // Still has commands but no mines - need to refill
              initiateAutoRefill(unit)
            }
          } else {
            unit.deployingMine = false
            unit.deployStartTime = null
            unit.deploymentCompleted = true // Mark as completed even on failure
          }
        } else {
          // Out of mines
          unit.deployingMine = false
          unit.deployStartTime = null
          unit.deploymentCompleted = true // Mark as completed
          initiateAutoRefill(unit)
        }
      }
    }
  })
}

/**
 * Start mine deployment process for a Mine Layer
 * @param {object} unit - Mine Layer unit
 * @param {number} tileX - Target tile X
 * @param {number} tileY - Target tile Y
 * @param {number} now - Current timestamp
 * @returns {boolean} True if deployment started
 */
export function startMineDeployment(unit, tileX, tileY, now) {
  if (unit.type !== 'mineLayer') {
    return false
  }
  if (unit.remainingMines <= 0) {
    initiateAutoRefill(unit)
    return false
  }

  unit.deployingMine = true
  unit.deployStartTime = now
  unit.deployTargetX = tileX
  unit.deployTargetY = tileY
  unit.deploymentCompleted = false // Reset completion flag

  // Stop unit movement during deployment
  unit.path = []
  unit.moveTarget = null

  return true
}

/**
 * Initiate auto-refill behavior for Mine Layer
 * @param {object} unit - Mine Layer unit
 */
function initiateAutoRefill(unit) {
  // Find nearest ammo source (ammunition truck or ammunition factory)
  const ammoSources = []

  // Add ammunition factories
  if (gameState.buildings) {
    gameState.buildings.forEach(building => {
      if (building.type === 'ammunitionFactory' && building.owner === unit.owner && building.health > 0) {
        ammoSources.push({
          type: 'building',
          x: building.x,
          y: building.y,
          width: building.width,
          height: building.height,
          building
        })
      }
    })
  }

  // Add ammunition trucks
  if (gameState.units) {
    gameState.units.forEach(otherUnit => {
      if (otherUnit.type === 'ammunitionTruck' && otherUnit.owner === unit.owner && otherUnit.health > 0) {
        if (otherUnit.ammoCargo && otherUnit.ammoCargo > 0) {
          ammoSources.push({
            type: 'unit',
            x: Math.floor(otherUnit.x / TILE_SIZE),
            y: Math.floor(otherUnit.y / TILE_SIZE),
            unit: otherUnit
          })
        }
      }
    })
  }

  if (ammoSources.length === 0) {
    // No ammo source available
    return
  }

  // Find closest ammo source
  const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

  let closestSource = null
  let closestDistance = Infinity

  ammoSources.forEach(source => {
    const sourceCenterX = source.type === 'building'
      ? source.x + Math.floor(source.width / 2)
      : source.x
    const sourceCenterY = source.type === 'building'
      ? source.y + Math.floor(source.height / 2)
      : source.y

    const distance = Math.hypot(sourceCenterX - unitTileX, sourceCenterY - unitTileY)
    if (distance < closestDistance) {
      closestDistance = distance
      closestSource = source
    }
  })

  if (closestSource) {
    // Set moveTarget to ammo source
    const targetX = closestSource.type === 'building'
      ? closestSource.x + Math.floor(closestSource.width / 2)
      : closestSource.x
    const targetY = closestSource.type === 'building'
      ? closestSource.y + Math.floor(closestSource.height / 2)
      : closestSource.y

    unit.moveTarget = { x: targetX, y: targetY }
    unit.refillTarget = closestSource
  }
}

/**
 * Move Mine Layer away from a newly mined tile to avoid triggering it
 * @param {object} unit - Mine Layer unit
 * @param {number} minedTileX - X coordinate of the mined tile
 * @param {number} minedTileY - Y coordinate of the mined tile
 */
function moveAwayFromMinedTile(unit, minedTileX, minedTileY) {
  // Find adjacent tiles (up to 1 tile away in any direction)
  const adjacentOffsets = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 },                     { x: 1, y: 0 },
    { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 }
  ]

  // Shuffle the offsets to randomize direction preference
  const shuffledOffsets = [...adjacentOffsets].sort(() => Math.random() - 0.5)

  for (const offset of shuffledOffsets) {
    const targetTileX = minedTileX + offset.x
    const targetTileY = minedTileY + offset.y

    // Check if this tile is safe (no mines, within map bounds, not blocked)
    const isSafe = isTileSafeForMineLayer(targetTileX, targetTileY)

    if (isSafe) {
      // Move to this safe tile
      const worldX = targetTileX * TILE_SIZE + TILE_SIZE / 2
      const worldY = targetTileY * TILE_SIZE + TILE_SIZE / 2

      unit.moveTarget = { x: targetTileX, y: targetTileY }
      unit.path = [] // Clear any existing path

      // Calculate simple path to the target
      const currentTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
      const currentTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

      if (currentTileX !== targetTileX || currentTileY !== targetTileY) {
        unit.path = [{ x: targetTileX, y: targetTileY }]
      }

      break // Found a safe tile, stop looking
    }
  }
}

/**
 * Check if a tile is safe for Mine Layer movement (no mines, within bounds, not blocked)
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {boolean} True if tile is safe
 */
function isTileSafeForMineLayer(tileX, tileY) {
  // Check map bounds
  if (tileX < 0 || tileY < 0 || tileX >= gameState.mapTilesX || tileY >= gameState.mapTilesY) {
    return false
  }

  // Check for existing mines
  if (gameState.mines) {
    const hasMine = gameState.mines.some(mine =>
      mine.x === tileX && mine.y === tileY && mine.active
    )
    if (hasMine) {
      return false
    }
  }

  // Check map grid for blocking terrain
  if (gameState.mapGrid && gameState.mapGrid[tileY] && gameState.mapGrid[tileY][tileX]) {
    const tile = gameState.mapGrid[tileY][tileX]
    if (typeof tile === 'number') {
      if (tile === 1) return false // Rock
    } else {
      if (tile.type === 'water' || tile.type === 'rock' || tile.seedCrystal) {
        return false
      }
    }
  }

  // Check for buildings
  if (gameState.buildings) {
    const hasBuilding = gameState.buildings.some(building =>
      building.health > 0 &&
      tileX >= building.x &&
      tileX < building.x + building.width &&
      tileY >= building.y &&
      tileY < building.y + building.height
    )
    if (hasBuilding) {
      return false
    }
  }

  return true
}
