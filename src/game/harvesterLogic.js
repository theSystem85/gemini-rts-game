// harvesterLogic.js - Handles all harvester-specific logic
import { TILE_SIZE, HARVESTER_CAPPACITY } from '../config.js'
import { findPath, buildOccupancyMap } from '../units.js'
import { playSound } from '../sound.js'
import { productionQueue } from '../productionQueue.js'
import { 
  findClosestOre, 
  findAdjacentTile, 
  isAdjacentToBuilding, 
  showUnloadingFeedback 
} from '../logic.js'

// Track tiles currently being harvested
const harvestedTiles = new Set()
// Track which ore tiles are targeted by which harvesters
const targetedOreTiles = {}

/**
 * Updates all harvester logic including mining, unloading, and pathfinding
 */
export function updateHarvesterLogic(units, factories, mapGrid, gameState) {
  const now = performance.now()
  const occupancyMap = buildOccupancyMap(units, mapGrid)

  // Initialize refinery status if not exists
  if (!gameState.refineryStatus) {
    gameState.refineryStatus = {}
  }

  units.forEach(unit => {
    if (unit.type !== 'harvester') return

    const unitTileX = Math.floor(unit.x / TILE_SIZE)
    const unitTileY = Math.floor(unit.y / TILE_SIZE)

    // Mining ore logic
    if (unit.oreCarried < HARVESTER_CAPPACITY && !unit.harvesting && !unit.unloadingAtRefinery) {
      if (mapGrid[unitTileY][unitTileX].type === 'ore') {
        const tileKey = `${unitTileX},${unitTileY}`
        if (!harvestedTiles.has(tileKey)) {
          if (!unit.oreField) {
            unit.oreField = { x: unitTileX, y: unitTileY }
            // Register this tile as targeted by this unit
            targetedOreTiles[tileKey] = unit.id
          }
          if (unit.oreField.x === unitTileX && unit.oreField.y === unitTileY) {
            unit.harvesting = true
            unit.harvestTimer = now
            harvestedTiles.add(tileKey) // Mark tile as being harvested
            playSound('harvest')
          }
        } else {
          // Tile is being harvested by another unit, find a new ore tile
          if (unit.oreField) {
            // Remove the previous targeting
            const prevTileKey = `${unit.oreField.x},${unit.oreField.y}`
            if (targetedOreTiles[prevTileKey] === unit.id) {
              delete targetedOreTiles[prevTileKey]
            }
          }
          unit.oreField = null
        }
      }
    }

    // Complete harvesting
    if (unit.harvesting) {
      if (now - unit.harvestTimer > 10000) {
        unit.oreCarried++
        unit.harvesting = false
        const tileKey = `${unit.oreField.x},${unit.oreField.y}`
        harvestedTiles.delete(tileKey) // Free up the tile

        // Keep targeting this tile until it's depleted
        mapGrid[unit.oreField.y][unit.oreField.x].type = 'land'

        // Remove targeting once the tile is depleted
        delete targetedOreTiles[tileKey]
        unit.oreField = null
      }
    }

    // Handle unloading when full
    if (unit.oreCarried >= HARVESTER_CAPPACITY && !unit.unloadingAtRefinery) {
      handleHarvesterUnloading(unit, factories, mapGrid, gameState, now, occupancyMap)
    }

    // Handle unloading process at refinery
    if (unit.unloadingAtRefinery && unit.unloadStartTime) {
      completeUnloading(unit, factories, mapGrid, gameState, now, occupancyMap)
    }

    // Find new ore when idle
    if (unit.oreCarried === 0 && !unit.harvesting && !unit.unloadingAtRefinery &&
        (!unit.path || unit.path.length === 0)) {
      findNewOreTarget(unit, mapGrid, occupancyMap)
    }
  })

  // Store targeted tiles in gameState for access by other modules
  gameState.targetedOreTiles = targetedOreTiles
}

/**
 * Handles harvester unloading logic at refineries
 */
function handleHarvesterUnloading(unit, factories, mapGrid, gameState, now, occupancyMap) {
  // Clear targeting when full of ore and returning to base
  if (unit.oreField) {
    const tileKey = `${unit.oreField.x},${unit.oreField.y}`
    if (targetedOreTiles[tileKey] === unit.id) {
      delete targetedOreTiles[tileKey]
    }
    unit.oreField = null
  }

  // Find available refinery
  const refineries = gameState.buildings?.filter(b => 
    b.type === 'oreRefinery' && 
    b.owner === unit.owner && 
    b.health > 0
  ) || []

  if (refineries.length === 0) {
    // No refineries available - fallback to factory (backward compatibility)
    const targetFactory = factories.find(f => 
      (unit.owner === 'player' && f.id === 'player') ||
      (unit.owner === 'enemy' && f.id === 'enemy')
    )
    
    if (targetFactory && isAdjacentToBuilding(unit, targetFactory)) {
      // Unload at factory immediately
      if (unit.owner === 'player') {
        gameState.money += 1000
        if (typeof productionQueue !== 'undefined' && productionQueue?.tryResumeProduction) {
          productionQueue.tryResumeProduction()
        }
      } else {
        targetFactory.budget += 1000
      }
      unit.oreCarried = 0
      unit.oreField = null
      playSound('deposit')
      
      // Find next ore
      findNewOreTarget(unit, mapGrid, null)
    } else {
      // Move to factory
      const unloadTarget = findAdjacentTile(targetFactory, mapGrid)
      if (unloadTarget && (!unit.path || unit.path.length === 0)) {
        const path = findPath({ x: unit.tileX, y: unit.tileY }, unloadTarget, mapGrid, occupancyMap)
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
    }
    return
  }

  // Find best available refinery
  let targetRefinery = null
  let targetUnloadTile = null

  // Check for assigned refinery first
  if (unit.assignedRefinery) {
    const assignedRef = refineries.find(r => r.id === unit.assignedRefinery)
    if (assignedRef) {
      targetRefinery = assignedRef
      targetUnloadTile = findAdjacentTile(targetRefinery, mapGrid)
    }
  }

  // If no assigned refinery or it's not available, find any free refinery
  if (!targetRefinery) {
    for (const refinery of refineries) {
      const refineryId = refinery.id || `refinery_${refinery.x}_${refinery.y}`
      const unloadTile = findAdjacentTile(refinery, mapGrid)
      
      if (unloadTile) {
        // Check if refinery is free
        if (!gameState.refineryStatus[refineryId]) {
          targetRefinery = refinery
          targetUnloadTile = unloadTile
          break
        }
      }
    }
  }

  // If all refineries are in use, pick any refinery to queue at
  if (!targetRefinery && refineries.length > 0) {
    targetRefinery = refineries[0]
    targetUnloadTile = findAdjacentTile(targetRefinery, mapGrid)
  }

  if (targetRefinery && targetUnloadTile) {
    const refineryId = targetRefinery.id || `refinery_${targetRefinery.x}_${targetRefinery.y}`

    // Check if harvester is already adjacent to the refinery
    if (isAdjacentToBuilding(unit, targetRefinery)) {
      // If the refinery is free or this unit is already using it, start unloading
      if (!gameState.refineryStatus[refineryId] || gameState.refineryStatus[refineryId] === unit.id) {
        // Mark this refinery as in use by this harvester
        gameState.refineryStatus[refineryId] = unit.id

        // Start unloading process (takes 20 seconds)
        unit.unloadingAtRefinery = true
        unit.unloadStartTime = now
        unit.unloadRefinery = refineryId
        unit.path = [] // Clear path while unloading

        // Show visual feedback
        showUnloadingFeedback(unit, targetRefinery)
      }
      // If the refinery is being used by another harvester, wait nearby
    } else {
      // Move to the refinery if not already there
      if (!unit.path || unit.path.length === 0) {
        const path = findPath({ x: unit.tileX, y: unit.tileY }, targetUnloadTile, mapGrid, occupancyMap)
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
    }
  }
}

/**
 * Completes the unloading process at a refinery
 */
function completeUnloading(unit, factories, mapGrid, gameState, now, occupancyMap) {
  // Unloading takes 10 seconds
  if (now - unit.unloadStartTime >= 10000) {
    // Unloading complete
    if (unit.owner === 'player') {
      gameState.money += 1000
      if (typeof productionQueue !== 'undefined' && productionQueue?.tryResumeProduction) {
        productionQueue.tryResumeProduction()
      }
    } else if (unit.owner === 'enemy') {
      const enemyFactory = factories.find(f => f.id === 'enemy')
      if (enemyFactory) {
        enemyFactory.budget += 1000
      }
    }

    // Clear refinery usage
    if (unit.unloadRefinery) {
      delete gameState.refineryStatus[unit.unloadRefinery]
    }

    // Reset harvester state
    unit.oreCarried = 0
    unit.unloadingAtRefinery = false
    unit.unloadStartTime = null
    unit.unloadRefinery = null
    playSound('deposit')

    // Find next ore tile
    findNewOreTarget(unit, mapGrid, occupancyMap)
  }
}

/**
 * Finds a new ore target for the harvester
 */
function findNewOreTarget(unit, mapGrid, occupancyMap) {
  const orePos = findClosestOre(unit, mapGrid, targetedOreTiles, unit.assignedRefinery)
  if (orePos) {
    const tileKey = `${orePos.x},${orePos.y}`
    targetedOreTiles[tileKey] = unit.id

    const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap)
    if (path.length > 1) {
      unit.path = path.slice(1)
    }
  }
}

/**
 * Gets the current harvested tiles (for external access)
 */
export function getHarvestedTiles() {
  return harvestedTiles
}

/**
 * Gets the current targeted ore tiles (for external access)
 */
export function getTargetedOreTiles() {
  return targetedOreTiles
}
