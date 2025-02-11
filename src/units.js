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
    occupancy[unit.tileY][unit.tileX] = true
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
// Now includes an early exit if the destination is out of bounds or impassable.
export function findPath(start, end, mapGrid, occupancyMap = null) {
  // If destination is not within map boundaries, return empty path.
  if (
    end.x < 0 ||
    end.y < 0 ||
    end.x >= mapGrid[0].length ||
    end.y >= mapGrid.length
  ) {
    console.warn('findPath: destination tile out of bounds')
    return []
  }
  // Early exit: if destination tile is impassable.
  const destType = mapGrid[end.y][end.x].type
  if (destType === 'water' || destType === 'rock' || destType === 'building') {
    console.warn('findPath: destination tile not passable')
    return []
  }

  const openHeap = new MinHeap()
  const closedSet = new Set()
  const startNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: Math.hypot(end.x - start.x, end.y - start.y)
  }
  startNode.f = startNode.g + startNode.h
  openHeap.push(startNode)

  function nodeKey(node) {
    return `${node.x},${node.y}`
  }

  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ]

  let iterations = 0
  const maxIterations = 10000  // safety cutoff
  while (openHeap.size() > 0) {
    if (++iterations > maxIterations) {
      console.warn('findPath: reached maximum iterations')
      return []
    }
    const current = openHeap.pop()
    if (current.x === end.x && current.y === end.y) {
      const path = []
      let node = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return path
    }
    closedSet.add(nodeKey(current))
    for (const dir of directions) {
      const nx = current.x + dir.x
      const ny = current.y + dir.y
      if (nx < 0 || ny < 0 || nx >= mapGrid[0].length || ny >= mapGrid.length) continue
      const tileType = mapGrid[ny][nx].type
      if (tileType === 'water' || tileType === 'rock' || tileType === 'building') continue
      if (occupancyMap && occupancyMap[ny][nx] && !(nx === end.x && ny === end.y)) continue
      if (closedSet.has(`${nx},${ny}`)) continue
      let baseCost = (dir.x !== 0 && dir.y !== 0) ? Math.SQRT2 : 1
      const multiplier = (tileType === 'street') ? 0.5 : 1
      const cost = baseCost * multiplier
      const gScore = current.g + cost
      const hScore = Math.hypot(end.x - nx, end.y - ny)
      const fScore = gScore + hScore
      const newNode = {
        x: nx,
        y: ny,
        g: gScore,
        h: hScore,
        f: fScore,
        parent: current
      }
      openHeap.push(newNode)
    }
  }
  return []
}

// Spawns a unit at the center ("under") of the factory.
export function spawnUnit(factory, unitType, units, mapGrid) {
  const spawnX = factory.x + Math.floor(factory.width / 2)
  const spawnY = factory.y + Math.floor(factory.height / 2)
  const unit = {
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
  return unit
}
