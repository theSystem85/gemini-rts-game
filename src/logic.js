// logic.js
import {
  INERTIA_DECAY,
  TILE_SIZE,
  ORE_SPREAD_INTERVAL,
  ORE_SPREAD_PROBABILITY,
  TANK_FIRE_RANGE,
  HARVESTER_CAPPACITY,
  PATH_CALC_INTERVAL
} from './config.js'
import { spawnUnit, findPath, buildOccupancyMap, resolveUnitCollisions } from './units.js'
import { playSound } from './sound.js'
import { updateEnemyAI } from './enemy.js'

let explosions = [] // Global explosion effects for rocket impacts

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  if (gameState.gamePaused) return
  const now = performance.now()
  const occupancyMap = buildOccupancyMap(units, mapGrid)
  gameState.gameTime += delta / 1000

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
  units.forEach(unit => {
    const prevX = unit.x, prevY = unit.y

    if (unit.target && unit.target.health !== undefined && unit.target.health <= 0) {
      unit.target = null
    }

    let effectiveSpeed = unit.speed
    if (mapGrid[unit.tileY][unit.tileX].type === 'street') {
      effectiveSpeed *= 2
    }

    // --- Movement Along Path ---
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0]
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
        occupancyMap[unit.tileY][unit.tileX] = true
      } else {
        unit.x += (dx / distance) * effectiveSpeed
        unit.y += (dy / distance) * effectiveSpeed
      }
    }
    if (unit.x !== prevX || unit.y !== prevY) {
      unit.lastMovedTime = now
    }

    // --- Spawn Exit ---
    if (unit.spawnedInFactory) {
      const factory = unit.owner === 'player'
        ? factories.find(f => f.id === 'player')
        : factories.find(f => f.id === 'enemy')
      if (unit.tileX >= factory.x && unit.tileX < factory.x + factory.width &&
          unit.tileY >= factory.y && unit.tileY < factory.y + factory.height) {
        const exitTile = findAdjacentTile(factory, mapGrid)
        if (exitTile) {
          const exitPath = findPath({ x: unit.tileX, y: unit.tileY }, exitTile, mapGrid, occupancyMap)
          if (exitPath.length > 1) {
            unit.path = exitPath.slice(1)
          }
        }
      } else {
        unit.spawnedInFactory = false
      }
    }

    // --- Firing ---
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
      const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)
      if (dist <= TANK_FIRE_RANGE * TILE_SIZE) {
        if (!unit.lastShotTime || now - unit.lastShotTime > 1600) {
          if (unit.type === 'tank') {
            let bullet = {
              id: Date.now() + Math.random(),
              x: unitCenterX,
              y: unitCenterY,
              speed: 3,
              baseDamage: 20,
              active: true,
              shooter: unit,
              homing: false
            }
            const angle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)
            bullet.vx = bullet.speed * Math.cos(angle)
            bullet.vy = bullet.speed * Math.sin(angle)
            bullets.push(bullet)
            unit.lastShotTime = now
            playSound('shoot')
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
              target: unit.target,
              startTime: now
            }
            bullets.push(bullet)
            unit.lastShotTime = now
            playSound('shoot_rocket')
          }
        }
      }
    }

    // --- Harvester ---
    if (unit.type === 'harvester') {
      const unitTileX = Math.floor(unit.x / TILE_SIZE)
      const unitTileY = Math.floor(unit.y / TILE_SIZE)
      if (unit.oreCarried < HARVESTER_CAPPACITY && !unit.harvesting) {
        if (mapGrid[unitTileY][unitTileX].type === 'ore') {
          if (!unit.oreField) {
            unit.oreField = { x: unitTileX, y: unitTileY }
          }
          if (unit.oreField.x === unitTileX && unit.oreField.y === unitTileY) {
            unit.harvesting = true
            unit.harvestTimer = now
            playSound('harvest')
          }
        } else {
          if (!unit.path || unit.path.length === 0) {
            const orePos = findClosestOre(unit, mapGrid)
            if (orePos) {
              const path = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, occupancyMap)
              if (path.length > 1) {
                unit.path = path.slice(1)
              }
            }
          }
        }
      }
      if (unit.harvesting) {
        if (now - unit.harvestTimer > 10000) {
          unit.oreCarried++
          unit.harvesting = false
          mapGrid[unitTileY][unitTileX].type = 'land'
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
  })

  // --- Global Path Recalculation ---
  if (!gameState.lastGlobalPathCalc || now - gameState.lastGlobalPathCalc > PATH_CALC_INTERVAL) {
    gameState.lastGlobalPathCalc = now
    const THRESHOLD = 20
    units.forEach(unit => {
      if (unit.target && (!unit.path || unit.path.length === 0)) {
        let targetPos
        if (unit.target.tileX !== undefined) {
          // If target is a unit, use its tile coordinates.
          targetPos = { x: unit.target.tileX, y: unit.target.tileY }
        } else {
          // Otherwise, assume target is a building.
          targetPos = { x: unit.target.x, y: unit.target.y }
        }
        // Compute distance in tiles.
        const distance = Math.hypot(targetPos.x - unit.tileX, targetPos.y - unit.tileY)
        const newPath = distance > THRESHOLD 
          ? findPath({ x: unit.tileX, y: unit.tileY }, targetPos, mapGrid, null)
          : findPath({ x: unit.tileX, y: unit.tileY }, targetPos, mapGrid, occupancyMap)
        if (newPath.length > 1) {
          unit.path = newPath.slice(1)
        }
      }
    })
  }

  // --- Bullet Updates ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet.active) continue
    if (bullet.homing) {
      if (now - bullet.startTime > 5000) {
        triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
        bullet.active = false
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
        bullet.x += (dx / distance) * bullet.speed
        bullet.y += (dy / distance) * bullet.speed
      } else {
        bullet.active = false
        triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
        continue
      }
      const hitTarget = checkBulletCollision(bullet, units, factories)
      if (hitTarget) {
        triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
        bullet.active = false
        playSound('shoot_rocket')
        continue
      }
    } else {
      bullet.x += bullet.vx
      bullet.y += bullet.vy
      const hitTarget = checkBulletCollision(bullet, units, factories)
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
        }
      }
    }
    if (bullet.x < 0 || bullet.x > mapGrid[0].length * TILE_SIZE ||
        bullet.y < 0 || bullet.y > mapGrid.length * TILE_SIZE) {
      bullet.active = false
    }
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
      } else if (factory.id === 'player') {
        gameState.losses++
      }
      gameState.gamePaused = true
      playSound('explosion')
      factories.splice(i, 1)
    }
  }

  // --- Update Enemy AI ---
  updateEnemyAI(units, factories, bullets, mapGrid, gameState)
}

// --- Helper Functions ---
function checkBulletCollision(bullet, units, factories) {
  for (let u of units) {
    if (u.id === bullet.shooter.id) continue
    const centerX = u.x + TILE_SIZE / 2
    const centerY = u.y + TILE_SIZE / 2
    const dist = Math.hypot(bullet.x - centerX, bullet.y - centerY)
    if (dist < 10) return u
  }
  for (let f of factories) {
    if (f.destroyed) continue
    const centerX = f.x * TILE_SIZE + (f.width * TILE_SIZE) / 2
    const centerY = f.y * TILE_SIZE + (f.height * TILE_SIZE) / 2
    const dist = Math.hypot(bullet.x - centerX, bullet.y - centerY)
    if (dist < 10) return f
  }
  return null
}

function triggerExplosion(x, y, baseDamage, units, factories, now, mapGrid) {
  const radius = 2 * TILE_SIZE
  units.forEach(u => {
    const unitCenterX = u.x + TILE_SIZE / 2
    const unitCenterY = u.y + TILE_SIZE / 2
    const dist = Math.hypot(unitCenterX - x, unitCenterY - y)
    if (dist < radius) {
      const factor = 1 - (dist / radius)
      const damage = baseDamage * factor
      u.health -= damage
      if (u.health < 0) u.health = 0
    }
  })
  factories.forEach(f => {
    if (f.destroyed) return
    const fCenterX = f.x * TILE_SIZE + (f.width * TILE_SIZE) / 2
    const fCenterY = f.y * TILE_SIZE + (f.height * TILE_SIZE) / 2
    const dist = Math.hypot(fCenterX - x, fCenterY - y)
    if (dist < radius) {
      const factor = 1 - (dist / radius)
      const damage = baseDamage * factor
      f.health -= damage
      if (f.health < 0) f.health = 0
    }
  })
  explosions.push({
    x: x,
    y: y,
    startTime: now,
    duration: 1000,
    maxRadius: radius
  })
}

function isAdjacentToFactory(unit, factory) {
  const unitTileX = Math.floor(unit.x / TILE_SIZE)
  const unitTileY = Math.floor(unit.y / TILE_SIZE)
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (unitTileX === x && unitTileY === y) {
        return true
      }
    }
  }
  return false
}

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
