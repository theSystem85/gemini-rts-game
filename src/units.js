// units.js
import { TILE_SIZE } from './config.js'
import { getUniqueId } from './utils.js'

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
export function findPath(start, end, mapGrid, occupancyMap = null) {
  if (
    end.x < 0 ||
    end.y < 0 ||
    end.x >= mapGrid[0].length ||
    end.y >= mapGrid.length
  ) {
    console.warn('findPath: destination tile out of bounds')
    return []
  }
  const destType = mapGrid[end.y][end.x].type
  if (destType === 'water' || destType === 'rock' || destType === 'building') {
    console.warn('findPath: destination tile not passable')
    return []
  }
  
  // Initialize A* search.
  const openHeap = new MinHeap()
  const closedSet = new Set()
  const startNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: Math.hypot(end.x - start.x, end.y - start.y),
    f: 0,
    parent: null
  }
  startNode.f = startNode.g + startNode.h
  openHeap.push(startNode)

  // Removed any maximum iteration check to ensure players' units can always move.
  while (openHeap.size() > 0) {
    const currentNode = openHeap.pop()
    const currentKey = `${currentNode.x},${currentNode.y}`

    if (currentNode.x === end.x && currentNode.y === end.y) {
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
        const hScore = Math.hypot(end.x - neighbor.x, end.y - neighbor.y)
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
export function spawnUnit(factory, unitType, units, mapGrid) {
  const spawnX = factory.x + Math.floor(factory.width / 2)
  const spawnY = factory.y + Math.floor(factory.height / 2)
  return {
    id: getUniqueId(),
    type: unitType,  // "tank", "rocketTank", or "harvester"
    owner: factory.id === 'player' ? 'player' : 'enemy',
    tileX: spawnX,
    tileY: spawnY,
    x: spawnX * TILE_SIZE,
    y: spawnY * TILE_SIZE,
    speed: (unitType === 'harvester') ? 1 : 2,
    health: (unitType === 'harvester') ? 150 : 100,
    maxHealth: (unitType === 'harvester') ? 150 : 100,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    spawnTime: Date.now(),
    spawnedInFactory: true
  }
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
