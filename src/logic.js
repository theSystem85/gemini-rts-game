import { INERTIA_DECAY, TILE_SIZE } from './config.js'
import { spawnUnit, findPath } from './units.js'
import { playSound } from './sound.js'

export function updateGame(delta, mapGrid, factories, units, bullets, gameState) {
  if (gameState.gamePaused) return

  const now = performance.now()
  // Automatische Produktion feindlicher Panzer (alle 10 Sekunden, Gruppe von 3)
  if (now - gameState.enemyLastProductionTime >= 10000) {
    for (let i = 0; i < 3; i++) {
      const enemyUnit = spawnUnit(factories[1], 'tank', units)
      units.push(enemyUnit)
      const path = findPath({ x: enemyUnit.tileX, y: enemyUnit.tileY }, { x: factories[0].x, y: factories[0].y }, mapGrid)
      if (path.length > 1) {
        enemyUnit.path = path.slice(1)
      }
      enemyUnit.target = factories[0]
    }
    gameState.enemyLastProductionTime = now
  }

  gameState.gameTime += delta / 1000

  // Inertia beim Scrolling
  if (!gameState.isRightDragging) {
    gameState.scrollOffset.x = Math.max(
      0,
      Math.min(
        gameState.scrollOffset.x - gameState.dragVelocity.x,
        mapGrid[0].length * TILE_SIZE - window.innerWidth + 250
      )
    )
    gameState.scrollOffset.y = Math.max(
      0,
      Math.min(
        gameState.scrollOffset.y - gameState.dragVelocity.y,
        mapGrid.length * TILE_SIZE - window.innerHeight
      )
    )
    gameState.dragVelocity.x *= INERTIA_DECAY
    gameState.dragVelocity.y *= INERTIA_DECAY
  }

  // Update der Einheitenbewegung
  units.forEach(unit => {
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0]
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE }
      const dx = targetPos.x - unit.x
      const dy = targetPos.y - unit.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < unit.speed) {
        unit.x = targetPos.x
        unit.y = targetPos.y
        unit.tileX = nextTile.x
        unit.tileY = nextTile.y
        unit.path.shift()
      } else {
        unit.x += (dx / distance) * unit.speed
        unit.y += (dy / distance) * unit.speed
      }
    } else {
      if (unit.target && unit.type === 'tank') {
        // Schieße ein Geschoss (kontinuierlich)
        const tx = unit.target.x || (unit.target.tileX * TILE_SIZE)
        const ty = unit.target.y || (unit.target.tileY * TILE_SIZE)
        const bullet = {
          id: Date.now() + Math.random(),
          x: unit.x + TILE_SIZE / 2,
          y: unit.y + TILE_SIZE / 2,
          target: unit.target,
          speed: 4,
          baseDamage: 20,
          active: true
        }
        bullets.push(bullet)
        playSound('shoot')
        unit.target = null
      }
    }

    // Logik für Harvester
    if (unit.type === 'harvester' && !unit.harvesting) {
      const tileX = Math.floor(unit.x / TILE_SIZE)
      const tileY = Math.floor(unit.y / TILE_SIZE)
      if (mapGrid[tileY][tileX].type === 'ore' && unit.oreCarried < 5) {
        unit.harvesting = true
        unit.harvestTimer = performance.now()
        playSound('harvest')
      }
    }
    if (unit.type === 'harvester' && unit.harvesting) {
      if (performance.now() - unit.harvestTimer > 10000) {
        unit.oreCarried++
        unit.harvesting = false
        if (unit.oreCarried >= 5) {
          const path = findPath({ x: unit.tileX, y: unit.tileY }, { x: factories[0].x, y: factories[0].y }, mapGrid)
          if (path.length > 1) {
            unit.path = path.slice(1)
          }
        }
      }
    }
    if (unit.type === 'harvester' && unit.oreCarried > 0) {
      if (
        unit.tileX >= factories[0].x &&
        unit.tileX < factories[0].x + factories[0].width &&
        unit.tileY >= factories[0].y &&
        unit.tileY < factories[0].y + factories[0].height
      ) {
        gameState.money += 500
        unit.oreCarried = 0
        playSound('deposit')
      }
    }
  })

  // Update der Geschosse
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet.active) continue
    let targetPos = null
    if (bullet.target) {
      targetPos = { x: bullet.target.x || (bullet.target.tileX * TILE_SIZE), y: bullet.target.y || (bullet.target.tileY * TILE_SIZE) }
    } else {
      bullet.active = false
      continue
    }
    const dx = targetPos.x - bullet.x
    const dy = targetPos.y - bullet.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < bullet.speed || distance === 0) {
      const factor = 0.8 + Math.random() * 0.4
      const damage = bullet.baseDamage * factor
      if (bullet.target.health !== undefined) {
        bullet.target.health -= damage
        bullet.active = false
        playSound('bulletHit')
        if (bullet.target.health <= 0) {
          bullet.target.health = 0
          // Hier könntest du die Einheit aus dem Spiel entfernen.
        }
      }
    } else {
      bullet.x += (dx / distance) * bullet.speed
      bullet.y += (dy / distance) * bullet.speed
    }
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].active) bullets.splice(i, 1)
  }
}
