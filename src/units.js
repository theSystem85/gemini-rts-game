import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { getUniqueId } from './utils.js'

// Baut eine Belegungs‑Map, in der für jede Kachel (Tile) vermerkt wird, ob bereits eine Einheit steht.
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

// A* Pfadfindung: Gibt einen Pfad (als Array von Tile-Koordinaten) vom Start- zum Zielpunkt zurück.
// Optional kann eine occupancyMap übergeben werden, die belegte Kacheln ausschließt.
export function findPath(start, end, mapGrid, occupancyMap = null) {
  const openList = [];
  const closedSet = new Set();
  const startNode = { x: start.x, y: start.y, g: 0, h: Math.abs(end.x - start.x) + Math.abs(end.y - start.y) };
  startNode.f = startNode.g + startNode.h;
  openList.push(startNode);

  function nodeKey(node) {
    return `${node.x},${node.y}`;
  }

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
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];
    for (const neighbor of neighbors) {
      // Prüfe, ob der Nachbarkachel innerhalb der Map liegt
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= mapGrid[0].length || neighbor.y >= mapGrid.length)
        continue;
      // Kacheln mit Wasser, Felsen oder Gebäuden blockieren den Weg
      const tileType = mapGrid[neighbor.y][neighbor.x].type;
      if (tileType === 'water' || tileType === 'rock' || tileType === 'building')
        continue;
      // Falls eine occupancyMap übergeben wurde, wird belegt geprüft (außer wenn es das Ziel ist)
      if (occupancyMap && occupancyMap[neighbor.y][neighbor.x] && !(neighbor.x === end.x && neighbor.y === end.y))
        continue;
      if (closedSet.has(nodeKey(neighbor)))
        continue;
      const gScore = current.g + 1;
      const hScore = Math.abs(end.x - neighbor.x) + Math.abs(end.y - neighbor.y);
      const fScore = gScore + hScore;
      const existing = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);
      if (existing && existing.f <= fScore)
        continue;
      openList.push({ x: neighbor.x, y: neighbor.y, g: gScore, h: hScore, f: fScore, parent: current });
    }
  }
  return []; // Kein gültiger Pfad gefunden
}

// Spawnt eine Einheit in der Nähe der Fabrik. Dabei wird verhindert, dass
// die Einheit in einer "building"-Kachel erscheint oder bereits besetzt ist.
export function spawnUnit(factory, unitType, units, mapGrid) {
  let spawnX = factory.x + factory.width;
  let spawnY = factory.y;
  // Solange die Kachel bereits von einer Einheit belegt ist oder als "building" markiert ist, suche weiter.
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
