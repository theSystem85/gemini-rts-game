// recoveryTankSystem.js - handle recovery tank repair and towing
import { TILE_SIZE } from '../config.js'
import { getUnitCost } from '../utils.js'
import { smoothRotateTowardsAngle, angleDiff } from '../logic.js'
import { playSound } from '../sound.js'
import { logPerformance } from '../performanceUtils.js'

const BASE_BUILD_DURATION = 3000

export const updateRecoveryTankLogic = logPerformance(function(units, gameState, delta) {
  const tanks = units.filter(u => u.type === 'recovery_tank' && u.health > 0)
  if (tanks.length === 0) return

  tanks.forEach(tank => {
    // adjust speed depending on towing
    tank.speed = tank.towingTarget ? 0.33 : 0.525

    // maintain towed unit position
    if (tank.towingTarget && tank.towingTarget.health > 0) {
      const target = tank.towingTarget
      target.towedBy = tank
      target.x = tank.x - TILE_SIZE / 2
      target.y = tank.y - TILE_SIZE / 2
      target.tileX = Math.floor((target.x + TILE_SIZE / 2) / TILE_SIZE)
      target.tileY = Math.floor((target.y + TILE_SIZE / 2) / TILE_SIZE)
      target.path = []
      target.moveTarget = null
    }

    // find repair target if none
    if (!tank.repairTarget) {
      const candidate = units.find(u =>
        u.owner === tank.owner &&
        u.health > 0 &&
        u.health < u.maxHealth &&
        Math.abs(u.tileX - tank.tileX) <= 1 &&
        Math.abs(u.tileY - tank.tileY) <= 1 &&
        u !== tank.towingTarget
      )
      if (candidate) {
        tank.repairTarget = candidate
        tank.repairSoundPlayed = false
      }
    }

    if (tank.repairTarget) {
      const target = tank.repairTarget
      if (
        target.health <= 0 ||
        Math.abs(target.tileX - tank.tileX) > 1 ||
        Math.abs(target.tileY - tank.tileY) > 1
      ) {
        tank.repairTarget = null
        tank.repairSoundPlayed = false
      } else {
        if (!tank.repairSoundPlayed) {
          playSound('repairStarted', 0.7)
          tank.repairSoundPlayed = true
        }

        const desired = Math.atan2(target.y - tank.y, target.x - tank.x)
        tank.turretDirection = smoothRotateTowardsAngle(
          tank.turretDirection,
          desired,
          tank.turretRotationSpeed
        )
        const aimed = Math.abs(angleDiff(tank.turretDirection, desired)) < 0.1
        if (aimed) {
          const cost = getUnitCost(target.type)
          const buildTime = BASE_BUILD_DURATION * (cost / 500)
          const healthIncrease = (target.maxHealth * delta) / buildTime
          const moneyCost = (cost * 0.25) * (healthIncrease / target.maxHealth)
          if (gameState.money >= moneyCost) {
            gameState.money -= moneyCost
            target.health = Math.min(
              target.health + healthIncrease,
              target.maxHealth
            )
            if (target.health >= target.maxHealth - 0.01) {
              target.health = target.maxHealth
              playSound('repairFinished', 1.0)
              tank.repairTarget = null
              tank.repairSoundPlayed = false
            }
          }
        }
      }
    }
  })
})
