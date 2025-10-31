import {
  TILE_SIZE,
  TANK_FIRE_RANGE,
  STREET_SPEED_MULTIPLIER,
  ENABLE_ENEMY_CONTROL,
  isTurretTankUnitType
} from '../config.js'
import { fireBullet } from './bulletSystem.js'
import { selectedUnits, getKeyboardHandler } from '../inputHandler.js'
import { gameState } from '../gameState.js'
import { angleDiff, normalizeAngle, smoothRotateTowardsAngle } from '../logic.js'

let lastAutoFocusUnitId = null

function ensureAutoFocusForRemoteControl(mapGrid) {
  if (!selectedUnits || selectedUnits.length !== 1) {
    lastAutoFocusUnitId = null
    return
  }

  const [unit] = selectedUnits
  if (!unit) {
    lastAutoFocusUnitId = null
    return
  }

  if (gameState.cameraFollowUnitId === unit.id) {
    lastAutoFocusUnitId = unit.id
    return
  }

  if (lastAutoFocusUnitId === unit.id) {
    return
  }

  const keyboardHandler = getKeyboardHandler ? getKeyboardHandler() : null
  if (!keyboardHandler || typeof keyboardHandler.toggleAutoFocus !== 'function') {
    return
  }

  keyboardHandler.toggleAutoFocus(selectedUnits, mapGrid)
  if (gameState.cameraFollowUnitId === unit.id) {
    lastAutoFocusUnitId = unit.id
  }
}

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

function clampRemoteIntensity(value) {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value > 1) return 1
  if (value < -1) return -1
  return value
}

function updateApacheRemoteControl(unit, inputs, now) {
  if (!unit.manualFlightInput) {
    unit.manualFlightInput = { forward: 0, strafe: 0, turn: 0, vertical: 0 }
  }

  const forward = clampRemoteIntensity(inputs.forward)
  const strafe = clampRemoteIntensity(inputs.strafe)
  const turn = clampRemoteIntensity(inputs.turn)
  const vertical = clampRemoteIntensity(inputs.vertical)

  const hasMovementInput =
    Math.abs(forward) > 0.05 ||
    Math.abs(strafe) > 0.05 ||
    Math.abs(turn) > 0.05 ||
    Math.abs(vertical) > 0.05

  if (hasMovementInput) {
    unit.path = []
    unit.moveTarget = null
    unit.flightTarget = null
    unit.flightCommand = null
  }

  unit.manualFlightInput.forward = forward
  unit.manualFlightInput.strafe = strafe
  unit.manualFlightInput.turn = turn
  unit.manualFlightInput.vertical = vertical
  unit.remoteControlActive = hasMovementInput

  if (inputs.fire > 0.1) {
    unit.manualFireRequested = now
  }
}

export function updateRemoteControlledUnits(units, bullets, mapGrid, occupancyMap) {
  const rc = gameState.remoteControl
  if (!rc) return
  if (!selectedUnits || selectedUnits.length === 0) {
    lastAutoFocusUnitId = null
    return
  }

  const now = performance.now()
  const forwardIntensity = rc.forward || 0
  const backwardIntensity = rc.backward || 0
  const turnLeftIntensity = rc.turnLeft || 0
  const turnRightIntensity = rc.turnRight || 0
  const turretLeftIntensity = rc.turretLeft || 0
  const turretRightIntensity = rc.turretRight || 0
  const fireIntensity = rc.fire || 0
  const ascendIntensity = rc.ascend || 0
  const descendIntensity = rc.descend || 0
  const strafeLeftIntensity = rc.strafeLeft || 0
  const strafeRightIntensity = rc.strafeRight || 0
  const rcAbsolute = gameState.remoteControlAbsolute || {}
  const rawWagonDirection =
    Number.isFinite(rcAbsolute.wagonDirection) ? rcAbsolute.wagonDirection : null
  const rawWagonSpeed = typeof rcAbsolute.wagonSpeed === 'number' ? rcAbsolute.wagonSpeed : 0
  const rawTurretDirection =
    Number.isFinite(rcAbsolute.turretDirection) ? rcAbsolute.turretDirection : null
  const rawTurretTurnFactor =
    typeof rcAbsolute.turretTurnFactor === 'number' ? rcAbsolute.turretTurnFactor : 0
  const remoteControlEngaged =
    forwardIntensity > 0 ||
    backwardIntensity > 0 ||
    turnLeftIntensity > 0 ||
    turnRightIntensity > 0 ||
    turretLeftIntensity > 0 ||
    turretRightIntensity > 0 ||
    fireIntensity > 0 ||
    rawWagonSpeed > 0 ||
    rawTurretTurnFactor > 0

  if (remoteControlEngaged) {
    ensureAutoFocusForRemoteControl(mapGrid)
  } else if (!gameState.cameraFollowUnitId) {
    lastAutoFocusUnitId = null
  }

  selectedUnits.forEach(unit => {
    if (!unit || !unit.movement) return

    const hasTurret = isTurretTankUnitType(unit.type)

    // Only allow remote control for player units unless enemy control is enabled
    const humanPlayer = gameState.humanPlayer || 'player1'
    const isPlayerUnit =
      unit.owner === humanPlayer || (humanPlayer === 'player1' && unit.owner === 'player')
    if (!isPlayerUnit && !ENABLE_ENEMY_CONTROL) {
      return
    }

    const absoluteMovementActive =
      hasTurret && rawWagonDirection !== null && rawWagonSpeed > 0
    let hasMovementInput
    if (unit.type === 'apache') {
      const forward = forwardIntensity - backwardIntensity
      const strafe = strafeRightIntensity - strafeLeftIntensity
      const turn = turnRightIntensity - turnLeftIntensity
      const vertical = ascendIntensity - descendIntensity
      hasMovementInput =
        Math.abs(forward) > 0 ||
        Math.abs(strafe) > 0 ||
        Math.abs(turn) > 0 ||
        Math.abs(vertical) > 0
    } else {
      hasMovementInput =
        absoluteMovementActive ||
        forwardIntensity > 0 ||
        backwardIntensity > 0 ||
        turnLeftIntensity > 0 ||
        turnRightIntensity > 0
    }
    // Remote control requires an active commander
    if (unit.crew && typeof unit.crew === 'object' && !unit.crew.commander) {
      unit.remoteControlActive = false
      return
    }

    // Units without fuel cannot be remote controlled
    if (unit.gas !== undefined && unit.gas <= 0) {
      unit.remoteControlActive = false
      return
    }

    if (unit.type === 'apache') {
      updateApacheRemoteControl(unit, {
        forward: forwardIntensity - backwardIntensity,
        strafe: strafeRightIntensity - strafeLeftIntensity,
        turn: turnRightIntensity - turnLeftIntensity,
        vertical: ascendIntensity - descendIntensity,
        fire: fireIntensity
      }, now)
      continue
    }

    if (hasMovementInput) {
      unit.path = []
      unit.moveTarget = null
    }

    unit.remoteControlActive = !!hasMovementInput

    // Adjust rotation of the wagon directly so movement aligns with it
    const rotationSpeed = unit.rotationSpeed || 0.05
    let absoluteMovementDirectionSign = 1
    if (absoluteMovementActive) {
      const desiredDirection = normalizeAngle(rawWagonDirection)
      const currentDirection = unit.direction || 0
      let targetDirection = desiredDirection

      const reverseDirection = normalizeAngle(desiredDirection + Math.PI)
      const frontDiff = angleDiff(currentDirection, desiredDirection)
      const backDiff = angleDiff(currentDirection, reverseDirection)

      if (backDiff + 0.0001 < frontDiff) {
        targetDirection = reverseDirection
        absoluteMovementDirectionSign = -1
      }

      unit.direction = smoothRotateTowardsAngle(currentDirection, targetDirection, rotationSpeed)
    } else {
      const netTurn = turnRightIntensity - turnLeftIntensity
      if (netTurn) {
        unit.direction = normalizeAngle((unit.direction || 0) + rotationSpeed * netTurn)
      }
    }

    // Manual turret rotation when shift-modified keys are used
    const turretSpeed = unit.turretRotationSpeed || unit.rotationSpeed || 0.05
    const absoluteTurretActive =
      hasTurret && rawTurretDirection !== null && rawTurretTurnFactor > 0
    const netTurret = turretRightIntensity - turretLeftIntensity
    if (hasTurret && absoluteTurretActive) {
      const current =
        unit.turretDirection !== undefined ? unit.turretDirection : unit.direction
      const desiredTurret = normalizeAngle(rawTurretDirection)
      const rotationRate = turretSpeed * Math.max(0, Math.min(rawTurretTurnFactor, 1))
      unit.turretDirection = smoothRotateTowardsAngle(current, desiredTurret, rotationRate)
      unit.turretShouldFollowMovement = false
      unit.manualTurretOverrideUntil = now + 150
    } else if (hasTurret && netTurret) {
      const current =
        unit.turretDirection !== undefined ? unit.turretDirection : unit.direction
      unit.turretDirection = normalizeAngle(current + turretSpeed * netTurret)
      unit.turretShouldFollowMovement = false
      unit.manualTurretOverrideUntil = now + 150
    }

    const manualTurretInput =
      hasTurret &&
      (absoluteTurretActive || turretLeftIntensity > 0 || turretRightIntensity > 0)
    if (!manualTurretInput && hasTurret && unit.manualTurretOverrideUntil && now >= unit.manualTurretOverrideUntil) {
      unit.manualTurretOverrideUntil = null
    }

    const manualOverrideActive =
      manualTurretInput || (hasTurret && unit.manualTurretOverrideUntil && now < unit.manualTurretOverrideUntil)

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
    if (absoluteMovementActive) {
      const movementMagnitude = Math.max(0, Math.min(rawWagonSpeed, 1))
      const fx = Math.cos(unit.direction)
      const fy = Math.sin(unit.direction)

      const checkDistance = TILE_SIZE
      const checkX =
        unit.x + TILE_SIZE / 2 + fx * checkDistance * absoluteMovementDirectionSign
      const checkY =
        unit.y + TILE_SIZE / 2 + fy * checkDistance * absoluteMovementDirectionSign
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
        unit.movement.targetVelocity.x =
          fx * effectiveMaxSpeed * movementMagnitude * absoluteMovementDirectionSign
        unit.movement.targetVelocity.y =
          fy * effectiveMaxSpeed * movementMagnitude * absoluteMovementDirectionSign
        unit.movement.isMoving = movementMagnitude > 0
      } else {
        unit.movement.targetVelocity.x = 0
        unit.movement.targetVelocity.y = 0
        unit.movement.isMoving = false
      }
    } else {
      const movementAxis = forwardIntensity - backwardIntensity
      if (movementAxis) {
        const directionSign = movementAxis > 0 ? 1 : -1
        const movementMagnitude = Math.min(Math.abs(movementAxis), 1)
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
          unit.movement.targetVelocity.x = fx * effectiveMaxSpeed * directionSign * movementMagnitude
          unit.movement.targetVelocity.y = fy * effectiveMaxSpeed * directionSign * movementMagnitude
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
    }

    if (hasTurret && unit.target && !manualOverrideActive) {
      aimTurretAtTarget(unit, unit.target)
    }

    // Fire forward when requested
    if (hasTurret && fireIntensity > 0 && unit.canFire !== false) {
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

  rc.fire = 0
}
