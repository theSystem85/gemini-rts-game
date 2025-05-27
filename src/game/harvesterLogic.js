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
// Track refinery queues
const refineryQueues = {}

/**
 * Updates all harvester logic including mining, unloading, and pathfinding
 */
export function updateHarvesterLogic(units, mapGrid, occupancyMap, gameState, factories, now) {
  // now parameter is passed from the main game loop
  
  // Initialize refinery status if not exists
  if (!gameState.refineryStatus) {
    gameState.refineryStatus = {}
  }

  // Clean up invalid queue entries and reassign harvesters from destroyed refineries
  cleanupQueues(units)
  
  // Only check for destroyed refineries periodically or when buildings change
  if (!gameState.lastRefineryCheck || now - gameState.lastRefineryCheck > 1000) {
    cleanupDestroyedRefineries(units, gameState)
    gameState.lastRefineryCheck = now
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

        // Only deplete the tile after multiple harvests (simulate limited ore)
        if (!mapGrid[unit.oreField.y][unit.oreField.x].harvests) {
          mapGrid[unit.oreField.y][unit.oreField.x].harvests = 0
        }
        mapGrid[unit.oreField.y][unit.oreField.x].harvests++
        
        // Deplete ore tile after 3-5 harvests
        if (mapGrid[unit.oreField.y][unit.oreField.x].harvests >= 3) {
          mapGrid[unit.oreField.y][unit.oreField.x].type = 'land'
          // Remove targeting once the tile is depleted
          delete targetedOreTiles[tileKey]
          unit.oreField = null
        }
      }
    }

    // Handle unloading when at capacity
    if (unit.oreCarried >= HARVESTER_CAPPACITY && !unit.unloadingAtRefinery && !unit.harvesting) {
      handleHarvesterUnloading(unit, factories, mapGrid, gameState, now, occupancyMap)
    }

    // Handle unloading process at refinery
    if (unit.unloadingAtRefinery && unit.unloadStartTime) {
      completeUnloading(unit, factories, mapGrid, gameState, now, occupancyMap)
    }

    // Find new ore when idle and not carrying ore
    if (unit.oreCarried === 0 && !unit.harvesting && !unit.unloadingAtRefinery &&
        (!unit.path || unit.path.length === 0) && !unit.oreField) {
      findNewOreTarget(unit, mapGrid, occupancyMap)
    }

    // Handle scheduled ore search after unloading
    if (unit.findOreAfterUnload && now >= unit.findOreAfterUnload) {
      unit.findOreAfterUnload = null
      if (unit.health > 0 && unit.oreCarried === 0) {
        findNewOreTarget(unit, mapGrid, occupancyMap)
      }
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
      // Calculate money based on ore carried
      const moneyEarned = unit.oreCarried * 1000
      
      // Unload at factory immediately
      if (unit.owner === 'player') {
        gameState.money += moneyEarned
        if (typeof productionQueue !== 'undefined' && productionQueue?.tryResumeProduction) {
          productionQueue.tryResumeProduction()
        }
      } else {
        targetFactory.budget += moneyEarned
      }
      unit.oreCarried = 0
      unit.oreField = null
      unit.findOreAfterUnload = now + 500 // Schedule ore search after 500ms
      playSound('deposit')
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

  // **STABLE REFINERY ASSIGNMENT** - Only reassign if harvester has no target or target is invalid
  let targetRefinery = null
  let targetUnloadTile = null
  
  // Check if current target refinery is still valid
  if (unit.targetRefinery) {
    const currentRefinery = refineries.find(r => (r.id || `refinery_${r.x}_${r.y}`) === unit.targetRefinery)
    if (currentRefinery) {
      // Keep using current refinery - NO REASSIGNMENT
      targetRefinery = currentRefinery
      targetUnloadTile = findAdjacentTile(targetRefinery, mapGrid)
    }
  }
  
  // Only assign new refinery if no valid current assignment
  if (!targetRefinery) {
    // Sort refineries by current load for even distribution
    const refineryLoads = refineries.map(refinery => {
      const refineryId = refinery.id || `refinery_${refinery.x}_${refinery.y}`
      const unloadTile = findAdjacentTile(refinery, mapGrid)
      
      if (!unloadTile) return null
      
      const queueLength = getRefineryQueue(refineryId).length
      const isInUse = gameState.refineryStatus[refineryId] ? 1 : 0
      const totalWait = queueLength + isInUse
      
      return {
        refinery,
        refineryId,
        unloadTile,
        totalWait
      }
    }).filter(Boolean).sort((a, b) => a.totalWait - b.totalWait)
    
    // Choose the refinery with the least load
    if (refineryLoads.length > 0) {
      const chosen = refineryLoads[0]
      targetRefinery = chosen.refinery
      targetUnloadTile = chosen.unloadTile
      
      // Set new assignment
      unit.assignedRefinery = chosen.refineryId
    }
  }

  if (targetRefinery && targetUnloadTile) {
    const refineryId = targetRefinery.id || `refinery_${targetRefinery.x}_${targetRefinery.y}`

    // **STABLE QUEUE MANAGEMENT** - Only modify queue if switching refineries
    if (unit.targetRefinery !== refineryId) {
      // Remove from old queue if switching refineries
      if (unit.targetRefinery) {
        removeFromRefineryQueue(unit.targetRefinery, unit.id)
      }
      
      // Add to new queue
      addToRefineryQueue(refineryId, unit.id)
      unit.targetRefinery = refineryId
    }
    
    // Get current queue position (this should be stable now)
    const queuePosition = getQueuePosition(refineryId, unit.id)
    unit.queuePosition = queuePosition // Store for rendering

    // Check if harvester is adjacent to the refinery
    if (isAdjacentToBuilding(unit, targetRefinery)) {
      // Check if this harvester is next in line
      const nextInQueue = getNextInQueue(refineryId)
      
      if (nextInQueue === unit.id && (!gameState.refineryStatus[refineryId] || gameState.refineryStatus[refineryId] === unit.id)) {
        // Mark this refinery as in use by this harvester
        gameState.refineryStatus[refineryId] = unit.id

        // Start unloading process (takes 10 seconds)
        unit.unloadingAtRefinery = true
        unit.unloadStartTime = now
        unit.unloadRefinery = refineryId
        unit.path = [] // Clear path while unloading

        // Remove from queue since now unloading
        removeFromRefineryQueue(refineryId, unit.id)
        unit.queuePosition = 0

        // Show visual feedback
        showUnloadingFeedback(unit, targetRefinery)
      } else {
        // Wait in queue - stay in position, don't move unnecessarily
        unit.path = [] // Clear any movement when waiting
      }
    } else {
      // **DIRECT MOVEMENT** - Go straight to refinery, no complex queue positioning until adjacent
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
    // Calculate money based on ore carried
    const moneyEarned = unit.oreCarried * 1000
    
    // Unloading complete
    if (unit.owner === 'player') {
      gameState.money += moneyEarned
      if (typeof productionQueue !== 'undefined' && productionQueue?.tryResumeProduction) {
        productionQueue.tryResumeProduction()
      }
    } else if (unit.owner === 'enemy') {
      const enemyFactory = factories.find(f => f.id === 'enemy')
      if (enemyFactory) {
        enemyFactory.budget += moneyEarned
      }
    }

    // Clear refinery usage
    if (unit.unloadRefinery) {
      delete gameState.refineryStatus[unit.unloadRefinery]
      
      // Process next harvester in queue
      const nextInQueue = getNextInQueue(unit.unloadRefinery)
      if (nextInQueue) {
        // The next harvester will be processed in the next update cycle
      }
    }

    // Reset harvester state
    unit.oreCarried = 0
    unit.unloadingAtRefinery = false
    unit.unloadStartTime = null
    unit.unloadRefinery = null
    unit.oreField = null // Clear any ore field reference
    unit.queuePosition = 0 // Clear queue position
    unit.targetRefinery = null // Clear target refinery
    unit.findOreAfterUnload = now + 500 // Schedule ore search after 500ms
    playSound('deposit')
  }
}

/**
 * Finds a new ore target for the harvester
 */
function findNewOreTarget(unit, mapGrid, occupancyMap) {
  // Clear any queue position when going to find ore
  if (unit.targetRefinery) {
    removeFromRefineryQueue(unit.targetRefinery, unit.id)
    unit.queuePosition = 0
    unit.targetRefinery = null
  }
  
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

/**
 * Gets or creates a queue for a refinery
 */
function getRefineryQueue(refineryId) {
  if (!refineryQueues[refineryId]) {
    refineryQueues[refineryId] = []
  }
  return refineryQueues[refineryId]
}

/**
 * Adds a harvester to a refinery queue
 */
function addToRefineryQueue(refineryId, harvesterId) {
  const queue = getRefineryQueue(refineryId)
  if (!queue.includes(harvesterId)) {
    queue.push(harvesterId)
  }
}

/**
 * Removes a harvester from a refinery queue
 */
function removeFromRefineryQueue(refineryId, harvesterId) {
  const queue = getRefineryQueue(refineryId)
  const index = queue.indexOf(harvesterId)
  if (index > -1) {
    queue.splice(index, 1)
  }
}

/**
 * Gets the waiting position of a harvester in a refinery queue (1-based)
 */
function getQueuePosition(refineryId, harvesterId) {
  const queue = getRefineryQueue(refineryId)
  const index = queue.indexOf(harvesterId)
  return index === -1 ? 0 : index + 1
}

/**
 * Gets the next harvester in queue for a refinery
 */
function getNextInQueue(refineryId) {
  const queue = getRefineryQueue(refineryId)
  return queue.length > 0 ? queue[0] : null
}

/**
 * Cleans up empty queues and invalid harvester references
 */
function cleanupQueues(units) {
  const validHarvesterIds = new Set(units.filter(u => u.type === 'harvester').map(u => u.id))
  
  for (const refineryId in refineryQueues) {
    refineryQueues[refineryId] = refineryQueues[refineryId].filter(id => validHarvesterIds.has(id))
    if (refineryQueues[refineryId].length === 0) {
      delete refineryQueues[refineryId]
    }
  }
}

/**
 * Cleans up harvester from all queues (call when harvester is destroyed)
 */
export function cleanupHarvesterFromQueues(harvesterId) {
  for (const refineryId in refineryQueues) {
    removeFromRefineryQueue(refineryId, harvesterId)
  }
}

/**
 * Gets the current refinery queues (for external access)
 */
export function getRefineryQueues() {
  return refineryQueues
}

/**
 * Finds a waiting position near a refinery based on queue position
 */
function findQueuePosition(refinery, queuePosition, mapGrid) {
  const centerX = refinery.x + Math.floor(refinery.width / 2)
  const centerY = refinery.y + Math.floor(refinery.height / 2)
  
  // Create positions in a more organized pattern around the refinery
  const positions = []
  
  // First, add positions adjacent to the refinery (for immediate access)
  for (let y = refinery.y - 1; y <= refinery.y + refinery.height; y++) {
    for (let x = refinery.x - 1; x <= refinery.x + refinery.width; x++) {
      if (x >= 0 && x < mapGrid[0].length && y >= 0 && y < mapGrid.length &&
          (x < refinery.x || x >= refinery.x + refinery.width || 
           y < refinery.y || y >= refinery.y + refinery.height) &&
          mapGrid[y][x].type !== 'water' && mapGrid[y][x].type !== 'rock') {
        positions.push({ x, y })
      }
    }
  }
  
  // Then add positions in expanding rings for longer queues
  for (let ring = 2; ring <= 4 && positions.length < 20; ring++) {
    for (let y = centerY - ring; y <= centerY + ring; y++) {
      for (let x = centerX - ring; x <= centerX + ring; x++) {
        if (x >= 0 && x < mapGrid[0].length && y >= 0 && y < mapGrid.length &&
            (Math.abs(x - centerX) === ring || Math.abs(y - centerY) === ring) &&
            mapGrid[y][x].type !== 'water' && mapGrid[y][x].type !== 'rock') {
          positions.push({ x, y })
        }
      }
    }
  }
  
  // Return the position based on queue position (1-based)
  const index = Math.min(queuePosition - 1, positions.length - 1)
  return positions[index] || { x: centerX + 2, y: centerY }
}

/**
 * Cleans up harvesters assigned to destroyed or sold refineries
 */
function cleanupDestroyedRefineries(units, gameState) {
  if (!gameState.buildings) return
  
  const existingRefineries = new Set(
    gameState.buildings
      .filter(b => b.type === 'oreRefinery' && b.health > 0)
      .map(b => b.id || `refinery_${b.x}_${b.y}`)
  )
  
  // Check all harvesters for invalid refinery assignments
  units.forEach(unit => {
    if (unit.type === 'harvester' && unit.assignedRefinery) {
      if (!existingRefineries.has(unit.assignedRefinery)) {
        // Clear assignment and queue position for destroyed refinery
        unit.assignedRefinery = null
        unit.targetRefinery = null
        unit.queuePosition = 0
        unit.unloadingAtRefinery = false
        unit.unloadStartTime = null
        unit.unloadRefinery = null
      }
    }
    
    // Clear refinery status for destroyed refineries
    if (unit.targetRefinery && !existingRefineries.has(unit.targetRefinery)) {
      unit.targetRefinery = null
      unit.queuePosition = 0
    }
  })
  
  // Clean up refinery status for destroyed refineries
  for (const refineryId in gameState.refineryStatus) {
    if (!existingRefineries.has(refineryId)) {
      delete gameState.refineryStatus[refineryId]
    }
  }
  
  // Clean up queues for destroyed refineries
  for (const refineryId in refineryQueues) {
    if (!existingRefineries.has(refineryId)) {
      delete refineryQueues[refineryId]
    }
  }
}

/**
 * Gets distribution statistics for harvesters across refineries
 */
export function getHarvesterDistribution(gameState) {
  const distribution = {}
  
  if (!gameState.buildings) return distribution
  
  const refineries = gameState.buildings.filter(b => 
    b.type === 'oreRefinery' && 
    b.health > 0
  )
  
  refineries.forEach(refinery => {
    const refineryId = refinery.id || `refinery_${refinery.x}_${refinery.y}`
    const queueLength = getRefineryQueue(refineryId).length
    const isInUse = gameState.refineryStatus?.[refineryId] ? 1 : 0
    
    distribution[refineryId] = {
      refinery,
      queueLength,
      isInUse,
      totalLoad: queueLength + isInUse
    }
  })
  
  return distribution
}

/**
 * Assigns a harvester to the least loaded refinery
 */
export function assignHarvesterToOptimalRefinery(harvester, gameState) {
  // Handle case where gameState is undefined or invalid
  if (!gameState || !gameState.buildings) {
    return null
  }
  
  const distribution = getHarvesterDistribution(gameState)
  
  if (Object.keys(distribution).length === 0) return null
  
  // Find refinery with minimum load
  let minLoad = Infinity
  let optimalRefineryId = null
  
  for (const [refineryId, data] of Object.entries(distribution)) {
    if (data.totalLoad < minLoad) {
      minLoad = data.totalLoad
      optimalRefineryId = refineryId
    }
  }
  
  if (optimalRefineryId) {
    harvester.assignedRefinery = optimalRefineryId
  }
  
  return optimalRefineryId
}
