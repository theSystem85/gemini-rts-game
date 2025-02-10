// units.js
import { TILE_SIZE } from './config.js';
import { getUniqueId } from './utils.js';

// Build an occupancy map indicating which tiles are occupied by a unit.
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

// A* pathfinding with diagonal movement and a cost advantage for "street" tiles.
export function findPath(start, end, mapGrid, occupancyMap = null) {
  const openList = [];
  const closedSet = new Set();
  const startNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: Math.hypot(end.x - start.x, end.y - start.y)
  };
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
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (nx < 0 || ny < 0 || nx >= mapGrid[0].length || ny >= mapGrid.length) {
        continue;
      }
      const tileType = mapGrid[ny][nx].type;
      // Skip water, rock, building tiles.
      if (tileType === 'water' || tileType === 'rock' || tileType === 'building') {
        continue;
      }
      // If occupancy map is given, skip if occupied (unless it's the end).
      if (occupancyMap && occupancyMap[ny][nx] && !(nx === end.x && ny === end.y)) {
        continue;
      }
      if (closedSet.has(`${nx},${ny}`)) {
        continue;
      }
      // Base cost for orth/diag movement.
      let baseCost = (dir.x !== 0 && dir.y !== 0) ? Math.SQRT2 : 1;
      // If it's a street, half the cost.
      const multiplier = (tileType === 'street') ? 0.5 : 1;
      const cost = baseCost * multiplier;

      const gScore = current.g + cost;
      const hScore = Math.hypot(end.x - nx, end.y - ny);
      const fScore = gScore + hScore;
      const existing = openList.find(n => n.x === nx && n.y === ny);
      if (existing && existing.f <= fScore) {
        continue;
      }
      openList.push({
        x: nx,
        y: ny,
        g: gScore,
        h: hScore,
        f: fScore,
        parent: current
      });
    }
  }
  return [];
}

// Spawns a unit near a factory by searching a small radius around the factory.
export function spawnUnit(factory, unitType, units, mapGrid) {
  const startX = factory.x + factory.width;
  const startY = factory.y;
  let spawnX = startX;
  let spawnY = startY;
  const maxRadius = 5;
  let found = false;
  for (let r = 0; r <= maxRadius && !found; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue;
        if (mapGrid[y][x].type === 'building') continue;
        if (units.some(u => u.tileX === x && u.tileY === y)) continue;
        spawnX = x;
        spawnY = y;
        found = true;
        break;
      }
      if (found) break;
    }
  }
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
    harvestTimer: 0
  };
  return unit;
}
