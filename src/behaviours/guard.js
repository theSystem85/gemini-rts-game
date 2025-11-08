import { TILE_SIZE } from '../config.js'
import { findPath } from '../units.js'

const FOLLOW_DISTANCE = 1.5 * TILE_SIZE
const PATH_INTERVAL = 500

export function updateGuardBehavior(unit, mapGrid, occupancyMap, now) {
  if (unit.awaitingRefuel || unit.refueling) {
    unit.guardTarget = null
    unit.guardMode = false
    return
  }

  if (unit.guardTarget && unit.guardTarget.health > 0) {
    unit.guardMode = true
    const unitCenterX = unit.x + TILE_SIZE / 2
    const unitCenterY = unit.y + TILE_SIZE / 2
    const targetCenterX = unit.guardTarget.x + TILE_SIZE / 2
    const targetCenterY = unit.guardTarget.y + TILE_SIZE / 2
    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)
    const desiredTile = { x: unit.guardTarget.tileX, y: unit.guardTarget.tileY }

    if (distance > FOLLOW_DISTANCE) {
      if (!unit.lastGuardPathCalcTime || now - unit.lastGuardPathCalcTime > PATH_INTERVAL) {
        const path = findPath({ x: unit.tileX, y: unit.tileY }, desiredTile, mapGrid, occupancyMap)
        if (path && path.length > 1) {
          unit.path = path.slice(1)
          unit.moveTarget = desiredTile
        }
        unit.lastGuardPathCalcTime = now
      }
    }
  } else {
    unit.guardTarget = null
    unit.guardMode = false
  }
}
