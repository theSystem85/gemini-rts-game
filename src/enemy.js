// enemy.js
import { TILE_SIZE, TANK_FIRE_RANGE } from './config.js'
import { findPath, buildOccupancyMap } from './units.js'
import { getUniqueId } from './utils.js'
import { findClosestOre } from './logic.js'
import { buildingData, createBuilding, canPlaceBuilding, placeBuilding, isNearExistingBuilding, isTileValid } from './buildings.js'

const ENABLE_DODGING = false // Constant to toggle dodging behavior, disabled by default
const lastPositionCheckTimeDelay = 3000
const dodgeTimeDelay = 3000
const useSafeAttackDistance = false

/* 
  updateEnemyAI:
  - Handles enemy production and target selection
  - Dodging behavior is now toggled by ENABLE_DODGING constant
  - Units recalculate paths no more often than every 2 seconds
  - Now includes building construction logic for turrets and power plants
*/
export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)
  const now = performance.now()
  const playerFactory = factories.find(f => f.id === 'player')
  const enemyFactory = factories.find(f => f.id === 'enemy')

  // Get targeted ore tiles from gameState
  const targetedOreTiles = gameState.targetedOreTiles || {};

  // --- Enemy Building Construction ---
  // Reduce build interval from 15 seconds to 10 seconds for faster defensive building construction
  if (now - (gameState.enemyLastBuildingTime || 0) >= 10000 && enemyFactory && enemyFactory.budget > 1000 && gameState.buildings) {
    const enemyBuildings = gameState.buildings.filter(b => b.owner === 'enemy');
    const powerPlants = enemyBuildings.filter(b => b.type === 'powerPlant');
    const turrets = enemyBuildings.filter(b => b.type.startsWith('turretGun') || b.type === 'rocketTurret');
    const enemyHarvesters = units.filter(u => u.owner === 'enemy' && u.type === 'harvester');
    
    // Calculate total power production and consumption
    let totalPower = 0;
    let totalProduction = 0;
    let totalConsumption = 0;
    
    enemyBuildings.forEach(building => {
      if (building.power > 0) {
        totalProduction += building.power;
      } else if (building.power < 0) {
        totalConsumption += Math.abs(building.power);
      }
      totalPower += building.power || 0;
    });
    
    // Check for energy efficiency (as a percentage)
    const energyEfficiency = totalProduction > 0 ? (totalProduction - totalConsumption) / totalProduction * 100 : 0;
    
    let buildingType = null;
    let cost = 0;
    
    // Check if we should learn from player building patterns
    if (gameState.playerBuildHistory && gameState.playerBuildHistory.length > 0 && Math.random() < 0.3) {
      const replicatedPattern = replicatePlayerBuildPattern(gameState, enemyBuildings);
      if (replicatedPattern) {
        buildingType = replicatedPattern;
        cost = buildingData[buildingType].cost;
      }
    }
    
    // If no building was selected from player patterns or we couldn't afford it, use standard logic
    if (!buildingType || enemyFactory.budget < cost) {
      // New build priority: First power plant, then at least 2 turrets before anything else
      if (powerPlants.length === 0) {
        // Always build first power plant
        buildingType = 'powerPlant';
        cost = 2000;
      } else if (turrets.length < 2) {
        // Prioritize defensive turrets (at least 2) right after power plant
        // Choose the best turret the enemy can afford
        if (enemyFactory.budget >= 4000) {
          buildingType = 'rocketTurret';
          cost = 4000;
        } else if (enemyFactory.budget >= 3000) {
          buildingType = 'turretGunV3';
          cost = 3000;
        } else if (enemyFactory.budget >= 2000) {
          buildingType = 'turretGunV2';
          cost = 2000;
        } else {
          buildingType = 'turretGunV1';
          cost = 1000;
        }
      } else if (enemyHarvesters.length === 0 || (enemyHarvesters.length < 2 && Math.random() < 0.7)) {
        // Now encourage harvester production (first one is handled in unit production)
        // Start with harvester support (if budget allows)
        if (enemyFactory.budget >= 2500) {
          buildingType = 'oreRefinery';
          cost = 2500;
        }
      } else if (energyEfficiency < 20 || (powerPlants.length < 2 && enemyFactory.budget >= 3000)) {
        // Build second power plant if energy efficiency is low or if we can afford it
        buildingType = 'powerPlant';
        cost = 2000;
      } else if (turrets.length < 4) {
        // After establishing economy, build more defensive structures
        const rand = Math.random();
        if (rand < 0.4 && enemyFactory.budget >= 4000) {
          buildingType = 'rocketTurret';
          cost = 4000;
        } else if (rand < 0.7 && enemyFactory.budget >= 3000) {
          buildingType = 'turretGunV3';
          cost = 3000;
        } else if (rand < 0.9 && enemyFactory.budget >= 2000) {
          buildingType = 'turretGunV2';
          cost = 2000;
        } else {
          buildingType = 'turretGunV1';
          cost = 1000;
        }
      } else if (enemyHarvesters.length >= 2 && powerPlants.length >= 2 && enemyFactory.budget >= 2500 && Math.random() < 0.5) {
        // Build refinery to speed up harvesting operations
        buildingType = 'oreRefinery';
        cost = 2500;
      } else if (enemyFactory.budget >= 3000 && Math.random() < 0.3) {
        // Sometimes build a vehicle factory
        buildingType = 'vehicleFactory';
        cost = 3000;
      } else if (powerPlants.length >= 2 && totalPower > 100 && Math.random() < 0.2) {
        // Occasionally build concrete walls for extra defense
        buildingType = 'concreteWall';
        cost = 100;
      }
    }
    
    // Attempt to place the building
    if (buildingType && enemyFactory.budget >= cost) {
      const position = findBuildingPosition(buildingType, mapGrid, units, gameState.buildings, factories);
      if (position) {
        // Create and place the building
        const newBuilding = createBuilding(buildingType, position.x, position.y);
        newBuilding.owner = 'enemy';
        gameState.buildings.push(newBuilding);
        placeBuilding(newBuilding, mapGrid);
        
        // Reduce enemy budget
        enemyFactory.budget -= cost;
        
        // Show what's being built
        enemyFactory.currentlyBuilding = buildingType;
        enemyFactory.buildStartTime = now;
        enemyFactory.buildDuration = 5000; // 5 seconds to show the icon
        
        // Update timestamp
        gameState.enemyLastBuildingTime = now;
        console.log(`Enemy started building ${buildingType} at (${position.x}, ${position.y})`);
      } else {
        // Skip this building attempt rather than retrying continuously
        gameState.enemyLastBuildingTime = now;
        console.log(`Enemy couldn't find valid position for ${buildingType}`);
      }
    }
  }
  
  // Clear building indicator after build duration
  if (enemyFactory && enemyFactory.currentlyBuilding && now - enemyFactory.buildStartTime > enemyFactory.buildDuration) {
    enemyFactory.currentlyBuilding = null;
  }

  // --- Enemy Unit Production ---
  if (now - gameState.enemyLastProductionTime >= 10000 && enemyFactory) {
    // Ensure enemy always has at least one harvester
    const enemyHarvesters = units.filter(u => u.owner === 'enemy' && u.type === 'harvester')
    let unitType = 'tank'
    let cost = 1000
    
    if (enemyHarvesters.length === 0) {
      unitType = 'harvester'
      cost = 500
    } else {
      const rand = Math.random()
      // Enhanced unit selection with tank-v2
      if (rand < 0.1) {
        unitType = 'rocketTank'
        cost = 2000
      } else if (rand < 0.3) {
        unitType = 'harvester'
        cost = 500
      } else if (rand < 0.5) {
        unitType = 'tank-v2'
        cost = 2000
      } else {
        unitType = 'tank'
        cost = 1000
      }
    }
    
    if (enemyFactory.budget >= cost) {
      const newEnemy = spawnEnemyUnit(enemyFactory, unitType, units, mapGrid)
      units.push(newEnemy)
      
      // Show what's being built
      enemyFactory.currentlyBuilding = unitType;
      enemyFactory.buildStartTime = now;
      enemyFactory.buildDuration = 5000; // 5 seconds to show the icon
      
      if (unitType === 'harvester') {
        const orePos = findClosestOre(newEnemy, mapGrid)
        if (orePos) {
          const path = findPath({ x: newEnemy.tileX, y: newEnemy.tileY }, orePos, mapGrid, occupancyMap)
          if (path.length > 1) {
            newEnemy.path = path.slice(1)
          }
        }
      } else {
        // Combat units target player factory initially
        const path = findPath(
          { x: newEnemy.tileX, y: newEnemy.tileY }, 
          { x: playerFactory.x, y: playerFactory.y }, 
          mapGrid, 
          null // Optimize performance for long paths
        )
        if (path.length > 1) {
          newEnemy.path = path.slice(1)
          newEnemy.moveTarget = { x: playerFactory.x, y: playerFactory.y }
        }
        newEnemy.target = playerFactory
        newEnemy.lastPathCalcTime = now
        newEnemy.lastTargetChangeTime = now
      }
      enemyFactory.budget -= cost
      gameState.enemyLastProductionTime = now
    }
  }

  // --- Update Enemy Units ---
  units.forEach(unit => {
    if (unit.owner !== 'enemy') return

    // Combat unit behavior
    if (unit.type === 'tank' || unit.type === 'rocketTank' || unit.type === 'tank-v2') {
      // Target selection throttled to every 2 seconds
      const canChangeTarget = !unit.lastTargetChangeTime || (now - unit.lastTargetChangeTime >= 2000)
      if (canChangeTarget) {
        let newTarget = null
        const nearbyEnemies = units.filter(u => u.owner === 'enemy' && Math.hypot(u.x - unit.x, u.y - unit.y) < 100)
        if (nearbyEnemies.length >= 3) {
          newTarget = playerFactory
        } else {
          let closestPlayer = null
          let closestDist = Infinity
          units.forEach(u => {
            if (u.owner === 'player') {
              const d = Math.hypot((u.x + TILE_SIZE/2) - (unit.x + TILE_SIZE/2), (u.y + TILE_SIZE/2) - (unit.y + TILE_SIZE/2))
              if (d < closestDist) {
                closestDist = d
                closestPlayer = u
              }
            }
          })
          newTarget = (closestPlayer && closestDist < 10 * TILE_SIZE) ? closestPlayer : playerFactory
        }
        
        if (unit.target !== newTarget) {
          unit.target = newTarget
          unit.lastTargetChangeTime = now
          let targetPos = null
          if (unit.target.tileX !== undefined) {
            targetPos = { x: unit.target.tileX, y: unit.target.tileY }
          } else {
            targetPos = { x: unit.target.x, y: unit.target.y }
          }
          unit.moveTarget = targetPos
          if (!unit.isDodging) {
            const path = findPath(
              { x: unit.tileX, y: unit.tileY }, 
              targetPos, 
              mapGrid, 
              null
            )
            if (path.length > 1) {
              unit.path = path.slice(1)
              unit.lastPathCalcTime = now
            }
          }
        }
      }
      
      // Path recalculation throttled to every 2 seconds
      const pathRecalcNeeded = !unit.lastPathCalcTime || (now - unit.lastPathCalcTime > 2000)
      if (pathRecalcNeeded && !unit.isDodging && unit.target && (!unit.path || unit.path.length < 3)) {
        let targetPos = null
        if (unit.target.tileX !== undefined) {
          targetPos = { x: unit.target.tileX, y: unit.target.tileY }
        } else {
          targetPos = { x: unit.target.x, y: unit.target.y }
        }
        const path = findPath(
          { x: unit.tileX, y: unit.tileY }, 
          targetPos, 
          mapGrid, 
          null
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
          unit.lastPathCalcTime = now
        }
      }

      // --- Dodge Logic: toggled by ENABLE_DODGING ---
      if (ENABLE_DODGING) {
        let underFire = false
        bullets.forEach(bullet => {
          if (bullet.shooter && bullet.shooter.owner === 'player') {
            const d = Math.hypot(bullet.x - (unit.x + TILE_SIZE/2), bullet.y - (unit.y + TILE_SIZE/2))
            if (d < 2 * TILE_SIZE) {
              underFire = true
            }
          }
        })
        
        if (underFire) {
          if (!unit.lastDodgeTime || now - unit.lastDodgeTime > dodgeTimeDelay) {
            console.log('Dodging! unit:', unit.id)
            unit.lastDodgeTime = now
            let dodgeDir = { x: 0, y: 0 }
            bullets.forEach(bullet => {
              if (bullet.shooter && bullet.shooter.owner === 'player') {
                const dx = (unit.x + TILE_SIZE/2) - bullet.x
                const dy = (unit.y + TILE_SIZE/2) - bullet.y
                const mag = Math.hypot(dx, dy)
                if (mag > 0) {
                  dodgeDir.x += dx / mag
                  dodgeDir.y += dy / mag
                }
              }
            })
            const mag = Math.hypot(dodgeDir.x, dodgeDir.y)
            if (mag > 0) {
              dodgeDir.x /= mag
              dodgeDir.y /= mag
              const dodgeDistance = 1 + Math.floor(Math.random() * 2)
              const destTileX = Math.floor(unit.tileX + Math.round(dodgeDir.x * dodgeDistance))
              const destTileY = Math.floor(unit.tileY + Math.round(dodgeDir.y * dodgeDistance))
              if (destTileX >= 0 && destTileX < mapGrid[0].length && 
                  destTileY >= 0 && destTileY < mapGrid.length) {
                const tileType = mapGrid[destTileY][destTileX].type
                if (tileType !== 'water' && tileType !== 'rock' && tileType !== 'building') {
                  if (!unit.originalPath) {
                    unit.originalPath = unit.path ? [...unit.path] : []
                    unit.originalTarget = unit.target
                    unit.dodgeEndTime = now + dodgeTimeDelay
                  }
                  const newPath = findPath(
                    { x: unit.tileX, y: unit.tileY }, 
                    { x: destTileX, y: destTileY }, 
                    mapGrid, 
                    occupancyMap
                  )
                  if (newPath.length > 1) {
                    unit.isDodging = true
                    unit.path = newPath.slice(1)
                    unit.lastPathCalcTime = now
                  }
                }
              }
            }
          }
        }
      }
      
      // Resume original path after dodging
      if (unit.isDodging && unit.originalPath) {
        if (unit.path.length === 0 || now > unit.dodgeEndTime) {
          unit.path = unit.originalPath
          unit.target = unit.originalTarget
          unit.originalPath = null
          unit.originalTarget = null
          unit.isDodging = false
          unit.dodgeEndTime = null
          unit.lastPathCalcTime = now
        }
      }
    }
    // Harvester behavior
    else if (unit.type === 'harvester') {
      const pathRecalcNeeded = !unit.lastPathCalcTime || (now - unit.lastPathCalcTime > 3000)
      if (pathRecalcNeeded && (!unit.path || unit.path.length === 0)) {
        if (unit.oreCarried >= 5) {
          // Clear targeting when full of ore and returning to base
          if (unit.oreField) {
            const tileKey = `${unit.oreField.x},${unit.oreField.y}`;
            if (targetedOreTiles[tileKey] === unit.id) {
              delete targetedOreTiles[tileKey];
            }
            unit.oreField = null;
          }

          const targetFactory = factories.find(f => f.id === 'enemy')
          const unloadTarget = findAdjacentTile(targetFactory, mapGrid)
          if (unloadTarget) {
            const path = findPath(
              { x: unit.tileX, y: unit.tileY },
              unloadTarget,
              mapGrid,
              occupancyMap
            )
            if (path.length > 1) {
              unit.path = path.slice(1)
              unit.lastPathCalcTime = now
            }
          }
        } else if (!unit.harvesting) {
          const orePos = findClosestOre(unit, mapGrid, targetedOreTiles)
          if (orePos) {
            // Mark this ore tile as targeted by this unit
            const tileKey = `${orePos.x},${orePos.y}`;
            targetedOreTiles[tileKey] = unit.id;

            const path = findPath(
              { x: unit.tileX, y: unit.tileY },
              orePos,
              mapGrid,
              occupancyMap
            )
            if (path.length > 1) {
              unit.path = path.slice(1)
              unit.lastPathCalcTime = now
              unit.oreField = orePos; // Set target ore field
            }
          }
        }
      }
    }
  })

  // Maintain safe attack distance for combat units
  if (useSafeAttackDistance) {
    units.forEach(unit => {
      if (unit.owner !== 'enemy') return
      if ((unit.type === 'tank' || unit.type === 'rocketTank') && unit.target) {
        console.log('Maintain safe attack distance for combat units')
        const positionCheckNeeded = !unit.lastPositionCheckTime || (now - unit.lastPositionCheckTime > lastPositionCheckTimeDelay)
        if (positionCheckNeeded) {
          unit.lastPositionCheckTime = now
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
          const dx = targetCenterX - unitCenterX
          const dy = targetCenterY - unitCenterY
          const currentDist = Math.hypot(dx, dy)
          const explosionSafetyBuffer = TILE_SIZE * 0.5
          const safeAttackDistance = Math.max(
            TANK_FIRE_RANGE * TILE_SIZE,
            TILE_SIZE * 2 + explosionSafetyBuffer
          )
          if (currentDist < safeAttackDistance && !unit.isDodging) {
            const destTileX = Math.floor(unit.tileX - Math.round((dx / currentDist) * 2))
            const destTileY = Math.floor(unit.tileY - Math.round((dy / currentDist) * 2))
            if (destTileX >= 0 && destTileX < mapGrid[0].length && 
                destTileY >= 0 && destTileY < mapGrid.length) {
              const tileType = mapGrid[destTileY][destTileX].type
              if (tileType !== 'water' && tileType !== 'rock' && tileType !== 'building') {
                const newPath = findPath(
                  { x: unit.tileX, y: unit.tileY }, 
                  { x: destTileX, y: destTileY }, 
                  mapGrid, 
                  null
                )
                if (newPath.length > 1) {
                  unit.path = newPath.slice(1)
                  unit.lastPathCalcTime = now
                }
              }
            }
          }
        }
      }
    })
  }
}

// Spawns an enemy unit at the center of the enemy factory
export function spawnEnemyUnit(factory, unitType, units, mapGrid) {
  const spawnX = factory.x + Math.floor(factory.width / 2)
  const spawnY = factory.y + Math.floor(factory.height / 2)
  const unit = {
    id: getUniqueId(),
    type: unitType,
    owner: 'enemy',
    tileX: spawnX,
    tileY: spawnY,
    x: spawnX * TILE_SIZE,
    y: spawnY * TILE_SIZE,
    speed: (unitType === 'harvester') ? 0.375 : 0.75, // 50% faster
    health: (unitType === 'harvester') ? 150 : 100,
    maxHealth: (unitType === 'harvester') ? 150 : 100,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    spawnTime: Date.now(),
    spawnedInFactory: true,
    holdInFactory: true, // Flag to hold unit in factory until loading indicator completes
    factoryBuildEndTime: factory.buildStartTime + factory.buildDuration, // Store when the factory's build timer ends
    lastPathCalcTime: 0,
    lastPositionCheckTime: 0,
    lastTargetChangeTime: 0,
    direction: 0,
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: 0.1,
    isRotating: false,
    effectiveSpeed: 0.75
  }
  if (unitType === 'harvester') {
    unit.effectiveSpeed = 0.15  // 50% faster
  } else if (unitType === 'rocketTank') {
    unit.effectiveSpeed = 0.1125  // 50% faster
  } else {
    unit.effectiveSpeed = 0.13125  // 50% faster
  }
  return unit
}

// Find an adjacent tile to the factory that is not a building
function findAdjacentTile(factory, mapGrid) {
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue
      if (mapGrid[y][x].type !== 'building') {
        return { x, y }
      }
    }
  }
  return null
}

// Let's improve this function to fix issues with enemy building placement
// Modified to improve building placement with better spacing and factory avoidance
function findBuildingPosition(buildingType, mapGrid, units, buildings, factories) {
  const factory = factories.find(f => f.owner === 'enemy' || f.id === 'enemy');
  if (!factory) return null;
  
  const buildingWidth = buildingData[buildingType].width;
  const buildingHeight = buildingData[buildingType].height;
  
  // Get player factory for directional placement
  const playerFactory = factories.find(f => f.id === 'player');
  const factoryX = factory.x + Math.floor(factory.width / 2);
  const factoryY = factory.y + Math.floor(factory.height / 2);
  
  // Direction toward player (for defensive buildings)
  let playerDirection = { x: 0, y: 0 };
  if (playerFactory) {
    const playerX = playerFactory.x + Math.floor(playerFactory.width / 2);
    const playerY = playerFactory.y + Math.floor(playerFactory.height / 2);
    playerDirection.x = playerX - factoryX;
    playerDirection.y = playerY - factoryY;
    const mag = Math.hypot(playerDirection.x, playerDirection.y);
    if (mag > 0) {
      playerDirection.x /= mag;
      playerDirection.y /= mag;
    }
  }
  
  // Find closest ore field to prioritize defense in that direction
  let closestOrePos = null;
  let closestOreDist = Infinity;
  
  // Search for ore fields
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      if (mapGrid[y][x].type === 'ore') {
        const dist = Math.hypot(x - factoryX, y - factoryY);
        if (dist < closestOreDist) {
          closestOreDist = dist;
          closestOrePos = { x, y };
        }
      }
    }
  }
  
  // Determine direction vector - prioritize direction toward player for defensive buildings
  let directionVector = { x: 0, y: 0 };
  const isDefensiveBuilding = buildingType.startsWith('turretGun') || buildingType === 'rocketTurret';
  
  if (isDefensiveBuilding && playerFactory) {
    // For defensive buildings, strongly prefer direction toward player
    directionVector = playerDirection;
  } else if (closestOrePos) {
    // For other buildings, prefer direction toward ore fields
    directionVector.x = closestOrePos.x - factoryX;
    directionVector.y = closestOrePos.y - factoryY;
    // Normalize
    const mag = Math.hypot(directionVector.x, directionVector.y);
    if (mag > 0) {
      directionVector.x /= mag;
      directionVector.y /= mag;
    }
  } else if (playerFactory) {
    // Fallback to player direction if no ore fields
    directionVector = playerDirection;
  }
  
  // Special case for walls - they can be placed closer together
  let minSpaceBetweenBuildings = buildingType === 'concreteWall' ? 1 : 2;
  
  // Preferred placement distances - increased to ensure more space between buildings
  const preferredDistances = [3, 4, 5, 2];
  
  // Search for positions prioritizing direction and preferred distance
  for (let angle = 0; angle < 360; angle += 30) {
    // Calculate angle alignment with target direction
    const angleRad = angle * Math.PI / 180;
    const checkVector = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
    const dotProduct = directionVector.x * checkVector.x + directionVector.y * checkVector.y;
    
    // Skip angles that don't face toward the desired direction for defensive buildings
    if (isDefensiveBuilding && dotProduct < 0.5 && Math.random() < 0.8) continue;
    
    // Try each of our preferred distances
    for (const distance of preferredDistances) {
      // Calculate position at this angle and distance
      const dx = Math.round(Math.cos(angleRad) * distance);
      const dy = Math.round(Math.sin(angleRad) * distance);
      
      const x = factory.x + dx;
      const y = factory.y + dy;
      
      // Skip if out of bounds
      if (x < 0 || y < 0 || 
          x + buildingWidth > mapGrid[0].length || 
          y + buildingHeight > mapGrid.length) {
        continue;
      }
      
      // Validate position - check for factory overlaps and other issues
      let isValid = true;
      let conflictsWithFactory = false;
      
      // First verify this position doesn't overlap with any factory
      for (let checkY = y; checkY < y + buildingHeight && isValid; checkY++) {
        for (let checkX = x; checkX < x + buildingWidth && isValid; checkX++) {
          if (isPartOfFactory(checkX, checkY, factories)) {
            conflictsWithFactory = true;
            isValid = false;
            break;
          }
        }
      }
      
      if (conflictsWithFactory) continue;
      
      // Now check if each tile is valid (terrain, units, etc.)
      for (let checkY = y; checkY < y + buildingHeight && isValid; checkY++) {
        for (let checkX = x; checkX < x + buildingWidth && isValid; checkX++) {
          if (!isTileValid(checkX, checkY, mapGrid, units, buildings, factories)) {
            isValid = false;
            break;
          }
        }
      }
      
      if (!isValid) continue;
      
      // Check if ANY tile of the building is within range of an existing enemy building
      // This means we're connected to the base, but not too close
      let isNearBase = false;
      for (let checkY = y; checkY < y + buildingHeight && !isNearBase; checkY++) {
        for (let checkX = x; checkX < x + buildingWidth && !isNearBase; checkX++) {
          if (isNearExistingBuilding(checkX, checkY, buildings, factories, 5, 'enemy')) {
            isNearBase = true;
          }
        }
      }
      
      if (!isNearBase) continue;
      
      // NEW: Check if this building would create a bottleneck by being too close to other buildings
      let hasClearPaths = ensurePathsAroundBuilding(x, y, buildingWidth, buildingHeight, mapGrid, buildings, factories, minSpaceBetweenBuildings);
      
      if (!hasClearPaths) continue;
      
      // If we got here, the position is valid
      console.log(`Found valid position for ${buildingType} at (${x}, ${y}) with distance ${distance}`);
      return { x, y };
    }
  }
  
  // If we couldn't find a position with our preferred approach, try the fallback
  console.log(`Switching to fallback search for ${buildingType}`);
  return fallbackBuildingPosition(buildingType, mapGrid, units, buildings, factories);
}

// New helper function to ensure there are clear paths around a potential building placement
function ensurePathsAroundBuilding(x, y, width, height, mapGrid, buildings, factories, minSpace) {
  // First, check all sides of the building to ensure there's adequate space
  let accessibleSides = 0;
  
  // Check north side
  let northClear = true;
  for (let checkX = x - minSpace; checkX < x + width + minSpace; checkX++) {
    const checkY = y - minSpace;
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue;
    
    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].type === 'building' || 
        mapGrid[checkY][checkX].type === 'water' || 
        mapGrid[checkY][checkX].type === 'rock') {
      northClear = false;
      break;
    }
    
    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      northClear = false;
      break;
    }
  }
  if (northClear) accessibleSides++;
  
  // Check south side
  let southClear = true;
  for (let checkX = x - minSpace; checkX < x + width + minSpace; checkX++) {
    const checkY = y + height + (minSpace - 1);
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue;
    
    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].type === 'building' || 
        mapGrid[checkY][checkX].type === 'water' || 
        mapGrid[checkY][checkX].type === 'rock') {
      southClear = false;
      break;
    }
    
    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      southClear = false;
      break;
    }
  }
  if (southClear) accessibleSides++;
  
  // Check west side
  let westClear = true;
  for (let checkY = y - minSpace; checkY < y + height + minSpace; checkY++) {
    const checkX = x - minSpace;
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue;
    
    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].type === 'building' || 
        mapGrid[checkY][checkX].type === 'water' || 
        mapGrid[checkY][checkX].type === 'rock') {
      westClear = false;
      break;
    }
    
    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      westClear = false;
      break;
    }
  }
  if (westClear) accessibleSides++;
  
  // Check east side
  let eastClear = true;
  for (let checkY = y - minSpace; checkY < y + height + minSpace; checkY++) {
    const checkX = x + width + (minSpace - 1);
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue;
    
    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].type === 'building' || 
        mapGrid[checkY][checkX].type === 'water' || 
        mapGrid[checkY][checkX].type === 'rock') {
      eastClear = false;
      break;
    }
    
    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      eastClear = false;
      break;
    }
  }
  if (eastClear) accessibleSides++;
  
  // Need at least 2 accessible sides (preferably opposite sides)
  if (accessibleSides < 2) {
    return false;
  }
  
  // Now, check if this placement would create a pathfinding bottleneck by:
  // 1. Creating a temporary map grid with this building placed
  // 2. Trying to find paths between key points around the base
  
  // Create a deep copy of the relevant portion of the map grid
  const tempMapGrid = JSON.parse(JSON.stringify(mapGrid));
  
  // Simulate placing the building in the temp grid
  for (let cy = y; cy < y + height; cy++) {
    for (let cx = x; cx < x + width; cx++) {
      if (cx >= 0 && cy >= 0 && cx < tempMapGrid[0].length && cy < tempMapGrid.length) {
        tempMapGrid[cy][cx].type = 'building';
      }
    }
  }
  
  // Get the enemy factory for path testing
  const enemyFactory = factories.find(f => f.owner === 'enemy' || f.id === 'enemy');
  if (!enemyFactory) return true; // If no enemy factory, placement should be allowed
  
  // Find existing buildings to test paths between
  const enemyBuildings = buildings ? buildings.filter(b => b.owner === 'enemy') : [];
  
  if (enemyBuildings.length < 1) {
    return true; // No existing buildings to test paths between
  }
  
  // Create test points around the enemy base
  const testPoints = [];
  
  // Add factory exit points
  testPoints.push({ 
    x: enemyFactory.x + Math.floor(enemyFactory.width / 2), 
    y: enemyFactory.y + enemyFactory.height + 1  // Below the factory
  });
  
  // Add points near existing buildings
  enemyBuildings.forEach(building => {
    // Add points around the building
    testPoints.push({ x: building.x - 1, y: building.y }); // Left
    testPoints.push({ x: building.x + building.width, y: building.y }); // Right
    testPoints.push({ x: building.x, y: building.y - 1 }); // Top
    testPoints.push({ x: building.x, y: building.y + building.height }); // Bottom
  });
  
  // Filter out invalid test points
  const validTestPoints = testPoints.filter(point => {
    return point.x >= 0 && point.y >= 0 && 
           point.x < tempMapGrid[0].length && point.y < tempMapGrid.length &&
           tempMapGrid[point.y][point.x].type !== 'building' &&
           tempMapGrid[point.y][point.x].type !== 'water' &&
           tempMapGrid[point.y][point.x].type !== 'rock';
  });
  
  // Need at least 2 valid test points to check paths
  if (validTestPoints.length < 2) {
    return true;
  }
  
  // Select a few random pairs of points to test paths between (no need to test all combinations)
  const pathTestPairs = [];
  for (let i = 0; i < Math.min(3, validTestPoints.length - 1); i++) {
    // Randomly select two points
    const point1 = validTestPoints[Math.floor(Math.random() * validTestPoints.length)];
    let point2;
    do {
      point2 = validTestPoints[Math.floor(Math.random() * validTestPoints.length)];
    } while (point1 === point2);
    
    pathTestPairs.push({ start: point1, end: point2 });
  }
  
  // Test if paths exist between these points with the new building placed
  for (const { start, end } of pathTestPairs) {
    // Use our own simple path finder instead of importing findPath to avoid circular dependencies
    const hasPath = checkSimplePath(start, end, tempMapGrid, 150); // Limit path length to avoid infinite loops
    
    if (!hasPath) {
      // If any path test fails, this building placement would create a bottleneck
      return false;
    }
  }
  
  // All tests passed, this building placement maintains paths between key points
  return true;
}

// Simple pathfinding function for testing connectivity (BFS approach)
function checkSimplePath(start, end, mapGrid, maxSteps) {
  const queue = [{ x: start.x, y: start.y, steps: 0 }];
  const visited = new Set();
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    // Check if we reached the destination
    if (current.x === end.x && current.y === end.y) {
      return true;
    }
    
    // Check if we've reached the step limit
    if (current.steps >= maxSteps) {
      return false;
    }
    
    // Mark as visited
    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    
    // Check all 8 directions
    const directions = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, // Cardinals
      { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 } // Diagonals
    ];
    
    for (const dir of directions) {
      const nextX = current.x + dir.x;
      const nextY = current.y + dir.y;
      
      // Check bounds
      if (nextX < 0 || nextY < 0 || nextX >= mapGrid[0].length || nextY >= mapGrid.length) {
        continue;
      }
      
      // Check if passable
      if (mapGrid[nextY][nextX].type === 'building' || 
          mapGrid[nextY][nextX].type === 'water' || 
          mapGrid[nextY][nextX].type === 'rock') {
        continue;
      }
      
      // Add to queue
      queue.push({ x: nextX, y: nextY, steps: current.steps + 1 });
    }
  }
  
  // No path found
  return false;
}

// Fallback position search with the original spiral pattern
function fallbackBuildingPosition(buildingType, mapGrid, units, buildings, factories) {
  const factory = factories.find(f => f.owner === 'enemy' || f.id === 'enemy');
  if (!factory) return null;
  
  const buildingWidth = buildingData[buildingType].width;
  const buildingHeight = buildingData[buildingType].height;
  
  // Special case for walls - they can be placed closer together
  let minSpaceBetweenBuildings = buildingType === 'concreteWall' ? 1 : 2;
  
  // Get player factory for directional placement of defensive buildings
  const playerFactory = factories.find(f => f.id === 'player');
  const isDefensiveBuilding = buildingType.startsWith('turretGun') || buildingType === 'rocketTurret';
  
  // Preferred distances for building placement
  const preferredDistances = [3, 4, 5, 2];
  
  // Calculate player direction for defensive buildings
  let playerDirection = null;
  if (playerFactory && isDefensiveBuilding) {
    const factoryX = factory.x + Math.floor(factory.width / 2);
    const factoryY = factory.y + Math.floor(factory.height / 2);
    const playerX = playerFactory.x + Math.floor(playerFactory.width / 2);
    const playerY = playerFactory.y + Math.floor(playerFactory.height / 2);
    
    playerDirection = {
      x: playerX - factoryX,
      y: playerY - factoryY
    };
    
    // Normalize
    const mag = Math.hypot(playerDirection.x, playerDirection.y);
    if (mag > 0) {
      playerDirection.x /= mag;
      playerDirection.y /= mag;
    }
  }
  
  // Search in a spiral pattern around the factory with preference to player direction
  for (let distance = 1; distance <= 10; distance++) {
    // Prioritize distances from our preferred list
    if (preferredDistances.includes(distance)) {
      // Prioritize building in 8 cardinal directions first
      for (let angle = 0; angle < 360; angle += 45) {
        // For defensive buildings, prioritize direction toward player
        if (isDefensiveBuilding && playerDirection) {
          // Calculate how closely this angle aligns with player direction
          const angleRad = angle * Math.PI / 180;
          const dirVector = { 
            x: Math.cos(angleRad), 
            y: Math.sin(angleRad) 
          };
          
          const dotProduct = playerDirection.x * dirVector.x + playerDirection.y * dirVector.y;
          
          // Skip angles that don't face toward player (negative dot product)
          if (dotProduct < 0.3 && Math.random() < 0.7) continue;
        }
        
        // Calculate position at this angle and distance
        const angleRad = angle * Math.PI / 180;
        const dx = Math.round(Math.cos(angleRad) * distance);
        const dy = Math.round(Math.sin(angleRad) * distance);
        
        const x = factory.x + dx;
        const y = factory.y + dy;
        
        // Skip if out of bounds
        if (x < 0 || y < 0 || 
            x + buildingWidth > mapGrid[0].length || 
            y + buildingHeight > mapGrid.length) {
          continue;
        }
        
        // First check factory overlap
        let overlapsFactory = false;
        for (let cy = y; cy < y + buildingHeight && !overlapsFactory; cy++) {
          for (let cx = x; cx < x + buildingWidth && !overlapsFactory; cx++) {
            if (isPartOfFactory(cx, cy, factories)) {
              overlapsFactory = true;
            }
          }
        }
        
        if (overlapsFactory) continue;
        
        // Check if ANY tile of the building is within range of an existing building
        let isNearBase = false;
        for (let cy = y; cy < y + buildingHeight && !isNearBase; cy++) {
          for (let cx = x; cx < x + buildingWidth && !isNearBase; cx++) {
            if (isNearExistingBuilding(cx, cy, buildings, factories, 5, 'enemy')) {
              isNearBase = true;
            }
          }
        }
        
        if (!isNearBase) continue;
        
        // Check if each tile is valid (terrain, units, etc.)
        let isValid = true;
        for (let cy = y; cy < y + buildingHeight && isValid; cy++) {
          for (let cx = x; cx < x + buildingWidth && isValid; cx++) {
            if (!isTileValid(cx, cy, mapGrid, units, buildings, factories)) {
              isValid = false;
            }
          }
        }
        
        if (!isValid) continue;
        
        // Use the same path checking as in the main function
        let hasClearPaths = ensurePathsAroundBuilding(x, y, buildingWidth, buildingHeight, mapGrid, buildings, factories, minSpaceBetweenBuildings);
        
        if (!hasClearPaths) continue;
        
        console.log(`Fallback found valid position for ${buildingType} at (${x}, ${y}) with distance ${distance}`);
        return { x, y };
      }
    }
  }
  
  // Last resort: check the entire spiral without preferred distances
  for (let distance = 1; distance <= 10; distance++) {
    // Skip distances we already checked
    if (preferredDistances.includes(distance)) continue;
    
    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        // Skip positions not on the perimeter
        if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue;
        
        const x = factory.x + dx;
        const y = factory.y + dy;
        
        // Skip if out of bounds
        if (x < 0 || y < 0 || 
            x + buildingWidth > mapGrid[0].length || 
            y + buildingHeight > mapGrid.length) {
          continue;
        }
        
        // First verify not overlapping a factory
        let overlapsFactory = false;
        for (let cy = y; cy < y + buildingHeight && !overlapsFactory; cy++) {
          for (let cx = x; cx < x + buildingWidth && !overlapsFactory; cx++) {
            if (isPartOfFactory(cx, cy, factories)) {
              overlapsFactory = true;
            }
          }
        }
        
        if (overlapsFactory) continue;
        
        // Check if near base and all tiles are valid
        let isNearBase = false;
        let allTilesValid = true;
        
        for (let cy = y; cy < y + buildingHeight; cy++) {
          for (let cx = x; cx < x + buildingWidth; cx++) {
            if (isNearExistingBuilding(cx, cy, buildings, factories, 5, 'enemy')) {
              isNearBase = true;
            }
            if (!isTileValid(cx, cy, mapGrid, units, buildings, factories)) {
              allTilesValid = false;
            }
          }
        }
        
        if (!isNearBase || !allTilesValid) continue;
        
        // Final check for pathfinding
        let hasClearPaths = ensurePathsAroundBuilding(x, y, buildingWidth, buildingHeight, mapGrid, buildings, factories, minSpaceBetweenBuildings);
        
        if (!hasClearPaths) continue;
        
        console.log(`Last resort found valid position for ${buildingType} at (${x}, ${y})`);
        return { x, y };
      }
    }
  }
  
  console.log(`Could not find any valid position for ${buildingType}`);
  return null;
}

// Handle enemy building production completion
function completeEnemyBuilding(gameState, mapGrid) {
  const production = gameState.enemy.currentBuildingProduction;
  if (!production) return;
  
  // Do a final check to make sure the location is still valid
  const buildingType = production.type;
  const x = production.x;
  const y = production.y;
  
  // Validate the building placement one final time
  if (canPlaceBuilding(buildingType, x, y, mapGrid, gameState.units, gameState.buildings, gameState.factories, 'enemy')) {
    // Create and place the building
    const newBuilding = createBuilding(buildingType, x, y);
    newBuilding.owner = 'enemy';
    
    // Add to game state
    gameState.buildings.push(newBuilding);
    
    // Update map grid
    placeBuilding(newBuilding, mapGrid);
    
    // Update power supply
    updatePowerSupply(gameState.buildings, gameState);
    
    console.log(`Enemy completed building ${buildingType} at (${x}, ${y})`);
  } else {
    console.log(`Enemy building placement failed for ${buildingType} at (${x}, ${y})`);
  }
  
  // Reset production state
  gameState.enemy.currentBuildingProduction = null;
}

// Add function to replicate player building patterns
function replicatePlayerBuildPattern(gameState, enemyBuildings) {
  try {
    // Get build patterns from localStorage if not already loaded
    if (!gameState.playerBuildHistory) {
      const savedHistory = localStorage.getItem('playerBuildHistory');
      gameState.playerBuildHistory = savedHistory ? JSON.parse(savedHistory) : [];
    }
    
    // Check if we have any patterns to learn from
    if (!gameState.playerBuildHistory || gameState.playerBuildHistory.length === 0) {
      return null;
    }
    
    // Pick a random session from the last 20 (or however many we have)
    const lastSessions = gameState.playerBuildHistory.slice(-20);
    const randomSession = lastSessions[Math.floor(Math.random() * lastSessions.length)];
    
    if (!randomSession || !randomSession.buildings || randomSession.buildings.length === 0) {
      return null;
    }
    
    // Get counts of existing enemy buildings by type
    const buildingCounts = {};
    enemyBuildings.forEach(building => {
      buildingCounts[building.type] = (buildingCounts[building.type] || 0) + 1;
    });
    
    // Find the next building type from the pattern that we haven't matched yet
    for (let i = 0; i < randomSession.buildings.length; i++) {
      const buildingType = randomSession.buildings[i];
      
      // If we haven't built this type of building yet or haven't built as many as the pattern suggests
      const currentCount = buildingCounts[buildingType] || 0;
      const patternCount = randomSession.buildings.slice(0, i + 1)
        .filter(type => type === buildingType).length;
      
      if (currentCount < patternCount) {
        console.log(`Enemy AI learning: Replicating building ${buildingType} from player session ${randomSession.id}`);
        return buildingType;
      }
    }
    
    // If we've replicated the entire pattern, choose the last building type
    return randomSession.buildings[randomSession.buildings.length - 1];
  } catch (error) {
    console.error("Error in replicatePlayerBuildPattern:", error);
    return null;
  }
}

// Helper function to check if a position is part of a factory
function isPartOfFactory(x, y, factories) {
  if (!factories) return false;
  
  for (const factory of factories) {
    if (x >= factory.x && x < factory.x + factory.width &&
        y >= factory.y && y < factory.y + factory.height) {
      return true;
    }
  }
  return false;
}