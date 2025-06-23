// enemy.js
import { TILE_SIZE, TANK_FIRE_RANGE } from './config.js'
import { findPath, buildOccupancyMap } from './units.js'
import { getUniqueId } from './utils.js'
import { findClosestOre } from './logic.js'
import { buildingData, createBuilding, canPlaceBuilding, placeBuilding, isNearExistingBuilding, isTileValid, updatePowerSupply } from './buildings.js'
import { assignHarvesterToOptimalRefinery } from './game/harvesterLogic.js'
import { initializeUnitMovement } from './game/unifiedMovement.js'
import { applyEnemyStrategies, shouldConductGroupAttack, resetAttackDirections, shouldRetreatLowHealth } from './ai/enemyStrategies.js'
import { gameState } from './gameState.js'

const ENABLE_DODGING = false // Constant to toggle dodging behavior, disabled by default
const lastPositionCheckTimeDelay = 3000
const dodgeTimeDelay = 3000
const useSafeAttackDistance = false

// Helper function to check if two players are enemies (in FFA mode, everyone is enemies)
function areEnemies(player1, player2) {
  return player1 !== player2
}

// Helper function to get all enemy players for a given player
function getEnemyPlayers(playerId) {
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  return allPlayers.filter(p => p !== playerId)
}

// Helper function to check if a unit/building belongs to an enemy player
function isEnemyTo(unit, currentPlayer) {
  return areEnemies(unit.owner, currentPlayer)
}

// Helper function to get closest enemy factory
function getClosestEnemyFactory(unit, factories, aiPlayerId) {
  if (!factories || !Array.isArray(factories)) {
    console.warn('getClosestEnemyFactory: factories is undefined or not an array')
    return null
  }
  
  let closestFactory = null
  let closestDist = Infinity
  
  factories.forEach(factory => {
    if (areEnemies(factory.id, aiPlayerId)) {
      const factoryCenterX = (factory.x + factory.width / 2) * TILE_SIZE
      const factoryCenterY = (factory.y + factory.height / 2) * TILE_SIZE
      const dist = Math.hypot(
        factoryCenterX - (unit.x + TILE_SIZE / 2),
        factoryCenterY - (unit.y + TILE_SIZE / 2)
      )
      if (dist < closestDist) {
        closestDist = dist
        closestFactory = factory
      }
    }
  })
  
  return closestFactory
}

/*
  updateEnemyAI:
  - Handles enemy production and target selection for all AI players
  - Dodging behavior is now toggled by ENABLE_DODGING constant
  - Units recalculate paths no more often than every 2 seconds
  - Now includes building construction logic for turrets and power plants
  - Supports multiple AI players in FFA mode
*/
export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)
  const now = performance.now()
  const humanPlayer = gameState.humanPlayer || 'player1'
  
  // Get all AI players (non-human players)
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  const aiPlayers = allPlayers.filter(p => p !== humanPlayer)

  // Get targeted ore tiles from gameState
  const targetedOreTiles = gameState.targetedOreTiles || {}

  // Run AI logic for each AI player
  aiPlayers.forEach(aiPlayerId => {
    updateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles)
  })
}

function updateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles) {
  const aiFactory = factories.find(f => f.id === aiPlayerId)
  
  // Check if AI player's construction yard still exists
  if (!aiFactory || aiFactory.destroyed || aiFactory.health <= 0) {
    // Construction yard is destroyed, AI can't build anything
    return
  }

  // Define the keys we'll use for this AI player's state
  const lastBuildingTimeKey = `${aiPlayerId}LastBuildingTime`
  const lastProductionKey = `${aiPlayerId}LastProductionTime`

  // --- AI Building Construction ---
  // Enforce strict build order: Power Plant -> Vehicle Factory -> Ore Refinery
  if (now - (gameState[lastBuildingTimeKey] || 0) >= 10000 && aiFactory && aiFactory.budget > 1000 && gameState.buildings) {
    const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
    const powerPlants = aiBuildings.filter(b => b.type === 'powerPlant')
    const vehicleFactories = aiBuildings.filter(b => b.type === 'vehicleFactory')
    const oreRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
    const turrets = aiBuildings.filter(b => b.type.startsWith('turretGun') || b.type === 'rocketTurret')
    const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')

    let buildingType = null
    let cost = 0

    // 1. Build Power Plant first
    if (powerPlants.length === 0) {
      buildingType = 'powerPlant'
      cost = buildingData.powerPlant.cost
    // 2. Then Vehicle Factory
    } else if (vehicleFactories.length === 0) {
      buildingType = 'vehicleFactory'
      cost = buildingData.vehicleFactory.cost
    // 3. Then Ore Refinery
    } else if (oreRefineries.length === 0) {
      buildingType = 'oreRefinery'
      cost = buildingData.oreRefinery.cost
    // 4. Only then build turrets or other buildings
    } else if (turrets.length < 2) {
      if (aiFactory.budget >= 4000) {
        buildingType = 'rocketTurret'
        cost = 4000
      } else if (aiFactory.budget >= 3000) {
        buildingType = 'turretGunV3'
        cost = 3000
      } else if (aiFactory.budget >= 2000) {
        buildingType = 'turretGunV2'
        cost = 2000
      } else {
        buildingType = 'turretGunV1'
        cost = 1000
      }
    } else {
      // Calculate current refinery to harvester ratio
      const aiRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
      const maxHarvestersForRefineries = aiRefineries.length * 4 // 1:4 ratio
      
      // Build more refineries if we have too many harvesters per refinery
      if (aiHarvesters.length >= maxHarvestersForRefineries && aiFactory.budget >= buildingData.oreRefinery.cost) {
        buildingType = 'oreRefinery'
        cost = buildingData.oreRefinery.cost
      } else if (turrets.length < 3) {
        // Build more turrets for defense
        if (aiFactory.budget >= 4000) {
          buildingType = 'rocketTurret'
          cost = 4000
        } else if (aiFactory.budget >= 3000) {
          buildingType = 'turretGunV3'
          cost = 3000
        } else if (aiFactory.budget >= 2000) {
          buildingType = 'turretGunV2'
          cost = 2000
        } else {
          buildingType = 'turretGunV1'
          cost = 1000
        }
      }
    }

    // Attempt to start building construction (don't place immediately)
    if (buildingType && aiFactory.budget >= cost) {
      const position = findBuildingPosition(buildingType, mapGrid, units, gameState.buildings, factories, aiPlayerId)
      if (position) {
        // Start construction process instead of placing immediately
        aiFactory.budget -= cost
        aiFactory.currentlyBuilding = buildingType
        aiFactory.buildStartTime = now
        aiFactory.buildDuration = 5000
        aiFactory.buildingPosition = position // Store position for completion
        gameState[lastBuildingTimeKey] = now
      } else {
        gameState[lastBuildingTimeKey] = now
      }
    }
  }

  // Complete building construction when timer finishes
  if (aiFactory && aiFactory.currentlyBuilding && now - aiFactory.buildStartTime > aiFactory.buildDuration) {
    const buildingType = aiFactory.currentlyBuilding
    const position = aiFactory.buildingPosition
    
    if (position) {
      // Double-check position is still valid before placing
      if (canPlaceBuilding(buildingType, position.x, position.y, mapGrid, units, gameState.buildings, factories, aiPlayerId)) {
        const newBuilding = createBuilding(buildingType, position.x, position.y)
        newBuilding.owner = aiPlayerId
        gameState.buildings.push(newBuilding)
        placeBuilding(newBuilding, mapGrid)
      } else {
        // Position became invalid, refund the cost
        aiFactory.budget += buildingData[buildingType]?.cost || 0
      }
    }
    
    // Clear construction state
    aiFactory.currentlyBuilding = null
    aiFactory.buildingPosition = null
  }

  // --- AI Unit Production ---
  // Only allow unit production after all required buildings are present
  if (gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'powerPlant').length > 0 &&
      gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'vehicleFactory').length > 0 &&
      gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'oreRefinery').length > 0) {
    if (now - (gameState[lastProductionKey] || 0) >= 10000 && aiFactory) {
      const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')
      const aiCombatUnits = units.filter(u => u.owner === aiPlayerId && 
        (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank'))
      const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
      const aiRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
      
      let unitType = 'tank_v1'
      let cost = 1000
      
      // New production rules:
      // 1. Build up to 8 harvesters first as priority
      // 2. Once at 8 harvesters, focus on tanks
      // 3. Only replace destroyed harvesters (maintain 8 max)
      // 4. When budget > 15k, focus on advanced tanks
      
      const MAX_HARVESTERS = 8
      const HIGH_BUDGET_THRESHOLD = 15000
      const isHighBudget = aiFactory.budget >= HIGH_BUDGET_THRESHOLD
      
      if (aiHarvesters.length < MAX_HARVESTERS) {
        // Priority: Build up to 8 harvesters first
        unitType = 'harvester'
        cost = 500
      } else {
        // We have 8 harvesters, now focus entirely on combat units
        const rand = Math.random()
        
        if (isHighBudget) {
          // High budget: heavily favor advanced units
          if (rand < 0.15) {
            unitType = 'tank_v1'
            cost = 1000
          } else if (rand < 0.4) {
            unitType = 'tank-v2'
            cost = 2000
          } else if (rand < 0.7) {
            unitType = 'rocketTank'
            cost = 2000
          } else {
            unitType = 'tank-v3'
            cost = 3000
          }
        } else {
          // Normal budget: balanced unit mix
          if (rand < 0.4) {
            unitType = 'tank_v1'
            cost = 1000
          } else if (rand < 0.7) {
            unitType = 'tank-v2'
            cost = 2000
          } else {
            unitType = 'rocketTank'
            cost = 2000
          }
        }
      }
      if (aiFactory.budget >= cost) {
        // Find appropriate spawn factory for this unit type
        let spawnFactory = aiFactory // Default to main construction yard
        
        // Harvesters and other vehicle units should spawn from vehicle factories
        if (unitType === 'harvester' || unitType === 'tank_v1' || unitType === 'tank-v2' || unitType === 'tank-v3' || unitType === 'rocketTank') {
          const aiVehicleFactories = gameState.buildings.filter(
            b => b.type === 'vehicleFactory' && b.owner === aiPlayerId
          )
          
          if (aiVehicleFactories.length > 0) {
            // Use round-robin to select the next vehicle factory
            const factoryIndexKey = `next${aiPlayerId}VehicleFactoryIndex`
            gameState[factoryIndexKey] = gameState[factoryIndexKey] ?? 0
            spawnFactory = aiVehicleFactories[gameState[factoryIndexKey] % aiVehicleFactories.length]
            gameState[factoryIndexKey]++
          } else {
            console.error(`Cannot spawn ${unitType}: AI player ${aiPlayerId} has no Vehicle Factory.`)
            // Skip this production cycle and try again later
            gameState[lastProductionKey] = now
            return
          }
        }
        
        const newUnit = spawnEnemyUnit(spawnFactory, unitType, units, mapGrid, gameState, now, aiPlayerId)
        if (newUnit) {
          units.push(newUnit)
          // Deduct the cost from AI factory budget just like player money is deducted
          aiFactory.budget -= cost
          aiFactory.currentlyBuilding = unitType
          aiFactory.buildStartTime = now
          aiFactory.buildDuration = 5000
          gameState[lastProductionKey] = now
          
          // Reset attack directions periodically to ensure varied attack patterns
          // This happens roughly every 4-5 unit productions (40-50 seconds)
          if (Math.random() < 0.25) {
            resetAttackDirections()
          }
        } else {
          console.warn(`Failed to spawn ${aiPlayerId} ${unitType}`)
          gameState[lastProductionKey] = now
        }
      }
    }
  }

  // --- Update AI Units ---
  units.forEach(unit => {
    if (unit.owner !== aiPlayerId) return

    updateAIUnit(unit, units, gameState, mapGrid, now, aiPlayerId, targetedOreTiles)
  })
}

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
            const path = findPath(
              { x: unit.tileX, y: unit.tileY },
              targetPos,
              mapGrid,
              null
            )
            if (path.length > 1) {
              unit.path = path.slice(1)
              unit.lastPathCalcTime = now
            }
          }
        }
      }

      // Path recalculation throttled to every 2 seconds
      const pathRecalcNeeded = !unit.lastPathCalcTime || (now - unit.lastPathCalcTime > 2000)
      if (pathRecalcNeeded && !unit.isDodging && unit.target && (!unit.path || unit.path.length < 3)) {
        let targetPos = null
        if (unit.target.tileX !== undefined) {
          targetPos = { x: unit.target.tileX, y: unit.target.tileY }
        } else {
          targetPos = { x: unit.target.x, y: unit.target.y }
        }
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          targetPos,
          mapGrid,
          null
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
                const newPath = findPath(
                  { x: unit.tileX, y: unit.tileY },
                  { x: destTileX, y: destTileY },
                  mapGrid,
                  null
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

// Spawns an AI unit at the specified building (factory or vehicle factory)
// NOTE: AI units now use identical stats to player units for perfect balance
export function spawnEnemyUnit(spawnBuilding, unitType, units, mapGrid, gameState, productionStartTime, aiPlayerId) {
  // Use the same spawn position logic as player units
  const buildingCenterX = spawnBuilding.x + Math.floor(spawnBuilding.width / 2)
  const buildingCenterY = spawnBuilding.y + Math.floor(spawnBuilding.height / 2)
  
  // Find a clear spawn position around the building
  
  // Find an available spawn position near the building's center (same as player logic)
  let spawnPosition = findAvailableSpawnPosition(buildingCenterX, buildingCenterY, mapGrid, units)
  
  if (!spawnPosition) {
    // Fallback to center position if no adjacent position available
    spawnPosition = { x: buildingCenterX, y: buildingCenterY }
  }
  
  // Use the same createUnit function as player units to ensure identical stats
  const unit = {
    id: getUniqueId(),
    type: unitType,
    owner: aiPlayerId, // Use the AI player ID instead of hardcoded 'enemy'
    tileX: spawnPosition.x,
    tileY: spawnPosition.y,
    x: spawnPosition.x * TILE_SIZE,
    y: spawnPosition.y * TILE_SIZE,
    // Use standard unit properties instead of hardcoded values
    speed: (unitType === 'harvester') ? 0.45 : 0.375, // Same as player units
    health: (unitType === 'harvester') ? 150 : (unitType === 'tank-v2' ? 130 : (unitType === 'tank-v3' ? 169 : 100)),
    maxHealth: (unitType === 'harvester') ? 150 : (unitType === 'tank-v2' ? 130 : (unitType === 'tank-v3' ? 169 : 100)),
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    spawnTime: Date.now(),
    spawnedInFactory: true,
    holdInFactory: true, // Flag to hold unit in factory until loading indicator completes
    factoryBuildEndTime: productionStartTime + 5000, // Use unit production duration (5 seconds) instead of building construction
    lastPathCalcTime: 0,
    lastPositionCheckTime: 0,
    lastTargetChangeTime: 0,
    direction: 0,
    targetDirection: 0,
    turretDirection: 0,
    rotationSpeed: 0.15, // Same as player units
    isRotating: false
  }
  
  // Set effectiveSpeed to match the unit's speed (no more speed advantage)
  unit.effectiveSpeed = unit.speed
  
  // Add armor for harvesters (same as player units)
  if (unitType === 'harvester') {
    unit.armor = 3
  }
  
  // Add alert mode capability for tank-v2 and tank-v3 (same as player units)
  if (unitType === 'tank-v2' || unitType === 'tank-v3') {
    unit.alertMode = true
  }
  
  // If this is a harvester, assign it to an optimal AI refinery and give it an initial ore target (same as player harvesters)
  if (unitType === 'harvester') {
    // Find AI refineries for assignment
    const aiGameState = {
      buildings: gameState?.buildings?.filter(b => b.owner === aiPlayerId) || []
    }
    assignHarvesterToOptimalRefinery(unit, aiGameState)
    
    // Give enemy harvester initial ore target (same as player harvesters)
    const targetedOreTiles = gameState?.targetedOreTiles || {}
    const orePos = findClosestOre(unit, mapGrid, targetedOreTiles, unit.assignedRefinery)
    if (orePos) {
      // Register this ore tile as targeted by this unit
      const tileKey = `${orePos.x},${orePos.y}`
      if (gameState?.targetedOreTiles) {
        gameState.targetedOreTiles[tileKey] = unit.id
      }

      const newPath = findPath({ x: unit.tileX, y: unit.tileY }, orePos, mapGrid, null)
      if (newPath.length > 1) {
        unit.path = newPath.slice(1)
        unit.oreField = orePos // Set initial ore field target
      }
    }
  }

  // Initialize unified movement system for the new enemy unit
  initializeUnitMovement(unit)

  // Apply god mode if it's active for enemy units
  if (window.cheatSystem && window.cheatSystem.isGodModeActive()) {
    window.cheatSystem.addUnitToGodMode(unit)
  }

  return unit
}

// Find an available position near the building center for unit spawn (same logic as player units)
function findAvailableSpawnPosition(buildingCenterX, buildingCenterY, mapGrid, units) {
  const DIRECTIONS = [
    { x: 0, y: -1 }, // North
    { x: 1, y: 0 },  // East  
    { x: 0, y: 1 },  // South
    { x: -1, y: 0 }, // West
    { x: 1, y: -1 }, // Northeast
    { x: 1, y: 1 },  // Southeast
    { x: -1, y: 1 }, // Southwest
    { x: -1, y: -1 } // Northwest
  ]
  
  // Check immediate surrounding tiles first (1 tile away from center)
  for (let distance = 1; distance <= 5; distance++) {
    for (const dir of DIRECTIONS) {
      const x = buildingCenterX + dir.x * distance
      const y = buildingCenterY + dir.y * distance

      // Check if position is valid (passable terrain, within bounds, not occupied)
      if (isPositionValidForSpawn(x, y, mapGrid, units)) {
        return { x, y }
      }
    }
  }

  // If we couldn't find a position in the immediate vicinity, expand the search
  for (let distance = 6; distance <= 10; distance++) {
    // Check in a square pattern around the building center
    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        // Skip positions not on the perimeter of the current distance square
        if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue

        const x = buildingCenterX + dx
        const y = buildingCenterY + dy

        if (isPositionValidForSpawn(x, y, mapGrid, units)) {
          return { x, y }
        }
      }
    }
  }

  // No valid position found
  return null
}

// Helper function to check if a position is valid for unit spawn
function isPositionValidForSpawn(x, y, mapGrid, units) {
  // Check bounds
  if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) {
    return false
  }

  // Check terrain
  const tile = mapGrid[y][x]
  if (tile.type === 'water' || tile.type === 'rock' || tile.building) {
    return false
  }

  // Check if any unit is already at this position
  for (const unit of units) {
    if (unit.tileX === x && unit.tileY === y) {
      return false
    }
  }

  return true
}

// Find an adjacent tile to the factory that is not a building
function findAdjacentTile(factory, mapGrid) {
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue
      if (!mapGrid[y][x].building) {
        return { x, y }
      }
    }
  }
  return null
}

// Let's improve this function to fix issues with enemy building placement
// Modified to improve building placement with better spacing and factory avoidance
function findBuildingPosition(buildingType, mapGrid, units, buildings, factories, aiPlayerId) {
  const factory = factories.find(f => f.id === aiPlayerId)
  if (!factory) return null

  const buildingWidth = buildingData[buildingType].width
  const buildingHeight = buildingData[buildingType].height

  // Get human player factory for directional placement (to build defenses toward them)
  const humanPlayerFactory = factories.find(f => f.id === 'player1') // Assume human is always player1
  const factoryX = factory.x + Math.floor(factory.width / 2)
  const factoryY = factory.y + Math.floor(factory.height / 2)

  // Direction toward human player (for defensive buildings)
  const playerDirection = { x: 0, y: 0 }
  if (humanPlayerFactory) {
    const playerX = humanPlayerFactory.x + Math.floor(humanPlayerFactory.width / 2)
    const playerY = humanPlayerFactory.y + Math.floor(humanPlayerFactory.height / 2)
    playerDirection.x = playerX - factoryX
    playerDirection.y = playerY - factoryY
    const mag = Math.hypot(playerDirection.x, playerDirection.y)
    if (mag > 0) {
      playerDirection.x /= mag
      playerDirection.y /= mag
    }
  }

  // Find closest ore field to prioritize defense in that direction
  let closestOrePos = null
  let closestOreDist = Infinity

  // Search for ore fields
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      if (mapGrid[y][x].ore) {
        const dist = Math.hypot(x - factoryX, y - factoryY)
        if (dist < closestOreDist) {
          closestOreDist = dist
          closestOrePos = { x, y }
        }
      }
    }
  }

  // Determine direction vector - prioritize direction toward player for defensive buildings
  let directionVector = { x: 0, y: 0 }
  const isDefensiveBuilding = buildingType.startsWith('turretGun') || buildingType === 'rocketTurret'

  if (isDefensiveBuilding && humanPlayerFactory) {
    // For defensive buildings, strongly prefer direction toward player
    directionVector = playerDirection
  } else if (closestOrePos) {
    // For other buildings, prefer direction toward ore fields
    directionVector.x = closestOrePos.x - factoryX
    directionVector.y = closestOrePos.y - factoryY
    // Normalize
    const mag = Math.hypot(directionVector.x, directionVector.y)
    if (mag > 0) {
      directionVector.x /= mag
      directionVector.y /= mag
    }
  } else if (humanPlayerFactory) {
    // Fallback to player direction if no ore fields
    directionVector = playerDirection
  }

  // Special case for walls - they can be placed closer together
  const minSpaceBetweenBuildings = buildingType === 'concreteWall' ? 1 : 2

  // Preferred placement distances - increased to ensure more space between buildings
  const preferredDistances = [3, 4, 5, 2]

  // Search for positions prioritizing direction and preferred distance
  for (let angle = 0; angle < 360; angle += 30) {
    // Calculate angle alignment with target direction
    const angleRad = angle * Math.PI / 180
    const checkVector = { x: Math.cos(angleRad), y: Math.sin(angleRad) }
    const dotProduct = directionVector.x * checkVector.x + directionVector.y * checkVector.y

    // Skip angles that don't face toward the desired direction for defensive buildings
    if (isDefensiveBuilding && dotProduct < 0.5 && Math.random() < 0.8) continue

    // Try each of our preferred distances
    for (const distance of preferredDistances) {
      // Calculate position at this angle and distance
      const dx = Math.round(Math.cos(angleRad) * distance)
      const dy = Math.round(Math.sin(angleRad) * distance)

      const x = factory.x + dx
      const y = factory.y + dy

      // Skip if out of bounds
      if (x < 0 || y < 0 ||
          x + buildingWidth > mapGrid[0].length ||
          y + buildingHeight > mapGrid.length) {
        continue
      }

      // Validate position - check for factory overlaps and other issues
      let isValid = true
      let conflictsWithFactory = false

      // First verify this position doesn't overlap with any factory
      for (let checkY = y; checkY < y + buildingHeight && isValid; checkY++) {
        for (let checkX = x; checkX < x + buildingWidth && isValid; checkX++) {
          if (isPartOfFactory(checkX, checkY, factories)) {
            conflictsWithFactory = true
            isValid = false
            break
          }
        }
      }

      if (conflictsWithFactory) continue

      // Now check if each tile is valid (terrain, units, etc.)
      for (let checkY = y; checkY < y + buildingHeight && isValid; checkY++) {
        for (let checkX = x; checkX < x + buildingWidth && isValid; checkX++) {
          if (!isTileValid(checkX, checkY, mapGrid, units, buildings, factories)) {
            isValid = false
            break
          }
        }
      }

      if (!isValid) continue

      // Check if ANY tile of the building is within range of an existing enemy building
      // This means we're connected to the base, but not too close
      let isNearBase = false
      for (let checkY = y; checkY < y + buildingHeight && !isNearBase; checkY++) {
        for (let checkX = x; checkX < x + buildingWidth && !isNearBase; checkX++) {
          if (isNearExistingBuilding(checkX, checkY, buildings, factories, 5, aiPlayerId)) {
            isNearBase = true
          }
        }
      }

      if (!isNearBase) continue

      // NEW: Check if this building would create a bottleneck by being too close to other buildings
      const hasClearPaths = ensurePathsAroundBuilding(x, y, buildingWidth, buildingHeight, mapGrid, buildings, factories, minSpaceBetweenBuildings)

      if (!hasClearPaths) continue

      // If we got here, the position is valid
      return { x, y }
    }
  }

  // If we couldn't find a position with our preferred approach, try the fallback
  return fallbackBuildingPosition(buildingType, mapGrid, units, buildings, factories)
}

// New helper function to ensure there are clear paths around a potential building placement
function ensurePathsAroundBuilding(x, y, width, height, mapGrid, buildings, factories, minSpace) {
  // First, check all sides of the building to ensure there's adequate space
  let accessibleSides = 0

  // Check north side
  let northClear = true
  for (let checkX = x - minSpace; checkX < x + width + minSpace; checkX++) {
    const checkY = y - minSpace
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue

    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].building ||
        mapGrid[checkY][checkX].type === 'water' ||
        mapGrid[checkY][checkX].type === 'rock') {
      northClear = false
      break
    }

    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      northClear = false
      break
    }
  }
  if (northClear) accessibleSides++

  // Check south side
  let southClear = true
  for (let checkX = x - minSpace; checkX < x + width + minSpace; checkX++) {
    const checkY = y + height + (minSpace - 1)
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue

    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].building ||
        mapGrid[checkY][checkX].type === 'water' ||
        mapGrid[checkY][checkX].type === 'rock') {
      southClear = false
      break
    }

    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      southClear = false
      break
    }
  }
  if (southClear) accessibleSides++

  // Check west side
  let westClear = true
  for (let checkY = y - minSpace; checkY < y + height + minSpace; checkY++) {
    const checkX = x - minSpace
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue

    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].building ||
        mapGrid[checkY][checkX].type === 'water' ||
        mapGrid[checkY][checkX].type === 'rock') {
      westClear = false
      break
    }

    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      westClear = false
      break
    }
  }
  if (westClear) accessibleSides++

  // Check east side
  let eastClear = true
  for (let checkY = y - minSpace; checkY < y + height + minSpace; checkY++) {
    const checkX = x + width + (minSpace - 1)
    if (checkX < 0 || checkY < 0 || checkX >= mapGrid[0].length || checkY >= mapGrid.length) continue

    // Check if this tile is blocked by another building
    if (mapGrid[checkY][checkX].building ||
        mapGrid[checkY][checkX].type === 'water' ||
        mapGrid[checkY][checkX].type === 'rock') {
      eastClear = false
      break
    }

    // Check if this tile is part of an existing factory
    if (isPartOfFactory(checkX, checkY, factories)) {
      eastClear = false
      break
    }
  }
  if (eastClear) accessibleSides++

  // Need at least 2 accessible sides (preferably opposite sides)
  if (accessibleSides < 2) {
    return false
  }

  // Now, check if this placement would create a pathfinding bottleneck by:
  // 1. Creating a temporary map grid with this building placed
  // 2. Trying to find paths between key points around the base

  // Create a safe copy of the map grid without circular references
  const tempMapGrid = mapGrid.map(row => 
    row.map(tile => ({
      type: tile.type,
      ore: tile.ore,
      building: tile.building ? true : false // Just track existence, not reference
    }))
  )

  // Simulate placing the building in the temp grid
  for (let cy = y; cy < y + height; cy++) {
    for (let cx = x; cx < x + width; cx++) {
      if (cx >= 0 && cy >= 0 && cx < tempMapGrid[0].length && cy < tempMapGrid.length) {
        tempMapGrid[cy][cx].type = 'building'
      }
    }
  }

  // Get an AI factory for path testing (use first AI player)
  const aiPlayerIds = Object.keys(gameState.aiPlayerStates || {})
  const aiFactory = aiPlayerIds.length > 0 
    ? factories.find(f => f.owner === aiPlayerIds[0] || f.id === aiPlayerIds[0])
    : factories.find(f => f.owner === 'enemy' || f.id === 'enemy') // fallback
  if (!aiFactory) return true // If no AI factory, placement should be allowed

  // Find existing buildings to test paths between
  const aiBuildings = buildings ? buildings.filter(b => b.owner === (aiPlayerIds[0] || 'enemy')) : []

  if (aiBuildings.length < 1) {
    return true // No existing buildings to test paths between
  }

  // Create test points around the AI base
  const testPoints = []

  // Add factory exit points
  testPoints.push({
    x: aiFactory.x + Math.floor(aiFactory.width / 2),
    y: aiFactory.y + aiFactory.height + 1  // Below the factory
  })

  // Add points near existing buildings
  aiBuildings.forEach(building => {
    // Add points around the building
    testPoints.push({ x: building.x - 1, y: building.y }) // Left
    testPoints.push({ x: building.x + building.width, y: building.y }) // Right
    testPoints.push({ x: building.x, y: building.y - 1 }) // Top
    testPoints.push({ x: building.x, y: building.y + building.height }) // Bottom
  })

  // Filter out invalid test points
  const validTestPoints = testPoints.filter(point => {
    return point.x >= 0 && point.y >= 0 &&
           point.x < tempMapGrid[0].length && point.y < tempMapGrid.length &&
           tempMapGrid[point.y][point.x].type !== 'building' &&
           tempMapGrid[point.y][point.x].type !== 'water' &&
           tempMapGrid[point.y][point.x].type !== 'rock'
  })

  // Need at least 2 valid test points to check paths
  if (validTestPoints.length < 2) {
    return true
  }

  // Select a few random pairs of points to test paths between (no need to test all combinations)
  const pathTestPairs = []
  for (let i = 0; i < Math.min(3, validTestPoints.length - 1); i++) {
    // Randomly select two points
    const point1 = validTestPoints[Math.floor(Math.random() * validTestPoints.length)]
    let point2
    do {
      point2 = validTestPoints[Math.floor(Math.random() * validTestPoints.length)]
    } while (point1 === point2)

    pathTestPairs.push({ start: point1, end: point2 })
  }

  // Test if paths exist between these points with the new building placed
  for (const { start, end } of pathTestPairs) {
    // Use our own simple path finder instead of importing findPath to avoid circular dependencies
    const hasPath = checkSimplePath(start, end, tempMapGrid, 150) // Limit path length to avoid infinite loops

    if (!hasPath) {
      // If any path test fails, this building placement would create a bottleneck
      return false
    }
  }

  // All tests passed, this building placement maintains paths between key points
  return true
}

// Simple pathfinding function for testing connectivity (BFS approach)
function checkSimplePath(start, end, mapGrid, maxSteps) {
  const queue = [{ x: start.x, y: start.y, steps: 0 }]
  const visited = new Set()

  while (queue.length > 0) {
    const current = queue.shift()

    // Check if we reached the destination
    if (current.x === end.x && current.y === end.y) {
      return true
    }

    // Check if we've reached the step limit
    if (current.steps >= maxSteps) {
      return false
    }

    // Mark as visited
    const key = `${current.x},${current.y}`
    if (visited.has(key)) continue
    visited.add(key)

    // Check all 8 directions
    const directions = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, // Cardinals
      { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 } // Diagonals
    ]

    for (const dir of directions) {
      const nextX = current.x + dir.x
      const nextY = current.y + dir.y

      // Check bounds
      if (nextX < 0 || nextY < 0 || nextX >= mapGrid[0].length || nextY >= mapGrid.length) {
        continue
      }

      // Check if passable
      if (mapGrid[nextY][nextX].building ||
          mapGrid[nextY][nextX].type === 'water' ||
          mapGrid[nextY][nextX].type === 'rock') {
        continue
      }

      // Add to queue
      queue.push({ x: nextX, y: nextY, steps: current.steps + 1 })
    }
  }

  // No path found
  return false
}

// Fallback position search with the original spiral pattern
function fallbackBuildingPosition(buildingType, mapGrid, units, buildings, factories) {
  // Use first AI player factory, fallback to 'enemy' for legacy compatibility
  const aiPlayerIds = Object.keys(gameState.aiPlayerStates || {})
  const factory = aiPlayerIds.length > 0 
    ? factories.find(f => f.owner === aiPlayerIds[0] || f.id === aiPlayerIds[0])
    : factories.find(f => f.owner === 'enemy' || f.id === 'enemy') // fallback
  if (!factory) return null

  const buildingWidth = buildingData[buildingType].width
  const buildingHeight = buildingData[buildingType].height

  // Special case for walls - they can be placed closer together
  const minSpaceBetweenBuildings = buildingType === 'concreteWall' ? 1 : 2

  // Get human player factory for directional placement of defensive buildings
  const playerFactory = factories.find(f => f.id === gameState.humanPlayer || f.id === 'player')
  const isDefensiveBuilding = buildingType.startsWith('turretGun') || buildingType === 'rocketTurret'

  // Preferred distances for building placement
  const preferredDistances = [3, 4, 5, 2]

  // Calculate player direction for defensive buildings
  let playerDirection = null
  if (playerFactory && isDefensiveBuilding) {
    const factoryX = factory.x + Math.floor(factory.width / 2)
    const factoryY = factory.y + Math.floor(factory.height / 2)
    const playerX = playerFactory.x + Math.floor(playerFactory.width / 2)
    const playerY = playerFactory.y + Math.floor(playerFactory.height / 2)

    playerDirection = {
      x: playerX - factoryX,
      y: playerY - factoryY
    }

    // Normalize
    const mag = Math.hypot(playerDirection.x, playerDirection.y)
    if (mag > 0) {
      playerDirection.x /= mag
      playerDirection.y /= mag
    }
  }

  // Search in a spiral pattern around the factory with preference to player direction
  for (let distance = 1; distance <= 10; distance++) {
    // Prioritize distances from our preferred list
    if (preferredDistances.includes(distance)) {
      // Prioritize building in 8 cardinal directions first
      for (let angle = 0; angle < 360; angle += 45) {
        // For defensive buildings, prioritize direction toward player
        if (isDefensiveBuilding && playerDirection) {
          // Calculate how closely this angle aligns with player direction
          const angleRad = angle * Math.PI / 180
          const dirVector = {
            x: Math.cos(angleRad),
            y: Math.sin(angleRad)
          }

          const dotProduct = playerDirection.x * dirVector.x + playerDirection.y * dirVector.y

          // Skip angles that don't face toward player (negative dot product)
          if (dotProduct < 0.3 && Math.random() < 0.7) continue
        }

        // Calculate position at this angle and distance
        const angleRad = angle * Math.PI / 180
        const dx = Math.round(Math.cos(angleRad) * distance)
        const dy = Math.round(Math.sin(angleRad) * distance)

        const x = factory.x + dx
        const y = factory.y + dy

        // Skip if out of bounds
        if (x < 0 || y < 0 ||
            x + buildingWidth > mapGrid[0].length ||
            y + buildingHeight > mapGrid.length) {
          continue
        }

        // First check factory overlap
        let overlapsFactory = false
        for (let cy = y; cy < y + buildingHeight && !overlapsFactory; cy++) {
          for (let cx = x; cx < x + buildingWidth && !overlapsFactory; cx++) {
            if (isPartOfFactory(cx, cy, factories)) {
              overlapsFactory = true
            }
          }
        }

        if (overlapsFactory) continue

        // Check if ANY tile of the building is within range of an existing building
        let isNearBase = false
        for (let cy = y; cy < y + buildingHeight && !isNearBase; cy++) {
          for (let cx = x; cx < x + buildingWidth && !isNearBase; cx++) {
            if (isNearExistingBuilding(cx, cy, buildings, factories, 5, aiPlayerId)) {
              isNearBase = true
            }
          }
        }

        if (!isNearBase) continue

        // Check if each tile is valid (terrain, units, etc.)
        let isValid = true
        for (let cy = y; cy < y + buildingHeight && isValid; cy++) {
          for (let cx = x; cx < x + buildingWidth && isValid; cx++) {
            if (!isTileValid(cx, cy, mapGrid, units, buildings, factories)) {
              isValid = false
            }
          }
        }

        if (!isValid) continue

        // Use the same path checking as in the main function
        const hasClearPaths = ensurePathsAroundBuilding(x, y, buildingWidth, buildingHeight, mapGrid, buildings, factories, minSpaceBetweenBuildings)

        if (!hasClearPaths) continue

        return { x, y }
      }
    }
  }

  // Last resort: check the entire spiral without preferred distances
  for (let distance = 1; distance <= 10; distance++) {
    // Skip distances we already checked
    if (preferredDistances.includes(distance)) continue

    for (let dx = -distance; dx <= distance; dx++) {
      for (let dy = -distance; dy <= distance; dy++) {
        // Skip positions not on the perimeter
        if (Math.abs(dx) < distance && Math.abs(dy) < distance) continue

        const x = factory.x + dx
        const y = factory.y + dy

        // Skip if out of bounds
        if (x < 0 || y < 0 ||
            x + buildingWidth > mapGrid[0].length ||
            y + buildingHeight > mapGrid.length) {
          continue
        }

        // First verify not overlapping a factory
        let overlapsFactory = false
        for (let cy = y; cy < y + buildingHeight && !overlapsFactory; cy++) {
          for (let cx = x; cx < x + buildingWidth && !overlapsFactory; cx++) {
            if (isPartOfFactory(cx, cy, factories)) {
              overlapsFactory = true
            }
          }
        }

        if (overlapsFactory) continue

        // Check if near base and all tiles are valid
        let isNearBase = false
        let allTilesValid = true

        for (let cy = y; cy < y + buildingHeight; cy++) {
          for (let cx = x; cx < x + buildingWidth; cx++) {
            if (isNearExistingBuilding(cx, cy, buildings, factories, 5, aiPlayerId)) {
              isNearBase = true
            }
            if (!isTileValid(cx, cy, mapGrid, units, buildings, factories)) {
              allTilesValid = false
            }
          }
        }

        if (!isNearBase || !allTilesValid) continue

        // Final check for pathfinding
        const hasClearPaths = ensurePathsAroundBuilding(x, y, buildingWidth, buildingHeight, mapGrid, buildings, factories, minSpaceBetweenBuildings)

        if (!hasClearPaths) continue

        return { x, y }
      }
    }
  }

  return null
}

// Handle enemy building production completion
// eslint-disable-next-line no-unused-vars
function completeEnemyBuilding(gameState, mapGrid) {
  const production = gameState.enemy.currentBuildingProduction
  if (!production) return

  // Do a final check to make sure the location is still valid
  const buildingType = production.type
  const x = production.x
  const y = production.y

  // Validate the building placement one final time
  if (canPlaceBuilding(buildingType, x, y, mapGrid, gameState.units, gameState.buildings, gameState.factories || [], 'enemy')) {
    // Create and place the building
    const newBuilding = createBuilding(buildingType, x, y)
    newBuilding.owner = 'enemy'

    // Add to game state
    gameState.buildings.push(newBuilding)

    // Update map grid
    placeBuilding(newBuilding, mapGrid)

    // Update power supply
    updatePowerSupply(gameState.buildings, gameState)

  } else {
  }

  // Reset production state
  gameState.enemy.currentBuildingProduction = null
}

// Add function to replicate player building patterns
// eslint-disable-next-line no-unused-vars
function replicatePlayerBuildPattern(gameState, enemyBuildings) {
  try {
    // Get build patterns from localStorage if not already loaded
    if (!gameState.playerBuildHistory) {
      const savedHistory = localStorage.getItem('playerBuildHistory')
      gameState.playerBuildHistory = savedHistory ? JSON.parse(savedHistory) : []
    }

    // Check if we have any patterns to learn from
    if (!gameState.playerBuildHistory || gameState.playerBuildHistory.length === 0) {
      return null
    }

    // Pick a random session from the last 20 (or however many we have)
    const lastSessions = gameState.playerBuildHistory.slice(-20)
    const randomSession = lastSessions[Math.floor(Math.random() * lastSessions.length)]

    if (!randomSession || !randomSession.buildings || randomSession.buildings.length === 0) {
      return null
    }

    // Get counts of existing enemy buildings by type
    const buildingCounts = {}
    enemyBuildings.forEach(building => {
      buildingCounts[building.type] = (buildingCounts[building.type] || 0) + 1
    })

    // Find the next building type from the pattern that we haven't matched yet
    for (let i = 0; i < randomSession.buildings.length; i++) {
      const buildingType = randomSession.buildings[i]

      // If we haven't built this type of building yet or haven't built as many as the pattern suggests
      const currentCount = buildingCounts[buildingType] || 0
      const patternCount = randomSession.buildings.slice(0, i + 1)
        .filter(type => type === buildingType).length

      if (currentCount < patternCount) {
        return buildingType
      }
    }

    // If we've replicated the entire pattern, choose the last building type
    return randomSession.buildings[randomSession.buildings.length - 1]
  } catch (error) {
    console.error('Error in replicatePlayerBuildPattern:', error)
    return null
  }
}

// Helper function to check if a position is part of a factory
function isPartOfFactory(x, y, factories) {
  if (!factories) return false

  for (const factory of factories) {
    if (x >= factory.x && x < factory.x + factory.width &&
        y >= factory.y && y < factory.y + factory.height) {
      return true
    }
  }
  return false
}
