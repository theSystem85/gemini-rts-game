// units.js
import { TILE_SIZE } from './config.js'
import { getUniqueId } from './utils.js'
import { playSound } from './sound.js'

export const unitCosts = {
  tank: 1000,
  rocketTank: 2000,
  harvester: 500,
  'tank-v2': 2000
}

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
      let child2N = (n + 1) * 2
      let child1N = child2N - 1
      let swap = null
      if (child1N < length) {
        let child1 = this.content[child1N]
        if (child1.f < element.f) {
          swap = child1N
        }
      }
      if (child2N < length) {
        let child2 = this.content[child2N]
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
export function findPath(start, end, mapGrid, occupancyMap = null, pathFindingLimit = 1000) {
  if (
    end.x < 0 ||
    end.y < 0 ||
    end.x >= mapGrid[0].length ||
    end.y >= mapGrid.length
  ) {
    console.warn('findPath: destination tile out of bounds')
    return []
  }
  // Begin destination adjustment if not passable
  let adjustedEnd = { ...end }
  let destType = mapGrid[adjustedEnd.y][adjustedEnd.x].type
  if (destType === 'water' || destType === 'rock' || destType === 'building') {
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 }
    ]
    let found = false
    for (const dir of dirs) {
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
      console.warn('findPath: destination tile not passable and no adjacent free tile found')
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
  let nodesExplored = 0;
  while (openHeap.size() > 0) {
    const currentNode = openHeap.pop()
    const currentKey = `${currentNode.x},${currentNode.y}`

    if (currentNode.x === adjustedEnd.x && currentNode.y === adjustedEnd.y) {
      // Reconstruct path.
      let path = []
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
    nodesExplored++;
    if (nodesExplored > pathFindingLimit) {
      const bestNode = openHeap.content.reduce((best, node) => {
        const fScore = node.g + node.h;
        const bestFScore = best.g + best.h;
        return fScore < bestFScore ? node : best;
      }, openHeap.content[0]);
      let path = [];
      let curr = bestNode;
      while (curr) {
        path.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path.reverse();
    }
  }
  // If no path is found, return an empty array.
  return []
}

function getNeighbors(node, mapGrid) {
  const neighbors = []
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ]
  
  for (const dir of dirs) {
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

// Spawns a unit at the center ("under") of the factory.
export function spawnUnit(factory, type, units, mapGrid) {
  // Check if player has enough money
  const unitCost = {
    'tank': 1000,
    'rocketTank': 2000,
    'harvester': 500,
    'tank-v2': 2000 // Update cost to $2000
  };

  const spawnX = factory.x + Math.floor(factory.width / 2);
  const spawnY = factory.y + Math.floor(factory.height / 2);
  
  // First try direct spawn at factory exit point (just below the factory)
  const exitX = spawnX;
  const exitY = spawnY + 1; // Position below factory
  
  // Check if exit is blocked by another unit and try to move it
  const exitBlocked = units.some(unit => 
    Math.floor(unit.x / TILE_SIZE) === exitX && 
    Math.floor(unit.y / TILE_SIZE) === exitY
  );
  
  // If exit is blocked, try to move blocking units as per requirement 3.1.7
  if (exitBlocked) {
    const success = moveBlockingUnits(exitX, exitY, units, mapGrid);
    if (success) {
      // Successfully moved blocking unit, spawn at exit
      const newUnit = createUnit(factory, type, exitX, exitY);
      
      // If factory has a rally point, set unit's path to it
      if (factory.rallyPoint) {
        const path = findPath(
          { x: exitX, y: exitY },
          { x: factory.rallyPoint.x, y: factory.rallyPoint.y },
          mapGrid,
          null
        );
        if (path.length > 1) {
          newUnit.path = path.slice(1);
        }
      }
      
      return newUnit;
    }
  } else if (isPositionValid(exitX, exitY, mapGrid, units)) {
    // Exit is free, spawn there
    const newUnit = createUnit(factory, type, exitX, exitY);
    
    // If factory has a rally point, set unit's path to it
    if (factory.rallyPoint) {
      const path = findPath(
        { x: exitX, y: exitY },
        { x: factory.rallyPoint.x, y: factory.rallyPoint.y },
        mapGrid,
        null
      );
      if (path.length > 1) {
        newUnit.path = path.slice(1);
      }
    }
    playSound('unitReady')
    
    return newUnit;
  }
  
  // If direct exit spawn failed, find another position
  const spawnPosition = findAvailableSpawnPosition(factory, mapGrid, units);
  if (!spawnPosition) {
    console.warn('No available spawn position for new unit');
    return null; // Return null if no position is available
  }
  
  const newUnit = createUnit(factory, type, spawnPosition.x, spawnPosition.y);
  
  // If factory has a rally point, set unit's path to it
  if (factory.rallyPoint) {
    const path = findPath(
      { x: spawnPosition.x, y: spawnPosition.y },
      { x: factory.rallyPoint.x, y: factory.rallyPoint.y },
      mapGrid,
      null
    );
    if (path.length > 1) {
      newUnit.path = path.slice(1);
    }
  }
  
  return newUnit;
}

// Helper to create the actual unit object
function createUnit(factory, unitType, x, y) {
  const unit = {
    id: getUniqueId(),
    type: unitType,  // "tank", "rocketTank", or "harvester"
    owner: factory.id === 'player' ? 'player' : 'enemy',
    tileX: x,
    tileY: y,
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    speed: (unitType === 'harvester') ? 1 : 2,
    health: (unitType === 'harvester') ? 150 : 100,
    maxHealth: (unitType === 'harvester') ? 150 : 100,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    spawnTime: Date.now(),
    spawnedInFactory: false,
    // Add rotation properties for all unit types
    direction: 0, // Angle in radians (0 = east, PI/2 = south)
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: 0.1, // Radians per frame
    isRotating: false,
    useAimAhead: false // Default: Don't use aim-ahead for other units
  };

  // Apply unit-specific properties
  if (unitType === 'tank-v2') {
    unit.speed = 1.5
    unit.rotationSpeed = 0.15
    unit.alertMode = true  // Start tank-v2 in alert mode by default
    unit.useAimAhead = true
  } else if (unitType === 'tank') {
    unit.speed = 1.5
    unit.rotationSpeed = 0.15
  } else if (unitType === 'rocketTank') {
    unit.speed = 1.3
    unit.rotationSpeed = 0.12
  } else if (unitType === 'harvester') {
    unit.speed = 1.8
    unit.rotationSpeed = 0.2
    unit.oreCarried = 0
    unit.harvesting = false
  }

  return unit;
}

// Find an available position near the factory for unit spawn
function findAvailableSpawnPosition(factory, mapGrid, units) {
  // First, try positions around the factory in a spiral pattern
  const directions = [
    { x: 0, y: 1 },  // south
    { x: 1, y: 0 },  // east
    { x: 0, y: -1 }, // north
    { x: -1, y: 0 }  // west
    // Add diagonals for more options
    ,{ x: 1, y: 1 },  // southeast
    { x: 1, y: -1 },  // northeast
    { x: -1, y: -1 }, // northwest
    { x: -1, y: 1 }   // southwest
  ];
  
  // Factory center and dimensions
  const factoryX = factory.x + Math.floor(factory.width / 2);
  const factoryY = factory.y + Math.floor(factory.height / 2);
  
  // Check immediate surrounding tiles first (1 tile away)
  for (let distance = 1; distance <= 5; distance++) {
    for (const dir of directions) {
      const x = factoryX + dir.x * distance;
      const y = factoryY + dir.y * distance;
      
      // Check if position is valid
      if (isPositionValid(x, y, mapGrid, units)) {
        return { x, y };
      }
    }
  }
  
  // If we couldn't find a position in the immediate vicinity,
  // expand the search with a more thorough approach
  for (let distance = 1; distance <= 10; distance++) {
    // Check in a square pattern around the factory
    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        // Skip positions we've already checked (inner square)
        if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue;
        
        const x = factoryX + dx;
        const y = factoryY + dy;
        
        if (isPositionValid(x, y, mapGrid, units)) {
          return { x, y };
        }
      }
    }
  }
  
  // No valid position found
  return null;
}

// Helper function to check if a position is valid for unit spawn
function isPositionValid(x, y, mapGrid, units) {
  // Check if position is within bounds
  if (x < 0 || y < 0 || y >= mapGrid.length || x >= mapGrid[0].length) {
    return false;
  }
  
  // Check if tile is passable (not a building, rock, etc.)
  if (mapGrid[y][x].type !== 'land' && mapGrid[y][x].type !== 'street' && mapGrid[y][x].type !== 'ore') {
    return false;
  }
  
  // Check if tile is occupied by another unit
  const isOccupied = units.some(unit => 
    Math.floor(unit.x / TILE_SIZE) === x && 
    Math.floor(unit.y / TILE_SIZE) === y
  );
  
  return !isOccupied;
}

// Implementation of algorithm A1: move blocking units to make room
export function moveBlockingUnits(targetX, targetY, units, mapGrid) {
  // Find any unit blocking the target position
  const blockingUnit = units.find(unit => 
    Math.floor(unit.x / TILE_SIZE) === targetX && 
    Math.floor(unit.y / TILE_SIZE) === targetY
  );
  
  if (!blockingUnit) return true; // No blocking unit
  
  // Find the closest free tile to move the blocking unit
  const directions = [
    {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0},  // Cardinals
    {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}  // Diagonals
  ];
  
  for (let distance = 1; distance <= 3; distance++) {
    for (const dir of directions) {
      const newX = targetX + dir.x * distance;
      const newY = targetY + dir.y * distance;
      
      if (isPositionValid(newX, newY, mapGrid, units)) {
        // Move the blocking unit
        blockingUnit.tileX = newX;
        blockingUnit.tileY = newY;
        blockingUnit.x = newX * TILE_SIZE;
        blockingUnit.y = newY * TILE_SIZE;
        return true;
      }
    }
  }
  
  return false; // Couldn't move blocking unit
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
