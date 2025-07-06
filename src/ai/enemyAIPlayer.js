import { buildingData, createBuilding, canPlaceBuilding, placeBuilding } from '../buildings.js'
import { spawnEnemyUnit } from './enemySpawner.js'
import { resetAttackDirections } from './enemyStrategies.js'
import { updateAIUnit } from './enemyUnitBehavior.js'
import { findBuildingPosition } from './enemyBuilding.js'

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

    updateAIUnit(unit, units, gameState, mapGrid, bullets, now, aiPlayerId, targetedOreTiles)
  })
}

export { updateAIPlayer }
