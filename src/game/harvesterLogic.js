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
  
  // Clean up stale ore tile reservations
  cleanupStaleOreReservations(units)
  
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
          // Immediately try to find new ore to prevent getting stuck
          findNewOreTarget(unit, mapGrid, occupancyMap)
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

        // Clear manual ore target when harvesting is complete
        if (unit.manualOreTarget && 
            unit.manualOreTarget.x === unit.oreField.x && 
            unit.manualOreTarget.y === unit.oreField.y) {
          unit.manualOreTarget = null
          console.log(`Harvester ${unit.id || 'unknown'} completed manual ore target, cleared`)
        }

        // Only deplete the tile after multiple harvests (simulate limited ore)
        if (!mapGrid[unit.oreField.y][unit.oreField.x].harvests) {
          mapGrid[unit.oreField.y][unit.oreField.x].harvests = 0
        }
        mapGrid[unit.oreField.y][unit.oreField.x].harvests++
        
        // Deplete ore tile after 1 harvest (matches HARVESTER_CAPPACITY = 1)
        if (mapGrid[unit.oreField.y][unit.oreField.x].harvests >= 1) {
          mapGrid[unit.oreField.y][unit.oreField.x].type = 'land'
          // Clear any cached texture variations for this tile to force re-render
          mapGrid[unit.oreField.y][unit.oreField.x].textureVariation = null
          // Remove targeting once the tile is depleted
          delete targetedOreTiles[tileKey]
          unit.oreField = null
          
          // Force all harvesters targeting this depleted tile to find new ore
          Object.keys(targetedOreTiles).forEach(key => {
            if (key === tileKey) {
              delete targetedOreTiles[key]
            }
          })
        }
      }
    }

    // Handle unloading when at capacity
    if (unit.oreCarried >= HARVESTER_CAPPACITY && !unit.unloadingAtRefinery && !unit.harvesting) {
      handleHarvesterUnloading(unit, factories, mapGrid, gameState, now, occupancyMap, units)
    }

    // Handle unloading process at refinery
    if (unit.unloadingAtRefinery && unit.unloadStartTime) {
      completeUnloading(unit, factories, mapGrid, gameState, now, occupancyMap)
    }

    // Find new ore when idle and not carrying ore
    if (unit.oreCarried === 0 && !unit.harvesting && !unit.unloadingAtRefinery &&
        (!unit.path || unit.path.length === 0) && !unit.oreField) {
      // Check if there's a manual ore target first
      if (unit.manualOreTarget) {
        handleManualOreTarget(unit, mapGrid, occupancyMap)
      } else {
        findNewOreTarget(unit, mapGrid, occupancyMap)
      }
    }

    // Handle harvesters that have an ore field but no path and aren't harvesting
    // This can happen when they get stuck or lose their path
    if (unit.oreCarried === 0 && !unit.harvesting && !unit.unloadingAtRefinery &&
        unit.oreField && (!unit.path || unit.path.length === 0)) {
      const tileKey = `${unit.oreField.x},${unit.oreField.y}`
      const currentTileX = Math.floor(unit.x / TILE_SIZE)
      const currentTileY = Math.floor(unit.y / TILE_SIZE)
      
      // Check if we're already at the ore field
      if (currentTileX === unit.oreField.x && currentTileY === unit.oreField.y) {
        // We're at the ore field, check if we can harvest
        if (mapGrid[unit.oreField.y][unit.oreField.x].type === 'ore' && 
            !harvestedTiles.has(tileKey)) {
          // Start harvesting
          unit.harvesting = true
          unit.harvestTimer = now
          harvestedTiles.add(tileKey)
          playSound('harvest')
        } else {
          // Ore field is no longer valid, find new one
          if (targetedOreTiles[tileKey] === unit.id) {
            delete targetedOreTiles[tileKey]
          }
          unit.oreField = null
          findNewOreTarget(unit, mapGrid, occupancyMap)
        }
      } else {
        // Try to path to the ore field again
        const path = findPath({ x: unit.tileX, y: unit.tileY }, unit.oreField, mapGrid, occupancyMap)
        if (path.length > 1) {
          unit.path = path.slice(1)
        } else {
          // Can't path to ore field, abandon it and find new one
          if (targetedOreTiles[tileKey] === unit.id) {
            delete targetedOreTiles[tileKey]
          }
          unit.oreField = null
          findNewOreTarget(unit, mapGrid, occupancyMap)
        }
      }
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
function handleHarvesterUnloading(unit, factories, mapGrid, gameState, now, occupancyMap, units) {
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
    // **DISTANCE-BASED REFINERY ASSIGNMENT** - Consider both distance and current load
    const refineryOptions = refineries.map(refinery => {
      const refineryId = refinery.id || `refinery_${refinery.x}_${refinery.y}`
      const unloadTile = findAdjacentTile(refinery, mapGrid)
      
      if (!unloadTile) return null
      
      // Calculate distance from harvester to refinery
      const distance = Math.hypot(
        unit.tileX - (refinery.x + refinery.width / 2),
        unit.tileY - (refinery.y + refinery.height / 2)
      )
      
      const queueLength = getRefineryQueue(refineryId).length
      const isInUse = gameState.refineryStatus[refineryId] ? 1 : 0
      const totalWait = queueLength + isInUse
      
      // Combine distance and wait time for scoring (prefer closer refineries with less wait)
      const score = distance * 2 + totalWait * 5 // Weight wait time more heavily
      
      return {
        refinery,
        refineryId,
        unloadTile,
        distance,
        totalWait,
        score
      }
    }).filter(Boolean).sort((a, b) => a.score - b.score) // Sort by best score (lowest)
    
    // Choose the refinery with the best score (closest with least wait)
    if (refineryOptions.length > 0) {
      const chosen = refineryOptions[0]
      targetRefinery = chosen.refinery
      targetUnloadTile = chosen.unloadTile
      
      // Set new assignment
      unit.assignedRefinery = chosen.refineryId
    }
  }

  if (targetRefinery && targetUnloadTile) {
    // Try to get a better unloading position (prefer tiles directly below refinery)
    const preferredUnloadTile = findPreferredUnloadTile(targetRefinery, mapGrid)
    if (preferredUnloadTile) {
      targetUnloadTile = preferredUnloadTile
    }
    
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

    // Check if harvester is near the refinery (more tolerant detection)
    const isNearRefinery = isAdjacentToBuilding(unit, targetRefinery) || isAtRefineryUnloadingPosition(unit, targetRefinery)
    
    if (isNearRefinery) {
      // **DISTANCE-BASED PRIORITY SYSTEM** - Check if this harvester is the closest
      const nextInQueue = getNextInQueue(refineryId)
      const isNextInQueue = nextInQueue === unit.id
      const refineryInUse = gameState.refineryStatus[refineryId]
      
      // Get all harvesters waiting for this refinery and sort by distance
      const waitingHarvesters = units.filter(u => 
        u.type === 'harvester' && 
        u.targetRefinery === refineryId && 
        u.health > 0 && 
        (isAdjacentToBuilding(u, targetRefinery) || isAtRefineryUnloadingPosition(u, targetRefinery))
      ).sort((a, b) => {
        // Calculate distance to refinery center with preference for proper unloading positions
        const refineryCenter = {
          x: (targetRefinery.x + targetRefinery.width / 2) * TILE_SIZE,
          y: (targetRefinery.y + targetRefinery.height / 2) * TILE_SIZE
        }
        
        // Give priority to harvesters in proper unloading positions
        const aInUnloadPosition = isAtRefineryUnloadingPosition(a, targetRefinery)
        const bInUnloadPosition = isAtRefineryUnloadingPosition(b, targetRefinery)
        
        if (aInUnloadPosition && !bInUnloadPosition) return -1
        if (!aInUnloadPosition && bInUnloadPosition) return 1
        
        // If both or neither are in unloading positions, sort by distance
        const distA = Math.hypot(a.x - refineryCenter.x, a.y - refineryCenter.y)
        const distB = Math.hypot(b.x - refineryCenter.x, b.y - refineryCenter.y)
        return distA - distB
      })
      
      // This harvester can unload if it's the closest and refinery is free
      const isClosest = waitingHarvesters.length > 0 && waitingHarvesters[0].id === unit.id
      
      if (isClosest && (!refineryInUse || refineryInUse === unit.id)) {
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
        // **STAY PUT** - Don't move when wanting to unload but not closest
        unit.path = [] // Clear any movement when waiting
        // Update queue position based on distance ranking
        const position = waitingHarvesters.findIndex(h => h.id === unit.id) + 1
        unit.queuePosition = position > 0 ? position : 1
      }
    } else {
      // **DIRECT MOVEMENT WITH UNLOAD PRIORITY** - Go straight to refinery, but stick around once there
      if (!unit.path || unit.path.length === 0) {
        const path = findPath({ x: unit.tileX, y: unit.tileY }, targetUnloadTile, mapGrid, occupancyMap)
        if (path.length > 1) {
          unit.path = path.slice(1)
        }
      }
      
      // **PREVENT MOVING AWAY WHEN WANTING TO UNLOAD**
      // If harvester is full of ore and close to refinery, don't accept new movement commands
      if (unit.oreCarried >= HARVESTER_CAPPACITY) {
        const distanceToRefinery = Math.hypot(
          unit.tileX - (targetRefinery.x + targetRefinery.width / 2),
          unit.tileY - (targetRefinery.y + targetRefinery.height / 2)
        )
        
        // If close to refinery (within 3 tiles), stay focused on unloading
        if (distanceToRefinery <= 3) {
          // Clear any other movement orders that might take harvester away
          unit.orderQueue = []
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
  
  // Clear any existing ore field reservation
  if (unit.oreField) {
    const prevTileKey = `${unit.oreField.x},${unit.oreField.y}`
    if (targetedOreTiles[prevTileKey] === unit.id) {
      delete targetedOreTiles[prevTileKey]
    }
    unit.oreField = null
  }
  
  const orePos = findClosestOre(unit, mapGrid, targetedOreTiles, unit.assignedRefinery)
  if (orePos) {
    const tileKey = `${orePos.x},${orePos.y}`
    
    // Double-check the tile isn't already taken (race condition protection)
    if (targetedOreTiles[tileKey] && targetedOreTiles[tileKey] !== unit.id) {
      // Try again with a small delay to avoid multiple harvesters fighting over the same tile
      setTimeout(() => {
        if (unit.health > 0 && unit.oreCarried === 0 && !unit.oreField) {
          findNewOreTarget(unit, mapGrid, occupancyMap)
        }
      }, 100 + Math.random() * 200) // Random delay between 100-300ms
      return
    }
    
    // Reserve the tile
    targetedOreTiles[tileKey] = unit.id
    unit.oreField = orePos

    const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap)
    if (path.length > 1) {
      unit.path = path.slice(1)
    }
  } else {
    // No ore available, try again after a delay
    setTimeout(() => {
      if (unit.health > 0 && unit.oreCarried === 0 && !unit.oreField) {
        findNewOreTarget(unit, mapGrid, occupancyMap)
      }
    }, 1000 + Math.random() * 1000) // Random delay between 1-2 seconds
  }
}

/**
 * Gets the current harvested tiles (for external access)
 */
export function getHarvestedTiles() {
  return harvestedTiles
}

/**
 * Clear ore field assignment for a stuck harvester (called from movement system)
 */
export function clearStuckHarvesterOreField(unit) {
  if (unit.type === 'harvester' && unit.oreField) {
    const tileKey = `${unit.oreField.x},${unit.oreField.y}`
    if (targetedOreTiles[tileKey] === unit.id) {
      delete targetedOreTiles[tileKey]
    }
    unit.oreField = null
  }
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
 * Cleans up stale ore tile reservations
 */
function cleanupStaleOreReservations(units) {
  const validHarvesterIds = new Set(units.filter(u => u.type === 'harvester' && u.health > 0).map(u => u.id))
  
  // Remove reservations for dead or non-existent harvesters
  for (const [tileKey, harvesterId] of Object.entries(targetedOreTiles)) {
    if (!validHarvesterIds.has(harvesterId)) {
      delete targetedOreTiles[tileKey]
      continue
    }
    
    // Check if the harvester still has this as their ore field
    const harvester = units.find(u => u.id === harvesterId)
    if (harvester && harvester.oreField) {
      const harvesterTileKey = `${harvester.oreField.x},${harvester.oreField.y}`
      if (harvesterTileKey !== tileKey) {
        // Harvester is targeting a different tile, clean up this reservation
        delete targetedOreTiles[tileKey]
      }
    } else if (harvester && !harvester.oreField) {
      // Harvester has no ore field but still has a reservation, clean it up
      delete targetedOreTiles[tileKey]
    }
  }
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

/**
 * Check if harvester is at a valid unloading position for the refinery
 * Allows unloading from any of the 3 tiles directly below the refinery
 */
function isAtRefineryUnloadingPosition(harvester, refinery) {
  const harvesterTileX = Math.floor(harvester.x / TILE_SIZE)
  const harvesterTileY = Math.floor(harvester.y / TILE_SIZE)
  
  // Check if harvester is at any of the 3 tiles directly below the refinery
  const refineryBottomY = refinery.y + refinery.height
  
  if (harvesterTileY === refineryBottomY) {
    // Check if harvester is within the refinery's width (3 tiles wide)
    return harvesterTileX >= refinery.x && harvesterTileX < refinery.x + refinery.width
  }
  
  return false
}

/**
 * Find the preferred unloading tile (directly below refinery)
 */
function findPreferredUnloadTile(refinery, mapGrid) {
  const bottomY = refinery.y + refinery.height
  
  // Check tiles directly below the refinery (preferred unloading spots)
  for (let x = refinery.x; x < refinery.x + refinery.width; x++) {
    if (bottomY < mapGrid.length && 
        x < mapGrid[0].length && 
        !mapGrid[bottomY][x].building &&
        mapGrid[bottomY][x].type !== 'water' && 
        mapGrid[bottomY][x].type !== 'rock') {
      return { x, y: bottomY }
    }
  }
  
  // Fallback to any adjacent tile
  return findAdjacentTile(refinery, mapGrid)
}

/**
 * Handle manually targeted ore tiles for harvesters
 */
function handleManualOreTarget(unit, mapGrid, occupancyMap) {
  const target = unit.manualOreTarget
  
  // Validate the manual target
  if (!target || 
      target.x < 0 || target.y < 0 || 
      target.x >= mapGrid[0].length || target.y >= mapGrid.length ||
      mapGrid[target.y][target.x].type !== 'ore') {
    // Invalid manual target, clear it and find automatic target
    unit.manualOreTarget = null
    findNewOreTarget(unit, mapGrid, occupancyMap)
    return
  }
  
  const tileKey = `${target.x},${target.y}`
  
  // Check if another harvester is already harvesting this tile
  if (harvestedTiles.has(tileKey)) {
    // Tile is being actively harvested, wait or find alternative
    // For manual targets, we can wait briefly then try again
    setTimeout(() => {
      if (unit.health > 0 && unit.oreCarried === 0 && unit.manualOreTarget) {
        handleManualOreTarget(unit, mapGrid, occupancyMap)
      }
    }, 500 + Math.random() * 1000) // Wait 0.5-1.5 seconds
    return
  }
  
  // Clear any existing ore field reservation
  if (unit.oreField) {
    const prevTileKey = `${unit.oreField.x},${unit.oreField.y}`
    if (targetedOreTiles[prevTileKey] === unit.id) {
      delete targetedOreTiles[prevTileKey]
    }
  }
  
  // Reserve the manual target
  targetedOreTiles[tileKey] = unit.id
  unit.oreField = target
  
  // Calculate path to manual target
  const path = findPath({ x: unit.tileX, y: unit.tileY }, target, mapGrid, occupancyMap)
  if (path.length > 1) {
    unit.path = path.slice(1)
    console.log(`Harvester ${unit.id || 'unknown'} pathing to manual ore target at ${target.x},${target.y}`)
  } else if (path.length === 1) {
    // Already at the target
    unit.path = []
  } else {
    // Can't path to manual target, clear it and find automatic target
    console.log(`Harvester ${unit.id || 'unknown'} cannot path to manual ore target, finding automatic target`)
    delete targetedOreTiles[tileKey]
    unit.oreField = null
    unit.manualOreTarget = null
    findNewOreTarget(unit, mapGrid, occupancyMap)
  }
}
