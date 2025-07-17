import { TILE_SIZE, TANK_FIRE_RANGE, ATTACK_PATH_CALC_INTERVAL, AI_DECISION_INTERVAL } from '../config.js'
import { getCachedPath } from '../game/pathfinding.js'
import { applyEnemyStrategies, shouldConductGroupAttack, shouldRetreatLowHealth } from './enemyStrategies.js'
import { isEnemyTo } from './enemyUtils.js'

const ENABLE_DODGING = false
const lastPositionCheckTimeDelay = 3000
const dodgeTimeDelay = 3000
const useSafeAttackDistance = false

function updateAIUnit(unit, units, gameState, mapGrid, now, aiPlayerId, _targetedOreTiles, bullets) {
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
    const allowDecision = !unit.lastDecisionTime || (now - unit.lastDecisionTime >= AI_DECISION_INTERVAL)

    // Target selection throttled - 5 second minimum between target changes
    // EXCEPT when unit gets attacked (immediate retaliation allowed)
    const justGotAttacked = unit.isBeingAttacked && unit.lastDamageTime && (now - unit.lastDamageTime < 1000)
    const canChangeTarget = justGotAttacked || !unit.lastTargetChangeTime || (now - unit.lastTargetChangeTime >= 5000)

    if (allowDecision) {
      if (canChangeTarget) {
        let newTarget = null

        // Check if current target is still valid and reasonably close before considering a new one
        let keepCurrentTarget = false
        if (unit.target && unit.target.health > 0) {
          let targetDistance = Infinity
          if (unit.target.tileX !== undefined) {
            // Target is a unit
            targetDistance = Math.hypot(
              (unit.target.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2),
              (unit.target.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2)
            )
          } else {
            // Target is a building
            const buildingCenterX = (unit.target.x + (unit.target.width || 1) / 2) * TILE_SIZE
            const buildingCenterY = (unit.target.y + (unit.target.height || 1) / 2) * TILE_SIZE
            targetDistance = Math.hypot(
              buildingCenterX - (unit.x + TILE_SIZE / 2),
              buildingCenterY - (unit.y + TILE_SIZE / 2)
            )
          }

          // Keep current target if it's within reasonable range (unless being attacked by someone else)
          const justGotAttacked = unit.isBeingAttacked && unit.lastDamageTime && (now - unit.lastDamageTime < 1000)
          if (targetDistance < 25 * TILE_SIZE && !justGotAttacked) {
            keepCurrentTarget = true
            newTarget = unit.target // Keep the current target
          }
        }

        if (!keepCurrentTarget) {
          // Only search for new targets if we don't have a valid current target

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

          // Third priority: Target player harvesters (key economic targets)
          if (!newTarget) {
            const playerHarvesters = units.filter(u =>
              u.owner === gameState.humanPlayer &&
            u.type === 'harvester' &&
            u.health > 0
            )

            if (playerHarvesters.length > 0) {
            // Find closest player harvester
              let closestHarvester = null
              let closestDist = Infinity

              playerHarvesters.forEach(harvester => {
                const distance = Math.hypot(
                  (harvester.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2),
                  (harvester.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2)
                )
                if (distance < closestDist) {
                  closestDist = distance
                  closestHarvester = harvester
                }
              })

              // Target harvester if within reasonable range
              if (closestHarvester && closestDist < 20 * TILE_SIZE) {
                newTarget = closestHarvester
              }
            }
          }

          // Fourth priority: Group attack strategy (target player base and units)
          if (!newTarget) {
          // Check if we should conduct group attack before selecting targets
            const nearbyAllies = units.filter(u => u.owner === aiPlayerId && u !== unit &&
            (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank') &&
            Math.hypot(u.x - unit.x, u.y - unit.y) < 8 * TILE_SIZE)

            // Use group attack strategy with priority targeting
            if (nearbyAllies.length >= 1) { // Reduced from 2 to make AI more aggressive
            // Priority 1: Target closest player combat unit
              let closestPlayerUnit = null
              let closestPlayerDist = Infinity

              units.forEach(u => {
                if (u.owner === gameState.humanPlayer && u.health > 0) {
                  const d = Math.hypot((u.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2), (u.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2))
                  if (d < closestPlayerDist) {
                    closestPlayerDist = d
                    closestPlayerUnit = u
                  }
                }
              })

              // Priority 2: If no player units nearby, target player buildings (base attack)
              if (!closestPlayerUnit || closestPlayerDist > 15 * TILE_SIZE) {
                const playerBuildings = gameState.buildings.filter(b => b.owner === gameState.humanPlayer && b.health > 0)
                if (playerBuildings.length > 0) {
                // Prioritize important buildings: construction yard > vehicle factory > ore refinery > others
                  const priorityOrder = ['constructionYard', 'vehicleFactory', 'oreRefinery', 'powerPlant', 'radarStation']
                  let targetBuilding = null

                  for (const buildingType of priorityOrder) {
                    const building = playerBuildings.find(b => b.type === buildingType)
                    if (building) {
                      targetBuilding = building
                      break
                    }
                  }

                  // If no priority buildings, target any building
                  if (!targetBuilding) {
                    targetBuilding = playerBuildings[0]
                  }

                  if (targetBuilding) {
                    newTarget = targetBuilding
                  }
                }
              } else {
                newTarget = closestPlayerUnit
              }

              // Only attack if group is large enough for heavily defended targets
              if (newTarget && shouldConductGroupAttack(unit, units, gameState, newTarget)) {
              // Keep the target
              } else if (nearbyAllies.length >= 2) {
              // With 3+ units, attack anyway
              // Keep the target
              } else {
              // Single unit or pair - only attack if very close or harvester
                if (newTarget && (newTarget.type === 'harvester' ||
                  Math.hypot((newTarget.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2),
                    (newTarget.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2)) < 8 * TILE_SIZE)) {
                // Keep the target
                } else {
                  newTarget = null
                }
              }
            } else {
            // Solo unit behavior - be more cautious, focus on harvesters and weak targets
              const soloTargets = units.filter(u =>
                u.owner === gameState.humanPlayer &&
              u.health > 0 &&
              (u.type === 'harvester' || u.health <= 50) // Target harvesters or damaged units
              )

              if (soloTargets.length > 0) {
                let closestTarget = null
                let closestDist = Infinity
                soloTargets.forEach(target => {
                  const d = Math.hypot((target.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2), (target.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2))
                  if (d < closestDist) {
                    closestDist = d
                    closestTarget = target
                  }
                })
                // Only engage if very close
                newTarget = (closestTarget && closestDist < 6 * TILE_SIZE) ? closestTarget : null
              }
            }
          }
        } // End of if (!keepCurrentTarget) block

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
            const path = getCachedPath(
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
      } else {
        // If we can't change targets but don't have a target, keep existing logic for path recalculation
        // This ensures units don't get stuck when they can't change targets but need to continue moving
        if (!unit.target) {
          // Only set a new target if we don't have one at all
          const existingTargets = units.filter(u =>
            u.owner === gameState.humanPlayer &&
            u.health > 0 &&
            Math.hypot((u.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2), (u.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2)) < 10 * TILE_SIZE
          )
          if (existingTargets.length > 0) {
            unit.target = existingTargets[0]
            unit.lastTargetChangeTime = now
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
        const path = getCachedPath(
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

      unit.lastDecisionTime = now
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
                const newPath = getCachedPath(
                  { x: unit.tileX, y: unit.tileY },
                  { x: destTileX, y: destTileY },
                  mapGrid,
                  gameState.occupancyMap
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
              const newPath = getCachedPath(
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
