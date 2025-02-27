export function generateMap(width, height, seed = null) {
  // Use provided seed or generate a random one
  const mapSeed = seed || Math.floor(Math.random() * 1000000);
  const rng = new SeededRandom(mapSeed);
  
  // Initialize empty map
  const map = {
    width,
    height,
    tiles: Array(height).fill().map(() => Array(width).fill().map(() => ({
      type: 'grass',
      isObstacle: false
    }))),
    seed: mapSeed
  };
  
  // Place bases at opposite corners
  const baseSize = 3;
  const playerBase = { x: 2, y: 2 };
  const enemyBase = { x: width - 3, y: height - 3 };
  
  // Place player base
  placeBase(map, playerBase, baseSize, 'player');
  
  // Place enemy base
  placeBase(map, enemyBase, baseSize, 'enemy');
  
  // Generate obstacles (trees, rocks, etc.)
  generateObstacles(map, rng, playerBase, enemyBase);
  
  // Generate a road connecting the bases
  generateRoad(map, playerBase, enemyBase, rng);
  
  // Generate resources
  generateResources(map, rng, playerBase, enemyBase);
  
  return map;
}

function placeBase(map, position, size, faction) {
  for (let y = position.y - size; y <= position.y + size; y++) {
    for (let x = position.x - size; x <= position.x + size; x++) {
      if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
        map.tiles[y][x].type = `${faction}_base`;
        map.tiles[y][x].faction = faction;
      }
    }
  }
}

function generateObstacles(map, rng, playerBase, enemyBase) {
  const obstacleCount = Math.floor(map.width * map.height * 0.1); // 10% of the map
  
  for (let i = 0; i < obstacleCount; i++) {
    let x, y;
    
    // Find a valid position for obstacle
    do {
      x = Math.floor(rng.random() * map.width);
      y = Math.floor(rng.random() * map.height);
    } while (
      // Avoid bases
      (Math.abs(x - playerBase.x) < 5 && Math.abs(y - playerBase.y) < 5) ||
      (Math.abs(x - enemyBase.x) < 5 && Math.abs(y - enemyBase.y) < 5) ||
      // Avoid existing obstacles
      map.tiles[y][x].isObstacle
    );
    
    map.tiles[y][x].type = rng.random() < 0.5 ? 'tree' : 'rock';
    map.tiles[y][x].isObstacle = true;
  }
}

function generateRoad(map, playerBase, enemyBase, rng) {
  let current = {...playerBase};
  const target = {...enemyBase};
  
  while (current.x !== target.x || current.y !== target.y) {
    map.tiles[current.y][current.x].type = 'road';
    map.tiles[current.y][current.x].isObstacle = false;
    
    // Move closer to target, with some randomness
    if (rng.random() < 0.5) {
      current.x += current.x < target.x ? 1 : -1;
    } else {
      current.y += current.y < target.y ? 1 : -1;
    }
    
    // Make sure we stay within bounds
    current.x = Math.max(0, Math.min(map.width - 1, current.x));
    current.y = Math.max(0, Math.min(map.height - 1, current.y));
  }
  
  // Mark the target as road too
  map.tiles[target.y][target.x].type = 'road';
  map.tiles[target.y][target.x].isObstacle = false;
}

function generateResources(map, rng, playerBase, enemyBase) {
  const resourceCount = Math.floor(map.width * map.height * 0.05); // 5% of the map
  
  for (let i = 0; i < resourceCount; i++) {
    let x, y;
    
    // Find a valid position for resource
    do {
      x = Math.floor(rng.random() * map.width);
      y = Math.floor(rng.random() * map.height);
    } while (
      // Avoid bases
      (Math.abs(x - playerBase.x) < 5 && Math.abs(y - playerBase.y) < 5) ||
      (Math.abs(x - enemyBase.x) < 5 && Math.abs(y - enemyBase.y) < 5) ||
      // Avoid obstacles and existing resources
      map.tiles[y][x].isObstacle ||
      map.tiles[y][x].type !== 'grass'
    );
    
    map.tiles[y][x].type = 'resource';
  }
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  random() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}
