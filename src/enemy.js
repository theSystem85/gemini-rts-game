// enemy.js
import { TILE_SIZE, TANK_FIRE_RANGE } from './config.js'
import { findPath, buildOccupancyMap } from './units.js'
import { getUniqueId } from './utils.js'

const ENABLE_DODGING = false // Constant to toggle dodging behavior, disabled by default
const lastPositionCheckTimeDelay = 3000
const dodgeTimeDelay = 3000
const useSafeAttackDistance = false

/* 
  updateEnemyAI:
  - Handles enemy production and target selection
  - Dodging behavior is now toggled by ENABLE_DODGING constant
  - Units recalculate paths no more often than every 2 seconds
*/
export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)
  const now = performance.now()
  const playerFactory = factories.find(f => f.id === 'player')
  const enemyFactory = factories.find(f => f.id === 'enemy')

  // Get targeted ore tiles from gameState
  const targetedOreTiles = gameState.targetedOreTiles || {};

  // --- Enemy Production ---
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
    if (unit.type === 'tank' || unit.type === 'rocketTank') {
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
    lastPathCalcTime: 0,
    lastPositionCheckTime: 0,
    lastTargetChangeTime: 0,
    direction: 0,
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: 0.1,
    isRotating: false,
    effectiveSpeed: 0.5
  }
  if (unitType === 'harvester') {
    unit.effectiveSpeed = 0.4
  } else if (unitType === 'rocketTank') {
    unit.effectiveSpeed = 0.3
  } else {
    unit.effectiveSpeed = 0.35
  }
  return unit
}

// Find the closest ore tile from a unit's position that isn't already targeted
function findClosestOre(unit, mapGrid, targetedOreTiles = {}) {
  return globalFindClosestOre(unit, mapGrid, targetedOreTiles);
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