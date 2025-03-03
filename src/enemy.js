// enemy.js
import { TILE_SIZE, TANK_FIRE_RANGE } from './config.js'
import { findPath, buildOccupancyMap } from './units.js'
import { playSound } from './sound.js'
import { getUniqueId } from './utils.js'

/* 
  updateEnemyAI:
  - Handles enemy production and target selection.
  - When under fire, units now compute a dodge using proper pathfinding
  - Dodge behavior preserves unit's original target and checks boundaries
*/
export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)
  const now = performance.now()
  const playerFactory = factories.find(f => f.id === 'player')
  const enemyFactory = factories.find(f => f.id === 'enemy')

  // --- Enemy Production ---
  if (now - gameState.enemyLastProductionTime >= 10000 && enemyFactory) {
    // Ensure enemy always has at least one harvester.
    const enemyHarvesters = units.filter(u => u.owner === 'enemy' && u.type === 'harvester')
    let unitType = 'tank'
    let cost = 1000
    if (enemyHarvesters.length === 0) {
      unitType = 'harvester'
      cost = 500
    } else {
      const rand = Math.random()
      if (rand < 0.1) {
        unitType = 'rocketTank'
        cost = 2000
      } else if (rand < 0.3) {
        unitType = 'harvester'
        cost = 500
      } else {
        unitType = 'tank'
        cost = 1000
      }
    }
    if (enemyFactory.budget >= cost) {
      const newEnemy = spawnEnemyUnit(enemyFactory, unitType, units, mapGrid)
      units.push(newEnemy)
      if (unitType === 'harvester') {
        const orePos = findClosestOre(newEnemy, mapGrid)
        if (orePos) {
          const path = findPath({ x: newEnemy.tileX, y: newEnemy.tileY }, orePos, mapGrid, occupancyMap)
          if (path.length > 1) {
            newEnemy.path = path.slice(1)
          }
        }
      } else {
        // Use the same findPath function as player units with proper parameters
        const path = findPath(
          { x: newEnemy.tileX, y: newEnemy.tileY }, 
          { x: playerFactory.x, y: playerFactory.y }, 
          mapGrid, 
          null // Don't use occupancy map for long distance paths for better performance
        )
        if (path.length > 1) {
          newEnemy.path = path.slice(1)
          newEnemy.moveTarget = { x: playerFactory.x, y: playerFactory.y } // Store target for recalculation
        }
        newEnemy.target = playerFactory
        // Set up pathfinding interval to prevent recalculating every frame
        newEnemy.lastPathCalcTime = now
      }
      enemyFactory.budget -= cost
      gameState.enemyLastProductionTime = now
    }
  }

  // --- Update Enemy Units ---
  units.forEach(unit => {
    if (unit.owner !== 'enemy') return

    // For tanks/rocket tanks, choose a target as before...
    if (unit.type === 'tank' || unit.type === 'rocketTank') {
      const nearbyEnemies = units.filter(u => u.owner === 'enemy' && Math.hypot(u.x - unit.x, u.y - unit.y) < 100)
      let newTarget = null
      
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
      
      // Only update the path if the target changed or we haven't calculated a path recently
      const targetChanged = unit.target !== newTarget;
      const pathRecalcNeeded = !unit.lastPathCalcTime || (now - unit.lastPathCalcTime > 2000); // 2 seconds interval
      
      if (targetChanged || (pathRecalcNeeded && (!unit.path || unit.path.length < 3))) {
        unit.target = newTarget;
        
        // Store target position for path calculation
        let targetPos = null;
        if (unit.target.tileX !== undefined) {
          targetPos = { x: unit.target.tileX, y: unit.target.tileY };
        } else {
          targetPos = { x: unit.target.x, y: unit.target.y };
        }
        unit.moveTarget = targetPos;
        
        // Only recalculate path if we need to and we're not currently dodging
        if (!unit.isDodging && (!unit.path || unit.path.length < 3 || targetChanged)) {
          // Use the same findPath function as player units
          const path = findPath(
            { x: unit.tileX, y: unit.tileY }, 
            targetPos, 
            mapGrid, 
            null // Don't use occupancy map for long distance paths
          )
          if (path.length > 1) {
            unit.path = path.slice(1)
            unit.lastPathCalcTime = now
          }
        }
      }

      // --- Dodge Logic: using pathfinding ---
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
        if (!unit.lastDodgeTime || now - unit.lastDodgeTime > 1000) { // Reduce frequency to avoid constant dodging
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
            
            // Calculate potential dodge destination (1-2 tiles away in dodge direction)
            const dodgeDistance = 1 + Math.floor(Math.random() * 2); // 1 or 2 tiles
            const destTileX = Math.floor(unit.tileX + Math.round(dodgeDir.x * dodgeDistance));
            const destTileY = Math.floor(unit.tileY + Math.round(dodgeDir.y * dodgeDistance));
            
            // Check map boundaries and tile validity
            if (destTileX >= 0 && destTileX < mapGrid[0].length && 
                destTileY >= 0 && destTileY < mapGrid.length) {
                
              const tileType = mapGrid[destTileY][destTileX].type;
              if (tileType !== 'water' && tileType !== 'rock' && tileType !== 'building') {
                
                // Store original path and target if this is a new dodge
                if (!unit.originalPath) {
                  unit.originalPath = unit.path ? [...unit.path] : [];
                  unit.originalTarget = unit.target;
                  unit.dodgeEndTime = now + 3000; // Resume original path after 3 seconds max
                }
                
                // Create a new path to the dodge destination using the same findPath function
                const newPath = findPath(
                  { x: unit.tileX, y: unit.tileY }, 
                  { x: destTileX, y: destTileY }, 
                  mapGrid, 
                  occupancyMap
                );
                
                if (newPath.length > 1) {
                  unit.isDodging = true;
                  unit.path = newPath.slice(1);
                  unit.lastPathCalcTime = now; // Reset path calculation timer after dodge
                }
              }
            }
          }
        } 
      }
      
      // Check if dodge should end (either reached destination or timed out)
      if (unit.isDodging && unit.originalPath) {
        if (unit.path.length === 0 || now > unit.dodgeEndTime) {
          // Return to original path and target
          unit.path = unit.originalPath;
          unit.target = unit.originalTarget;
          unit.originalPath = null;
          unit.originalTarget = null;
          unit.isDodging = false;
          unit.dodgeEndTime = null;
          unit.lastPathCalcTime = now; // Reset path calculation timer
        }
      }
    }
    // (For harvesters, behavior remains the same but we'll add path recalculation throttling)
    else if (unit.type === 'harvester') {
      // Only recalculate harvester paths periodically to improve performance
      const pathRecalcNeeded = !unit.lastPathCalcTime || (now - unit.lastPathCalcTime > 3000); // 3 seconds interval
      
      if (pathRecalcNeeded && (!unit.path || unit.path.length === 0)) {
        // Find ore or return to factory as needed
        if (unit.oreCarried >= 5) { // Assuming 5 is full capacity
          const targetFactory = factories.find(f => f.id === 'enemy');
          const unloadTarget = findAdjacentTile(targetFactory, mapGrid);
          
          if (unloadTarget) {
            const path = findPath(
              { x: unit.tileX, y: unit.tileY },
              unloadTarget,
              mapGrid,
              occupancyMap
            );
            
            if (path.length > 1) {
              unit.path = path.slice(1);
              unit.lastPathCalcTime = now;
            }
          }
        } else if (!unit.harvesting) {
          const orePos = findClosestOre(unit, mapGrid);
          
          if (orePos) {
            const path = findPath(
              { x: unit.tileX, y: unit.tileY },
              orePos,
              mapGrid,
              occupancyMap
            );
            
            if (path.length > 1) {
              unit.path = path.slice(1);
              unit.lastPathCalcTime = now;
            }
          }
        }
      }
    }
  })

  // For tanks with targets, ensure they maintain safe attack distance
  units.forEach(unit => {
    if (unit.owner !== 'enemy') return
    
    if ((unit.type === 'tank' || unit.type === 'rocketTank') && unit.target) {
      // Check if unit is too close to its target - only do this check occasionally for performance
      const positionCheckNeeded = !unit.lastPositionCheckTime || (now - unit.lastPositionCheckTime > 1000); // 1 second interval
      
      if (positionCheckNeeded) {
        unit.lastPositionCheckTime = now;
        
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
        
        // Calculate safe distance with explosion buffer
        const explosionSafetyBuffer = TILE_SIZE * 0.5
        const safeAttackDistance = Math.max(
          TANK_FIRE_RANGE * TILE_SIZE,
          TILE_SIZE * 2 + explosionSafetyBuffer
        )
        
        // If unit is too close and not already dodging, back up
        if (currentDist < safeAttackDistance && !unit.isDodging) {
          // Calculate retreat position (away from target)
          const destTileX = Math.floor(unit.tileX - Math.round((dx / currentDist) * 2));
          const destTileY = Math.floor(unit.tileY - Math.round((dy / currentDist) * 2));
          
          // Check map boundaries and tile validity
          if (destTileX >= 0 && destTileX < mapGrid[0].length && 
              destTileY >= 0 && destTileY < mapGrid.length) {
            
            const tileType = mapGrid[destTileY][destTileX].type;
            if (tileType !== 'water' && tileType !== 'rock' && tileType !== 'building') {
              const newPath = findPath(
                { x: unit.tileX, y: unit.tileY }, 
                { x: destTileX, y: destTileY }, 
                mapGrid, 
                null
              );
              if (newPath.length > 1) {
                unit.path = newPath.slice(1);
                unit.lastPathCalcTime = now;
              }
            }
          }
        }
      }
    }
  });
}

// Spawns an enemy unit at the center ("under") of the enemy factory.
export function spawnEnemyUnit(factory, unitType, units, mapGrid) {
  const spawnX = factory.x + Math.floor(factory.width / 2)
  const spawnY = factory.y + Math.floor(factory.height / 2)
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
    spawnedInFactory: true,
    lastPathCalcTime: 0,        // Track when we last calculated a path
    lastPositionCheckTime: 0,   // Track when we last checked position
    // Add rotation properties
    direction: 0,
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: 0.1,
    isRotating: false
  }
}

// Helper: Find the closest ore tile from a unit's current position.
function findClosestOre(unit, mapGrid) {
  let closest = null
  let closestDist = Infinity
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      if (mapGrid[y][x].type === 'ore') {
        const dx = x - unit.tileX
        const dy = y - unit.tileY
        const dist = Math.hypot(dx, dy)
        if (dist < closestDist) {
          closestDist = dist
          closest = { x, y }
        }
      }
    }
  }
  return closest
}

// Helper: Find an adjacent tile (to the factory) that is not a building.
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
