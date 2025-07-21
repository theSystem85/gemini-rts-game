// units.js
import {
  TILE_SIZE,
  UNIT_COSTS,
  UNIT_PROPERTIES,
  PATHFINDING_LIMIT,
  DIRECTIONS,
  MAX_SPAWN_SEARCH_DISTANCE,
  STREET_PATH_COST
} from './config.js'
import { logPerformance } from './performanceUtils.js'
import { getUniqueId, updateUnitSpeedModifier } from './utils.js'
import { initializeUnitMovement } from './game/unifiedMovement.js'
import { gameState } from './gameState.js'

// Add a global variable to track if we've already shown the pathfinding warning
let pathfindingWarningShown = false

export const unitCosts = UNIT_COSTS

// Build an occupancy map indicating which tiles are occupied by a unit.
export function buildOccupancyMap(units, mapGrid, textureManager = null) {
  const occupancy = []
  let impassableGrassCount = 0
  
  for (let y = 0; y < mapGrid.length; y++) {
    occupancy[y] = []
    for (let x = 0; x < mapGrid[0].length; x++) {
      const tile = mapGrid[y][x]
      
      // Check if this is an impassable grass tile
      let isImpassableGrass = false
      if (tile.type === 'land' && textureManager && textureManager.isLandTileImpassable) {
        isImpassableGrass = textureManager.isLandTileImpassable(x, y)
        if (isImpassableGrass) {
          impassableGrassCount++
        }
      }
      
      occupancy[y][x] =
        tile.type === 'water' || 
        tile.type === 'rock' || 
        tile.seedCrystal || 
        tile.building || 
        isImpassableGrass ? 1 : 0
    }
  }
  
  if (impassableGrassCount > 0) {
    console.log(`Occupancy map built: ${impassableGrassCount} impassable grass tiles found`)
  }
  
  units.forEach(unit => {
    const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
    const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
    if (
      tileY >= 0 &&
      tileY < mapGrid.length &&
      tileX >= 0 &&
      tileX < mapGrid[0].length
    ) {
      occupancy[tileY][tileX] += 1
    }
  })
  return occupancy
}

export function initializeOccupancyMap(units, mapGrid, textureManager = null) {
  return buildOccupancyMap(units, mapGrid, textureManager)
}

// Function to rebuild occupancy map after textures are loaded
export function rebuildOccupancyMapWithTextures(units, mapGrid, textureManager) {
  if (textureManager && textureManager.allTexturesLoaded) {
    console.log('Rebuilding occupancy map with loaded textures...')
    return buildOccupancyMap(units, mapGrid, textureManager)
  }
  return null
}

export const updateUnitOccupancy = logPerformance(function updateUnitOccupancy(unit, prevTileX, prevTileY, occupancyMap) {
  if (!occupancyMap) return
  
  // Remove occupancy from previous position (using center coordinates)
  if (
    prevTileY >= 0 &&
    prevTileY < occupancyMap.length &&
    prevTileX >= 0 &&
    prevTileX < occupancyMap[0].length
  ) {
    occupancyMap[prevTileY][prevTileX] = Math.max(
      0,
      (occupancyMap[prevTileY][prevTileX] || 0) - 1
    )
  }
  
  // Add occupancy to current position (using center coordinates)
  const currentTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const currentTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
  
  if (
    currentTileY >= 0 &&
    currentTileY < occupancyMap.length &&
    currentTileX >= 0 &&
    currentTileX < occupancyMap[0].length
  ) {
    occupancyMap[currentTileY][currentTileX] =
      (occupancyMap[currentTileY][currentTileX] || 0) + 1
  }
}, false)

export function removeUnitOccupancy(unit, occupancyMap) {
  if (!occupancyMap) return
  const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
  const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
  if (
    tileY >= 0 &&
    tileY < occupancyMap.length &&
    tileX >= 0 &&
    tileX < occupancyMap[0].length
  ) {
    occupancyMap[tileY][tileX] = Math.max(0, (occupancyMap[tileY][tileX] || 0) - 1)
  }
}

// A simple binary heap (min-heap) for nodes based on f value.
class MinHeap {
  constructor() {
    this.content = []
  }
  push(element) {
    this.content.push(element)
    this.bubbleUp(this.content.length - 1)
  }
  pop() {
    const result = this.content[0]
    const end = this.content.pop()
    if (this.content.length > 0) {
      this.content[0] = end
      this.sinkDown(0)
    }
    return result
  }
  bubbleUp(n) {
    const element = this.content[n]
    while (n > 0) {
      const parentN = Math.floor((n - 1) / 2)
      const parent = this.content[parentN]
      if (element.f >= parent.f) break
      this.content[parentN] = element
      this.content[n] = parent
      n = parentN
    }
  }
  sinkDown(n) {
    const length = this.content.length
    const element = this.content[n]
    while (true) {
      const child2N = (n + 1) * 2
      const child1N = child2N - 1
      let swap = null
      if (child1N < length) {
        const child1 = this.content[child1N]
        if (child1.f < element.f) {
          swap = child1N
        }
      }
      if (child2N < length) {
        const child2 = this.content[child2N]
        if ((swap === null ? element.f : this.content[child1N].f) > child2.f) {
          swap = child2N
        }
      }
      if (swap === null) break
      this.content[n] = this.content[swap]
      this.content[swap] = element
      n = swap
    }
  }
  size() {
    return this.content.length
  }
}

// Locate the nearest passable and unoccupied tile to the given coordinates.
// Searches in expanding squares up to a limited radius.
function findNearestFreeTile(x, y, mapGrid, occupancyMap, maxDistance = 5) {
  for (let distance = 0; distance <= maxDistance; distance++) {
    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        // Only check perimeter of the square for this distance
        if (Math.abs(dx) !== distance && Math.abs(dy) !== distance) continue

        const checkX = x + dx
        const checkY = y + dy

        if (
          checkX >= 0 &&
          checkY >= 0 &&
          checkX < mapGrid[0].length &&
          checkY < mapGrid.length
        ) {
          const tile = mapGrid[checkY][checkX]
          const passable =
            tile.type !== 'water' &&
            tile.type !== 'rock' &&
            !tile.building &&
            !tile.seedCrystal
          const occupied = occupancyMap && occupancyMap[checkY][checkX]
          if (passable && !occupied) {
            return { x: checkX, y: checkY }
          }
        }
      }
    }
  }
  return null
}

// A* pathfinding with diagonal movement and cost advantage for street tiles.
// Early exits if destination is out of bounds or impassable.
export const findPath = logPerformance(function findPath(start, end, mapGrid, occupancyMap = null, pathFindingLimit = PATHFINDING_LIMIT) {
  // Validate input coordinates
  if (!start || !end || 
      typeof start.x !== 'number' || typeof start.y !== 'number' ||
      typeof end.x !== 'number' || typeof end.y !== 'number' ||
      !isFinite(start.x) || !isFinite(start.y) ||
      !isFinite(end.x) || !isFinite(end.y)) {
    console.warn('findPath: invalid coordinates provided', { start, end })
    return []
  }

  // Validate mapGrid
  if (!mapGrid || !Array.isArray(mapGrid) || mapGrid.length === 0 || !mapGrid[0] || !Array.isArray(mapGrid[0])) {
    console.warn('findPath: invalid mapGrid provided', { mapGrid })
    return []
  }
  
  if (
    start.x < 0 || start.y < 0 ||
    start.x >= mapGrid[0].length || start.y >= mapGrid.length ||
    end.x < 0 || end.y < 0 ||
    end.x >= mapGrid[0].length || end.y >= mapGrid.length
  ) {
    if (!pathfindingWarningShown) {
      console.warn('findPath: start or destination tile out of bounds', { start, end })
      pathfindingWarningShown = true
    }
    return []
  }
  // Begin destination adjustment if blocked or occupied
  let adjustedEnd = { ...end }
  const destTile = mapGrid[adjustedEnd.y][adjustedEnd.x]
  const destType = destTile.type
  const destHasBuilding = destTile.building
  const destSeedCrystal = destTile.seedCrystal
  const destOccupied = occupancyMap && occupancyMap[adjustedEnd.y][adjustedEnd.x]
  if (
    destType === 'water' ||
    destType === 'rock' ||
    destHasBuilding ||
    destSeedCrystal ||
    destOccupied
  ) {
    const alt = findNearestFreeTile(adjustedEnd.x, adjustedEnd.y, mapGrid, occupancyMap)
    if (alt) {
      adjustedEnd = alt
    } else {
      // Only show the warning once and include detailed information to help diagnose
      if (!pathfindingWarningShown) {
        console.warn('findPath: destination tile not passable and no adjacent free tile found', {
          start,
          end,
          destinationType: destType,
          occupied: destOccupied,
          surroundingTiles: DIRECTIONS.map(dir => {
            const x = adjustedEnd.x + dir.x
            const y = adjustedEnd.y + dir.y
            if (x >= 0 && y >= 0 && x < mapGrid[0].length && y < mapGrid.length) {
              return {
                x,
                y,
                type: mapGrid[y][x].type,
                building: mapGrid[y][x].building
                  ? {
                      type: mapGrid[y][x].building.type,
                      owner: mapGrid[y][x].building.owner
                    }
                  : null,
                occupied: occupancyMap && occupancyMap[y][x]
              }
            }
            return { x, y, outOfBounds: true }
          })
        })
        pathfindingWarningShown = true
      }
      return []
    }
  }

  // Initialize A* search.
  const openHeap = new MinHeap()
  const closedSet = new Set()
  const startNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: Math.hypot(adjustedEnd.x - start.x, adjustedEnd.y - start.y),
    f: 0,
    parent: null
  }
  startNode.f = startNode.g + startNode.h
  openHeap.push(startNode)

  let finalPath = []

  // Removed any maximum iteration check to ensure players' units can always move.
  let nodesExplored = 0
  while (openHeap.size() > 0) {
    const currentNode = openHeap.pop()
    const currentKey = `${currentNode.x},${currentNode.y}`

    if (currentNode.x === adjustedEnd.x && currentNode.y === adjustedEnd.y) {
      // Reconstruct path.
      const path = []
      let curr = currentNode
      while (curr) {
        path.push({ x: curr.x, y: curr.y })
        curr = curr.parent
      }
      finalPath = path.reverse()
      break
    }

    closedSet.add(currentKey)
    const neighbors = getNeighbors(currentNode, mapGrid)
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`
      if (closedSet.has(neighborKey)) continue
      // Skip if occupancyMap is provided and the tile is occupied.
      if (occupancyMap && occupancyMap[neighbor.y][neighbor.x]) continue

      const baseCost = Math.hypot(neighbor.x - currentNode.x, neighbor.y - currentNode.y)
      const tileType = mapGrid[neighbor.y][neighbor.x].type
      const terrainCost = tileType === 'street' ? STREET_PATH_COST : 1
      const gScore = currentNode.g + baseCost * terrainCost
      let foundInHeap = false
      for (const node of openHeap.content) {
        if (node.x === neighbor.x && node.y === neighbor.y) {
          foundInHeap = true
          if (gScore < node.g) {
            node.g = gScore
            node.f = gScore + node.h
            node.parent = currentNode
            openHeap.bubbleUp(openHeap.content.indexOf(node))
          }
          break
        }
      }
      if (!foundInHeap) {
        const hScore = Math.hypot(adjustedEnd.x - neighbor.x, adjustedEnd.y - neighbor.y)
        const neighborNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: currentNode
        }
        openHeap.push(neighborNode)
      }
    }
    nodesExplored++
    if (nodesExplored > pathFindingLimit) {
      const bestNode = openHeap.content.reduce((best, node) => {
        const fScore = node.g + node.h
        const bestFScore = best.g + best.h
        return fScore < bestFScore ? node : best
      }, openHeap.content[0])
      const path = []
      let curr = bestNode
      while (curr) {
        path.push({ x: curr.x, y: curr.y })
        curr = curr.parent
      }
      finalPath = path.reverse()
      break
    }
  }
  // If no path was found, finalPath will be empty

  // If direct line is available, compare costs
  let directPath = null
  let directCost = Infinity
  if (isDirectPathClear(start, adjustedEnd, mapGrid, occupancyMap)) {
    directPath = getLineTiles(start, adjustedEnd)
    directCost = calculatePathCost(directPath, mapGrid)
  }

  const aStarCost = calculatePathCost(finalPath, mapGrid)

  let chosenPath = finalPath

  if (directPath && (finalPath.length === 0 || directCost <= aStarCost)) {
    chosenPath = directPath
  }

  return smoothPath(chosenPath, mapGrid, occupancyMap)
})

function getNeighbors(node, mapGrid) {
  const neighbors = []

  for (const dir of DIRECTIONS) {
    const x = node.x + dir.x
    const y = node.y + dir.y
    if (y >= 0 && y < mapGrid.length && x >= 0 && x < mapGrid[0].length) {
      const tile = mapGrid[y][x]
      const tileType = tile.type
      const hasBuilding = tile.building
      const hasSeedCrystal = tile.seedCrystal
      if (tileType !== 'water' && tileType !== 'rock' && !hasBuilding && !hasSeedCrystal) {
        neighbors.push({ x, y })
      }
    }
  }
  return neighbors
}

// --- Path Utilities ---------------------------------------------------------

// Bresenham-like line algorithm to get all tiles on a line
function getLineTiles(start, end) {
  // Validate input coordinates
  if (!start || !end || 
      typeof start.x !== 'number' || typeof start.y !== 'number' ||
      typeof end.x !== 'number' || typeof end.y !== 'number' ||
      !isFinite(start.x) || !isFinite(start.y) ||
      !isFinite(end.x) || !isFinite(end.y)) {
    console.warn('Invalid coordinates passed to getLineTiles:', { start, end })
    return []
  }

  const tiles = [{ x: start.x, y: start.y }]
  let x = start.x
  let y = start.y
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  const sx = start.x < end.x ? 1 : -1
  const sy = start.y < end.y ? 1 : -1
  let err = dx - dy

  // Prevent infinite loops for very large distances
  let iterations = 0
  const maxIterations = Math.max(dx, dy) + 1
  
  while (!(x === end.x && y === end.y) && iterations < maxIterations) {
    iterations++
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
    
    // Validate coordinates before pushing
    if (isFinite(x) && isFinite(y)) {
      tiles.push({ x, y })
    } else {
      console.warn('Invalid coordinates generated in getLineTiles:', { x, y, start, end })
      break
    }
  }
  return tiles
}

// Check if direct line between tiles is clear of obstacles/units
function isDirectPathClear(start, end, mapGrid, occupancyMap) {
  const tiles = getLineTiles(start, end)
  for (let i = 1; i < tiles.length; i++) {
    const { x, y } = tiles[i]
    if (x < 0 || y < 0 || y >= mapGrid.length || x >= mapGrid[0].length) {
      return false
    }
    const tile = mapGrid[y][x]
    if (tile.type === 'water' || tile.type === 'rock' || tile.building || tile.seedCrystal) {
      return false
    }
    if (occupancyMap && occupancyMap[y][x]) {
      return false
    }
  }
  return true
}

// Calculate travel cost for a path array using same costs as A*
function calculatePathCost(path, mapGrid) {
  if (!path || path.length < 2) return 0
  let cost = 0
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]
    const base = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const tileType = mapGrid[curr.y][curr.x].type
    const terrain = tileType === 'street' ? STREET_PATH_COST : 1
    cost += base * terrain
  }
  return cost
}

// Reduce a tile path into straight-line segments for smoother movement
function smoothPath(path, mapGrid, occupancyMap) {
  if (!path || path.length <= 2) return path

  const smoothed = [path[0]]
  let currentIndex = 0

  while (currentIndex < path.length - 1) {
    let nextIndex = path.length - 1
    for (let i = path.length - 1; i > currentIndex; i--) {
      if (isDirectPathClear(path[currentIndex], path[i], mapGrid, occupancyMap)) {
        nextIndex = i
        break
      }
    }
    smoothed.push(path[nextIndex])
    currentIndex = nextIndex
  }

  return smoothed
}

// Spawns a unit near the specified factory.
// Accepts an optional rallyPointTarget from the specific spawning factory.
export function spawnUnit(factory, type, units, mapGrid, rallyPointTarget = null, occupancyMap = gameState.occupancyMap) {
  // Default spawn position is the center below the factory
  const spawnX = factory.x + Math.floor(factory.width / 2)
  const spawnY = factory.y + factory.height

  let spawnPosition = null

  if (factory.type === 'vehicleFactory') {
    // Attempt to free the designated spawn tile using algorithm A1
    moveBlockingUnits(spawnX, spawnY, units, mapGrid)

    // If the spot is valid after moving blockers, use it
    if (isPositionValid(spawnX, spawnY, mapGrid, units)) {
      spawnPosition = { x: spawnX, y: spawnY }
    } else {
      // Fallback: search near the designated spot
      spawnPosition = findAvailableSpawnPosition(spawnX, spawnY, mapGrid, units)
    }
  } else {
    // Determine the center of the factory/building for spawn proximity check
    const factoryCenterX = factory.x + Math.floor(factory.width / 2)
    const factoryCenterY = factory.y + Math.floor(factory.height / 2)

    // Find an available spawn position near the factory's center
    spawnPosition = findAvailableSpawnPosition(factoryCenterX, factoryCenterY, mapGrid, units)
  }

  if (!spawnPosition) {
    console.warn(`No available spawn position near factory/building at (${factory.x}, ${factory.y}) for unit type ${type}`)
    return null // Return null if no position is available
  }

  const newUnit = createUnit(factory, type, spawnPosition.x, spawnPosition.y)
  if (occupancyMap) {
    // Use center coordinates for occupancy map consistency
    const centerTileX = Math.floor((newUnit.x + TILE_SIZE / 2) / TILE_SIZE)
    const centerTileY = Math.floor((newUnit.y + TILE_SIZE / 2) / TILE_SIZE)
    if (centerTileY >= 0 && centerTileY < occupancyMap.length &&
        centerTileX >= 0 && centerTileX < occupancyMap[0].length) {
      occupancyMap[centerTileY][centerTileX] = (occupancyMap[centerTileY][centerTileX] || 0) + 1
    }
  }

  // If a rally point target was provided (from the specific spawning factory), set the unit's path to it.
  // This allows each factory to have its own individual assembly point.
  // Harvesters handle their own initial path logic in productionQueue.js
  if (rallyPointTarget && type !== 'harvester') {
    const path = findPath(
      { x: spawnPosition.x, y: spawnPosition.y },
      { x: rallyPointTarget.x, y: rallyPointTarget.y },
      mapGrid,
      null // Pass null for occupancyMap initially, pathfinding handles collisions
    )
    if (path && path.length > 1) {
      newUnit.path = path.slice(1)
      newUnit.moveTarget = { x: rallyPointTarget.x, y: rallyPointTarget.y } // Store final destination
    } else if (path && path.length === 1) {
      // If the rally point is the spawn point itself (unlikely but possible)
      newUnit.path = []
      newUnit.moveTarget = { x: rallyPointTarget.x, y: rallyPointTarget.y }
    } else {
      console.warn(`Could not find path from spawn (${spawnPosition.x}, ${spawnPosition.y}) to rally point (${rallyPointTarget.x}, ${rallyPointTarget.y}) for ${type}`)
    }
  }

  // Play unit ready sound (moved here from productionQueue for consistency)
  // Note: Harvester initial path logic is in productionQueue, so sound plays there.
  // Consider moving harvester sound here too if spawnUnit handles initial harvester path.
  // if (type !== 'harvester') { // Only play if not a harvester (handled in productionQueue)
  //   const readySounds = ['unitReady01', 'unitReady02', 'unitReady03'];
  //   const randomSound = readySounds[Math.floor(Math.random() * readySounds.length)];
  //   playSound(randomSound, 1.0);
  // }

  return newUnit
}

// Helper to create the actual unit object
export function createUnit(factory, unitType, x, y) {
  // Get base unit properties
  const baseProps = UNIT_PROPERTIES.base

  // Get unit-specific properties or use base properties if type not found
  const typeProps = UNIT_PROPERTIES[unitType] || baseProps

  // Special handling for 'tank' and 'tank_v1' to use the same properties
  const actualType = (unitType === 'tank') ? 'tank_v1' : unitType
  const unitProps = UNIT_PROPERTIES[actualType] || typeProps

  const unit = {
    id: getUniqueId(),
    type: actualType,
    // Determine owner based on factory's 'owner' property (for buildings) or 'id' (for initial factories)
    owner: factory.owner || factory.id,
    tileX: x,
    tileY: y,
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    speed: unitProps.speed,
    health: unitProps.health,
    maxHealth: unitProps.maxHealth,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    // Add rotation properties
    direction: 0, // Angle in radians (0 = east, PI/2 = south)
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: unitProps.rotationSpeed,
    turretRotationSpeed: unitProps.turretRotationSpeed || unitProps.rotationSpeed,
    isRotating: false,
    loggingEnabled: false,
    lastLoggedStatus: null,
    guardMode: false,
    guardTarget: null,
    // Command queue for path planning feature
    commandQueue: [],
    currentCommand: null
  }

  // Add unit-specific properties
  if (unitType === 'tank-v2' || unitType === 'tank-v3') {
    unit.alertMode = unitProps.alertMode
  } else if (unitType === 'harvester') {
    unit.oreCarried = 0
    unit.harvesting = false
    unit.armor = unitProps.armor
  }

  // Initialize unified movement system for the new unit
  initializeUnitMovement(unit)
  
  // Initialize leveling system for combat units (not harvesters)
  if (unit.type !== 'harvester') {
    unit.level = 0
    unit.experience = 0
    unit.baseCost = unitCosts[unit.type] || unitCosts[unitType] || 1000
  }
  
  // Initialize speed modifier based on current health
  updateUnitSpeedModifier(unit)

  // Apply god mode if it's active for this unit's owner
  if (window.cheatSystem && window.cheatSystem.isGodModeActive()) {
    window.cheatSystem.addUnitToGodMode(unit)
  }

  return unit
}

// Find an available position near the factory center for unit spawn
function findAvailableSpawnPosition(factoryX, factoryY, mapGrid, units) {
  // First, try positions around the factory center in a spiral pattern

  // Check immediate surrounding tiles first (1 tile away from center)
  for (let distance = 1; distance <= 5; distance++) { // Check up to 5 tiles away initially
    for (const dir of DIRECTIONS) {
      const x = factoryX + dir.x * distance
      const y = factoryY + dir.y * distance

      // Check if position is valid (passable terrain, within bounds, not occupied)
      if (isPositionValid(x, y, mapGrid, units)) {
        return { x, y }
      }
    }
  }

  // If we couldn't find a position in the immediate vicinity,
  // expand the search with a more thorough approach (larger radius)
  for (let distance = 6; distance <= MAX_SPAWN_SEARCH_DISTANCE; distance++) {
    // Check in a square pattern around the factory center
    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        // Skip positions not on the perimeter of the current distance square
        if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue

        const x = factoryX + dx
        const y = factoryY + dy

        if (isPositionValid(x, y, mapGrid, units)) {
          return { x, y }
        }
      }
    }
  }

  // No valid position found
  return null
}

// Helper function to check if a position is valid for unit spawn
function isPositionValid(x, y, mapGrid, units) {
  // Check if position is within bounds
  if (x < 0 || y < 0 || y >= mapGrid.length || x >= mapGrid[0].length) {
    return false
  }

  // Check if tile is passable (not a building, rock, etc.)
  // Note: Tiles with ore overlay (mapGrid[y][x].ore = true) are still passable based on their underlying type
  if (
    mapGrid[y][x].type !== 'land' &&
    mapGrid[y][x].type !== 'street'
  ) {
    return false
  }

  if (mapGrid[y][x].seedCrystal) {
    return false
  }

  // Check if tile is occupied by another unit
  const isOccupied = units.some(unit =>
    Math.floor(unit.x / TILE_SIZE) === x &&
    Math.floor(unit.y / TILE_SIZE) === y
  )

  return !isOccupied
}

// Implementation of algorithm A1: move blocking units to make room
export function moveBlockingUnits(targetX, targetY, units, mapGrid) {
  // Find any unit blocking the target position
  const blockingUnit = units.find(unit =>
    Math.floor(unit.x / TILE_SIZE) === targetX &&
    Math.floor(unit.y / TILE_SIZE) === targetY
  )

  if (!blockingUnit) return true // No blocking unit

  // Find the closest free tile to move the blocking unit
  for (let distance = 1; distance <= 3; distance++) {
    for (const dir of DIRECTIONS) {
      const newX = targetX + dir.x * distance
      const newY = targetY + dir.y * distance

      if (isPositionValid(newX, newY, mapGrid, units)) {
        // Store previous tile position (using center coordinates)
        const prevTileX = Math.floor((blockingUnit.x + TILE_SIZE / 2) / TILE_SIZE)
        const prevTileY = Math.floor((blockingUnit.y + TILE_SIZE / 2) / TILE_SIZE)
        
        // Move the blocking unit
        blockingUnit.tileX = newX
        blockingUnit.tileY = newY
        blockingUnit.x = newX * TILE_SIZE
        blockingUnit.y = newY * TILE_SIZE
        
        // Update occupancy map
        if (gameState.occupancyMap) {
          updateUnitOccupancy(blockingUnit, prevTileX, prevTileY, gameState.occupancyMap)
        }
        
        return true
      }
    }
  }

  return false // Could not move the blocking unit
}

// --- Collision Resolution for Idle Units ---
// When multiple units share the same tile, naturally guide them to separate positions
export function resolveUnitCollisions(units, mapGrid) {
  const assignedTiles = new Set()
  const COLLISION_RADIUS = TILE_SIZE * 0.4; // Collision detection radius
  const SEPARATION_FORCE = 0.5; // Force to separate overlapping units
  
  // Update each unit's tile coordinates based on their current positions.
  units.forEach(u => {
    if (!u.path || u.path.length === 0) {
      u.tileX = Math.floor(u.x / TILE_SIZE)
      u.tileY = Math.floor(u.y / TILE_SIZE)
    }
  })
  
  // Find overlapping units and apply gentle separation forces
  for (let i = 0; i < units.length; i++) {
    const unit1 = units[i];
    if (unit1.path && unit1.path.length > 0) continue; // Skip moving units
    
    for (let j = i + 1; j < units.length; j++) {
      const unit2 = units[j];
      if (unit2.path && unit2.path.length > 0) continue; // Skip moving units
      
      const dx = unit2.x - unit1.x;
      const dy = unit2.y - unit1.y;
      const distance = Math.hypot(dx, dy);
      
      // If units are overlapping, apply gentle separation
      if (distance < COLLISION_RADIUS && distance > 0) {
        const overlap = COLLISION_RADIUS - distance;
        const separationX = (dx / distance) * overlap * SEPARATION_FORCE;
        const separationY = (dy / distance) * overlap * SEPARATION_FORCE;
        
        // Apply separation force (split the movement between both units)
        unit1.x -= separationX * 0.5;
        unit1.y -= separationY * 0.5;
        unit2.x += separationX * 0.5;
        unit2.y += separationY * 0.5;
        
        // Ensure units stay within map bounds
        unit1.x = Math.max(0, Math.min(unit1.x, (mapGrid[0].length - 1) * TILE_SIZE));
        unit1.y = Math.max(0, Math.min(unit1.y, (mapGrid.length - 1) * TILE_SIZE));
        unit2.x = Math.max(0, Math.min(unit2.x, (mapGrid[0].length - 1) * TILE_SIZE));
        unit2.y = Math.max(0, Math.min(unit2.y, (mapGrid.length - 1) * TILE_SIZE));
        
        // Update tile positions
        unit1.tileX = Math.floor(unit1.x / TILE_SIZE);
        unit1.tileY = Math.floor(unit1.y / TILE_SIZE);
        unit2.tileX = Math.floor(unit2.x / TILE_SIZE);
        unit2.tileY = Math.floor(unit2.y / TILE_SIZE);
      }
    }
  }
}

// --- Helper: Deselect All Units ---
// Call this function on a right-click event if it is not part of a map drag.
export function deselectUnits(units) {
  units.forEach(u => {
    u.selected = false
  })
}
