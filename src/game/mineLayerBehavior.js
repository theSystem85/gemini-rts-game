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
            
            // Check if we need to auto-refill
            if (unit.remainingMines === 0 && unit.commandQueue && unit.commandQueue.length > 0) {
              // Still has commands but no mines - need to refill
              initiateAutoRefill(unit)
            }
          } else {
            // Failed to deploy (maybe already a mine there)
            unit.deployingMine = false
            unit.deployStartTime = null
          }
        } else {
          // Out of mines
          unit.deployingMine = false
          unit.deployStartTime = null
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
  if (unit.type !== 'mineLayer') return false
  if (unit.remainingMines <= 0) {
    initiateAutoRefill(unit)
    return false
  }

  unit.deployingMine = true
  unit.deployStartTime = now
  unit.deployTargetX = tileX
  unit.deployTargetY = tileY

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
 * Check if Mine Layer needs mine refill
 * @param {object} unit - Mine Layer unit
 * @returns {boolean} True if needs refill
 */
export function needsMineRefill(unit) {
  return unit.type === 'mineLayer' && unit.remainingMines === 0
}
