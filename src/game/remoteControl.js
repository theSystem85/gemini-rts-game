import {
  TILE_SIZE,
  TANK_FIRE_RANGE,
  STREET_SPEED_MULTIPLIER,
  ENABLE_ENEMY_CONTROL
} from '../config.js'
import { fireBullet } from './bulletSystem.js'
import { selectedUnits } from '../inputHandler.js'
import { gameState } from '../gameState.js'
import { normalizeAngle, smoothRotateTowardsAngle } from '../logic.js'

function getFireRateForUnit(unit) {
  if (unit.type === 'rocketTank') return 12000
  return 4000
}

function getTargetCenter(target) {
  if (!target) return null

  if (target.tileX !== undefined) {
    return {
      x: target.x + TILE_SIZE / 2,
      y: target.y + TILE_SIZE / 2
    }
  }

  if (target.width !== undefined && target.height !== undefined) {
    return {
      x: target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2,
      y: target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2
    }
  }

  return null
}

function aimTurretAtTarget(unit, target) {
  if (!target) return
  if (target.health !== undefined && target.health <= 0) return

  const targetCenter = getTargetCenter(target)
  if (!targetCenter) return

  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2
  const desiredAngle = Math.atan2(targetCenter.y - unitCenterY, targetCenter.x - unitCenterX)

  if (unit.crew && typeof unit.crew === 'object' && !unit.crew.gunner) {
    unit.turretDirection = unit.direction || 0
    return
  }

  const currentAngle =
    unit.turretDirection !== undefined ? unit.turretDirection : unit.direction || 0
  const rotationSpeed = unit.turretRotationSpeed || unit.rotationSpeed || 0.05
  unit.turretDirection = smoothRotateTowardsAngle(currentAngle, desiredAngle, rotationSpeed)
  unit.turretShouldFollowMovement = false
}

export function updateRemoteControlledUnits(units, bullets, mapGrid, occupancyMap) {
  const rc = gameState.remoteControl
  if (!rc) return
  if (!selectedUnits || selectedUnits.length === 0) return
  const now = performance.now()
  selectedUnits.forEach(unit => {
    if (!unit.type || !unit.type.includes('tank')) return
    if (!unit.movement) return

    // Only allow remote control for player units unless enemy control is enabled
    const humanPlayer = gameState.humanPlayer || 'player1'
    const isPlayerUnit =
      unit.owner === humanPlayer || (humanPlayer === 'player1' && unit.owner === 'player')
    if (!isPlayerUnit && !ENABLE_ENEMY_CONTROL) {
      return
    }

    // Cancel pathing when using remote control
    if (rc.forward || rc.backward || rc.turnLeft || rc.turnRight) {
      unit.path = []
      unit.moveTarget = null
    }

    // Track whether this unit is actively being moved via remote control
    unit.remoteControlActive = rc.forward || rc.backward

    // Adjust rotation of the wagon directly so movement aligns with it
    if (rc.turnLeft) {
      unit.direction = normalizeAngle(
        (unit.direction || 0) - (unit.rotationSpeed || 0.05)
      )
    }
    if (rc.turnRight) {
      unit.direction = normalizeAngle(
        (unit.direction || 0) + (unit.rotationSpeed || 0.05)
      )
    }

    // Manual turret rotation when shift-modified keys are used
    if (rc.turretLeft) {
      const speed = unit.turretRotationSpeed || unit.rotationSpeed || 0.05
      const current =
        unit.turretDirection !== undefined ? unit.turretDirection : unit.direction
      unit.turretDirection = normalizeAngle(current - speed)
      unit.turretShouldFollowMovement = false
      unit.manualTurretOverrideUntil = now + 150
    }
    if (rc.turretRight) {
      const speed = unit.turretRotationSpeed || unit.rotationSpeed || 0.05
      const current =
        unit.turretDirection !== undefined ? unit.turretDirection : unit.direction
      unit.turretDirection = normalizeAngle(current + speed)
      unit.turretShouldFollowMovement = false
      unit.manualTurretOverrideUntil = now + 150
    }
    const manualTurretInput = rc.turretLeft || rc.turretRight
    if (!manualTurretInput && unit.manualTurretOverrideUntil && now >= unit.manualTurretOverrideUntil) {
      unit.manualTurretOverrideUntil = null
    }

    const manualOverrideActive =
      manualTurretInput || (unit.manualTurretOverrideUntil && now < unit.manualTurretOverrideUntil)
    // Keep movement rotation in sync with wagon direction
    unit.movement.rotation = unit.direction
    unit.movement.targetRotation = unit.direction

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

    // Move forward/backward relative to wagon direction
    if (rc.forward || rc.backward) {
      const directionSign = rc.forward ? 1 : -1
      const fx = Math.cos(unit.direction)
      const fy = Math.sin(unit.direction)

      // Check the tile one tile ahead (or behind) for occupancy
      const checkDistance = TILE_SIZE
      const checkX = unit.x + TILE_SIZE / 2 + fx * checkDistance * directionSign
      const checkY = unit.y + TILE_SIZE / 2 + fy * checkDistance * directionSign
      const nextTileX = Math.floor(checkX / TILE_SIZE)
      const nextTileY = Math.floor(checkY / TILE_SIZE)
      const currentTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
      const currentTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
      const occupied =
        occupancyMap &&
        occupancyMap[nextTileY] &&
        occupancyMap[nextTileY][nextTileX] &&
        !(nextTileX === currentTileX && nextTileY === currentTileY)

      if (!occupied) {
        unit.movement.targetVelocity.x = fx * effectiveMaxSpeed * directionSign
        unit.movement.targetVelocity.y = fy * effectiveMaxSpeed * directionSign
        unit.movement.isMoving = true
      } else {
        unit.movement.targetVelocity.x = 0
        unit.movement.targetVelocity.y = 0
        unit.movement.isMoving = false
      }
    } else {
      unit.movement.targetVelocity.x = 0
      unit.movement.targetVelocity.y = 0
      unit.movement.isMoving = false
    }

    if (unit.target && !manualOverrideActive) {
      aimTurretAtTarget(unit, unit.target)
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
