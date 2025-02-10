// enemy.js
import { TILE_SIZE } from './config.js';
import { findPath, buildOccupancyMap } from './units.js';
import { playSound } from './sound.js';
import { getUniqueId } from './utils.js';

/* 
  updateEnemyAI:
  - Handles enemy production and target selection.
  - When under fire, units now compute a dodge offset of 10 pixels instead of jumping to an adjacent tile.
*/
export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = buildOccupancyMap(units, mapGrid);
  const now = performance.now();
  const playerFactory = factories.find(f => f.id === 'player');
  const enemyFactory = factories.find(f => f.id === 'enemy');

  // --- Enemy Production (unchanged) ---
  if (now - gameState.enemyLastProductionTime >= 10000 && enemyFactory) {
    const rand = Math.random();
    let unitType = 'tank';
    let cost = 1000;
    if (rand < 0.1) {
      unitType = 'rocketTank';
      cost = 2000;
    } else if (rand < 0.3) {
      unitType = 'harvester';
      cost = 500;
    }
    if (enemyFactory.budget >= cost) {
      const newEnemy = spawnEnemyUnit(enemyFactory, unitType, units, mapGrid);
      units.push(newEnemy);
      if (unitType === 'harvester') {
        const orePos = findClosestOre(newEnemy, mapGrid);
        if (orePos) {
          const path = findPath({ x: newEnemy.tileX, y: newEnemy.tileY }, orePos, mapGrid, occupancyMap);
          if (path.length > 1) {
            newEnemy.path = path.slice(1);
          }
        }
      } else {
        const path = findPath({ x: newEnemy.tileX, y: newEnemy.tileY }, { x: playerFactory.x, y: playerFactory.y }, mapGrid, occupancyMap);
        if (path.length > 1) {
          newEnemy.path = path.slice(1);
        }
        newEnemy.target = playerFactory;
      }
      enemyFactory.budget -= cost;
      gameState.enemyLastProductionTime = now;
    }
  }

  // --- Update Enemy Units ---
  units.forEach(unit => {
    if (unit.owner !== 'enemy') return;

    // For tanks/rocket tanks, choose a target as before...
    if (unit.type === 'tank' || unit.type === 'rocketTank') {
      const nearbyEnemies = units.filter(u => u.owner === 'enemy' && Math.hypot(u.x - unit.x, u.y - unit.y) < 100);
      if (nearbyEnemies.length >= 3) {
        unit.target = playerFactory;
      } else {
        let closestPlayer = null;
        let closestDist = Infinity;
        units.forEach(u => {
          if (u.owner === 'player') {
            const d = Math.hypot((u.x + TILE_SIZE/2) - (unit.x + TILE_SIZE/2), (u.y + TILE_SIZE/2) - (unit.y + TILE_SIZE/2));
            if (d < closestDist) {
              closestDist = d;
              closestPlayer = u;
            }
          }
        });
        unit.target = (closestPlayer && closestDist < 10 * TILE_SIZE) ? closestPlayer : playerFactory;
      }

      // --- Dodge Logic: gradual movement ---
      let underFire = false;
      bullets.forEach(bullet => {
        if (bullet.shooter && bullet.shooter.owner === 'player') {
          const d = Math.hypot(bullet.x - (unit.x + TILE_SIZE/2), bullet.y - (unit.y + TILE_SIZE/2));
          if (d < 2 * TILE_SIZE) {
            underFire = true;
          }
        }
      });
      if (underFire) {
        if (!unit.lastDodgeTime || now - unit.lastDodgeTime > 500) {
          unit.lastDodgeTime = now;
          let dodgeDir = { x: 0, y: 0 };
          bullets.forEach(bullet => {
            if (bullet.shooter && bullet.shooter.owner === 'player') {
              const dx = (unit.x + TILE_SIZE/2) - bullet.x;
              const dy = (unit.y + TILE_SIZE/2) - bullet.y;
              const mag = Math.hypot(dx, dy);
              if (mag > 0) {
                dodgeDir.x += dx / mag;
                dodgeDir.y += dy / mag;
              }
            }
          });
          const mag = Math.hypot(dodgeDir.x, dodgeDir.y);
          if (mag > 0) {
            dodgeDir.x /= mag;
            dodgeDir.y /= mag;
            const offsetPixels = 10;  // gradual offset (10 pixels)
            const desiredX = unit.x + dodgeDir.x * offsetPixels;
            const desiredY = unit.y + dodgeDir.y * offsetPixels;
            const destTile = { x: Math.floor(desiredX / TILE_SIZE), y: Math.floor(desiredY / TILE_SIZE) };
            if (destTile.x !== unit.tileX || destTile.y !== unit.tileY) {
              const newPath = findPath({ x: unit.tileX, y: unit.tileY }, destTile, mapGrid, occupancyMap);
              if (newPath.length > 0) {
                unit.path = newPath.slice(1);
              }
            } else {
              // If still in the same tile, nudge position slightly.
              unit.x += dodgeDir.x * offsetPixels;
              unit.y += dodgeDir.y * offsetPixels;
            }
          }
        }
      }
    }
    // (For harvesters, behavior remains the same.)
  });
}

// Spawns an enemy unit at the center ("under") of the enemy factory.
export function spawnEnemyUnit(factory, unitType, units, mapGrid) {
  const spawnX = factory.x + Math.floor(factory.width / 2);
  const spawnY = factory.y + Math.floor(factory.height / 2);
  return {
    id: getUniqueId(),
    type: unitType,  // "tank", "rocketTank", or "harvester"
    owner: 'enemy',
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
  };
}

// Helper: Find the closest ore tile from a unit's current position.
function findClosestOre(unit, mapGrid) {
  let closest = null;
  let closestDist = Infinity;
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      if (mapGrid[y][x].type === 'ore') {
        const dx = x - unit.tileX;
        const dy = y - unit.tileY;
        const dist = Math.hypot(dx, dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = { x, y };
        }
      }
    }
  }
  return closest;
}

// Helper: Find an adjacent tile (to the factory) that is not a building.
function findAdjacentTile(factory, mapGrid) {
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue;
      if (mapGrid[y][x].type !== 'building') {
        return { x, y };
      }
    }
  }
  return null;
}
