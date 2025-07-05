import { TILE_SIZE, TANK_FIRE_RANGE, ATTACK_PATH_CALC_INTERVAL } from '../config.js'
import { findPath } from '../units.js'
import { applyEnemyStrategies, shouldConductGroupAttack, shouldRetreatLowHealth } from './enemyStrategies.js'
import { getClosestEnemyFactory, isEnemyTo } from './enemyUtils.js'

const ENABLE_DODGING = false
const lastPositionCheckTimeDelay = 3000
const dodgeTimeDelay = 3000
const useSafeAttackDistance = false

function updateAIUnit(unit, units, gameState, mapGrid, now, aiPlayerId, targetedOreTiles) {
  // Reset being attacked flag if enough time has passed since last damage
  if (unit.isBeingAttacked && unit.lastDamageTime && (now - unit.lastDamageTime > 5000)) {
    unit.isBeingAttacked = false
    unit.lastAttacker = null
  }

  // Clear invalid attacker references
  if (unit.lastAttacker && (unit.lastAttacker.health <= 0 || unit.lastAttacker.destroyed)) {
    unit.lastAttacker = null
    if (!unit.lastDamageTime || (now - unit.lastDamageTime > 3000)) {
      unit.isBeingAttacked = false
    }
  }

  // Apply new AI strategies first
    applyEnemyStrategies(unit, units, gameState, mapGrid, now)
    
    // Skip further processing if unit is retreating
    if (unit.isRetreating) return

    // Combat unit behavior
    if (unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'rocketTank' || unit.type === 'tank-v2' || unit.type === 'tank-v3') {
      // Target selection throttled to every 2 seconds
      const canChangeTarget = !unit.lastTargetChangeTime || (now - unit.lastTargetChangeTime >= 2000)
      if (canChangeTarget) {
        let newTarget = null

        // Check if unit should retreat due to low health (flee to base mode)
        const shouldFlee = shouldRetreatLowHealth(unit)
        
        // Highest priority: Retaliate against attacker when being attacked (unless fleeing)
        if (!shouldFlee && unit.isBeingAttacked && unit.lastAttacker && 
            unit.lastAttacker.health > 0 && isEnemyTo(unit.lastAttacker, aiPlayerId)) {
          
          let validTarget = false
          let attackerDist = Infinity
          
          // Handle unit attackers
          if (unit.lastAttacker.tileX !== undefined) {
            attackerDist = Math.hypot(
              (unit.lastAttacker.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2), 
              (unit.lastAttacker.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2)
            )
            if (attackerDist < 15 * TILE_SIZE) { // Within reasonable retaliation range
              validTarget = true
            }
          }
          // Handle building attackers (like Tesla coils, turrets)
          else if (unit.lastAttacker.x !== undefined && unit.lastAttacker.y !== undefined) {
            const buildingCenterX = (unit.lastAttacker.x + (unit.lastAttacker.width || 1) / 2) * TILE_SIZE
            const buildingCenterY = (unit.lastAttacker.y + (unit.lastAttacker.height || 1) / 2) * TILE_SIZE
            attackerDist = Math.hypot(
              buildingCenterX - (unit.x + TILE_SIZE / 2), 
              buildingCenterY - (unit.y + TILE_SIZE / 2)
            )
            if (attackerDist < 20 * TILE_SIZE) { // Longer range for buildings
              validTarget = true
            }
          }
          
          if (validTarget) {
            newTarget = unit.lastAttacker
          }
        }

        // Second priority: Defend harvesters under attack (if not retaliating)
        if (!newTarget) {
          const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')
          let harvesterUnderAttack = null
          for (const harvester of aiHarvesters) {
            const threateningEnemies = units.filter(u =>
              isEnemyTo(u, aiPlayerId) &&
              Math.hypot(u.x - harvester.x, u.y - harvester.y) < 5 * TILE_SIZE
            )
            if (threateningEnemies.length > 0) {
              harvesterUnderAttack = threateningEnemies[0] // Target closest threat to harvester
              break
            }
          }

          if (harvesterUnderAttack) {
            newTarget = harvesterUnderAttack
          }
        }

        // Third priority: Group attack strategy (if not retaliating or defending harvesters)
        if (!newTarget) {
          // Check if we should conduct group attack before selecting targets
          const nearbyAllies = units.filter(u => u.owner === aiPlayerId && u !== unit &&
            (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank') &&
            Math.hypot(u.x - unit.x, u.y - unit.y) < 8 * TILE_SIZE)

          // Use group attack strategy
          if (nearbyAllies.length >= 2) {
            // Find appropriate target for group attack - target closest enemy
            let closestEnemy = null
            let closestDist = Infinity
            units.forEach(u => {
              if (isEnemyTo(u, aiPlayerId)) {
                const d = Math.hypot((u.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2), (u.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2))
                if (d < closestDist) {
                  closestDist = d
                  closestEnemy = u
                }
              }
            })
            
            // Only attack if group is large enough for the target's defenses
            const potentialTarget = (closestEnemy && closestDist < 12 * TILE_SIZE) ? closestEnemy : getClosestEnemyFactory(unit, gameState.factories || [], aiPlayerId)
            if (shouldConductGroupAttack(unit, units, gameState, potentialTarget)) {
              newTarget = potentialTarget
            }
          } else {
            // Not enough allies nearby, avoid attacking alone unless absolutely necessary
            let closestPlayer = null
            let closestDist = Infinity
            units.forEach(u => {
              if (u.owner === gameState.humanPlayer) {
                const d = Math.hypot((u.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2), (u.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2))
                if (d < closestDist) {
                  closestDist = d
                  closestPlayer = u
                }
              }
            })
            // Only engage if very close or no other choice
            newTarget = (closestPlayer && closestDist < 6 * TILE_SIZE) ? closestPlayer : null
          }
        }

        if (unit.target !== newTarget) {
          unit.target = newTarget
          unit.lastTargetChangeTime = now
          let targetPos = null
          if (unit.target && unit.target.tileX !== undefined) {
            targetPos = { x: unit.target.tileX, y: unit.target.tileY }
          } else if (unit.target) {
            targetPos = { x: unit.target.x, y: unit.target.y }
          }
          unit.moveTarget = targetPos
          if (!unit.isDodging && targetPos) {
            // Use occupancy map in attack mode to prevent moving through occupied tiles
            const occupancyMap = gameState.occupancyMap
            const path = findPath(
              { x: unit.tileX, y: unit.tileY },
              targetPos,
              mapGrid,
              occupancyMap
            )
            if (path.length > 1) {
              unit.path = path.slice(1)
              unit.lastPathCalcTime = now
            }
          }
        }
      }

      // Path recalculation throttled to every 3 seconds for attack/chase movement
      const pathRecalcNeeded = !unit.lastPathCalcTime || (now - unit.lastPathCalcTime > ATTACK_PATH_CALC_INTERVAL)
      if (pathRecalcNeeded && !unit.isDodging && unit.target && (!unit.path || unit.path.length < 3)) {
        let targetPos = null
        if (unit.target.tileX !== undefined) {
          targetPos = { x: unit.target.tileX, y: unit.target.tileY }
        } else {
          targetPos = { x: unit.target.x, y: unit.target.y }
        }
        // Use occupancy map in attack mode to prevent moving through occupied tiles
        const occupancyMap = gameState.occupancyMap
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          targetPos,
          mapGrid,
          occupancyMap
        )
        if (path.length > 1) {
          unit.path = path.slice(1)
          unit.lastPathCalcTime = now
        }
      }

      // --- Dodge Logic: toggled by ENABLE_DODGING ---
      if (ENABLE_DODGING) {
        let underFire = false
        bullets.forEach(bullet => {
          if (bullet.shooter && isEnemyTo(bullet.shooter, aiPlayerId)) {
            const d = Math.hypot(bullet.x - (unit.x + TILE_SIZE / 2), bullet.y - (unit.y + TILE_SIZE / 2))
            if (d < 2 * TILE_SIZE) {
              underFire = true
            }
          }
        })

        if (underFire) {
          if (!unit.lastDodgeTime || now - unit.lastDodgeTime > dodgeTimeDelay) {
            unit.lastDodgeTime = now
            const dodgeDir = { x: 0, y: 0 }
            bullets.forEach(bullet => {
              if (bullet.shooter && isEnemyTo(bullet.shooter, aiPlayerId)) {
                const dx = (unit.x + TILE_SIZE / 2) - bullet.x
                const dy = (unit.y + TILE_SIZE / 2) - bullet.y
                const mag = Math.hypot(dx, dy)
                if (mag > 0) {
                  dodgeDir.x += dx / mag
                  dodgeDir.y += dy / mag
                }
              }
            })
            const mag = Math.hypot(dodgeDir.x, dodgeDir.y)
            if (mag > 0) {
              dodgeDir.x /= mag
              dodgeDir.y /= mag
              const dodgeDistance = 1 + Math.floor(Math.random() * 2)
              const destTileX = Math.floor(unit.tileX + Math.round(dodgeDir.x * dodgeDistance))
              const destTileY = Math.floor(unit.tileY + Math.round(dodgeDir.y * dodgeDistance))
              if (destTileX >= 0 && destTileX < mapGrid[0].length &&
                  destTileY >= 0 && destTileY < mapGrid.length) {
                const tileType = mapGrid[destTileY][destTileX].type
                const hasBuilding = mapGrid[destTileY][destTileX].building
                if (tileType !== 'water' && tileType !== 'rock' && !hasBuilding) {
                  if (!unit.originalPath) {
                    unit.originalPath = unit.path ? [...unit.path] : []
                    unit.originalTarget = unit.target
                    unit.dodgeEndTime = now + dodgeTimeDelay
                  }
                  const newPath = findPath(
                    { x: unit.tileX, y: unit.tileY },
                    { x: destTileX, y: destTileY },
                    mapGrid,
                    occupancyMap
                  )
                  if (newPath.length > 1) {
                    unit.isDodging = true
                    unit.path = newPath.slice(1)
                    unit.lastPathCalcTime = now
                  }
                }
              }
            }
          }
        }
      }

      // Resume original path after dodging
      if (unit.isDodging && unit.originalPath) {
        if (unit.path.length === 0 || now > unit.dodgeEndTime) {
          unit.path = unit.originalPath
          unit.target = unit.originalTarget
          unit.originalPath = null
          unit.originalTarget = null
          unit.isDodging = false
          unit.dodgeEndTime = null
          unit.lastPathCalcTime = now
        }
      }
    }
    // NOTE: Harvester behavior is now handled by the unified harvesterLogic.js module
    // AI harvesters use the same logic as player harvesters for consistent behavior
  
  // Maintain safe attack distance for combat units
  if (useSafeAttackDistance) {
    if ((unit.type === 'tank' || unit.type === 'rocketTank') && unit.target) {
      const positionCheckNeeded = !unit.lastPositionCheckTime || (now - unit.lastPositionCheckTime > lastPositionCheckTimeDelay)
      if (positionCheckNeeded) {
        unit.lastPositionCheckTime = now
        const unitCenterX = unit.x + TILE_SIZE / 2
        const unitCenterY = unit.y + TILE_SIZE / 2
        let targetCenterX, targetCenterY
        if (unit.target.tileX !== undefined) {
            targetCenterX = unit.target.x + TILE_SIZE / 2
            targetCenterY = unit.target.y + TILE_SIZE / 2
          } else {
            targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
            targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
          }
          const dx = targetCenterX - unitCenterX
          const dy = targetCenterY - unitCenterY
          const currentDist = Math.hypot(dx, dy)
          const explosionSafetyBuffer = TILE_SIZE * 0.5
          const safeAttackDistance = Math.max(
            TANK_FIRE_RANGE * TILE_SIZE,
            TILE_SIZE * 2 + explosionSafetyBuffer
          )
          if (currentDist < safeAttackDistance && !unit.isDodging) {
            const destTileX = Math.floor(unit.tileX - Math.round((dx / currentDist) * 2))
            const destTileY = Math.floor(unit.tileY - Math.round((dy / currentDist) * 2))
            if (destTileX >= 0 && destTileX < mapGrid[0].length &&
                destTileY >= 0 && destTileY < mapGrid.length) {
              const tileType = mapGrid[destTileY][destTileX].type
              const hasBuilding = mapGrid[destTileY][destTileX].building
              if (tileType !== 'water' && tileType !== 'rock' && !hasBuilding) {
                // Use occupancy map for tactical retreat movement to avoid moving through units
                const occupancyMap = gameState.occupancyMap
                const newPath = findPath(
                  { x: unit.tileX, y: unit.tileY },
                  { x: destTileX, y: destTileY },
                  mapGrid,
                  occupancyMap
                )
                if (newPath.length > 1) {
                  unit.path = newPath.slice(1)
                  unit.lastPathCalcTime = now
                }
              }
            }
          }
        }
      }
    }
  }
export { updateAIUnit }
