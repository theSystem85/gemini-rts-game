// units.js
import { TILE_SIZE } from './config.js';
import { getUniqueId } from './utils.js';

// Build an occupancy map, marking which tiles are occupied.
export function buildOccupancyMap(units, mapGrid) {
  const occupancy = [];
  for (let y = 0; y < mapGrid.length; y++) {
    occupancy[y] = [];
    for (let x = 0; x < mapGrid[0].length; x++) {
      occupancy[y][x] = false;
    }
  }
  units.forEach(unit => {
    occupancy[unit.tileY][unit.tileX] = true;
  });
  return occupancy;
}

// A* pathfinding with diagonal movement (8 neighbors).
export function findPath(start, end, mapGrid, occupancyMap = null) {
  const openList = [];
  const closedSet = new Set();
  const startNode = { x: start.x, y: start.y, g: 0, h: Math.hypot(end.x - start.x, end.y - start.y) };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  function nodeKey(node) {
    return `${node.x},${node.y}`;
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
  ];

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift();
    if (current.x === end.x && current.y === end.y) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }
    closedSet.add(nodeKey(current));
    for (const dir of directions) {
      const neighbor = { x: current.x + dir.x, y: current.y + dir.y };
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= mapGrid[0].length || neighbor.y >= mapGrid.length)
        continue;
      const tileType = mapGrid[neighbor.y][neighbor.x].type;
      if (tileType === 'water' || tileType === 'rock' || tileType === 'building')
        continue;
      if (occupancyMap && occupancyMap[neighbor.y][neighbor.x] && !(neighbor.x === end.x && neighbor.y === end.y))
        continue;
      if (closedSet.has(nodeKey(neighbor)))
        continue;
      const cost = (dir.x !== 0 && dir.y !== 0) ? Math.SQRT2 : 1;
      const gScore = current.g + cost;
      const hScore = Math.hypot(end.x - neighbor.x, end.y - neighbor.y);
      const fScore = gScore + hScore;
      const existing = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);
      if (existing && existing.f <= fScore)
        continue;
      openList.push({ x: neighbor.x, y: neighbor.y, g: gScore, h: hScore, f: fScore, parent: current });
    }
  }
  return []; // No valid path found.
}

// Spawns a unit near the given factory, avoiding building tiles.
export function spawnUnit(factory, unitType, units, mapGrid) {
  let spawnX = factory.x + factory.width;
  let spawnY = factory.y;
  while (
    units.some(u => u.tileX === spawnX && u.tileY === spawnY) ||
    mapGrid[spawnY][spawnX].type === 'building'
  ) {
    spawnX++;
    if (spawnX >= mapGrid[0].length) {
      spawnX = factory.x;
      spawnY++;
      if (spawnY >= mapGrid.length) break;
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
  };
  return unit;
}
