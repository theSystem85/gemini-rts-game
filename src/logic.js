// logic.js
import {
  INERTIA_DECAY,
  TILE_SIZE,
  ORE_SPREAD_INTERVAL,
  ORE_SPREAD_PROBABILITY,
  TANK_FIRE_RANGE,
  HARVESTER_CAPPACITY
} from './config.js';
import { spawnUnit, findPath, buildOccupancyMap } from './units.js';
import { playSound } from './sound.js';

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  if (gameState.gamePaused) return;

  const now = performance.now();
  const occupancyMap = buildOccupancyMap(units, mapGrid);

  // --- Enemy Production: Spawn one enemy tank every 10 seconds ---
  const enemyFactory = factories.find(f => f.id === 'enemy');
  const enemyTankCost = 1000;
  if (now - gameState.enemyLastProductionTime >= 10000 && enemyFactory.budget >= enemyTankCost) {
    const enemyUnit = spawnUnit(enemyFactory, 'tank', units, mapGrid);
    units.push(enemyUnit);
    const playerFactory = factories.find(f => f.id === 'player');
    const path = findPath({ x: enemyUnit.tileX, y: enemyUnit.tileY },
                          { x: playerFactory.x, y: playerFactory.y },
                          mapGrid, occupancyMap);
    if (path.length > 1) {
      enemyUnit.path = path.slice(1);
    }
    enemyUnit.target = playerFactory;
    enemyFactory.budget -= enemyTankCost;
    enemyFactory.budget = Math.max(0, enemyFactory.budget);
    gameState.enemyLastProductionTime = now;
  }

  gameState.gameTime += delta / 1000;

  // --- Map Scrolling Inertia ---
  if (!gameState.isRightDragging) {
    const maxScrollX = mapGrid[0].length * TILE_SIZE - (window.innerWidth - 250);
    const maxScrollY = mapGrid.length * TILE_SIZE - window.innerHeight;
    gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - gameState.dragVelocity.x, maxScrollX));
    gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - gameState.dragVelocity.y, maxScrollY));
    gameState.dragVelocity.x *= INERTIA_DECAY;
    gameState.dragVelocity.y *= INERTIA_DECAY;
  }

  // --- Unit Updates ---
  units.forEach(unit => {
    // Clear target if destroyed.
    if (unit.target && unit.target.health !== undefined && unit.target.health <= 0) {
      unit.target = null;
    }

    // Effective speed (doubled on street tiles)
    let effectiveSpeed = unit.speed;
    if (mapGrid[unit.tileY][unit.tileX].type === 'street') {
      effectiveSpeed *= 2;
    }

    // --- Enemy AI for Tanks ---
    if (unit.owner !== 'player' && unit.type === 'tank') {
      // Look for any player's unit within 10 tiles.
      let closestPlayerUnit = null;
      let closestDist = Infinity;
      for (const other of units) {
        if (other.owner === 'player') {
          const d = Math.hypot(
            (other.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2),
            (other.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2)
          );
          if (d < closestDist) {
            closestDist = d;
            closestPlayerUnit = other;
          }
        }
      }
      if (closestPlayerUnit && closestDist < 10 * TILE_SIZE) {
        unit.target = closestPlayerUnit;
      } else {
        // Default to attacking player's base.
        unit.target = factories.find(f => f.id === 'player');
      }
    }

    // --- Tank Movement & Firing Behavior ---
    // logic.js (inside your tank firing logic)
    if (unit.type === 'tank' || unit.type === 'rocketTank') {
      // If it's a rocket tank, give it double range:
      const range = (unit.type === 'rocketTank')
        ? TANK_FIRE_RANGE * 2
        : TANK_FIRE_RANGE;

      if (unit.target) {
        const unitCenterX = unit.x + TILE_SIZE / 2;
        const unitCenterY = unit.y + TILE_SIZE / 2;
        let targetCenterX, targetCenterY;
        // ...
        const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
        if (dist <= range * TILE_SIZE) {
          // within range => can fire
          if (!unit.lastShotTime || performance.now() - unit.lastShotTime > 1600) {
            // [spawn bullet code]
          }
        }
      }
    }


    // --- Movement Along Path ---
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0];
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE };
      const dx = targetPos.x - unit.x;
      const dy = targetPos.y - unit.y;
      const distance = Math.hypot(dx, dy);
      if (distance < effectiveSpeed) {
        if (!occupancyMap[nextTile.y][nextTile.x] || (nextTile.x === unit.tileX && nextTile.y === unit.tileY)) {
          unit.x = targetPos.x;
          unit.y = targetPos.y;
          unit.tileX = nextTile.x;
          unit.tileY = nextTile.y;
          unit.path.shift();
          occupancyMap[unit.tileY][unit.tileX] = true;
        }
      } else {
        unit.x += (dx / distance) * effectiveSpeed;
        unit.y += (dy / distance) * effectiveSpeed;
      }
    }

    // --- Tank Firing ---
    if ((unit.type === 'tank' || unit.type === 'rocketTank') && unit.target) {
      const unitCenterX = unit.x + TILE_SIZE / 2;
      const unitCenterY = unit.y + TILE_SIZE / 2;
      let targetCenterX, targetCenterY;
      if (unit.target.tileX !== undefined) {
        targetCenterX = unit.target.x + TILE_SIZE / 2;
        targetCenterY = unit.target.y + TILE_SIZE / 2;
      } else {
        targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2;
        targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2;
      }
      const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
      if (dist <= TANK_FIRE_RANGE * TILE_SIZE) {
        if (!unit.lastShotTime || performance.now() - unit.lastShotTime > 1600) {
          let bullet = {
            id: Date.now() + Math.random(),
            x: unitCenterX,
            y: unitCenterY,
            speed: 3,
            baseDamage: 20,
            active: true,
            shooter: unit
          };
          bullet.homing = false;
          bullet.fixedTargetPos = { x: targetCenterX, y: targetCenterY };
          const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX);
          bullet.vx = bullet.speed * Math.cos(angle);
          bullet.vy = bullet.speed * Math.sin(angle);
          bullets.push(bullet);
          unit.lastShotTime = performance.now();
          playSound('shoot');
        }
      }
      // rocket tank
      else if (dist <= TANK_FIRE_RANGE * 2 * TILE_SIZE) {
        if (!unit.lastShotTime || performance.now() - unit.lastShotTime > 1600) {
          let bullet = {
            id: Date.now() + Math.random(),
            x: unitCenterX,
            y: unitCenterY,
            speed: 2,
            baseDamage: 40,
            active: true,
            shooter: unit
          };
          if (unit.type === 'rocketTank') {
            bullet.homing = true;
            bullet.target = unit.target;
          }
          bullets.push(bullet);
          unit.lastShotTime = performance.now();
          playSound('shoot_rocket');
        }
      }
    }

    // --- Harvester Behavior ---
    if (unit.type === 'harvester') {
      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      // Begin mining if on an ore tile.
      if (unit.oreCarried < HARVESTER_CAPPACITY && !unit.harvesting && mapGrid[tileY][tileX].type === 'ore') {
        if (!unit.oreField) {
          unit.oreField = { x: tileX, y: tileY };
        }
        if (unit.oreField.x === tileX && unit.oreField.y === tileY) {
          unit.harvesting = true;
          unit.harvestTimer = performance.now();
          playSound('harvest');
        }
      }
      if (unit.harvesting) {
        if (performance.now() - unit.harvestTimer > 10000) {
          unit.oreCarried++;
          unit.harvesting = false;
          // Remove ore from map.
          mapGrid[tileY][tileX].type = 'land';
        }
      }
      if (unit.oreCarried >= HARVESTER_CAPPACITY) {
        const targetFactory = unit.owner === 'player'
          ? factories.find(f => f.id === 'player')
          : factories.find(f => f.id === 'enemy');
        // Instead of using center distances, unload as soon as the harvester is on any tile adjacent to the factory.
        if (isAdjacentToFactory(unit, targetFactory)) {
          if (unit.owner === 'player') {
            gameState.money += 1000;
          } else {
            targetFactory.budget += 1000;
          }
          unit.oreCarried = 0;
          unit.oreField = null;
          playSound('deposit');
          // After unloading, resume harvesting by moving toward the nearest ore field.
          const orePos = findClosestOre(unit, mapGrid);
          if (orePos) {
            const newPath = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap);
            if (newPath.length > 1) {
              unit.path = newPath.slice(1);
            }
          }
        } else {
          // Otherwise, set path toward the factory (any tile adjacent to it).
          const unloadTarget = findAdjacentTile(targetFactory, mapGrid);
          if (unloadTarget) {
            if (!unit.path || unit.path.length === 0) {
              const path = findPath({ x: unit.tileX, y: unit.tileY }, unloadTarget, mapGrid, occupancyMap);
              if (path.length > 1) {
                unit.path = path.slice(1);
              }
            }
          }
        }
      }
    }

    // --- Enemy Response: Backfire & Dodge ---
    if (unit.owner !== 'player' && unit.type === 'tank') {
      let underFire = false;
      bullets.forEach(bullet => {
        if (bullet.shooter && bullet.shooter.owner === 'player') {
          const bulletDist = Math.hypot(
            bullet.x - (unit.x + TILE_SIZE / 2),
            bullet.y - (unit.y + TILE_SIZE / 2)
          );
          if (bulletDist < 2 * TILE_SIZE) {
            underFire = true;
            if (!unit.target) {
              unit.target = bullet.shooter;
            }
          }
        }
      });
      if (underFire && unit.path && unit.path.length > 0) {
        const possibleMoves = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ];
        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        const newTile = { x: unit.tileX + randomMove.dx, y: unit.tileY + randomMove.dy };
        if (newTile.x >= 0 && newTile.x < mapGrid[0].length &&
            newTile.y >= 0 && newTile.y < mapGrid.length &&
            mapGrid[newTile.y][newTile.x].type !== 'building') {
          const newPath = findPath({ x: unit.tileX, y: unit.tileY }, newTile, mapGrid, occupancyMap);
          if (newPath.length > 0) {
            unit.path = newPath.slice(1);
          }
        }
      }
    }
  });

  // --- Resolve Multiple Units on the Same Tile (Offset them) ---
  const tileOccupants = {};
  units.forEach(u => {
    const key = `${u.tileX},${u.tileY}`;
    if (!tileOccupants[key]) tileOccupants[key] = [];
    tileOccupants[key].push(u);
  });
  for (const key in tileOccupants) {
    const group = tileOccupants[key];
    if (group.length > 1) {
      group.forEach((u, index) => {
        u.x = u.tileX * TILE_SIZE + index * 3;
        u.y = u.tileY * TILE_SIZE + index * 3;
      });
    }
  }

  // --- Bullet Updates: Universal Collision Check ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet.active) continue;
    if (bullet.homing) {
      if (bullet.target) {
        let targetCenterX, targetCenterY;
        if (bullet.target.tileX !== undefined) {
          targetCenterX = bullet.target.x + TILE_SIZE / 2;
          targetCenterY = bullet.target.y + TILE_SIZE / 2;
        } else {
          targetCenterX = bullet.target.x * TILE_SIZE + (bullet.target.width * TILE_SIZE) / 2;
          targetCenterY = bullet.target.y * TILE_SIZE + (bullet.target.height * TILE_SIZE) / 2;
        }
        const dx = targetCenterX - bullet.x;
        const dy = targetCenterY - bullet.y;
        const distance = Math.hypot(dx, dy);
        bullet.x += (dx / distance) * bullet.speed;
        bullet.y += (dy / distance) * bullet.speed;
      } else {
        bullet.active = false;
      }
    } else {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
    }
    // Check collision with ANY target.
    const hitTarget = checkBulletCollision(bullet, units, factories);
    if (hitTarget) {
      const factor = 0.8 + Math.random() * 0.4;
      const damage = bullet.baseDamage * factor;
      if (hitTarget.health !== undefined) {
        hitTarget.health -= damage;
        bullet.active = false;
        playSound('bulletHit');
        if (hitTarget.health <= 0) {
          hitTarget.health = 0;
        }
      }
    }
    if (bullet.x < 0 || bullet.x > mapGrid[0].length * TILE_SIZE ||
        bullet.y < 0 || bullet.y > mapGrid.length * TILE_SIZE) {
      bullet.active = false;
    }
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].active) bullets.splice(i, 1);
  }

  // --- Ore Spreading ---
  if (now - gameState.lastOreUpdate >= ORE_SPREAD_INTERVAL) {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];
    for (let y = 0; y < mapGrid.length; y++) {
      for (let x = 0; x < mapGrid[0].length; x++) {
        if (mapGrid[y][x].type === 'ore') {
          directions.forEach(dir => {
            const nx = x + dir.x, ny = y + dir.y;
            if (nx >= 0 && nx < mapGrid[0].length && ny >= 0 && ny < mapGrid.length) {
              if (mapGrid[ny][nx].type === 'land' && Math.random() < ORE_SPREAD_PROBABILITY) {
                mapGrid[ny][nx].type = 'ore';
              }
            }
          });
        }
      }
    }
    gameState.lastOreUpdate = now;
  }

  // --- Cleanup: Remove Destroyed Units ---
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i].health <= 0) {
      units.splice(i, 1);
    }
  }

  // --- Factory Destruction: Remove enemy base when destroyed ---
  for (let i = factories.length - 1; i >= 0; i--) {
    const factory = factories[i];
    if (factory.health <= 0 && !factory.destroyed) {
      factory.destroyed = true;
      if (factory.id === 'enemy') {
        gameState.wins++;
      } else if (factory.id === 'player') {
        gameState.losses++;
      }
      gameState.gamePaused = true;
      playSound('explosion');
      factories.splice(i, 1);
    }
  }
}

// Helper: Check if a bullet collides with any unit or factory.
function checkBulletCollision(bullet, units, factories) {
  // Check collision with units.
  for (let u of units) {
    if (u.id === bullet.shooter.id) continue;
    const centerX = u.x + TILE_SIZE / 2;
    const centerY = u.y + TILE_SIZE / 2;
    const dist = Math.hypot(bullet.x - centerX, bullet.y - centerY);
    if (dist < 10) return u;
  }
  // Check collision with factories.
  for (let f of factories) {
    if (f.destroyed) continue;
    const centerX = f.x * TILE_SIZE + (f.width * TILE_SIZE) / 2;
    const centerY = f.y * TILE_SIZE + (f.height * TILE_SIZE) / 2;
    const dist = Math.hypot(bullet.x - centerX, bullet.y - centerY);
    if (dist < 10) return f;
  }
  return null;
}

// Helper: Determine if a unit is adjacent to a factory.
// A unit is adjacent if its tile is within one tile of any tile occupied by the factory.
function isAdjacentToFactory(unit, factory) {
  return (unit.tileX >= factory.x - 1 &&
          unit.tileX <= factory.x + factory.width &&
          unit.tileY >= factory.y - 1 &&
          unit.tileY <= factory.y + factory.height);
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
  // Look at the border around the factory.
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
