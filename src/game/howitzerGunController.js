// howitzerGunController.js - manages howitzer gun elevation and firing readiness
import {
  TILE_SIZE,
  HOWITZER_FIRE_RANGE,
  HOWITZER_MIN_RANGE
} from '../config.js'
import { normalizeAngle } from '../logic.js'

const MAX_ELEVATION_RAD = (65 * Math.PI) / 180
const MIN_ELEVATION_RAD = 0
const LOWERED_THRESHOLD_RAD = (2.5 * Math.PI) / 180
const MIN_ADJUST_DURATION_MS = 1400
const MAX_ADJUST_DURATION_MS = 4000
const DEFAULT_LOWER_DURATION_MS = 2600

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function initializeHowitzerGun(unit) {
  unit.barrelElevation = 0
  unit.targetBarrelElevation = 0
  unit.barrelWorldAngle = unit.direction || 0
  unit.targetBarrelWorldAngle = unit.direction || 0
  unit.lastBarrelUpdateTime = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now()
  unit.howitzerGunReady = true
  unit.howitzerMovementLock = false
  unit.barrelDistanceFactor = 1
}

export function updateHowitzerGunState(unit, now) {
  if (!unit || unit.type !== 'howitzer') {
    return
  }

  if (typeof unit.barrelElevation !== 'number') {
    initializeHowitzerGun(unit)
  }

  const deltaMs = unit.lastBarrelUpdateTime ? Math.max(0, Math.min(now - unit.lastBarrelUpdateTime, 120)) : 16
  unit.lastBarrelUpdateTime = now

  let desiredWorldAngle = unit.direction || 0
  let desiredElevation = 0
  let distanceFactor = unit.barrelDistanceFactor || 1

  const hasTarget = Boolean(unit.target && unit.target.health > 0)
  if (hasTarget) {
    let targetCenterX
    let targetCenterY
    if (unit.target.tileX !== undefined) {
      targetCenterX = unit.target.x + TILE_SIZE / 2
      targetCenterY = unit.target.y + TILE_SIZE / 2
    } else {
      targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
      targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
    }

    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2

    const dx = targetCenterX - unitCenterX
    const dy = targetCenterY - unitCenterY
    const distance = Math.hypot(dx, dy)

    if (distance > 1e-3) {
      const arcHeight = distance * 0.5
      const launchAngle = Math.atan2(dy - arcHeight * Math.PI, dx)
      desiredWorldAngle = launchAngle

      const maxRange = (HOWITZER_FIRE_RANGE || 15) * TILE_SIZE * (unit.rangeMultiplier || 1)
      const minRange = (HOWITZER_MIN_RANGE || 2) * TILE_SIZE
      const clampedRange = clamp(distance, minRange, maxRange)
      distanceFactor = clamp((clampedRange - minRange) / Math.max(1, maxRange - minRange), 0, 1)
    }
  }

  unit.targetBarrelWorldAngle = desiredWorldAngle
  const rawElevation = normalizeAngle((unit.direction || 0) - desiredWorldAngle)
  desiredElevation = clamp(rawElevation, MIN_ELEVATION_RAD, MAX_ELEVATION_RAD)
  unit.targetBarrelElevation = desiredElevation
  unit.barrelDistanceFactor = distanceFactor

  const currentElevation = unit.barrelElevation || 0
  const diff = desiredElevation - currentElevation
  const isRaising = diff > 0
  const distanceWeightedDuration = MIN_ADJUST_DURATION_MS + (1 - distanceFactor) * (MAX_ADJUST_DURATION_MS - MIN_ADJUST_DURATION_MS)
  const durationMs = isRaising
    ? distanceWeightedDuration
    : Math.max(MIN_ADJUST_DURATION_MS * 0.75, Math.min(MAX_ADJUST_DURATION_MS, distanceWeightedDuration * 0.85 || DEFAULT_LOWER_DURATION_MS))

  let nextElevation = desiredElevation
  if (Math.abs(diff) > 1e-4) {
    const angularSpeed = (MAX_ELEVATION_RAD - MIN_ELEVATION_RAD) / Math.max(durationMs, 1)
    const step = angularSpeed * deltaMs
    if (Math.abs(diff) <= step) {
      nextElevation = desiredElevation
    } else {
      nextElevation = currentElevation + Math.sign(diff) * step
    }
  }

  unit.barrelElevation = clamp(nextElevation, MIN_ELEVATION_RAD, MAX_ELEVATION_RAD)
  unit.barrelWorldAngle = (unit.direction || 0) - unit.barrelElevation

  const elevationError = Math.abs(unit.barrelElevation - desiredElevation)
  unit.howitzerGunReady = hasTarget ? elevationError <= (1.5 * Math.PI) / 180 : elevationError <= (2 * Math.PI) / 180
  unit.barrelIsMoving = elevationError > (0.3 * Math.PI) / 180
  const needsLowering = !hasTarget && unit.barrelElevation > LOWERED_THRESHOLD_RAD
  unit.howitzerMovementLock = unit.barrelIsMoving || needsLowering
}

export function isHowitzerGunReadyToFire(unit) {
  if (!unit || unit.type !== 'howitzer') return true
  return Boolean(unit.howitzerGunReady)
}

export function getHowitzerLaunchAngle(unit) {
  if (!unit || unit.type !== 'howitzer') {
    return unit ? unit.direction : 0
  }
  return typeof unit.barrelWorldAngle === 'number' ? unit.barrelWorldAngle : unit.direction || 0
}

