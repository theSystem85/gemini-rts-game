import { TILE_SIZE } from '../config.js'
import { playSound } from '../sound.js'
import { getUnitCost } from '../utils.js'
import { logPerformance } from '../performanceUtils.js'

export const updateRecoveryTankLogic = logPerformance(function(units, gameState, delta) {
  const tanks = units.filter(u => u.type === 'recoveryTank')
  if (tanks.length === 0) return

  tanks.forEach(tank => {
    // Update towed unit position
    if (tank.towedUnit) {
      const t = tank.towedUnit
      t.x = tank.x
      t.y = tank.y - TILE_SIZE / 2
      t.tileX = Math.floor(t.x / TILE_SIZE)
      t.tileY = Math.floor(t.y / TILE_SIZE)
      
      // Update speed when towing
      const unitProps = tank.loadedSpeed || 0.33
      tank.speed = unitProps
    } else {
      // Update speed when not towing
      const unitProps = tank.currentSpeed || 0.525
      tank.speed = unitProps
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
        u.owner === tank.owner && u !== tank &&
        u.health < u.maxHealth &&
        Math.abs(u.tileX - tank.tileX) <= 1 &&
        Math.abs(u.tileY - tank.tileY) <= 1
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
      if (target.health <= 0 || Math.abs(target.tileX - tank.tileX) > 1 || Math.abs(target.tileY - tank.tileY) > 1) {
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
          const oldHealth = target.health
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

