import { TILE_SIZE, MAP_TILES_X } from './config.js'
import { getUniqueId } from './utils.js'

export function findPath(start, end, mapGrid) {
  const openList = []
  const closedSet = new Set()
  const startNode = { x: start.x, y: start.y, g: 0, h: Math.abs(end.x - start.x) + Math.abs(end.y - start.y) }
  startNode.f = startNode.g + startNode.h
  openList.push(startNode)

  function nodeKey(node) {
    return `${node.x},${node.y}`
  }

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()
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
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ]
    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= mapGrid[0].length || neighbor.y >= mapGrid.length) continue
      const tileType = mapGrid[neighbor.y][neighbor.x].type
      if (tileType === 'water' || tileType === 'rock') continue
      if (closedSet.has(nodeKey(neighbor))) continue
      const gScore = current.g + 1
      const hScore = Math.abs(end.x - neighbor.x) + Math.abs(end.y - neighbor.y)
      const fScore = gScore + hScore
      const existing = openList.find(n => n.x === neighbor.x && n.y === neighbor.y)
      if (existing && existing.f <= fScore) continue
      openList.push({ x: neighbor.x, y: neighbor.y, g: gScore, h: hScore, f: fScore, parent: current })
    }
  }
  return [] // Kein Pfad gefunden
}

export function spawnUnit(factory, unitType, units) {
  let spawnX = factory.x + factory.width
  let spawnY = factory.y
  while (units.some(u => u.tileX === spawnX && u.tileY === spawnY)) {
    spawnX++
    if (spawnX >= MAP_TILES_X) {
      spawnX = factory.x
      spawnY++
    }
  }
  const unit = {
    id: getUniqueId(),
    type: unitType,
    owner: factory.id === 'player' ? 'player' : 'enemy',
    tileX: spawnX,
    tileY: spawnY,
    x: spawnX * TILE_SIZE,
    y: spawnY * TILE_SIZE,
    speed: unitType === 'tank' ? 2 : 1,
    health: unitType === 'tank' ? 100 : 150,
    maxHealth: unitType === 'tank' ? 100 : 150,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    harvestTimer: 0
  }
  return unit
}
