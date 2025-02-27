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
import { selectedUnits, cleanupDestroyedSelectedUnits } from './inputHandler.js'

let explosions = [] // Global explosion effects for rocket impacts

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  try {
    if (gameState.gamePaused) return
    const now = performance.now()
    const occupancyMap = buildOccupancyMap(units, mapGrid)
    gameState.gameTime += delta / 1000
    
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

      // Clear targets that are destroyed
      if (unit.target && unit.target.health !== undefined && unit.target.health <= 0) {
        unit.target = null
      }
      
      let effectiveSpeed = unit.speed
      // Before using tile indices, clamp them so we don't access out-of-bound indices.
      unit.tileX = Math.max(0, Math.min(unit.tileX, mapGrid[0].length - 1))
      unit.tileY = Math.max(0, Math.min(unit.tileY, mapGrid.length - 1))

      if (mapGrid[unit.tileY][unit.tileX].type === 'street') {
        effectiveSpeed *= 2
      }

      // --- Movement Along Path ---
      if (unit.path && unit.path.length > 0) {
        const nextTile = unit.path[0]
        // Prevent path finding errors if nextTile is out of bounds.
        if (nextTile.x < 0 || nextTile.x >= mapGrid[0].length ||
            nextTile.y < 0 || nextTile.y >= mapGrid.length) {
          unit.path.shift()
        } else {
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
      }
      if (unit.x !== prevX || unit.y !== prevY) {
        unit.lastMovedTime = now
      }

      // After repositioning, clamp tile indices again.
      unit.tileX = Math.max(0, Math.min(unit.tileX, mapGrid[0].length - 1))
      unit.tileY = Math.max(0, Math.min(unit.tileY, mapGrid.length - 1))

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

      // --- Smooth Attack Position Adjustment for Tanks ---
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
        const desiredDist = TANK_FIRE_RANGE * TILE_SIZE
        // Calculate the desired center position to maintain range.
        const desiredCenterX = targetCenterX - (dx / currentDist) * desiredDist
        const desiredCenterY = targetCenterY - (dy / currentDist) * desiredDist
        // Compute target top-left positions for this unit.
        const desiredX = desiredCenterX - TILE_SIZE / 2
        const desiredY = desiredCenterY - TILE_SIZE / 2
        // Smoothly interpolate toward the desired position, scaled by unit speed.
        const diffX = desiredX - unit.x
        const diffY = desiredY - unit.y
        const diffDist = Math.hypot(diffX, diffY)
        if (diffDist > 1) { // only move if significant difference exists
          const moveX = (diffX / diffDist) * effectiveSpeed
          const moveY = (diffY / diffDist) * effectiveSpeed
          unit.x += moveX
          unit.y += moveY
        }
      }

      // --- Firing with Clear Line-of-Sight Check (Prevent Friendly Fire) ---
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
        // Only fire if target is within range and there is a clear line of sight
        if (dist <= TANK_FIRE_RANGE * TILE_SIZE && hasClearShot(unit, unit.target, units)) {
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
    }

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
      if (!bullet.active) {
        bullets.splice(i, 1)
        continue
      }
      if (bullet.homing) {
        if (now - bullet.startTime > 5000) {
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
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
          bullet.x += (dx / distance) * bullet.speed
          bullet.y += (dy / distance) * bullet.speed
        } else {
          bullet.active = false
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
          bullets.splice(i, 1)
          continue
        }
        const hitTarget = checkBulletCollision(bullet, units, factories)
        if (hitTarget) {
          triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
          bullet.active = false
          playSound('shoot_rocket')
          bullets.splice(i, 1)
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
            triggerExplosion(bullet.x, bullet.y, bullet.baseDamage, units, factories, now, mapGrid)
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
  } catch (error) {
    console.error("Critical error in updateGame:", error)
    // Don't allow the game to completely crash
  }
}

// --- Helper Functions ---
function checkBulletCollision(bullet, units, factories) {
  try {
    // Check collisions with units
    for (const unit of units) {
      // Skip friendly units to prevent friendly fire
      if (unit.owner === bullet.shooter?.owner) continue;
      
      const dx = (unit.x + TILE_SIZE / 2) - bullet.x
      const dy = (unit.y + TILE_SIZE / 2) - bullet.y
      const distance = Math.hypot(dx, dy)
      
      if (distance < 10) { // 10-pixel threshold for collision
        // Apply randomized damage (0.8x to 1.2x base damage)
        const damageMultiplier = 0.8 + Math.random() * 0.4
        const actualDamage = Math.round(bullet.baseDamage * damageMultiplier)
        unit.health -= actualDamage
        return unit
      }
    }
    
    // Check collisions with factories
    for (const factory of factories) {
      // Skip friendly factories
      if (factory.id === bullet.shooter?.owner) continue;
      if (factory.destroyed) continue;
      
      // Check if bullet is within factory bounds (with small buffer)
      const factoryX = factory.x * TILE_SIZE
      const factoryY = factory.y * TILE_SIZE
      const factoryWidth = factory.width * TILE_SIZE
      const factoryHeight = factory.height * TILE_SIZE
      
      if (bullet.x >= factoryX - 5 && bullet.x <= factoryX + factoryWidth + 5 &&
          bullet.y >= factoryY - 5 && bullet.y <= factoryY + factoryHeight + 5) {
        factory.health -= bullet.baseDamage
        // Create explosion effect
        if (!explosions) explosions = []
        
        // Check if factory is destroyed
        if (factory.health <= 0) {
          factory.destroyed = true
          if (factory.id === 'player') {
            gameState.losses++
            gameState.gameOver = true
          } else {
            gameState.wins++
            gameState.gameOver = true
          }
        }
        return factory
      }
    }
    
    return null
  } catch (error) {
    console.error("Error in checkBulletCollision:", error)
    return null
  }
}

// Trigger explosion effect and apply area damage
function triggerExplosion(x, y, baseDamage, units, factories, now, mapGrid) {
  const explosionRadius = TILE_SIZE * 2
  
  // Add explosion visual effect
  explosions.push({
    x,
    y,
    startTime: now,
    duration: 500,
    maxRadius: explosionRadius
  })
  
  // Apply damage to nearby units
  units.forEach(unit => {
    const dx = (unit.x + TILE_SIZE / 2) - x
    const dy = (unit.y + TILE_SIZE / 2) - y
    const distance = Math.hypot(dx, dy)
    
    if (distance < explosionRadius) {
      const falloff = 1 - (distance / explosionRadius)
      const damage = Math.round(baseDamage * falloff * 0.5) // Half damage with falloff
      unit.health -= damage
    }
  })
  
  // Apply damage to nearby factories
  factories.forEach(factory => {
    if (factory.destroyed) return
    
    const factoryCenterX = (factory.x + factory.width / 2) * TILE_SIZE
    const factoryCenterY = (factory.y + factory.height / 2) * TILE_SIZE
    const dx = factoryCenterX - x
    const dy = factoryCenterY - y
    const distance = Math.hypot(dx, dy)
    
    if (distance < explosionRadius) {
      const falloff = 1 - (distance / explosionRadius)
      const damage = Math.round(baseDamage * falloff * 0.3) // 30% damage with falloff
      factory.health -= damage
    }
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

// Prevent friendly fire by ensuring clear line-of-sight.
// Returns true if no friendly unit (other than shooter and target) is in the bullet's path.
function hasClearShot(shooter, target, units) {
  const shooterCenter = { x: shooter.x + TILE_SIZE / 2, y: shooter.y + TILE_SIZE / 2 }
  const targetCenter = target.tileX !== undefined 
    ? { x: target.x + TILE_SIZE / 2, y: target.y + TILE_SIZE / 2 }
    : { x: target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2, y: target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2 }
  const dx = targetCenter.x - shooterCenter.x
  const dy = targetCenter.y - shooterCenter.y
  const segmentLengthSq = dx * dx + dy * dy
  // Threshold distance that counts as being "in the way"
  const threshold = TILE_SIZE / 3

  for (let other of units) {
    // Only check for friendly units that are not the shooter or the intended target.
    if (other === shooter || other === target) continue
    if (other.owner !== shooter.owner) continue
    const otherCenter = { x: other.x + TILE_SIZE / 2, y: other.y + TILE_SIZE / 2 }
    const px = otherCenter.x - shooterCenter.x
    const py = otherCenter.y - shooterCenter.y
    let t = (px * dx + py * dy) / segmentLengthSq
    if (t < 0 || t > 1) continue
    const closestPoint = { x: shooterCenter.x + t * dx, y: shooterCenter.y + t * dy }
    const distToSegment = Math.hypot(otherCenter.x - closestPoint.x, otherCenter.y - closestPoint.y)
    if (distToSegment < threshold) {
      return false
    }
  }
  return true
}
