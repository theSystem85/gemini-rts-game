// units.js
import { TILE_SIZE, PATHFINDING_THRESHOLD } from './config.js'
import { getUniqueId } from './utils.js'
import { isImpassableTile } from './movementUtils.js'

// Cache for occupancy map to improve performance
let cachedOccupancyMap = null;
let lastOccupancyUpdateTime = 0;
const OCCUPANCY_CACHE_LIFETIME = 100; // 100ms cache lifetime

// Build an occupancy map indicating which tiles are occupied by a unit.
export function buildOccupancyMap(units, mapGrid) {
  const now = performance.now();
  
  // Return cached map if it's still valid
  if (cachedOccupancyMap && now - lastOccupancyUpdateTime < OCCUPANCY_CACHE_LIFETIME) {
    return cachedOccupancyMap;
  }
  
  // Initialize a new occupancy map
  const occupancyMap = Array(mapGrid.length).fill().map(() => 
    Array(mapGrid[0].length).fill(false)
  );
  
  // Mark tiles occupied by units
  for (const unit of units) {
    if (unit.health <= 0) continue;
    
    const tileX = Math.floor(unit.x / TILE_SIZE);
    const tileY = Math.floor(unit.y / TILE_SIZE);
    
    if (tileY >= 0 && tileY < occupancyMap.length &&
        tileX >= 0 && tileX < occupancyMap[0].length) {
      occupancyMap[tileY][tileX] = true;
    }
  }
  
  // Update cache
  cachedOccupancyMap = occupancyMap;
  lastOccupancyUpdateTime = now;
  
  return occupancyMap;
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

// Calculate the heuristic cost for A* pathfinding
function calculateHeuristic(x1, y1, x2, y2) {
  // Using Manhattan distance with a slight diagonal preference
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  return (dx + dy) * 1.001 - Math.min(dx, dy) * 0.001;
}

// A* pathfinding with diagonal movement and cost advantage for street tiles.
// Early exits if destination is out of bounds or impassable.
export function findPath(start, end, mapGrid, occupancyMap = null, pathFindingLimit = 1000) {
  // Early exit checks for invalid input
  if (!start || !end || !mapGrid || !mapGrid.length) return [];
  
  // If start and end are the same, return empty path
  if (start.x === end.x && start.y === end.y) return [];
  
  // Create local copy of end point for possible adjustments
  let adjustedEnd = { ...end };
  
  // Quick bounds check
  if (adjustedEnd.y < 0 || adjustedEnd.y >= mapGrid.length || 
      adjustedEnd.x < 0 || adjustedEnd.x >= mapGrid[0].length) {
    // If out of bounds, find closest valid point
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 }
    ];
    
    // Find a valid tile nearby
    adjustedEnd = findNearestValidTile(adjustedEnd, mapGrid);
    
    // If still no valid endpoint found, return empty path
    if (!adjustedEnd) return [];
  }
  
  // Check if destination is on an impassable tile type
  const destTileType = mapGrid[adjustedEnd.y][adjustedEnd.x].type;
  if (isImpassableTile(destTileType)) {
    // Try to find a valid tile nearby
    adjustedEnd = findNearestValidTile(adjustedEnd, mapGrid);
    
    // If no valid endpoint found, return empty path
    if (!adjustedEnd) return [];
  }
  
  // Check if we should use the occupancy map
  // Only use it if the path is long enough to warrant the extra checks
  const useOccupancyMap = occupancyMap && 
    Math.abs(start.x - adjustedEnd.x) + Math.abs(start.y - adjustedEnd.y) > PATHFINDING_THRESHOLD;
  
  // Initialize pathfinding structures
  const openHeap = new MinHeap();
  const closedSet = new Set();
  
  // Add starting node to open heap
  openHeap.push({
    x: start.x,
    y: start.y,
    g: 0,
    h: calculateHeuristic(start.x, start.y, adjustedEnd.x, adjustedEnd.y),
    f: calculateHeuristic(start.x, start.y, adjustedEnd.x, adjustedEnd.y),
    parent: null
  });
  
  // Track nodes explored for limits
  let nodesExplored = 0;
  
  // Main A* loop
  while (openHeap.size() > 0) {
    // Get the node with lowest f score
    const currentNode = openHeap.pop();
    const currentKey = `${currentNode.x},${currentNode.y}`;
    
    // Check if we reached the destination
    if (currentNode.x === adjustedEnd.x && currentNode.y === adjustedEnd.y) {
      // Reconstruct path
      return reconstructPath(currentNode);
    }
    
    // Add to closed set
    closedSet.add(currentKey);
    
    // Get neighbors
    const neighbors = getNeighbors(currentNode, mapGrid);
    
    // Process each neighbor
    for (const neighbor of neighbors) {
      // Skip if already evaluated
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;
      
      // Skip if occupancyMap is provided and the tile is occupied
      if (useOccupancyMap && occupancyMap[neighbor.y][neighbor.x]) continue;
      
      // Calculate movement cost to this neighbor
      // Diagonal movement costs more than cardinal movement
      const isDiagonal = neighbor.x !== currentNode.x && neighbor.y !== currentNode.y;
      const movementCost = isDiagonal ? 1.41 : 1.0;
      
      // Give bonus movement for streets
      const isStreet = mapGrid[neighbor.y][neighbor.x].type === 'street';
      const terrainFactor = isStreet ? 0.67 : 1.0; // 33% less cost (50% faster) on streets
      
      // Calculate g score (cost from start to this neighbor via current path)
      const gScore = currentNode.g + (movementCost * terrainFactor);
      
      // Check if neighbor is already in open heap
      let foundInHeap = false;
      for (const node of openHeap.content) {
        if (node.x === neighbor.x && node.y === neighbor.y) {
          foundInHeap = true;
          
          // If this path is better, update the node
          if (gScore < node.g) {
            node.g = gScore;
            node.f = gScore + node.h;
            node.parent = currentNode;
            openHeap.bubbleUp(openHeap.content.indexOf(node));
          }
          break;
        }
      }
      
      // If not in open heap, add it
      if (!foundInHeap) {
        const hScore = calculateHeuristic(neighbor.x, neighbor.y, adjustedEnd.x, adjustedEnd.y);
        const neighborNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: currentNode
        };
        openHeap.push(neighborNode);
      }
    }
    
    // Check path exploration limit
    nodesExplored++;
    if (nodesExplored > pathFindingLimit) {
      // If we hit the limit, return the best partial path
      return getBestPartialPath(openHeap, adjustedEnd);
    }
  }
  
  // If open heap is empty and no path found, return empty path
  return [];
}

// Helper to find the nearest valid (non-impassable) tile
function findNearestValidTile(position, mapGrid) {
  const maxRadius = 5; // Maximum search radius
  
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check perimeter
        if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue;
        
        const nx = position.x + dx;
        const ny = position.y + dy;
        
        // Check bounds
        if (ny < 0 || ny >= mapGrid.length || nx < 0 || nx >= mapGrid[0].length) {
          continue;
        }
        
        // Check if this tile is valid (not impassable)
        const tileType = mapGrid[ny][nx].type;
        if (!isImpassableTile(tileType)) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  
  // No valid tile found
  return null;
}

// Helper to reconstruct the path from A* search result
function reconstructPath(endNode) {
  let path = [];
  let curr = endNode;
  
  while (curr) {
    path.push({ x: curr.x, y: curr.y });
    curr = curr.parent;
  }
  
  return path.reverse();
}

// When pathfinding hits its limit, get the best partial path
function getBestPartialPath(openHeap, target) {
  // If heap is empty, return empty path
  if (openHeap.content.length === 0) return [];
  
  // Find the node with best f-score
  const bestNode = openHeap.content.reduce((best, node) => {
    return node.f < best.f ? node : best;
  }, openHeap.content[0]);
  
  // Reconstruct path to this best node
  return reconstructPath(bestNode);
}

// Get neighbors for a node in the grid
function getNeighbors(node, mapGrid) {
  const neighbors = [];
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ];
  
  // Check if mapGrid or node is undefined
  if (!mapGrid || !node || typeof node.x !== 'number' || typeof node.y !== 'number') {
    return neighbors;
  }
  
  // Check if mapGrid has content
  if (!mapGrid.length || !mapGrid[0] || !mapGrid[0].length) {
    return neighbors;
  }
  
  for (const dir of dirs) {
    const x = node.x + dir.x;
    const y = node.y + dir.y;
    
    // Check bounds
    if (y < 0 || y >= mapGrid.length || x < 0 || x >= mapGrid[0].length) {
      continue;
    }
    
    // Make sure the grid cell exists before accessing its properties
    if (!mapGrid[y] || !mapGrid[y][x]) {
      continue;
    }
    
    // Check if this tile is passable
    const tileType = mapGrid[y][x].type;
    
    if (!isImpassableTile(tileType)) {
      neighbors.push({ x, y });
    }
  }
  
  return neighbors;
}

// Spawns a unit at the center ("under") of the factory.
export function spawnUnit(factory, unitType, units, mapGrid) {
  // Find an available position for unit spawn
  const spawn = findAvailableSpawnPosition(factory, mapGrid, units);
  if (!spawn) return null;
  
  // Create the unit
  const newUnit = createUnit(factory, unitType, spawn.x, spawn.y);
  
  // Mark that unit just spawned (for visual effects, etc)
  newUnit.spawnedInFactory = true;
  
  return newUnit;
}

// Helper to create the actual unit object
function createUnit(factory, unitType, x, y) {
  return {
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
    // Add pathfinding optimization properties
    lastPathCalcTime: 0,
    recalculatingPath: false,
    pathfindingAttempted: false,
  };
}

// Find an available position near the factory for unit spawn
function findAvailableSpawnPosition(factory, mapGrid, units) {
  // First try inside the factory (center)
  const centerX = Math.floor(factory.x + factory.width / 2);
  const centerY = Math.floor(factory.y + factory.height / 2);
  
  if (isPositionValid(centerX, centerY, mapGrid, units)) {
    return { x: centerX, y: centerY };
  }
  
  // Try positions adjacent to the factory
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      // Skip the actual factory tiles
      if (x >= factory.x && x < factory.x + factory.width && 
          y >= factory.y && y < factory.y + factory.height) {
        continue;
      }
      
      if (isPositionValid(x, y, mapGrid, units)) {
        return { x, y };
      }
    }
  }
  
  // If still no position found, search in expanding square
  const maxRadius = 5;
  for (let radius = 2; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check perimeter
        if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue;
        
        const x = centerX + dx;
        const y = centerY + dy;
        
        if (isPositionValid(x, y, mapGrid, units)) {
          return { x, y };
        }
      }
    }
  }
  
  return null;
}

// Helper function to check if a position is valid for unit spawn
function isPositionValid(x, y, mapGrid, units) {
  // Check bounds
  if (y < 0 || y >= mapGrid.length || x < 0 || x >= mapGrid[0].length) {
    return false;
  }
  
  // Check if tile type is valid (not water or rock)
  const tileType = mapGrid[y][x].type;
  if (isImpassableTile(tileType)) {
    return false;
  }
  
  // Check if any unit already occupies this position
  for (const unit of units) {
    const unitTileX = Math.floor(unit.x / TILE_SIZE);
    const unitTileY = Math.floor(unit.y / TILE_SIZE);
    
    if (unitTileX === x && unitTileY === y) {
      return false;
    }
  }
  
  return true;
}

// Implementation of algorithm A1: move blocking units to make room
export function moveBlockingUnits(targetX, targetY, units, mapGrid) {
  // Find units at this position
  const unitsToMove = units.filter(unit => {
    const unitTileX = Math.floor(unit.x / TILE_SIZE);
    const unitTileY = Math.floor(unit.y / TILE_SIZE);
    return unitTileX === targetX && unitTileY === targetY;
  });
  
  if (!unitsToMove.length) return;
  
  // Sort by health (lowest first) to prioritize moving weaker units
  unitsToMove.sort((a, b) => a.health - b.health);
  
  // Get possible directions to move
  const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }, // West
    { dx: 1, dy: -1 }, // Northeast
    { dx: 1, dy: 1 },  // Southeast
    { dx: -1, dy: 1 }, // Southwest
    { dx: -1, dy: -1 } // Northwest
  ];
  
  // Shuffle directions to avoid bias
  directions.sort(() => Math.random() - 0.5);
  
  // Try to move each unit
  for (const unit of unitsToMove) {
    // Skip if the unit is in the middle of harvesting or has a specific target
    if (unit.harvesting || unit.target) continue;
    
    for (const dir of directions) {
      const newX = targetX + dir.dx;
      const newY = targetY + dir.dy;
      
      // Check if the new position is valid
      if (isPositionValid(newX, newY, mapGrid, units)) {
        // Set a new path for this unit
        unit.path = [{ x: newX, y: newY }];
        break;
      }
    }
  }
}

// --- Collision Resolution for Idle Units ---
// When multiple units share the same tile, smoothly move them to their target positions
export function resolveUnitCollisions(units, mapGrid) {
  // Group units by tile position
  const tileToUnits = new Map();
  
  for (const unit of units) {
    if (unit.health <= 0) continue;
    
    const tileX = Math.floor(unit.x / TILE_SIZE);
    const tileY = Math.floor(unit.y / TILE_SIZE);
    const tileKey = `${tileX},${tileY}`;
    
    if (!tileToUnits.has(tileKey)) {
      tileToUnits.set(tileKey, []);
    }
    
    tileToUnits.get(tileKey).push(unit);
  }
  
  // Process tiles with multiple units
  for (const [tileKey, tileUnits] of tileToUnits.entries()) {
    if (tileUnits.length <= 1) continue;
    
    // Only adjust idle units (no path, no target)
    const idleUnits = tileUnits.filter(unit => 
      !unit.path.length && !unit.target && !unit.harvesting
    );
    
    if (idleUnits.length <= 1) continue;
    
    // Calculate center of tile
    const [tileX, tileY] = tileKey.split(',').map(Number);
    const tileCenterX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const tileCenterY = tileY * TILE_SIZE + TILE_SIZE / 2;
    
    // Distribute units in a circle around the center
    const radius = TILE_SIZE * 0.3;
    const angleStep = (2 * Math.PI) / idleUnits.length;
    
    idleUnits.forEach((unit, index) => {
      const angle = angleStep * index;
      const targetX = tileCenterX + radius * Math.cos(angle);
      const targetY = tileCenterY + radius * Math.sin(angle);
      
      // Move unit slightly towards target position (smooth movement)
      const dx = targetX - unit.x;
      const dy = targetY - unit.y;
      const distance = Math.hypot(dx, dy);
      
      if (distance > 1) {
        const moveFactor = 0.05; // Smooth movement factor
        unit.x += dx * moveFactor;
        unit.y += dy * moveFactor;
      }
    });
  }
}

// --- Helper: Deselect All Units ---
// Call this function on a right-click event if it is not part of a map drag.
export function deselectUnits(units) {
  units.forEach(unit => {
    unit.selected = false;
  });
}

// Export these utility functions to be used in updateGame.js
export const movementUtils = {
  getNeighbors,
  isPositionValid
};
