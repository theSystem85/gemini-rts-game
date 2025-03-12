// logic.js
import {
  INERTIA_DECAY,
  TILE_SIZE,
  ORE_SPREAD_INTERVAL,
  ORE_SPREAD_PROBABILITY,
  TANK_FIRE_RANGE,
  HARVESTER_CAPPACITY,
  PATH_CALC_INTERVAL,
  PATHFINDING_THRESHOLD,
  SAFE_RANGE_ENABLED
} from './config.js'
import { findPath, buildOccupancyMap, resolveUnitCollisions } from './units.js'
import { playSound } from './sound.js'
import { updateEnemyAI } from './enemy.js'
import { selectedUnits, cleanupDestroyedSelectedUnits } from './inputHandler.js'
import {
  checkBulletCollision, triggerExplosion, isAdjacentToFactory, angleDiff, explosions,
  findClosestOre, findAdjacentTile, findPositionWithClearShot, smoothRotateTowardsAngle,
  hasClearShot
} from './logic.js'

const harvestedTiles = new Set(); // Track tiles currently being harvested

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  try {
    if (gameState.gamePaused) return
    const now = performance.now()
    const occupancyMap = buildOccupancyMap(units, mapGrid)
    // Scale delta time by speed multiplier
    const scaledDelta = delta * gameState.speedMultiplier
    gameState.gameTime += scaledDelta / 1000

    // Update movement speeds for all units based on speed multiplier
    units.forEach(unit => {
      unit.effectiveSpeed = unit.speed * gameState.speedMultiplier
    })

    // Clean up unit selection - prevent null references
    cleanupDestroyedSelectedUnits();

    // --- Right Click Deselect (if not dragging) ---
    if (gameState.rightClick && !gameState.isRightDragging) {
      units.forEach(unit => { unit.selected = false })
      gameState.rightClick = false // reset flag after processing
    }

    // --- Map Scrolling Inertia ---
    if (!gameState.isRightDragging) {
      const maxScrollX = mapGrid[0].length * TILE_SIZE - (window.innerWidth - 250)
      const maxScrollY = mapGrid.length * TILE_SIZE - window.innerHeight
      gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - gameState.dragVelocity.x, maxScrollX))
      gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - gameState.dragVelocity.y, maxScrollY))
      gameState.dragVelocity.x *= INERTIA_DECAY
      gameState.dragVelocity.y *= INERTIA_DECAY
    }

    // --- Unit Updates ---
    for (let i = units.length - 1; i >= 0; i--) {
      const unit = units[i]

      // Skip destroyed units and remove them
      if (unit.health <= 0) {
        // Remove unit from selected units if it was selected
        if (unit.selected) {
          const idx = selectedUnits.findIndex(u => u === unit)
          if (idx !== -1) {
            selectedUnits.splice(idx, 1)
          }
        }

        units.splice(i, 1)
        continue
      }

      // Store previous position for collision detection
      const prevX = unit.x, prevY = unit.y

      // If the unit has finished dodging and reached its dodge destination
      if (unit.isDodging && unit.path.length === 0 && unit.originalPath) {
        unit.path = unit.originalPath;
        unit.target = unit.originalTarget;
        unit.originalPath = null;
        unit.originalTarget = null;
        unit.isDodging = false;
        unit.dodgeEndTime = null;
      }

      // Clear targets that are destroyed
      if (unit.target && unit.target.health !== undefined && unit.target.health <= 0) {
        unit.target = null
      }

      let effectiveSpeed = unit.effectiveSpeed * 0.5 // Reduce base speed by half

      // Apply street speed bonus (reduced from 2x to 1.5x)
      if (mapGrid[unit.tileY]?.[unit.tileX]?.type === 'street') {
        effectiveSpeed *= 1.5
      }

      // Further reduce speed in combat situations
      if (unit.target || unit.isDodging) {
        effectiveSpeed *= 0.6 // 60% speed when in combat or dodging
      }

      // Cap maximum speed
      effectiveSpeed = Math.min(effectiveSpeed, 2)
      // Before using tile indices, clamp them so we don't access out-of-bound indices.
      unit.tileX = Math.max(0, Math.min(unit.tileX || 0, mapGrid[0].length - 1))
      unit.tileY = Math.max(0, Math.min(unit.tileY || 0, mapGrid.length - 1))

      // Apply same speed rules for all units (player and enemy)
      if (mapGrid[unit.tileY]?.[unit.tileX]?.type === 'street') {
        effectiveSpeed *= 2
      }

      // --- Movement Along Path ---
      // Apply consistent movement logic for all units with paths
      if (unit.path && unit.path.length > 0) {
        const nextTile = unit.path[0]
        // Prevent path finding errors if nextTile is out of bounds.
        if (nextTile && (nextTile.x < 0 || nextTile.x >= mapGrid[0].length ||
          nextTile.y < 0 || nextTile.y >= mapGrid.length)) {
          unit.path.shift()
        } else if (nextTile) {
          const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE }
          const dx = targetPos.x - unit.x
          const dy = targetPos.y - unit.y
          const distance = Math.hypot(dx, dy)
          if (distance < effectiveSpeed) {
            unit.x = targetPos.x
            unit.y = targetPos.y
            unit.tileX = nextTile.x
            unit.tileY = nextTile.y
            unit.path.shift()
            if (unit.tileY >= 0 && unit.tileY < occupancyMap.length &&
              unit.tileX >= 0 && unit.tileX < occupancyMap[0].length) {
              occupancyMap[unit.tileY][unit.tileX] = true
            }
          } else {
            unit.x += (dx / distance) * effectiveSpeed
            unit.y += (dy / distance) * effectiveSpeed
          }
        }
      }
      if (unit.x !== prevX || unit.y !== prevY) {
        unit.lastMovedTime = now
      }

      // After repositioning, clamp tile indices again.
      unit.tileX = Math.max(0, Math.min(unit.tileX || 0, mapGrid[0].length - 1))
      unit.tileY = Math.max(0, Math.min(unit.tileY || 0, mapGrid.length - 1))

      // --- Spawn Exit ---
      if (unit.spawnedInFactory) {
        const factory = unit.owner === 'player'
          ? factories.find(f => f.id === 'player')
          : factories.find(f => f.id === 'enemy')
        if (factory && unit.tileX >= factory.x && unit.tileX < factory.x + factory.width &&
          unit.tileY >= factory.y && unit.tileY < factory.y + factory.height) {
          const exitTile = findAdjacentTile(factory, mapGrid)
          if (exitTile) {
            const exitPath = findPath({ x: unit.tileX, y: unit.tileY }, exitTile, mapGrid, occupancyMap)
            if (exitPath && exitPath.length > 1) {
              unit.path = exitPath.slice(1)
            }
          }
        } else {
          unit.spawnedInFactory = false
        }
      }

      // --- Smooth Attack Position Adjustment for Tanks ---
      // Apply this to both player and enemy units
      if ((unit.type === 'tank' || unit.type === 'rocketTank') && unit.target) {
        const unitCenterX = unit.x + TILE_SIZE / 2
        const unitCenterY = unit.y + TILE_SIZE / 2
        let targetCenterX, targetCenterY
        if (unit.target.tileX !== undefined) {
          targetCenterX = unit.target.x + TILE_SIZE / 2
          targetCenterY = unit.target.y + TILE_SIZE / 2
        } else {
          targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
          targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
        }
        // Determine ideal position: maintain attack range without colliding.
        const dx = targetCenterX - unitCenterX
        const dy = targetCenterY - unitCenterY
        const currentDist = Math.hypot(dx, dy)

        // Increase minimum distance to account for explosion radius
        // Use TANK_FIRE_RANGE but add a small safety buffer (0.5 tile)
        const explosionSafetyBuffer = TILE_SIZE * 0.5
        const desiredDist = Math.max(
          TANK_FIRE_RANGE * TILE_SIZE,
          TILE_SIZE * 2 + explosionSafetyBuffer // explosion radius + buffer
        )

        if (SAFE_RANGE_ENABLED) {
          // Calculate the desired center position to maintain safe range
          const desiredCenterX = targetCenterX - (dx / currentDist) * desiredDist
          const desiredCenterY = targetCenterY - (dy / currentDist) * desiredDist

          // Compute target top-left positions for this unit.
          const desiredX = desiredCenterX - TILE_SIZE / 2
          const desiredY = desiredCenterY - TILE_SIZE / 2
          // Smoothly interpolate toward the desired position, scaled by unit speed.
          // Apply the same movement speed limit for both player and enemy units
          const diffX = desiredX - unit.x
          const diffY = desiredY - unit.y
          const diffDist = Math.hypot(diffX, diffY)
          if (diffDist > 1) { // only move if significant difference exists
            const moveX = (diffX / diffDist) * Math.min(effectiveSpeed, 2) // Cap at speed 2
            const moveY = (diffY / diffDist) * Math.min(effectiveSpeed, 2) // Cap at speed 2
            unit.x += moveX
            unit.y += moveY
          }
        }

        // Define a threshold (90% of firing range) for moving closer to target
        const attackRangeThreshold = TANK_FIRE_RANGE * TILE_SIZE * 0.9;
        if (currentDist > attackRangeThreshold) {
          const targetTile = { x: Math.floor(targetCenterX / TILE_SIZE), y: Math.floor(targetCenterY / TILE_SIZE) };
          // Limit path recalculation frequency - for both player and enemy units 
          if (!unit.lastPathCalcTime || now - unit.lastPathCalcTime > 2000) { // 2 seconds
            const newPath = findPath({ x: unit.tileX, y: unit.tileY }, targetTile, mapGrid, null);
            if (newPath && newPath.length > 1) {
              unit.path = newPath.slice(1);
              unit.lastPathCalcTime = now;
            }
          }
        }
      }

      // --- Firing with Clear Line-of-Sight Check (Prevent Friendly Fire) ---
      if ((unit.type === 'tank' || unit.type === 'rocketTank' || unit.type === 'tank-v2') && unit.target) {
        const unitCenterX = unit.x + TILE_SIZE / 2
        const unitCenterY = unit.y + TILE_SIZE / 2
        let targetCenterX, targetCenterY
        if (unit.target.tileX !== undefined) {
          targetCenterX = unit.target.x + TILE_SIZE / 2
          targetCenterY = unit.target.y + TILE_SIZE / 2
        } else {
          targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
          targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
        }
        const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)
        // Only fire if target is within range and there is a clear line of sight
        if (dist <= TANK_FIRE_RANGE * TILE_SIZE && hasClearShot(unit, unit.target, units)) {
          if (!unit.lastShotTime || now - unit.lastShotTime > 1600) {
            if (unit.type === 'tank') {
              const cooldown = 1600; // Normal tank reload in ms
              if (!unit.lastShotTime || (now - unit.lastShotTime) >= cooldown) {
                let bullet = {
                  id: Date.now() + Math.random(),
                  x: unitCenterX,
                  y: unitCenterY,
                  speed: 3,
                  baseDamage: 20,
                  active: true,
                  shooter: unit,
                  homing: false
                };
                const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX);
                // Use correct angle formula for normal tank to fire at current target position
                bullet.vx = bullet.speed * Math.cos(angle);
                bullet.vy = bullet.speed * Math.sin(angle);

                bullets.push(bullet);
                unit.lastShotTime = now;
              }
            } else if (unit.type === 'tank-v2') {
              const cooldown = 1600; // Same cooldown as regular tank
              if (!unit.lastShotTime || (now - unit.lastShotTime) >= cooldown) {
                // Standard bullet like normal tank
                let bullet = {
                  id: Date.now() + Math.random(),
                  x: unitCenterX,
                  y: unitCenterY,
                  speed: 3,
                  baseDamage: 24, // 20% more damage than regular tank
                  active: true,
                  shooter: unit,
                  homing: false
                };

                const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX);
                bullet.vx = bullet.speed * Math.cos(angle);
                bullet.vy = bullet.speed * Math.sin(angle);

                bullets.push(bullet);
                unit.lastShotTime = now;
              }
            } else if (unit.type === 'rocketTank') {
              const cooldown = 2000; // Rocket tank reload in ms
              if (!unit.lastShotTime || (now - unit.lastShotTime) >= cooldown) {
                let bullet = {
                  id: Date.now() + Math.random(),
                  x: unitCenterX,
                  y: unitCenterY,
                  speed: 5, // Increased from 2 to 5 for 2.5x faster rockets
                  baseDamage: 40,
                  active: true,
                  shooter: unit,
                  homing: true,
                  target: unit.target  // Fixed: changed from 'target' to 'unit.target'
                };
                const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX);
                bullet.vx = bullet.speed * Math.cos(angle);
                bullet.vy = bullet.speed * Math.sin(angle);

                bullets.push(bullet);
                unit.lastShotTime = now;
              }
            }
          }
        } else if (!hasClearShot(unit, unit.target, units) && !unit.findingClearShot) {
          // If no clear shot, find a nearby position with clear shot
          unit.findingClearShot = true;
          findPositionWithClearShot(unit, unit.target, units, mapGrid);
        }
      }

      // --- Alert Mode Firing for Player Units ---
      if (unit.owner === 'player' && unit.alertMode) {
        // Gather enemy units.
        const enemyUnits = units.filter(u => u.owner !== 'player' && u.health > 0);
        // Calculate center of current unit.
        const unitCenterX = unit.x + TILE_SIZE / 2;
        const unitCenterY = unit.y + TILE_SIZE / 2;
        // Filter enemies within firing range.
        const alertRange = TANK_FIRE_RANGE * TILE_SIZE; // Using same constant for range.
        const targets = enemyUnits.filter(enemy => {
          const enemyCenterX = enemy.x + TILE_SIZE / 2;
          const enemyCenterY = enemy.y + TILE_SIZE / 2;
          return Math.hypot(enemyCenterX - unitCenterX, enemyCenterY - unitCenterY) <= alertRange;
        });
        if (targets.length > 0) {
          // Use different cooldowns for tank and rocketTank
          const cooldown = unit.type === 'rocketTank' ? 2000 : 1600;
          if (!unit.lastShotTime || now - unit.lastShotTime > cooldown) {
            targets.forEach(target => {
              // Calculate target center for accurate aiming
              const targetCenterX =
                target.tileX !== undefined
                  ? target.x + TILE_SIZE / 2
                  : target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2;
              const targetCenterY =
                target.tileX !== undefined
                  ? target.y + TILE_SIZE / 2
                  : target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2;
              const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX);
              if (unit.type === 'tank' || unit.type === 'tank-v2') {
                let bullet = {
                  id: Date.now() + Math.random(),
                  x: unitCenterX,
                  y: unitCenterY,
                  speed: 3,
                  baseDamage: 20,
                  active: true,
                  shooter: unit,
                  homing: false
                };
                bullet.vx = bullet.speed * Math.cos(angle);
                bullet.vy = bullet.speed * Math.sin(angle);
                bullets.push(bullet);
                playSound('shoot');
              } else if (unit.type === 'rocketTank') {
                let bullet = {
                  id: Date.now() + Math.random(),
                  x: unitCenterX,
                  y: unitCenterY,
                  speed: 2,
                  baseDamage: 40,
                  active: true,
                  shooter: unit,
                  homing: true,
                  target: target
                };
                bullet.vx = bullet.speed * Math.cos(angle);
                bullet.vy = bullet.speed * Math.sin(angle);
                bullets.push(bullet);
                playSound('shoot_rocket');
              }
              unit.lastShotTime = now;
            });
          }
        }
      }

      // Fix: Auto–acquire target for tank-v2 in alert mode if none assigned.
      if (unit.owner === 'player' && unit.alertMode && unit.type === 'tank-v2' && !unit.target) {
        const enemyUnits = units.filter(u => u.owner !== 'player' && u.health > 0);
        if (enemyUnits.length) {
          enemyUnits.sort((a, b) => {
            const aDist = Math.hypot(a.x - (unit.x + TILE_SIZE / 2), a.y - (unit.y + TILE_SIZE / 2));
            const bDist = Math.hypot(b.x - (unit.x + TILE_SIZE / 2), b.y - (unit.y + TILE_SIZE / 2));
            return aDist - bDist;
          });
          unit.target = enemyUnits[0];
        }
      }

      // --- Harvester ---
      if (unit.type === 'harvester') {
        const unitTileX = Math.floor(unit.x / TILE_SIZE)
        const unitTileY = Math.floor(unit.y / TILE_SIZE)
        if (unit.oreCarried < HARVESTER_CAPPACITY && !unit.harvesting) {
          if (mapGrid[unitTileY][unitTileX].type === 'ore') {
            const tileKey = `${unitTileX},${unitTileY}`;
            if (!harvestedTiles.has(tileKey)) {
              if (!unit.oreField) {
                unit.oreField = { x: unitTileX, y: unitTileY }
              }
              if (unit.oreField.x === unitTileX && unit.oreField.y === unitTileY) {
                unit.harvesting = true
                unit.harvestTimer = now
                harvestedTiles.add(tileKey); // Mark tile as being harvested
                playSound('harvest')
              }
            } else {
              // Tile is being harvested by another unit, find a new ore tile
              unit.oreField = null;
            }
          }
        }

        if (unit.harvesting) {
          if (now - unit.harvestTimer > 10000) {
            unit.oreCarried++
            unit.harvesting = false
            const tileKey = `${unit.oreField.x},${unit.oreField.y}`;
            harvestedTiles.delete(tileKey); // Free up the tile
            mapGrid[unit.oreField.y][unit.oreField.x].type = 'land'
            unit.oreField = null;
          }
        }

        if (unit.oreCarried >= HARVESTER_CAPPACITY) {
          const targetFactory = unit.owner === 'player'
            ? factories.find(f => f.id === 'player')
            : factories.find(f => f.id === 'enemy')
          if (isAdjacentToFactory(unit, targetFactory)) {
            if (unit.owner === 'player') {
              gameState.money += 1000
            } else {
              targetFactory.budget += 1000
            }
            unit.oreCarried = 0
            unit.oreField = null
            playSound('deposit')
            const orePos = findClosestOre(unit, mapGrid)
            if (orePos) {
              const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap)
              if (path.length > 1) {
                unit.path = path.slice(1)
              }
            }
          } else {
            const unloadTarget = findAdjacentTile(targetFactory, mapGrid)
            if (unloadTarget) {
              if (!unit.path || unit.path.length === 0) {
                const path = findPath({ x: unit.tileX, y: unit.tileY }, unloadTarget, mapGrid, occupancyMap)
                if (path.length > 1) {
                  unit.path = path.slice(1)
                }
              }
            }
          }
        }
      }

      // --- Rotation Updates ---
      // Update turret direction
      if (unit.target) {
        let targetCenterX, targetCenterY
        if (unit.target.tileX !== undefined) {
          targetCenterX = unit.target.x + TILE_SIZE / 2
          targetCenterY = unit.target.y + TILE_SIZE / 2
        } else {
          targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
          targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
        }

        const unitCenterX = unit.x + TILE_SIZE / 2
        const unitCenterY = unit.y + TILE_SIZE / 2

        // Calculate target turret angle
        const turretAngle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)

        // Smoothly rotate the turret
        unit.turretDirection = smoothRotateTowardsAngle(unit.turretDirection, turretAngle, unit.rotationSpeed)
      }

      // Update body direction for movement
      if (unit.path && unit.path.length > 0) {
        const nextTile = unit.path[0]
        // Prevent path finding errors if nextTile is out of bounds.
        if (nextTile && !(nextTile.x < 0 || nextTile.x >= mapGrid[0].length ||
          nextTile.y < 0 || nextTile.y >= mapGrid.length)) {

          const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE }
          const dx = targetPos.x - unit.x
          const dy = targetPos.y - unit.y

          // Calculate target direction angle for the tank body
          const targetDirection = Math.atan2(dy, dx)
          unit.targetDirection = targetDirection

          // Check if we need to rotate
          const angleDifference = angleDiff(unit.direction, targetDirection)

          if (angleDifference > 0.05) { // Allow small threshold to avoid jitter
            unit.isRotating = true
            // Smoothly rotate towards the target direction
            unit.direction = smoothRotateTowardsAngle(unit.direction, targetDirection, unit.rotationSpeed)
          } else {
            unit.isRotating = false
          }

          // Only move if not significantly rotating
          if (!unit.isRotating) {
            const distance = Math.hypot(dx, dy)
            let effectiveSpeed = unit.effectiveSpeed

            if (distance < effectiveSpeed) {
              unit.x = targetPos.x
              unit.y = targetPos.y
              unit.tileX = nextTile.x
              unit.tileY = nextTile.y
              unit.path.shift()
              occupancyMap[unit.tileY][unit.tileX] = true
            } else {
              unit.x += (dx / distance) * effectiveSpeed
              unit.y += (dy / distance) * effectiveSpeed
            }
          }
        } else if (nextTile) {
          unit.path.shift()
        }
      }
    }

    // --- Global Path Recalculation ---
    if (!gameState.lastGlobalPathCalc || now - gameState.lastGlobalPathCalc > PATH_CALC_INTERVAL) {
      gameState.lastGlobalPathCalc = now
      units.forEach(unit => {
        // Only recalculate if unit has no path or is near the end of its current path
        if (!unit.path || unit.path.length === 0 || unit.path.length < 3) {
          // For enemy units, respect target change timer
          if (unit.owner === 'enemy' && unit.lastTargetChangeTime &&
            now - unit.lastTargetChangeTime < 2000) {
            return; // Skip recalculation if target was changed recently
          }

          // Preserve movement command even when path is empty
          let targetPos = null;

          if (unit.moveTarget) {
            // Use stored move target if it exists
            targetPos = unit.moveTarget;
          } else if (unit.target) {
            // Handle combat targets
            targetPos = unit.target.tileX !== undefined
              ? { x: unit.target.tileX, y: unit.target.tileY }
              : { x: unit.target.x, y: unit.target.y };
          }

          if (targetPos) {
            // Store move target for future recalculations
            unit.moveTarget = targetPos;

            // Compute distance to decide pathfinding strategy
            const distance = Math.hypot(targetPos.x - unit.tileX, targetPos.y - unit.tileY);

            // Use occupancy map for close range, ignore for long distance
            const newPath = distance > PATHFINDING_THRESHOLD
              ? findPath({ x: unit.tileX, y: unit.tileY }, targetPos, mapGrid, null)
              : findPath({ x: unit.tileX, y: unit.tileY }, targetPos, mapGrid, occupancyMap);

            if (newPath.length > 1) {
              unit.path = newPath.slice(1);
              // Update last path calculation time for all units
              unit.lastPathCalcTime = now;
            } else if (Math.hypot(unit.tileX - targetPos.x, unit.tileY - targetPos.y) < 1) {
              // Clear moveTarget if we've reached destination
              unit.moveTarget = null;
            }
          }
        }
      });
    }

    // --- Bullet Updates ---
    bullets.forEach(bullet => {
      bullet.effectiveSpeed = bullet.speed * gameState.speedMultiplier
    })
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]
      if (!bullet.active) {
        bullets.splice(i, 1)
        continue
      }
      if (bullet.homing) {
        if (now - bullet.startTime > 5000) {
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid)
          bullet.active = false
          bullets.splice(i, 1)
          continue
        }
        if (bullet.target) {
          let targetCenterX, targetCenterY
          if (bullet.target.tileX !== undefined) {
            targetCenterX = bullet.target.x + TILE_SIZE / 2
            targetCenterY = bullet.target.y + TILE_SIZE / 2
          } else {
            targetCenterX = bullet.target.x * TILE_SIZE + (bullet.target.width * TILE_SIZE) / 2
            targetCenterY = bullet.target.y * TILE_SIZE + (bullet.target.height * TILE_SIZE) / 2
          }
          const dx = targetCenterX - bullet.x
          const dy = targetCenterY - bullet.y
          const distance = Math.hypot(dx, dy)
          bullet.x += (dx / distance) * bullet.effectiveSpeed
          bullet.y += (dy / distance) * bullet.effectiveSpeed
        } else {
          bullet.active = false
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid)
          bullets.splice(i, 1)
          continue
        }
        const hitTarget = checkBulletCollision(bullet, units, factories, gameState)
        if (hitTarget) {
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid)
          bullet.active = false
          playSound('shoot_rocket')
          bullets.splice(i, 1)
          continue
        }
      } else {
        bullet.x += bullet.vx
        bullet.y += bullet.vy
        const hitTarget = checkBulletCollision(bullet, units, factories, gameState)
        if (hitTarget) {
          const factor = 0.8 + Math.random() * 0.4
          const damage = bullet.baseDamage * factor
          if (hitTarget.health !== undefined) {
            hitTarget.health -= damage
            bullet.active = false
            playSound('bulletHit')
            if (hitTarget.health <= 0) {
              hitTarget.health = 0
            }
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid)
            bullets.splice(i, 1)
            continue
          }
        }
      }
      if (bullet.x < 0 || bullet.x > mapGrid[0].length * TILE_SIZE ||
        bullet.y < 0 || bullet.y > mapGrid.length * TILE_SIZE) {
        bullet.active = false
        bullets.splice(i, 1)
      }
    }

    // If game over, display win/loss ratio message on screen
    if (gameState.gameOver) {
      const gameOverEl = document.getElementById('gameOverMessage');
      if (gameOverEl) {
        gameOverEl.innerText = `Game Over! Wins: ${gameState.wins}, Losses: ${gameState.losses}`;
      } else {
        console.log(`Game Over! Wins: ${gameState.wins}, Losses: ${gameState.losses}`);
      }
      // Optionally, halt further game processing
      return;
    }

    // --- Update Explosion Effects ---
    for (let i = explosions.length - 1; i >= 0; i--) {
      if (now - explosions[i].startTime > explosions[i].duration) {
        explosions.splice(i, 1)
      }
    }
    gameState.explosions = explosions

    // --- Resolve Unit Collisions ---
    resolveUnitCollisions(units, mapGrid)

    // --- Ore Spreading ---
    if (now - gameState.lastOreUpdate >= ORE_SPREAD_INTERVAL) {
      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ]
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[0].length; x++) {
          if (mapGrid[y][x].type === 'ore') {
            directions.forEach(dir => {
              const nx = x + dir.x, ny = y + dir.y
              if (nx >= 0 && nx < mapGrid[0].length && ny >= 0 && ny < mapGrid.length) {
                if (mapGrid[ny][nx].type === 'land' && Math.random() < ORE_SPREAD_PROBABILITY) {
                  mapGrid[ny][nx].type = 'ore'
                }
              }
            })
          }
        }
      }
      gameState.lastOreUpdate = now
    }

    // --- Cleanup: Remove Destroyed Units ---
    for (let i = units.length - 1; i >= 0; i--) {
      if (units[i].health <= 0) {
        units.splice(i, 1)
      }
    }

    // --- Factory Destruction ---
    for (let i = factories.length - 1; i >= 0; i--) {
      const factory = factories[i]
      if (factory.health <= 0 && !factory.destroyed) {
        factory.destroyed = true
        if (factory.id === 'enemy') {
          gameState.wins++
          gameState.gameOver = true
          gameState.gameOverMessage = `Victory! Win/Loss Ratio: ${gameState.wins}:${gameState.losses}`
        } else if (factory.id === 'player') {
          gameState.losses++
          gameState.gameOver = true
          gameState.gameOverMessage = `Defeat! Win/Loss Ratio: ${gameState.wins}:${gameState.losses}`
        }
        gameState.gamePaused = true
        playSound('explosion')
      }
    }

    // --- Update Enemy AI ---
    updateEnemyAI(units, factories, bullets, mapGrid, gameState)
  } catch (error) {
    console.error("Critical error in updateGame:", error)
    console.trace() // Add stack trace to see exactly where the error occurs
    // Don't allow the game to completely crash
  }
}
