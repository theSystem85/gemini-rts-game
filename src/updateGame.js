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
  hasClearShot, calculateAimAheadPosition, isAdjacentToBuilding, showUnloadingFeedback
} from './logic.js'
import { updatePowerSupply, updateBuildingsUnderRepair } from './buildings.js'
import { showNotification } from './main.js'

const harvestedTiles = new Set(); // Track tiles currently being harvested
const targetedOreTiles = {}; // Track which ore tiles are targeted by which harvesters

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
        // Check if the unit should still be held in the factory (for enemy units)
        if (unit.holdInFactory && unit.owner === 'enemy') {
          const now = performance.now();
          if (now < unit.factoryBuildEndTime) {
            // Don't allow the unit to leave the factory yet
            continue;
          } else {
            // Unit can now leave the factory
            unit.holdInFactory = false;
          }
        }
        
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

                playSound('shoot', 0.5);
                
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
                
                // Use aim-ahead function if enabled for this unit
                let targetingX = targetCenterX;
                let targetingY = targetCenterY;
                
                if (unit.useAimAhead && unit.target.path && unit.target.path.length > 0) {
                  // Calculate predicted position using aim-ahead
                  const predictedPos = calculateAimAheadPosition(unit, unit.target, bullet.speed, gameState);
                  targetingX = predictedPos.x;
                  targetingY = predictedPos.y;
                } else {
                  // Standard targeting without prediction
                  targetingX = targetCenterX;
                  targetingY = targetCenterY;
                }
                
                // Calculate bullet direction based on predicted position
                const angle = Math.atan2(targetingY - unitCenterY, targetingX - unitCenterX);
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
                const angle = Math.atan2(targetCenterY - unitCenterX, targetCenterX - unitCenterX);
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
        // Calculate center of current unit.
        const unitCenterX = unit.x + TILE_SIZE / 2;
        const unitCenterY = unit.y + TILE_SIZE / 2;
        
        // Define alert range (same as firing range)
        const alertRange = TANK_FIRE_RANGE * TILE_SIZE;
        
        // Only proceed if unit doesn't already have a target
        if (!unit.target) {
          // First, check for enemy units within range
          const enemyUnits = units.filter(u => 
            u.owner !== 'player' && 
            u.health > 0 && 
            Math.hypot(
              (u.x + TILE_SIZE / 2) - unitCenterX, 
              (u.y + TILE_SIZE / 2) - unitCenterY
            ) <= alertRange
          );
          
          // Also check for enemy buildings (particularly defensive ones) within range
          const enemyBuildings = [];
          if (gameState.buildings && gameState.buildings.length > 0) {
            for (const building of gameState.buildings) {
              if (building.owner !== 'player' && building.health > 0) {
                // Calculate building center
                const buildingCenterX = (building.x + building.width/2) * TILE_SIZE;
                const buildingCenterY = (building.y + building.height/2) * TILE_SIZE;
                const distance = Math.hypot(buildingCenterX - unitCenterX, buildingCenterY - unitCenterY);
                
                // Prioritize defensive buildings like turrets
                const isDefensive = building.type === 'rocketTurret' || 
                                   building.type.startsWith('turretGun');
                                   
                if (distance <= alertRange) {
                  enemyBuildings.push({
                    building: building,
                    distance: distance,
                    isDefensive: isDefensive
                  });
                }
              }
            }
          }
          
          // Determine target - prioritize closest enemy
          let closestTarget = null;
          let closestDistance = Infinity;
          
          // Check enemy units first
          if (enemyUnits.length > 0) {
            enemyUnits.forEach(u => {
              const distance = Math.hypot(
                (u.x + TILE_SIZE / 2) - unitCenterX, 
                (u.y + TILE_SIZE / 2) - unitCenterY
              );
              
              if (distance < closestDistance) {
                closestDistance = distance;
                closestTarget = u;
              }
            });
          }
          
          // Then check enemy buildings, prioritizing defensive structures
          if (enemyBuildings.length > 0) {
            // First check defensive buildings
            const defensiveBuildings = enemyBuildings.filter(b => b.isDefensive);
            
            if (defensiveBuildings.length > 0) {
              defensiveBuildings.sort((a, b) => a.distance - b.distance);
              
              if (!closestTarget || defensiveBuildings[0].distance < closestDistance) {
                closestDistance = defensiveBuildings[0].distance;
                closestTarget = defensiveBuildings[0].building;
              }
            } 
            // If no defensive buildings or none closer than units, check other buildings
            else if (!closestTarget) {
              enemyBuildings.sort((a, b) => a.distance - b.distance);
              closestTarget = enemyBuildings[0].building;
            }
          }
          
          // Set the closest enemy as target
          if (closestTarget) {
            unit.target = closestTarget;
          }
        }
        
        // If the target went out of range, clear it
        if (unit.target) {
          let targetCenterX, targetCenterY;
          
          if (unit.target.isBuilding) {
            // Target is a building
            targetCenterX = (unit.target.x + unit.target.width/2) * TILE_SIZE;
            targetCenterY = (unit.target.y + unit.target.height/2) * TILE_SIZE;
          } else {
            // Target is a unit
            targetCenterX = unit.target.x + TILE_SIZE / 2;
            targetCenterY = unit.target.y + TILE_SIZE / 2;
          }
          
          const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
          
          if (distance > alertRange) {
            unit.target = null;
          }
        }
      }

      // --- Harvester ---
      if (unit.type === 'harvester') {
        const unitTileX = Math.floor(unit.x / TILE_SIZE)
        const unitTileY = Math.floor(unit.y / TILE_SIZE)
        
        // Mining ore logic
        if (unit.oreCarried < HARVESTER_CAPPACITY && !unit.harvesting && !unit.unloadingAtRefinery) {
          if (mapGrid[unitTileY][unitTileX].type === 'ore') {
            const tileKey = `${unitTileX},${unitTileY}`;
            if (!harvestedTiles.has(tileKey)) {
              if (!unit.oreField) {
                unit.oreField = { x: unitTileX, y: unitTileY }
                // Register this tile as targeted by this unit
                targetedOreTiles[tileKey] = unit.id;
              }
              if (unit.oreField.x === unitTileX && unit.oreField.y === unitTileY) {
                unit.harvesting = true
                unit.harvestTimer = now
                harvestedTiles.add(tileKey); // Mark tile as being harvested
                playSound('harvest')
              }
            } else {
              // Tile is being harvested by another unit, find a new ore tile
              if (unit.oreField) {
                // Remove the previous targeting
                const prevTileKey = `${unit.oreField.x},${unit.oreField.y}`;
                if (targetedOreTiles[prevTileKey] === unit.id) {
                  delete targetedOreTiles[prevTileKey];
                }
              }
              unit.oreField = null;
            }
          }
        }

        // Complete harvesting
        if (unit.harvesting) {
          if (now - unit.harvestTimer > 10000) {
            unit.oreCarried++
            unit.harvesting = false
            const tileKey = `${unit.oreField.x},${unit.oreField.y}`;
            harvestedTiles.delete(tileKey); // Free up the tile
            
            // Keep targeting this tile until it's depleted
            mapGrid[unit.oreField.y][unit.oreField.x].type = 'land'
            
            // Remove targeting once the tile is depleted
            delete targetedOreTiles[tileKey];
            unit.oreField = null;
          }
        }

        // Find refinery to unload ore when full
        if (unit.oreCarried >= HARVESTER_CAPPACITY && !unit.unloadingAtRefinery) {
          // Clear targeting when full of ore and returning to base
          if (unit.oreField) {
            const tileKey = `${unit.oreField.x},${unit.oreField.y}`;
            if (targetedOreTiles[tileKey] === unit.id) {
              delete targetedOreTiles[tileKey];
            }
            unit.oreField = null;
          }
          
          // Find a refinery to unload at
          const refineries = gameState.buildings.filter(b => 
            b.type === 'oreRefinery' && 
            b.owner === unit.owner &&
            b.health > 0
          );
          
          // If there's no refinery, use the main factory as fallback
          if (refineries.length === 0) {
            const targetFactory = unit.owner === 'player'
              ? factories.find(f => f.id === 'player')
              : factories.find(f => f.id === 'enemy');
            
            if (isAdjacentToFactory(unit, targetFactory)) {
              if (unit.owner === 'player') {
                gameState.money += 1000;
              } else {
                targetFactory.budget += 1000;
              }
              unit.oreCarried = 0;
              unit.oreField = null;
              playSound('deposit');
              const orePos = findClosestOre(unit, mapGrid, targetedOreTiles);
              if (orePos) {
                const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap);
                if (path.length > 1) {
                  unit.path = path.slice(1);
                }
              }
            } else {
              const unloadTarget = findAdjacentTile(targetFactory, mapGrid);
              if (unloadTarget && (!unit.path || unit.path.length === 0)) {
                const path = findPath({ x: unit.tileX, y: unit.tileY }, unloadTarget, mapGrid, occupancyMap);
                if (path.length > 1) {
                  unit.path = path.slice(1);
                }
              }
            }
          } else {
            // Find an available refinery (not in use by another harvester)
            let targetRefinery = null;
            let targetUnloadTile = null;
            
            // Check for assigned refinery first
            if (unit.assignedRefinery) {
              const assignedRefinery = refineries.find(r => r.id === unit.assignedRefinery);
              if (assignedRefinery) {
                targetRefinery = assignedRefinery;
              }
            }
            
            // If no assigned refinery or it's not found, find the closest available one
            if (!targetRefinery) {
              for (const refinery of refineries) {
                const refineryId = refinery.id || `refinery_${refinery.x}_${refinery.y}`;
                
                // Check if this refinery is being used
                if (!gameState.refineryStatus[refineryId] || gameState.refineryStatus[refineryId] === unit.id) {
                  const adjacentTile = findAdjacentTile(refinery, mapGrid);
                  if (adjacentTile) {
                    if (!targetRefinery) {
                      targetRefinery = refinery;
                      targetUnloadTile = adjacentTile;
                    } else {
                      // Compare distances to choose the closest refinery
                      const currentDist = Math.hypot(unit.tileX - adjacentTile.x, unit.tileY - adjacentTile.y);
                      const bestDist = Math.hypot(unit.tileX - targetUnloadTile.x, unit.tileY - targetUnloadTile.y);
                      if (currentDist < bestDist) {
                        targetRefinery = refinery;
                        targetUnloadTile = adjacentTile;
                      }
                    }
                  }
                }
              }
            }
            
            // If all refineries are in use, pick any refinery to queue at
            if (!targetRefinery && refineries.length > 0) {
              targetRefinery = refineries[0];
              targetUnloadTile = findAdjacentTile(targetRefinery, mapGrid);
            }
            
            if (targetRefinery && targetUnloadTile) {
              const refineryId = targetRefinery.id || `refinery_${targetRefinery.x}_${targetRefinery.y}`;
              
              // Check if harvester is already adjacent to the refinery
              if (isAdjacentToBuilding(unit, targetRefinery)) {
                // If the refinery is free or this unit is already using it, start unloading
                if (!gameState.refineryStatus[refineryId] || gameState.refineryStatus[refineryId] === unit.id) {
                  // Mark this refinery as in use by this harvester
                  gameState.refineryStatus[refineryId] = unit.id;
                  
                  // Start unloading process (takes 20 seconds)
                  unit.unloadingAtRefinery = true;
                  unit.unloadStartTime = now;
                  unit.unloadRefinery = refineryId;
                  unit.path = []; // Clear path while unloading
                  
                  // Show visual feedback
                  showUnloadingFeedback(unit, targetRefinery);
                }
                // If the refinery is being used by another harvester, wait nearby
                // The harvester stays in place, which effectively means it's queued
              } else {
                // Move to the refinery if not already there
                if (!unit.path || unit.path.length === 0) {
                  const path = findPath({ x: unit.tileX, y: unit.tileY }, targetUnloadTile, mapGrid, occupancyMap);
                  if (path.length > 1) {
                    unit.path = path.slice(1);
                  }
                }
              }
            }
          }
        }
        
        // Handle unloading at refinery
        if (unit.unloadingAtRefinery && unit.unloadStartTime) {
          // Unloading takes 20 seconds
          if (now - unit.unloadStartTime >= 20000) {
            // Unloading complete
            if (unit.owner === 'player') {
              gameState.money += 1000;
            } else if (unit.owner === 'enemy') {
              const enemyFactory = factories.find(f => f.id === 'enemy');
              if (enemyFactory) {
                enemyFactory.budget += 1000;
              }
            }
            
            // Clear refinery usage
            if (unit.unloadRefinery) {
              delete gameState.refineryStatus[unit.unloadRefinery];
            }
            
            // Reset harvester state
            unit.oreCarried = 0;
            unit.unloadingAtRefinery = false;
            unit.unloadStartTime = null;
            unit.unloadRefinery = null;
            playSound('deposit');
            
            // Find next ore tile
            const orePos = findClosestOre(unit, mapGrid, targetedOreTiles, unit.assignedRefinery);
            if (orePos) {
              const tileKey = `${orePos.x},${orePos.y}`;
              targetedOreTiles[tileKey] = unit.id;
              
              const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap);
              if (path.length > 1) {
                unit.path = path.slice(1);
              }
            }
          }
        }
        
        // After unloading, find a new ore tile that's not targeted
        if (unit.oreCarried === 0 && !unit.harvesting && !unit.unloadingAtRefinery && 
            (!unit.path || unit.path.length === 0)) {
          const orePos = findClosestOre(unit, mapGrid, targetedOreTiles, unit.assignedRefinery);
          if (orePos) {
            // Mark this ore tile as targeted by this unit
            const tileKey = `${orePos.x},${orePos.y}`;
            targetedOreTiles[tileKey] = unit.id;
            
            const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap);
            if (path.length > 1) {
              unit.path = path.slice(1);
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

    // --- Building Updates (make buildings attackable) ---
    if (gameState.buildings && gameState.buildings.length > 0) {
      for (let i = gameState.buildings.length - 1; i >= 0; i--) {
        const building = gameState.buildings[i];
        
        // Skip destroyed buildings and remove them
        if (building.health <= 0) {
          // Remove building from selected units if it was selected
          if (building.selected) {
            const idx = selectedUnits.findIndex(u => u === building);
            if (idx !== -1) {
              selectedUnits.splice(idx, 1);
            }
          }
          
          // Remove from map grid and restore original tiles
          for (let y = building.y; y < building.y + building.height; y++) {
            for (let x = building.x; x < building.x + building.width; x++) {
              if (mapGrid[y] && mapGrid[y][x]) {
                // Restore the original tile type if it was saved, otherwise default to 'land'
                if (building.originalTiles && 
                    building.originalTiles[y - building.y] && 
                    building.originalTiles[y - building.y][x - building.x]) {
                  mapGrid[y][x].type = building.originalTiles[y - building.y][x - building.x];
                } else {
                  mapGrid[y][x].type = 'land';  // Default to land if no original type is stored
                }
                mapGrid[y][x].building = null;
              }
            }
          }
          
          // Store the power value and owner before removing the building
          const destroyedBuildingPower = building.power || 0;
          const destroyedBuildingOwner = building.owner;
          
          // Remove the building from the buildings array
          gameState.buildings.splice(i, 1);
          
          // Update power supply after building is destroyed
          updatePowerSupply(gameState.buildings, gameState);
          
          // Play explosion sound with reduced volume (0.5)
          playSound('explosion', 0.5);
          
          // Add explosion effect
          const buildingCenterX = building.x * TILE_SIZE + (building.width * TILE_SIZE / 2);
          const buildingCenterY = building.y * TILE_SIZE + (building.height * TILE_SIZE / 2);
          triggerExplosion(buildingCenterX, buildingCenterY, 40, units, factories, null, now, mapGrid);
          
          continue;
        }
      }
    }

    // --- Global Path Recalculation ---
    if (!gameState.lastGlobalPathCalc || now - gameState.lastGlobalPathCalc > PATH_CALC_INTERVAL) {
      gameState.lastGlobalPathCalc = now
      
      // Group units by formation to calculate centers before path recalculations
      const formationGroups = {};
      
      // First pass: identify all formation groups and calculate centers
      units.forEach(unit => {
        if (unit.formationActive && unit.groupNumber) {
          if (!formationGroups[unit.groupNumber]) {
            formationGroups[unit.groupNumber] = {
              units: [],
              centerX: 0,
              centerY: 0
            };
          }
          formationGroups[unit.groupNumber].units.push(unit);
        }
      });
      
      // Calculate the center position of each formation group
      Object.values(formationGroups).forEach(group => {
        if (group.units.length > 0) {
          group.centerX = group.units.reduce((sum, unit) => sum + unit.x, 0) / group.units.length;
          group.centerY = group.units.reduce((sum, unit) => sum + unit.y, 0) / group.units.length;
        }
      });
      
      // Second pass: recalculate paths for all units
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
            
            // Apply formation offset if unit is in formation mode
            let adjustedTarget = {...targetPos};
            
            // If unit is in formation mode and has formation offset, adjust the target
            if (unit.formationActive && unit.formationOffset && unit.groupNumber) {
              const formationGroup = formationGroups[unit.groupNumber];
              
              // If this unit is part of a known formation group
              if (formationGroup && formationGroup.units.some(u => u.moveTarget)) {
                // Use the first unit with a moveTarget as the formation reference point
                const referenceUnit = formationGroup.units.find(u => u.moveTarget);
                
                if (referenceUnit && referenceUnit !== unit) {
                  // Apply formation offset to target position
                  adjustedTarget = {
                    x: Math.floor((targetPos.x * TILE_SIZE + unit.formationOffset.x) / TILE_SIZE),
                    y: Math.floor((targetPos.y * TILE_SIZE + unit.formationOffset.y) / TILE_SIZE)
                  };
                }
              }
            }
            
            // Compute distance to decide pathfinding strategy
            const distance = Math.hypot(adjustedTarget.x - unit.tileX, adjustedTarget.y - unit.tileY);
            
            // Use occupancy map for close range, ignore for long distance
            const newPath = distance > PATHFINDING_THRESHOLD
              ? findPath({ x: unit.tileX, y: unit.tileY }, adjustedTarget, mapGrid, null)
              : findPath({ x: unit.tileX, y: unit.tileY }, adjustedTarget, mapGrid, occupancyMap);
            
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
            playSound('bulletHit', 0.5)
            if (hitTarget.health <= 0) {
              hitTarget.health = 0
            }
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid)
            bullets.splice(i, 1)
            continue
          }
        }
      }
      // Check for collisions with buildings
      if (bullet.active && gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          // Skip checking owner's own buildings UNLESS this is a forced attack
          if (bullet.shooter && bullet.shooter.owner === building.owner && 
              !(bullet.shooter.forcedAttack && bullet.shooter.target === building)) {
            continue;
          }
          
          // Calculate building boundaries
          const buildingLeft = building.x * TILE_SIZE;
          const buildingRight = buildingLeft + building.width * TILE_SIZE;
          const buildingTop = building.y * TILE_SIZE;
          const buildingBottom = buildingTop + building.height * TILE_SIZE;
          
          // Check if bullet is inside building
          if (bullet.x >= buildingLeft && bullet.x <= buildingRight &&
              bullet.y >= buildingTop && bullet.y <= buildingBottom) {
            
            // Calculate damage
            const factor = 0.8 + Math.random() * 0.4;
            const damage = bullet.baseDamage * factor;
            
            // Apply damage to building
            building.health -= damage;
            if (building.health <= 0) {
              building.health = 0;
            }
            
            // Create explosion effect
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, bullet.shooter, now, mapGrid);
            
            // Play sound
            playSound('bulletHit', 0.5);
            
            // Deactivate bullet
            bullet.active = false;
            bullets.splice(i, 1);
            break;
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
        if (units[i].owner === 'player') {
          playSound('unitLost', 1.0); // Play unit lost sound only for player units
        }
        units.splice(i, 1);
        continue;
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
        playSound('explosion', 0.5)
      }
    }

    // --- Update Enemy AI ---
    updateEnemyAI(units, factories, bullets, mapGrid, gameState)
    
    // Update defensive buildings
    if (gameState.buildings && gameState.buildings.length > 0) {
      updateDefensiveBuildings(gameState.buildings, units, bullets, delta, gameState);
    }
    
    // Update buildings under repair
    if (gameState.buildingsUnderRepair && gameState.buildingsUnderRepair.length > 0) {
      updateBuildingsUnderRepair(gameState, now);
    }
  } catch (error) {
    console.error("Critical error in updateGame:", error)
    console.trace() // Add stack trace to see exactly where the error occurs
    // Don't allow the game to completely crash
  }
}

// Function to update defensive buildings like rocket turrets
function updateDefensiveBuildings(buildings, units, bullets, delta, gameState) {
  const now = performance.now();
  
  buildings.forEach(building => {
    // Process defensive buildings that aren't destroyed (both player and enemy)
    if ((building.type === 'rocketTurret' || building.type.startsWith('turretGun')) && 
        building.health > 0) {
      
      // Calculate center position of the building for range calculations
      const centerX = (building.x + building.width / 2) * TILE_SIZE;
      const centerY = (building.y + building.height / 2) * TILE_SIZE;
      
      // For turret guns with burst fire, handle burst timing
      if (building.burstFire && building.currentBurst > 0) {
        if (now - building.lastBurstTime >= building.burstDelay) {
          // Fire the next shot in the burst sequence
          fireTurretProjectile(building, building.currentTarget, centerX, centerY, now, bullets);
          building.lastBurstTime = now;
          building.currentBurst--;
          return; // Skip regular firing logic during burst sequence
        }
        return; // Wait for next burst shot
      }
      
      // Calculate effective cooldown based on power situation
      let effectiveCooldown = building.fireCooldown;
      
      // Apply power slowdown for defensive buildings using the new build speed modifier
      if (building.owner === 'player' && gameState.playerPowerSupply < 0) {
        // Apply player build speed modifier to turret cooldown
        // This inverts the modifier since we want cooldown to increase as speed decreases
        effectiveCooldown = building.fireCooldown / gameState.playerBuildSpeedModifier;
      } else if (building.owner === 'enemy' && gameState.enemyPowerSupply < 0) {
        // Apply enemy build speed modifier to turret cooldown
        effectiveCooldown = building.fireCooldown / gameState.enemyBuildSpeedModifier;
      }
      
      // Only fire if cooldown has elapsed
      if (!building.lastShotTime || now - building.lastShotTime >= effectiveCooldown) {
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        // Find closest enemy in range (enemy turrets target player units, player turrets target enemy units)
        for (const unit of units) {
          if (unit.owner !== building.owner && unit.health > 0) {
            const unitCenterX = unit.x + TILE_SIZE / 2;
            const unitCenterY = unit.y + TILE_SIZE / 2;
            const dx = unitCenterX - centerX;
            const dy = unitCenterY - centerY;
            const distance = Math.hypot(dx, dy);
            
            if (distance <= building.fireRange * TILE_SIZE && distance < closestDistance) {
              closestEnemy = unit;
              closestDistance = distance;
            }
          }
        }
        
        // If enemy in range, rotate turret and fire
        if (closestEnemy) {
          building.currentTarget = closestEnemy; // Store current target for burst fire
          
          const unitCenterX = closestEnemy.x + TILE_SIZE / 2;
          const unitCenterY = closestEnemy.y + TILE_SIZE / 2;
          
          // Standard target prediction
          let targetX = unitCenterX;
          let targetY = unitCenterY;
          
          // For V2 turret, implement aim-ahead feature
          if (building.useAimAhead && closestEnemy.path && closestEnemy.path.length > 0) {
            // Use the centralized aim-ahead function instead of manual velocity calculation
            const predictedPos = calculateAimAheadPosition(building, closestEnemy, building.projectileSpeed, gameState);
            targetX = predictedPos.x;
            targetY = predictedPos.y;
          } else if (building.aimAhead && closestEnemy.path && closestEnemy.path.length > 0) {
            // Calculate target velocity
            let vx = 0, vy = 0;
            
            if (closestEnemy.lastKnownX !== undefined && closestEnemy.lastKnownY !== undefined) {
              // Calculate velocity based on position change
              vx = (unitCenterX - closestEnemy.lastKnownX) / delta;
              vy = (unitCenterY - closestEnemy.lastKnownY) / delta;
            } else if (closestEnemy.path && closestEnemy.path.length > 0) {
              // Estimate velocity based on path direction
              const nextTile = closestEnemy.path[0];
              const nextX = nextTile.x * TILE_SIZE + TILE_SIZE / 2;
              const nextY = nextTile.y * TILE_SIZE + TILE_SIZE / 2;
              const dx = nextX - unitCenterX;
              const dy = nextY - unitCenterY;
              const dist = Math.hypot(dx, dy);
              if (dist > 0) {
                vx = dx / dist * closestEnemy.speed;
                vy = dy / dist * closestEnemy.speed;
              }
            }
            
            // Calculate time to reach target based on bullet speed
            const distToTarget = Math.hypot(unitCenterX - centerX, unitCenterY - centerY);
            const timeToTarget = distToTarget / (building.projectileSpeed * TILE_SIZE);
            
            // Predict future position
            targetX = unitCenterX + vx * timeToTarget;
            targetY = unitCenterY + vy * timeToTarget;
          }
          
          // Store current target position for velocity calculation in next update
          closestEnemy.lastKnownX = unitCenterX;
          closestEnemy.lastKnownY = unitCenterY;
          
          // Calculate target direction for the turret
          building.targetDirection = Math.atan2(targetY - centerY, targetX - centerX);
          
          // Smoothly rotate turret - use 0.5 for 5x faster rotation (previously 0.1)
          building.turretDirection = smoothRotateTowardsAngle(
            building.turretDirection || 0, 
            building.targetDirection, 
            0.5
          );
          
          // Only fire if the turret is facing close enough to the target
          const angleToTarget = Math.abs(angleDiff(building.turretDirection, building.targetDirection));
          if (angleToTarget < 0.2) { // Only fire if pointing within ~11 degrees
            // Fire the projectile
            fireTurretProjectile(building, closestEnemy, centerX, centerY, now, bullets);
            
            // For burst fire, set up burst sequence
            if (building.burstFire) {
              building.currentBurst = building.burstCount - 1; // Already fired first shot
              building.lastBurstTime = now;
            }
          }
        }
      }
    }
  });
}

// Helper function to fire a projectile from a turret
function fireTurretProjectile(building, target, centerX, centerY, now, bullets) {
  // Create a bullet object with all required properties
  let projectile = {
    id: Date.now() + Math.random(),
    x: centerX + Math.cos(building.turretDirection) * (TILE_SIZE * 0.75), // Offset from building center
    y: centerY + Math.sin(building.turretDirection) * (TILE_SIZE * 0.75), // Offset from building center
    speed: building.projectileSpeed,
    baseDamage: building.damage,
    active: true,
    shooter: building
  };
  
  if (building.type === 'rocketTurret') {
    // Rocket projectile - homing
    projectile.homing = true;
    projectile.target = target;
    projectile.startTime = now;
    
    // Play rocket sound
    playSound('shoot_rocket');
  } else {
    // Standard bullet - calculate trajectory
    projectile.homing = false;
    projectile.vx = Math.cos(building.turretDirection) * building.projectileSpeed;
    projectile.vy = Math.sin(building.turretDirection) * building.projectileSpeed;
    
    // Play appropriate sound based on turret type
    if (building.type === 'turretGunV3') {
      playSound('shoot_heavy');
    } else {
      playSound('shoot');
    }
  }
  
  bullets.push(projectile);
  
  // Update last shot time unless we're in a burst sequence
  if (!building.burstFire || building.currentBurst === 0) {
    building.lastShotTime = now;
  }
}
