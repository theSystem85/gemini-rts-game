import { TILE_SIZE, TANK_FIRE_RANGE, STREET_SPEED_MULTIPLIER } from '../config.js'
import { fireBullet } from './bulletSystem.js'
import { selectedUnits } from '../inputHandler.js'
import { gameState } from '../gameState.js'

function getFireRateForUnit(unit) {
  if (unit.type === 'rocketTank') return 12000
  return 4000
}

export function updateRemoteControlledUnits(units, bullets, mapGrid) {
  const rc = gameState.remoteControl
  if (!rc) return
  if (!selectedUnits || selectedUnits.length === 0) return
  const now = performance.now()
  selectedUnits.forEach(unit => {
    if (!unit.type || !unit.type.includes('tank')) return
    if (!unit.movement) return

    // Cancel pathing when using remote control
    if (rc.forward || rc.backward || rc.turnLeft || rc.turnRight) {
      unit.path = []
      unit.moveTarget = null
    }

    // Adjust rotation
    if (rc.turnLeft) {
      unit.movement.targetRotation -= unit.rotationSpeed || 0.05
    }
    if (rc.turnRight) {
      unit.movement.targetRotation += unit.rotationSpeed || 0.05
    }

    // Compute effective max speed similar to unified movement
    const speedModifier = unit.speedModifier || 1
    const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
    const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
    const onStreet = mapGrid[tileY] && mapGrid[tileY][tileX] && mapGrid[tileY][tileX].type === 'street'
    let terrainMultiplier = onStreet ? STREET_SPEED_MULTIPLIER : 1
    if (unit.type === 'ambulance' && onStreet) {
      const props = unit.ambulanceProps || { streetSpeedMultiplier: 6.0 }
      terrainMultiplier = props.streetSpeedMultiplier || 6.0
    }
    const effectiveMaxSpeed = 0.9 * speedModifier * terrainMultiplier

    // Move forward/backward
    if (rc.forward) {
      const fx = Math.cos(unit.movement.rotation)
      const fy = Math.sin(unit.movement.rotation)
      unit.movement.targetVelocity.x = fx * effectiveMaxSpeed
      unit.movement.targetVelocity.y = fy * effectiveMaxSpeed
      unit.movement.isMoving = true
    } else if (rc.backward) {
      const fx = Math.cos(unit.movement.rotation)
      const fy = Math.sin(unit.movement.rotation)
      unit.movement.targetVelocity.x = -fx * effectiveMaxSpeed
      unit.movement.targetVelocity.y = -fy * effectiveMaxSpeed
      unit.movement.isMoving = true
    } else {
      unit.movement.targetVelocity.x = 0
      unit.movement.targetVelocity.y = 0
      unit.movement.isMoving = false
    }

    // Fire forward when requested
    if (rc.fire && unit.canFire !== false) {
      const baseRate = getFireRateForUnit(unit)
      const effectiveRate =
        unit.level >= 3 ? baseRate / (unit.fireRateMultiplier || 1.33) : baseRate

      if (!unit.lastShotTime || now - unit.lastShotTime >= effectiveRate) {
        const rangePx = TANK_FIRE_RANGE * TILE_SIZE
        const dir =
          unit.turretDirection !== undefined
            ? unit.turretDirection
            : unit.movement.rotation
        const tx = unit.x + TILE_SIZE / 2 + Math.cos(dir) * rangePx
        const ty = unit.y + TILE_SIZE / 2 + Math.sin(dir) * rangePx
        const target = {
          tileX: Math.floor(tx / TILE_SIZE),
          tileY: Math.floor(ty / TILE_SIZE),
          x: tx,
          y: ty
        }
        fireBullet(unit, target, bullets, now)
      }
    }
  })
  rc.fire = false
}
