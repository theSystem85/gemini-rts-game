// units.js
import {
  TILE_SIZE,
  UNIT_COSTS,
  UNIT_PROPERTIES,
  PATHFINDING_LIMIT,
  DIRECTIONS,
  MAX_SPAWN_SEARCH_DISTANCE
} from './config.js'
import { getUniqueId } from './utils.js'

// Add a global variable to track if we've already shown the pathfinding warning
let pathfindingWarningShown = false

export const unitCosts = UNIT_COSTS

// Build an occupancy map indicating which tiles are occupied by a unit.
export function buildOccupancyMap(units, mapGrid) {
  const occupancy = []
  for (let y = 0; y < mapGrid.length; y++) {
    occupancy[y] = []
    for (let x = 0; x < mapGrid[0].length; x++) {
      occupancy[y][x] = false
    }
  }
  units.forEach(unit => {
    // Ensure unit tile indices are within mapGrid bounds.
    if (
      unit.tileY >= 0 &&
      unit.tileY < mapGrid.length &&
      unit.tileX >= 0 &&
      unit.tileX < mapGrid[0].length
    ) {
      occupancy[unit.tileY][unit.tileX] = true
    }
  })
  return occupancy
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

// A* pathfinding with diagonal movement and cost advantage for street tiles.
// Early exits if destination is out of bounds or impassable.
export function findPath(start, end, mapGrid, occupancyMap = null, pathFindingLimit = PATHFINDING_LIMIT) {
  if (
    end.x < 0 ||
    end.y < 0 ||
    end.x >= mapGrid[0].length ||
    end.y >= mapGrid.length
  ) {
    if (!pathfindingWarningShown) {
      console.warn('findPath: destination tile out of bounds', { start, end })
      pathfindingWarningShown = true
    }
    return []
  }
  // Begin destination adjustment if not passable
  let adjustedEnd = { ...end }
  const destType = mapGrid[adjustedEnd.y][adjustedEnd.x].type
  if (destType === 'water' || destType === 'rock' || destType === 'building') {
    let found = false
    for (const dir of DIRECTIONS) {
      const newX = adjustedEnd.x + dir.x
      const newY = adjustedEnd.y + dir.y
      if (newX >= 0 && newY >= 0 && newX < mapGrid[0].length && newY < mapGrid.length) {
        const newType = mapGrid[newY][newX].type
        if (newType !== 'water' && newType !== 'rock' && newType !== 'building') {
          adjustedEnd = { x: newX, y: newY }
          found = true
          break
        }
      }
    }
    if (!found) {
      // Only show the warning once and include detailed information to help diagnose
      if (!pathfindingWarningShown) {
        console.warn('findPath: destination tile not passable and no adjacent free tile found', {
          start,
          end,
          destinationType: destType,
          surroundingTiles: DIRECTIONS.map(dir => {
            const x = adjustedEnd.x + dir.x
            const y = adjustedEnd.y + dir.y
            if (x >= 0 && y >= 0 && x < mapGrid[0].length && y < mapGrid.length) {
              return {
                x, y,
                type: mapGrid[y][x].type,
                building: mapGrid[y][x].building ? {
                  type: mapGrid[y][x].building.type,
                  owner: mapGrid[y][x].building.owner
                } : null
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
      return path.reverse()
    }

    closedSet.add(currentKey)
    const neighbors = getNeighbors(currentNode, mapGrid)
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`
      if (closedSet.has(neighborKey)) continue
      // Skip if occupancyMap is provided and the tile is occupied.
      if (occupancyMap && occupancyMap[neighbor.y][neighbor.x]) continue

      const gScore = currentNode.g + Math.hypot(neighbor.x - currentNode.x, neighbor.y - currentNode.y)
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
      return path.reverse()
    }
  }
  // If no path is found, return an empty array.
  return []
}

function getNeighbors(node, mapGrid) {
  const neighbors = []

  for (const dir of DIRECTIONS) {
    const x = node.x + dir.x
    const y = node.y + dir.y
    if (y >= 0 && y < mapGrid.length && x >= 0 && x < mapGrid[0].length) {
      const tileType = mapGrid[y][x].type
      if (tileType !== 'water' && tileType !== 'rock' && tileType !== 'building') {
        neighbors.push({ x, y })
      }
    }
  }
  return neighbors
}

// Spawns a unit near the specified factory.
// Accepts an optional rallyPointTarget from the main player factory.
export function spawnUnit(factory, type, units, mapGrid, rallyPointTarget = null) {
  // Determine the center of the factory/building for spawn proximity check
  const factoryCenterX = factory.x + Math.floor(factory.width / 2)
  const factoryCenterY = factory.y + Math.floor(factory.height / 2)

  // Find an available spawn position near the factory's center
  const spawnPosition = findAvailableSpawnPosition(factoryCenterX, factoryCenterY, mapGrid, units)

  if (!spawnPosition) {
    console.warn(`No available spawn position near factory/building at (${factory.x}, ${factory.y}) for unit type ${type}`)
    return null // Return null if no position is available
  }

  const newUnit = createUnit(factory, type, spawnPosition.x, spawnPosition.y)

  // If a rally point target was provided (from the main player factory), set the unit's path to it.
  // This overrides any rally point the specific spawn building might have (though they shouldn't).
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
    owner: (factory.owner === 'player' || factory.id === 'player') ? 'player' : 'enemy',
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
    isRotating: false,
    useAimAhead: unitProps.useAimAhead || false
  }

  // Add unit-specific properties
  if (unitType === 'tank-v2' || unitType === 'tank-v3') {
    unit.alertMode = unitProps.alertMode
  } else if (unitType === 'harvester') {
    unit.oreCarried = 0
    unit.harvesting = false
    unit.armor = unitProps.armor
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
  if (mapGrid[y][x].type !== 'land' && mapGrid[y][x].type !== 'street' && mapGrid[y][x].type !== 'ore') {
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
        // Move the blocking unit
        blockingUnit.tileX = newX
        blockingUnit.tileY = newY
        blockingUnit.x = newX * TILE_SIZE
        blockingUnit.y = newY * TILE_SIZE
        return true
      }
    }
  }

  return false // Could not move the blocking unit
}

// --- Collision Resolution for Idle Units ---
// When multiple units share the same tile, smoothly move them to their target positions
export function resolveUnitCollisions(units, mapGrid) {
  const assignedTiles = new Set()
  // Update each unit's tile coordinates based on their current positions.
  units.forEach(u => {
    if (!u.path || u.path.length === 0) {
      u.tileX = Math.floor(u.x / TILE_SIZE)
      u.tileY = Math.floor(u.y / TILE_SIZE)
    }
  })
  const tileOccupants = {}
  units.forEach(u => {
    if (!u.path || u.path.length === 0) {
      const key = `${u.tileX},${u.tileY}`
      if (!tileOccupants[key]) tileOccupants[key] = []
      tileOccupants[key].push(u)
    }
  })
  for (const key in tileOccupants) {
    const group = tileOccupants[key]
    const [tileX, tileY] = key.split(',').map(Number)
    // Desired center for units on this tile:
    const centerX = tileX * TILE_SIZE
    const centerY = tileY * TILE_SIZE
    // For primary unit, smoothly interpolate toward tile center.
    const primary = group[0]
    primary.x += (centerX - primary.x) * 0.2
    primary.y += (centerY - primary.y) * 0.2
    assignedTiles.add(key)
    // Directions for adjacent free tiles.
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 }
    ]
    // For additional units, find a free neighboring tile and smoothly move them.
    group.slice(1).forEach(u => {
      let placed = false
      // Shuffle directions for randomness.
      for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = directions[i]
        directions[i] = directions[j]
        directions[j] = temp
      }
      for (const { dx, dy } of directions) {
        const newTileX = tileX + dx
        const newTileY = tileY + dy
        if (
          newTileX < 0 ||
          newTileY < 0 ||
          newTileX >= mapGrid[0].length ||
          newTileY >= mapGrid.length
        )
          continue
        const tileType = mapGrid[newTileY][newTileX].type
        if (tileType === 'water' || tileType === 'rock' || tileType === 'building')
          continue
        const newKey = `${newTileX},${newTileY}`
        if (assignedTiles.has(newKey)) continue
        const targetX = newTileX * TILE_SIZE
        const targetY = newTileY * TILE_SIZE
        u.x += (targetX - u.x) * 0.2
        u.y += (targetY - u.y) * 0.2
        u.tileX = newTileX
        u.tileY = newTileY
        assignedTiles.add(newKey)
        placed = true
        break
      }
      if (!placed) {
        // If no adjacent tile is free, smoothly move toward the center.
        u.x += (centerX - u.x) * 0.2
        u.y += (centerY - u.y) * 0.2
      }
    })
  }
}

// --- Helper: Deselect All Units ---
// Call this function on a right-click event if it is not part of a map drag.
export function deselectUnits(units) {
  units.forEach(u => {
    u.selected = false
  })
}
