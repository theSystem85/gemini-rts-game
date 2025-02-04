// logic.js
import { INERTIA_DECAY, TILE_SIZE, ORE_SPREAD_INTERVAL, ORE_SPREAD_PROBABILITY } from './config.js';
import { spawnUnit, findPath, buildOccupancyMap } from './units.js';
import { playSound } from './sound.js';
import { selectedUnits } from './inputHandler.js';

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
      const path = findPath(
        { x: enemyUnit.tileX, y: enemyUnit.tileY },
        { x: playerFactory.x, y: playerFactory.y },
        mapGrid,
        occupancyMap
      );
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

  // --- Update Unit Movement and Actions ---
  // logic.js (modified excerpt inside updateGame)
  units.forEach(unit => {
    // Calculate effective speed (doubled on streets)
    let effectiveSpeed = unit.speed;
    if (mapGrid[unit.tileY][unit.tileX].type === 'street') {
      effectiveSpeed *= 2;
    }

    // Movement along a precomputed path.
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0];
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE };
      const dx = targetPos.x - unit.x;
      const dy = targetPos.y - unit.y;
      const distance = Math.hypot(dx, dy);
      if (distance < effectiveSpeed) {
        // Only move if the target tile is unoccupied.
        if (!occupancyMap[nextTile.y][nextTile.x] || (nextTile.x === unit.tileX && nextTile.y === unit.tileY)) {
          unit.x = targetPos.x;
          unit.y = targetPos.y;
          unit.tileX = nextTile.x;
          unit.tileY = nextTile.y;
          unit.path.shift();
          occupancyMap[unit.tileY][unit.tileX] = true; // Mark this tile as occupied.
        }
      } else {
        unit.x += (dx / distance) * effectiveSpeed;
        unit.y += (dy / distance) * effectiveSpeed;
      }
    }

    // (a) Tank firing logic (fires regardless of movement).
    if (unit.type === 'tank' && unit.target) {
      const unitCenterX = unit.x + TILE_SIZE / 2;
      const unitCenterY = unit.y + TILE_SIZE / 2;
      let targetCenterX, targetCenterY;
      if (unit.target.tileX !== undefined) {
        targetCenterX = unit.target.x + TILE_SIZE / 2;
        targetCenterY = unit.target.y + TILE_SIZE / 2;
      } else {
        targetCenterX = unit.target.x + (unit.target.width * TILE_SIZE) / 2;
        targetCenterY = unit.target.y + (unit.target.height * TILE_SIZE) / 2;
      }
      const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
      if (dist <= 4 * TILE_SIZE) {
        if (!unit.lastShotTime || performance.now() - unit.lastShotTime > 500) {
          const bullet = {
            id: Date.now() + Math.random(),
            x: unitCenterX,
            y: unitCenterY,
            target: unit.target,
            speed: 2, // Reduced speed for visible tracking.
            baseDamage: 20,
            active: true
          };
          bullets.push(bullet);
          unit.lastShotTime = performance.now();
          playSound('shoot');
        }
      }
    }

    // (c) Harvester mining logic.
    if (unit.type === 'harvester') {
      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      if (!unit.harvesting && mapGrid[tileY][tileX].type === 'ore' && unit.oreCarried < 5) {
        unit.harvesting = true;
        unit.harvestTimer = performance.now();
        playSound('harvest');
      }
      if (unit.harvesting) {
        if (performance.now() - unit.harvestTimer > 10000) { // 10-second mining duration.
          unit.oreCarried++;
          unit.harvesting = false;
          if (unit.oreCarried >= 5) {
            // When full, set path back to base.
            const targetFactory = unit.owner === 'player'
              ? factories.find(f => f.id === 'player')
              : factories.find(f => f.id === 'enemy');
            const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: targetFactory.x, y: targetFactory.y }, mapGrid, occupancyMap);
            if (path.length > 1) {
              unit.path = path.slice(1);
            }
          }
        }
      }
      // Unloading ore when in factory.
      const targetFactory = unit.owner === 'player'
        ? factories.find(f => f.id === 'player')
        : factories.find(f => f.id === 'enemy');
      if (unit.oreCarried >= 5 &&
          unit.tileX >= targetFactory.x &&
          unit.tileX < targetFactory.x + targetFactory.width &&
          unit.tileY >= targetFactory.y &&
          unit.tileY < targetFactory.y + targetFactory.height) {
        if (unit.owner === 'player') {
          gameState.money += 500;
        } else {
          targetFactory.budget += 500;
        }
        unit.oreCarried = 0;
        playSound('deposit');
        // After unloading, automatically search for the nearest ore field.
        const orePos = findClosestOre(unit, mapGrid);
        if (orePos) {
          const newPath = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap);
          if (newPath.length > 1) {
            unit.path = newPath.slice(1);
          }
        }
      }
    }
  });

  // Helper function: Find the closest ore tile from the unit's current tile.
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


  // --- Update Bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    if (!bullet.active) continue;
    let targetPos = null;
    if (bullet.target) {
      if (bullet.target.tileX !== undefined) {
        targetPos = { x: bullet.target.x + TILE_SIZE / 2, y: bullet.target.y + TILE_SIZE / 2 };
      } else {
        targetPos = { x: bullet.target.x + (bullet.target.width * TILE_SIZE) / 2, y: bullet.target.y + (bullet.target.height * TILE_SIZE) / 2 };
      }
    } else {
      bullet.active = false;
      continue;
    }
    const dx = targetPos.x - bullet.x;
    const dy = targetPos.y - bullet.y;
    const distance = Math.hypot(dx, dy);
    if (distance < bullet.speed || distance === 0) {
      // Randomized damage scaling between 0.8 and 1.2
      const factor = 0.8 + Math.random() * 0.4;
      const damage = bullet.baseDamage * factor;
      if (bullet.target.health !== undefined) {
        bullet.target.health -= damage;
        bullet.active = false;
        playSound('bulletHit');
        if (bullet.target.health <= 0) {
          bullet.target.health = 0;
          // (Removal of destroyed units is handled below.)
        }
      }
    } else {
      bullet.x += (dx / distance) * bullet.speed;
      bullet.y += (dy / distance) * bullet.speed;
      // Deactivate bullet if it leaves the map boundaries.
      if (bullet.x < 0 || bullet.x > mapGrid[0].length * TILE_SIZE || bullet.y < 0 || bullet.y > mapGrid.length * TILE_SIZE) {
        bullet.active = false;
      }
    }
  }
  // Remove inactive bullets.
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].active) bullets.splice(i, 1);
  }

  // --- Ore Spreading ---
  if (now - gameState.lastOreUpdate >= ORE_SPREAD_INTERVAL) {
    // For every ore tile, try to spread to adjacent land tiles.
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

  // --- Cleanup: Remove Destroyed Units & Check Factory Health ---
  // Remove units that have zero or less health and update selection.
  for (let i = units.length - 1; i >= 0; i--) {
    if (units[i].health <= 0) {
      const index = selectedUnits.indexOf(units[i]);
      if (index > -1) selectedUnits.splice(index, 1);
      units.splice(i, 1);
    }
  }
  // Check if any factory has been destroyed.
  factories.forEach(factory => {
    if (factory.health <= 0 && !factory.destroyed) {
      factory.destroyed = true; // Mark as destroyed to avoid multiple counts.
      if (factory.id === 'enemy') {
        gameState.wins++;
      } else if (factory.id === 'player') {
        gameState.losses++;
      }
      gameState.gamePaused = true; // Pause the game upon a win/loss.
      playSound('explosion');
    }
  });
}
