import { INERTIA_DECAY, TILE_SIZE } from './config.js'
import { spawnUnit, findPath, buildOccupancyMap } from './units.js'
import { playSound } from './sound.js'

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  if (gameState.gamePaused) return;

  const now = performance.now();
  // Erstelle Occupancy-Map basierend auf aktuellen Einheitenpositionen
  const occupancyMap = buildOccupancyMap(units, mapGrid);

  // Gegnerproduktion: Alle 10 Sekunden, aber nur wenn Budget vorhanden ist
  const enemyFactory = factories.find(f => f.id === 'enemy');
  const enemyTankCost = 1000;
  if (now - gameState.enemyLastProductionTime >= 10000 && enemyFactory.budget >= enemyTankCost) {
    for (let i = 0; i < 3; i++) {
      if (enemyFactory.budget < enemyTankCost) break;
      const enemyUnit = spawnUnit(enemyFactory, 'tank', units, mapGrid);
      units.push(enemyUnit);
      const path = findPath(
        { x: enemyUnit.tileX, y: enemyUnit.tileY },
        { x: factories.find(f => f.id === 'player').x, y: factories.find(f => f.id === 'player').y },
        mapGrid,
        occupancyMap
      );
      if (path.length > 1) {
        enemyUnit.path = path.slice(1);
      }
      enemyUnit.target = factories.find(f => f.id === 'player');
      enemyFactory.budget -= enemyTankCost;
      enemyFactory.budget = Math.max(0, enemyFactory.budget);
    }
    gameState.enemyLastProductionTime = now;
  }

  gameState.gameTime += delta / 1000;

  // Inertia beim Scrolling
  if (!gameState.isRightDragging) {
    const maxScrollX = mapGrid[0].length * TILE_SIZE - (window.innerWidth - 250);
    const maxScrollY = mapGrid.length * TILE_SIZE - window.innerHeight;
    gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - gameState.dragVelocity.x, maxScrollX));
    gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - gameState.dragVelocity.y, maxScrollY));
    gameState.dragVelocity.x *= INERTIA_DECAY;
    gameState.dragVelocity.y *= INERTIA_DECAY;
  }

  // Update der Einheitenbewegung
  units.forEach(unit => {
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0];
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE };
      const dx = targetPos.x - unit.x;
      const dy = targetPos.y - unit.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < unit.speed) {
        if (!occupancyMap[nextTile.y][nextTile.x] || (nextTile.x === unit.tileX && nextTile.y === unit.tileY)) {
          unit.x = targetPos.x;
          unit.y = targetPos.y;
          unit.tileX = nextTile.x;
          unit.tileY = nextTile.y;
          unit.path.shift();
        }
      } else {
        unit.x += (dx / distance) * unit.speed;
        unit.y += (dy / distance) * unit.speed;
      }
    } else {
      if (unit.target && unit.type === 'tank') {
        let targetCenterX, targetCenterY;
        if (unit.target.tileX !== undefined) {
          targetCenterX = unit.target.x + TILE_SIZE / 2;
          targetCenterY = unit.target.y + TILE_SIZE / 2;
        } else {
          targetCenterX = unit.target.x + (unit.target.width * TILE_SIZE) / 2;
          targetCenterY = unit.target.y + (unit.target.height * TILE_SIZE) / 2;
        }
        const unitCenterX = unit.x + TILE_SIZE / 2;
        const unitCenterY = unit.y + TILE_SIZE / 2;
        const bullet = {
          id: Date.now() + Math.random(),
          x: unitCenterX,
          y: unitCenterY,
          target: unit.target,
          speed: 4,
          baseDamage: 20,
          active: true
        };
        bullets.push(bullet);
        playSound('shoot');
        unit.target = null;
      }
    }

    // Logik für Harvester
    if (unit.type === 'harvester' && !unit.harvesting) {
      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      if (mapGrid[tileY][tileX].type === 'ore' && unit.oreCarried < 5) {
        unit.harvesting = true;
        unit.harvestTimer = performance.now();
        playSound('harvest');
      }
    }
    if (unit.type === 'harvester' && unit.harvesting) {
      if (performance.now() - unit.harvestTimer > 10000) {
        unit.oreCarried++;
        unit.harvesting = false;
        if (unit.oreCarried >= 5) {
          const targetFactory = unit.owner === 'player' ? factories.find(f => f.id === 'player') : factories.find(f => f.id === 'enemy');
          const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: targetFactory.x, y: targetFactory.y }, mapGrid, occupancyMap);
          if (path.length > 1) {
            unit.path = path.slice(1);
          }
        }
      }
    }
    if (unit.type === 'harvester' && unit.oreCarried > 0) {
      const targetFactory = unit.owner === 'player' ? factories.find(f => f.id === 'player') : factories.find(f => f.id === 'enemy');
      if (
        unit.tileX >= targetFactory.x &&
        unit.tileX < targetFactory.x + targetFactory.width &&
        unit.tileY >= targetFactory.y &&
        unit.tileY < targetFactory.y + targetFactory.height
      ) {
        if (unit.owner === 'player') {
          gameState.money += 500;
        } else {
          targetFactory.budget += 500;
        }
        unit.oreCarried = 0;
        playSound('deposit');
      }
    }
  });

  // Update der Geschosse
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
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < bullet.speed || distance === 0) {
      const factor = 0.8 + Math.random() * 0.4;
      const damage = bullet.baseDamage * factor;
      if (bullet.target.health !== undefined) {
        bullet.target.health -= damage;
        bullet.active = false;
        playSound('bulletHit');
        if (bullet.target.health <= 0) {
          bullet.target.health = 0;
          // Optionale Entfernung der Einheit
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
}
