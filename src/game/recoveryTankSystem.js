import { TILE_SIZE } from '../config.js'
import { playSound } from '../sound.js'
import { getUnitCost } from '../utils.js'
import { logPerformance } from '../performanceUtils.js'
import { findPath, createUnit } from '../units.js'
import {
  getWreckById,
  removeWreckById,
  updateWreckPositionFromTank,
  releaseWreckAssignment
} from './unitWreckManager.js'

const TOW_DISTANCE_THRESHOLD = TILE_SIZE * 0.6

function distanceBetweenPoints(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

function handleTowTask(tank, task, wreck, units, gameState) {
  const mapGrid = gameState.mapGrid
  const occupancyMap = gameState.occupancyMap

  if (task.state === 'movingToWreck') {
    const tankCenterX = tank.x + TILE_SIZE / 2
    const tankCenterY = tank.y + TILE_SIZE / 2
    const wreckCenterX = wreck.x + TILE_SIZE / 2
    const wreckCenterY = wreck.y + TILE_SIZE / 2
    const dist = distanceBetweenPoints(tankCenterX, tankCenterY, wreckCenterX, wreckCenterY)

    if (dist <= TOW_DISTANCE_THRESHOLD) {
      tank.path = []
      tank.moveTarget = null
      tank.towedWreck = wreck
      wreck.towedBy = tank.id
      task.state = 'towingToWorkshop'

      const path = findPath(
        { x: tank.tileX, y: tank.tileY },
        task.workshopEntry,
        mapGrid,
        occupancyMap
      )

      if (path && path.length > 0) {
        tank.path = path.slice(1)
        tank.moveTarget = { x: task.workshopEntry.x, y: task.workshopEntry.y }
      } else {
        releaseWreckAssignment(wreck)
        tank.recoveryTask = null
        tank.towedWreck = null
        playSound('repairCancelled', 0.6)
      }
    }
  } else if (task.state === 'towingToWorkshop') {
    if (!tank.towedWreck) {
      tank.towedWreck = wreck
    }
    updateWreckPositionFromTank(wreck, tank)

    const workshop = (gameState.buildings || []).find(b => b.id === task.workshopId)
    if (!workshop || workshop.health <= 0) {
      releaseWreckAssignment(wreck)
      tank.recoveryTask = null
      tank.towedWreck = null
      playSound('repairCancelled', 0.6)
      return
    }

    const entryCenterX = (task.workshopEntry.x + 0.5) * TILE_SIZE
    const entryCenterY = (task.workshopEntry.y + 0.5) * TILE_SIZE
    const tankCenterX = tank.x + TILE_SIZE / 2
    const tankCenterY = tank.y + TILE_SIZE / 2
    const dist = distanceBetweenPoints(tankCenterX, tankCenterY, entryCenterX, entryCenterY)

    if (dist <= TOW_DISTANCE_THRESHOLD) {
      task.state = 'restoring'
      finalizeRestoration(tank, wreck, units, gameState)
    }
  }
}

function finalizeRestoration(tank, wreck, units, gameState) {
  if (!wreck) return
  const dropTileX = tank.tileX
  const dropTileY = tank.tileY

  const restored = createUnit({ owner: tank.owner }, wreck.unitType, dropTileX, dropTileY, {
    buildDuration: wreck.buildDuration
  })

  if (restored.crew) {
    Object.keys(restored.crew).forEach(role => {
      restored.crew[role] = false
    })
  }

  restored.health = restored.maxHealth
  restored.x = dropTileX * TILE_SIZE
  restored.y = dropTileY * TILE_SIZE
  restored.tileX = dropTileX
  restored.tileY = dropTileY

  units.push(restored)

  const occupancyMap = gameState.occupancyMap
  if (occupancyMap) {
    const centerTileX = Math.floor((restored.x + TILE_SIZE / 2) / TILE_SIZE)
    const centerTileY = Math.floor((restored.y + TILE_SIZE / 2) / TILE_SIZE)
    if (
      centerTileY >= 0 &&
      centerTileY < occupancyMap.length &&
      centerTileX >= 0 &&
      centerTileX < occupancyMap[0].length
    ) {
      occupancyMap[centerTileY][centerTileX] = (occupancyMap[centerTileY][centerTileX] || 0) + 1
    }
  }

  removeWreckById(gameState, wreck.id)
  releaseWreckAssignment(wreck)
  tank.recoveryTask = null
  tank.towedWreck = null
  tank.recoveryProgress = 0
  playSound('repairFinished', 0.8)
}

function handleRecycleTask(tank, task, wreck, gameState, delta) {
  if (task.state === 'movingToWreck') {
    const tankCenterX = tank.x + TILE_SIZE / 2
    const tankCenterY = tank.y + TILE_SIZE / 2
    const wreckCenterX = wreck.x + TILE_SIZE / 2
    const wreckCenterY = wreck.y + TILE_SIZE / 2
    const dist = distanceBetweenPoints(tankCenterX, tankCenterY, wreckCenterX, wreckCenterY)

    if (dist <= TOW_DISTANCE_THRESHOLD) {
      tank.path = []
      tank.moveTarget = null
      task.state = 'recycling'
      task.elapsed = 0
      wreck.isBeingRecycled = true
      wreck.recycleStartedAt = performance.now()
      tank.recoveryProgress = 0
    }
  } else if (task.state === 'recycling') {
    task.elapsed = (task.elapsed || 0) + delta
    const progress = Math.min(task.elapsed / (task.recycleDuration || 1), 1)
    tank.recoveryProgress = progress
    if (progress >= 1) {
      const removed = removeWreckById(gameState, wreck.id)
      const valueSource = removed?.cost || getUnitCost(wreck.unitType)
      const refund = Math.floor((valueSource || 0) * 0.33)
      gameState.money += refund
      if (typeof gameState.totalMoneyEarned === 'number') {
        gameState.totalMoneyEarned += refund
      }
      releaseWreckAssignment(wreck)
      tank.recoveryTask = null
      tank.recoveryProgress = 0
      playSound('deposit', 0.7)
    }
  }
}

export const updateRecoveryTankLogic = logPerformance(function(units, gameState, delta) {
  const tanks = units.filter(u => u.type === 'recoveryTank')
  if (tanks.length === 0) return

  tanks.forEach(tank => {
    if (tank.recoveryTask) {
      const wreck = getWreckById(gameState, tank.recoveryTask.wreckId)
      if (!wreck) {
        tank.recoveryTask = null
        tank.towedWreck = null
        tank.recoveryProgress = 0
      } else if (tank.recoveryTask.mode === 'tow') {
        handleTowTask(tank, tank.recoveryTask, wreck, units, gameState)
      } else if (tank.recoveryTask.mode === 'recycle') {
        handleRecycleTask(tank, tank.recoveryTask, wreck, gameState, delta)
      }
    }

    // Update towed unit position or wreck if applicable
    if (tank.towedUnit) {
      const t = tank.towedUnit
      t.x = tank.x
      t.y = tank.y - TILE_SIZE / 2
      t.tileX = Math.floor(t.x / TILE_SIZE)
      t.tileY = Math.floor(t.y / TILE_SIZE)

      // Update speed when towing
      const unitProps = tank.loadedSpeed || 0.33
      tank.speed = unitProps
    } else if (tank.towedWreck) {
      updateWreckPositionFromTank(tank.towedWreck, tank)
      tank.speed = tank.loadedSpeed || 0.33
    } else {
      // Update speed when not towing
      const unitProps = tank.currentSpeed || 0.525
      tank.speed = unitProps
    }

    if (tank.recoveryTask) {
      tank.repairTarget = null
      tank.repairData = null
      tank.repairStarted = false
      return
    }

    const hasLoader = !(tank.crew && typeof tank.crew === 'object' && !tank.crew.loader)
    if (!hasLoader) {
      tank.repairTarget = null
      tank.repairData = null
      tank.repairStarted = false
      return
    }

    // Auto-repair logic - find nearby damaged units
    if (!tank.repairTarget) {
      const target = units.find(u =>
        u.owner === tank.owner &&
        u !== tank &&
        u.health < u.maxHealth &&
        Math.abs(u.tileX - tank.tileX) <= 1 &&
        Math.abs(u.tileY - tank.tileY) <= 1 &&
        !(u.movement && u.movement.isMoving)
      )
      if (target) {
        tank.repairTarget = target
        tank.repairStarted = true
        // Calculate repair parameters once
        const cost = getUnitCost(target.type) || 1000
        const buildDuration = Math.max(1000, 3000 * (cost / 500)) // Minimum 1 second
        tank.repairData = {
          totalCost: cost * 0.25,
          healthPerMs: (target.maxHealth - target.health) / buildDuration,
          costPerMs: (cost * 0.25) / buildDuration,
          soundCooldown: 0,
          repairFinishedSoundPlayed: false,
          repairStartSoundPlayed: false
        }
        // console.log(`Recovery tank starting repair of ${target.type}: health=${target.health}/${target.maxHealth}, cost=${cost}, duration=${buildDuration}ms`)
      }
    }

    // Process repair if we have a target
    if (tank.repairTarget) {
      const target = tank.repairTarget

      // Check if target is still valid
      if (target.health <= 0 ||
          Math.abs(target.tileX - tank.tileX) > 1 ||
          Math.abs(target.tileY - tank.tileY) > 1 ||
          (target.movement && target.movement.isMoving)) {
        // console.log(`Recovery tank repair cancelled: target invalid`)
        tank.repairTarget = null
        tank.repairData = null
        tank.repairStarted = false
        return
      }

      // Initialize repair data if missing
      if (!tank.repairData) {
        const cost = getUnitCost(target.type) || 1000
        // Much faster repair: 200-800ms duration for visible progress
        const buildDuration = Math.max(200, 800 * (cost / 500))
        tank.repairData = {
          totalCost: cost * 0.25,
          // Increase health per ms for much faster repair - 10x faster
          healthPerMs: ((target.maxHealth - target.health) / buildDuration) * 10,
          costPerMs: (cost * 0.25) / buildDuration,
          soundCooldown: 0,
          repairFinishedSoundPlayed: false,
          repairStartSoundPlayed: false
        }
      }

      const repairData = tank.repairData

      // Only proceed if we have valid repair rates
      if (repairData.healthPerMs > 0) {
        let heal = repairData.healthPerMs * delta
        const spend = repairData.costPerMs * delta

        // Ensure minimum 1HP per tick for visible progress
        if (heal < 0.125) {
          heal = 0.125
        }

        if (gameState.money >= spend) {
          gameState.money -= spend
          target.health = Math.min(target.health + heal, target.maxHealth)

          // console.log(`Repairing ${target.type}: ${oldHealth.toFixed(1)} -> ${target.health.toFixed(1)} (+${heal.toFixed(1)} HP) cost: ${spend.toFixed(2)}`)

          // Handle repair sounds with cooldown to prevent looping
          if (!repairData.repairStartSoundPlayed) {
            playSound('repairStarted', 0.7, 1, true)
            repairData.repairStartSoundPlayed = true
            repairData.soundCooldown = 2000 // 2 second cooldown
          }

          if (repairData.soundCooldown <= 0) {
            if (target.health >= target.maxHealth) {
              if (!repairData.repairFinishedSoundPlayed) {
                playSound('repairFinished', 0.7, 1, true)
                repairData.repairFinishedSoundPlayed = true
                // console.log(`Recovery tank completed repair of ${target.type}`)
              }
              tank.repairTarget = null
              tank.repairData = null
              tank.repairStarted = false
            } else {
              // Play repair sound every 10 seconds during repair
              playSound('repairStarted', 1, 1, true)
              repairData.soundCooldown = 10000 // 10 second cooldown
            }
          } else {
            repairData.soundCooldown -= delta
          }
        } else {
          // console.log(`Recovery tank repair paused: insufficient funds (need ${spend.toFixed(2)}, have ${gameState.money.toFixed(2)})`)
        }
      }
    }
  })
})

