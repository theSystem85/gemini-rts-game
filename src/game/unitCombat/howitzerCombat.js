import { TILE_SIZE } from '../../config.js'
import { playSound } from '../../sound.js'
import { findPath } from '../../units.js'
import { gameState } from '../../gameState.js'
import { isHowitzerGunReadyToFire } from '../howitzerGunController.js'
import { showNotification } from '../../ui/notifications.js'
import {
  applyTargetingSpread,
  getHowitzerCooldown,
  getHowitzerMinRange,
  getHowitzerRange,
  handleTankMovement,
  isHowitzerTargetVisible,
  isHumanControlledParty,
  isTurretAimedAtTarget
} from './combatHelpers.js'
import { fireHowitzerShell } from './firingHandlers.js'

export function updateHowitzerCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (!unit.target || unit.target.health <= 0) {
    return
  }

  const CHASE_THRESHOLD = getHowitzerRange(unit) * 1.1
  const { distance, targetCenterX, targetCenterY } = handleTankMovement(
    unit,
    unit.target,
    now,
    occupancyMap,
    CHASE_THRESHOLD,
    mapGrid
  )

  const canAttack = isHumanControlledParty(unit.owner) || unit.allowedToAttack === true
  const minRangePx = getHowitzerMinRange()
  const effectiveRange = getHowitzerRange(unit)
  const targetVisible = isHowitzerTargetVisible(unit, unit.target, mapGrid)
  const unitCenterX = unit.x + TILE_SIZE / 2
  const unitCenterY = unit.y + TILE_SIZE / 2

  if (distance < minRangePx) {
    if (!isHumanControlledParty(unit.owner) && mapGrid && mapGrid.length > 0) {
      const shouldReposition = !unit.lastMinRangeReposition || (now - unit.lastMinRangeReposition > 750)
      if (shouldReposition) {
        const mapHeight = mapGrid.length
        const mapWidth = mapGrid[0]?.length || 0

        if (mapWidth > 0) {
          const retreatVectorX = unitCenterX - targetCenterX
          const retreatVectorY = unitCenterY - targetCenterY
          const retreatDistance = Math.hypot(retreatVectorX, retreatVectorY)

          if (retreatDistance > 1) {
            const desiredDistance = Math.max(minRangePx + TILE_SIZE, retreatDistance)
            const normX = retreatVectorX / retreatDistance
            const normY = retreatVectorY / retreatDistance
            const desiredX = targetCenterX + normX * desiredDistance
            const desiredY = targetCenterY + normY * desiredDistance

            const baseTileX = Math.max(0, Math.min(mapWidth - 1, Math.floor(desiredX / TILE_SIZE)))
            const baseTileY = Math.max(0, Math.min(mapHeight - 1, Math.floor(desiredY / TILE_SIZE)))

            const currentTileX = Math.floor(unitCenterX / TILE_SIZE)
            const currentTileY = Math.floor(unitCenterY / TILE_SIZE)

            const candidateOffsets = [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: -1 },
              { x: 1, y: 1 },
              { x: -1, y: -1 },
              { x: 1, y: -1 },
              { x: -1, y: 1 }
            ]

            for (const offset of candidateOffsets) {
              const tileX = Math.max(0, Math.min(mapWidth - 1, baseTileX + offset.x))
              const tileY = Math.max(0, Math.min(mapHeight - 1, baseTileY + offset.y))

              if (tileX === currentTileX && tileY === currentTileY) {
                continue
              }

              const tile = mapGrid[tileY]?.[tileX]
              if (!tile || tile.type === 'water' || tile.type === 'rock' || tile.building) {
                continue
              }

              const path = findPath(
                { x: currentTileX, y: currentTileY },
                { x: tileX, y: tileY },
                mapGrid,
                occupancyMap
              )

              if (path.length > 1) {
                unit.path = path.slice(1)
                unit.moveTarget = { x: tileX, y: tileY }
                unit.lastAttackPathCalcTime = now
                break
              }
            }
          }
        }

        unit.lastMinRangeReposition = now
      }
    }

    return
  }

  if (
    distance <= effectiveRange &&
    canAttack &&
    targetVisible &&
    unit.canFire !== false &&
    isTurretAimedAtTarget(unit, unit.target) &&
    isHowitzerGunReadyToFire(unit)
  ) {
    if (unit.crew && typeof unit.crew === 'object' && !unit.crew.loader) {
      return
    }
    // Check ammunition availability
    if (typeof unit.ammunition === 'number' && unit.ammunition <= 0) {
      // Show notification only for player units and only once per unit
      if (unit.owner === gameState.humanPlayer && !unit.noAmmoNotificationShown) {
        showNotification('No Ammunition - Resupply Required', 3000)
        playSound('i_am_out_of_ammo', 1.0, 0, true) // Stackable so multiple units can announce
        unit.noAmmoNotificationShown = true
      }
      return
    } else if (unit.ammunition > 0) {
      // Reset notification flag when unit has ammo again
      unit.noAmmoNotificationShown = false
    }
    const cooldown = getHowitzerCooldown(unit)
    if (!unit.lastShotTime || now - unit.lastShotTime >= cooldown) {
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      const aimPoint = applyTargetingSpread(unitCenterX, unitCenterY, targetCenterX, targetCenterY, 'artillery', unit.type)
      fireHowitzerShell(unit, aimPoint, bullets, now)
    }
  }
}
