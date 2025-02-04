// logic.js
import { INERTIA_DECAY, TILE_SIZE, ORE_SPREAD_INTERVAL, ORE_SPREAD_PROBABILITY, TANK_FIRE_RANGE } from './config.js';
import { spawnUnit, findPath, buildOccupancyMap } from './units.js';
import { playSound } from './sound.js';

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  if (gameState.gamePaused) return;

  const now = performance.now();
  const occupancyMap = buildOccupancyMap(units, mapGrid);

  // --- Enemy Production ---
  const enemyFactory = factories.find(f => f.id === 'enemy');
  const enemyTankCost = 1000;
  if (now - gameState.enemyLastProductionTime >= 10000 && enemyFactory.budget >= enemyTankCost) {
    for (let i = 0; i < 3; i++) {
      if (enemyFactory.budget < enemyTankCost) break;
      const enemyUnit = spawnUnit(enemyFactory, 'tank', units, mapGrid);
      units.push(enemyUnit);
      const playerFactory = factories.find(f => f.id === 'player');
      const path = findPath({ x: enemyUnit.tileX, y: enemyUnit.tileY }, { x: playerFactory.x, y: playerFactory.y }, mapGrid, occupancyMap);
      if (path.length > 1) {
        enemyUnit.path = path.slice(1);
      }
      enemyUnit.target = playerFactory;
      enemyFactory.budget -= enemyTankCost;
      enemyFactory.budget = Math.max(0, enemyFactory.budget);
    }
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
    // If target is destroyed, clear it.
    if (unit.target && unit.target.health !== undefined && unit.target.health <= 0) {
      unit.target = null;
    }

    // Calculate effective speed (doubled on streets).
    let effectiveSpeed = unit.speed;
    if (mapGrid[unit.tileY][unit.tileX].type === 'street') {
      effectiveSpeed *= 2;
    }

    // --- Enemy AI: Auto-Target & Backfire ---
    if (unit.owner !== 'player' && unit.type === 'tank') {
      // If no target, default to the player factory.
      if (!unit.target) {
        unit.target = factories.find(f => f.id === 'player');
        const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: unit.target.x, y: unit.target.y }, mapGrid, occupancyMap);
        if (path.length > 1) {
          unit.path = path.slice(1);
        }
      } else {
        // If a friendly unit is close, switch target.
        for (const other of units) {
          if (other.owner === 'player') {
            const dist = Math.hypot((other.x + TILE_SIZE/2) - (unit.x + TILE_SIZE/2),
                                    (other.y + TILE_SIZE/2) - (unit.y + TILE_SIZE/2));
            if (dist < TANK_FIRE_RANGE * TILE_SIZE) {
              unit.target = other;
              break;
            }
          }
        }
      }
    }

    // --- Tank Movement & Firing Behavior ---
    if (unit.type === 'tank') {
      if (unit.target) {
        const unitCenterX = unit.x + TILE_SIZE / 2;
        const unitCenterY = unit.y + TILE_SIZE / 2;
        let targetCenterX, targetCenterY;
        if (unit.target.tileX !== undefined) {
          targetCenterX = unit.target.x + TILE_SIZE / 2;
          targetCenterY = unit.target.y + TILE_SIZE / 2;
        } else {
          // For factories, convert tile coordinates to pixels.
          targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2;
          targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2;
        }
        const distToTarget = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
        if (distToTarget <= TANK_FIRE_RANGE * TILE_SIZE) {
          // Already in range: stop moving.
          unit.path = [];
        }
      }
    }

    // --- Movement Along Path (for all units) ---
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

    // --- Tank Firing Logic ---
    if (unit.type === 'tank' && unit.target) {
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
          const bullet = {
            id: Date.now() + Math.random(),
            x: unitCenterX,
            y: unitCenterY,
            target: unit.target,
            speed: 3, // Projectile speed increased by 50%
            baseDamage: 20,
            active: true,
            shooter: unit
          };
          bullets.push(bullet);
          unit.lastShotTime = performance.now();
          playSound('shoot');
        }
      }
    }

    // --- Harvester Logic ---
    if (unit.type === 'harvester') {
      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      // If not full and not already mining, start mining if on an ore tile.
      if (unit.oreCarried < 5 && !unit.harvesting && mapGrid[tileY][tileX].type === 'ore') {
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
          // Remove the ore from the map once harvested.
          mapGrid[tileY][tileX].type = 'land';
        }
      }
      if (unit.oreCarried >= 5) {
        const targetFactory = unit.owner === 'player'
          ? factories.find(f => f.id === 'player')
          : factories.find(f => f.id === 'enemy');
        if (!isAdjacentToFactory(unit, targetFactory)) {
          const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: targetFactory.x, y: targetFactory.y }, mapGrid, occupancyMap);
          if (path.length > 1) {
            unit.path = path.slice(1);
          }
        } else {
          // Unload ore when adjacent.
          if (unit.owner === 'player') {
            gameState.money += 1000;
          } else {
            targetFactory.budget += 1000;
          }
          unit.oreCarried = 0;
          unit.oreField = null;
          playSound('deposit');
          const orePos = findClosestOre(unit, mapGrid);
          if (orePos) {
            const newPath = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap);
            if (newPath.length > 1) {
              unit.path = newPath.slice(1);
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
          const bulletDist = Math.hypot(bullet.x - (unit.x + TILE_SIZE / 2), bullet.y - (unit.y + TILE_SIZE / 2));
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

  // --- Bullet Updates ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet.active) continue;
    let targetPos = null;
    if (bullet.target) {
      if (bullet.target.tileX !== undefined) {
        targetPos = { x: bullet.target.x + TILE_SIZE / 2, y: bullet.target.y + TILE_SIZE / 2 };
      } else {
        targetPos = { x: bullet.target.x * TILE_SIZE + (bullet.target.width * TILE_SIZE) / 2, y: bullet.target.y * TILE_SIZE + (bullet.target.height * TILE_SIZE) / 2 };
      }
    } else {
      bullet.active = false;
      continue;
    }
    const dx = targetPos.x - bullet.x;
    const dy = targetPos.y - bullet.y;
    const distance = Math.hypot(dx, dy);
    if (distance < bullet.speed || distance === 0) {
      const factor = 0.8 + Math.random() * 0.4;
      const damage = bullet.baseDamage * factor;
      if (bullet.target.health !== undefined) {
        bullet.target.health -= damage;
        bullet.active = false;
        playSound('bulletHit');
        if (bullet.target.health <= 0) {
          bullet.target.health = 0;
        }
      }
    } else {
      bullet.x += (dx / distance) * bullet.speed;
      bullet.y += (dy / distance) * bullet.speed;
      if (bullet.x < 0 || bullet.x > mapGrid[0].length * TILE_SIZE || bullet.y < 0 || bullet.y > mapGrid.length * TILE_SIZE) {
        bullet.active = false;
      }
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

  // --- Factory Destruction ---
  factories.forEach(factory => {
    if (factory.health <= 0 && !factory.destroyed) {
      factory.destroyed = true;
      if (factory.id === 'enemy') {
        gameState.wins++;
      } else if (factory.id === 'player') {
        gameState.losses++;
      }
      gameState.gamePaused = true;
      playSound('explosion');
    }
  });
}

// Helper: Check if unit is adjacent to factory (within one tile of its area).
function isAdjacentToFactory(unit, factory) {
  return (unit.tileX >= factory.x - 1 &&
          unit.tileX <= factory.x + factory.width &&
          unit.tileY >= factory.y - 1 &&
          unit.tileY <= factory.y + factory.height);
}

// Helper: Find the closest ore tile from the unit's current position.
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
