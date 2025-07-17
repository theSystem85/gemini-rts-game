import { buildingData, createBuilding, canPlaceBuilding, placeBuilding } from '../buildings.js'
import { spawnEnemyUnit } from './enemySpawner.js'
import { resetAttackDirections } from './enemyStrategies.js'
import { updateAIUnit } from './enemyUnitBehavior.js'
import { findBuildingPosition } from './enemyBuilding.js'

function findSimpleBuildingPosition(buildingType, mapGrid, factories, aiPlayerId) {
  // Validate inputs
  if (!buildingType) {
    console.warn('findSimpleBuildingPosition called with undefined buildingType')
    return null
  }

  if (!buildingData[buildingType]) {
    console.warn(`findSimpleBuildingPosition called with unknown buildingType: ${buildingType}`)
    return null
  }

  const factory = factories.find(f => f.id === aiPlayerId)
  if (!factory) return null

  const buildingWidth = buildingData[buildingType].width
  const buildingHeight = buildingData[buildingType].height

  // Use appropriate spacing based on building type
  let minDistance = 2
  if (buildingType === 'oreRefinery' || buildingType === 'vehicleFactory') {
    minDistance = 4 // More space for refineries and factories
  } else if (buildingType === 'concreteWall') {
    minDistance = 1 // Walls can be closer
  }

  // Extended spiral search around the factory with appropriate spacing
  for (let radius = minDistance; radius <= 20; radius++) { // Increased from 12 to 20
    for (let angle = 0; angle < 360; angle += 30) { // Reduced step from 45 to 30 for more positions
      const x = factory.x + Math.round(Math.cos(angle * Math.PI / 180) * radius)
      const y = factory.y + Math.round(Math.sin(angle * Math.PI / 180) * radius)

      // Check bounds
      if (x < 0 || y < 0 || x + buildingWidth >= mapGrid[0].length || y + buildingHeight >= mapGrid.length) {
        continue
      }

      // Check if all tiles are valid with minimal clearance requirements
      let valid = true

      // For refineries and vehicle factories, check extra clearance around the building
      const clearanceNeeded = (buildingType === 'oreRefinery' || buildingType === 'vehicleFactory') ? 1 : 0

      for (let by = y - clearanceNeeded; by < y + buildingHeight + clearanceNeeded && valid; by++) {
        for (let bx = x - clearanceNeeded; bx < x + buildingWidth + clearanceNeeded && valid; bx++) {
          // Only check the core building area for basic validity
          if (by >= y && by < y + buildingHeight && bx >= x && bx < x + buildingWidth) {
            if (by >= 0 && by < mapGrid.length && bx >= 0 && bx < mapGrid[0].length) {
              const tile = mapGrid[by][bx]
              if (tile.type === 'water' || tile.type === 'rock' || tile.building || tile.seedCrystal) {
                valid = false
              }
            } else {
              valid = false // Out of bounds
            }
          }
          // Check clearance area for obstacles (but allow land/street) - relaxed for smaller buildings
          else if (clearanceNeeded > 0 && (buildingType === 'oreRefinery' || buildingType === 'vehicleFactory')) {
            if (by >= 0 && by < mapGrid.length && bx >= 0 && bx < mapGrid[0].length) {
              const tile = mapGrid[by][bx]
              if (tile.type === 'water' || tile.type === 'rock' || tile.building) {
                valid = false
              }
            }
          }
        }
      }

      if (valid) {
        return { x, y }
      }
    }
  }

  return null
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
  
  // Debug logging (enable temporarily to debug building issues)
  const DEBUG_AI_BUILDING = false  // Disable debugging
  // Enhanced build order: Core buildings -> Defense -> Advanced structures
  // Don't build if currently building something or already producing a unit
  if (now - (gameState[lastBuildingTimeKey] || 0) >= 6000 && aiFactory && aiFactory.budget > 1000 && 
      gameState.buildings && !aiFactory.currentlyBuilding && !aiFactory.currentlyProducingUnit) {
    const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
    const powerPlants = aiBuildings.filter(b => b.type === 'powerPlant')
    const vehicleFactories = aiBuildings.filter(b => b.type === 'vehicleFactory')
    const oreRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
    const turrets = aiBuildings.filter(b => b.type.startsWith('turretGun') || b.type === 'rocketTurret')
    const radarStations = aiBuildings.filter(b => b.type === 'radarStation')
    const teslaCoils = aiBuildings.filter(b => b.type === 'teslaCoil')
    const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')

    // Debug logging (enable temporarily to debug building issues)
    if (DEBUG_AI_BUILDING) {
      console.log(`AI ${aiPlayerId} building check: Power=${powerPlants.length}, VF=${vehicleFactories.length}, Refinery=${oreRefineries.length}, Budget=${aiFactory.budget}`)
    }

    let buildingType = null
    let cost = 0

    // Phase 1: Essential infrastructure - prioritize refinery for economic growth
    if (powerPlants.length === 0) {
      buildingType = 'powerPlant'
      cost = buildingData.powerPlant.cost
    } else if (oreRefineries.length === 0) {
      // Build refinery BEFORE vehicle factory to establish economy quickly
      buildingType = 'oreRefinery'
      cost = buildingData.oreRefinery.cost
    } else if (vehicleFactories.length === 0) {
      buildingType = 'vehicleFactory'
      cost = buildingData.vehicleFactory.cost

    // Phase 2: Basic defense
    } else if (turrets.length < 3) {
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

    // Phase 3: Radar for advanced units and tesla coils
    } else if (radarStations.length === 0 && aiFactory.budget >= buildingData.radarStation.cost) {
      buildingType = 'radarStation'
      cost = buildingData.radarStation.cost

    // Phase 4: Advanced defense (Tesla Coils require radar)
    } else if (teslaCoils.length < 2 && radarStations.length > 0 && aiFactory.budget >= buildingData.teslaCoil.cost) {
      buildingType = 'teslaCoil'
      cost = buildingData.teslaCoil.cost

    // Phase 5: Expansion - more production buildings
    } else if (vehicleFactories.length < 2 && aiFactory.budget >= buildingData.vehicleFactory.cost) {
      buildingType = 'vehicleFactory'
      cost = buildingData.vehicleFactory.cost

    // Phase 6: More refineries based on harvester count
    } else {
      const aiRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
      const maxHarvestersForRefineries = aiRefineries.length * 3 // 1:3 ratio for better efficiency

      if (aiHarvesters.length >= maxHarvestersForRefineries && aiFactory.budget >= buildingData.oreRefinery.cost) {
        buildingType = 'oreRefinery'
        cost = buildingData.oreRefinery.cost

      // Phase 7: More advanced defense
      } else if (turrets.length < 6 && aiFactory.budget >= 3000) {
        if (aiFactory.budget >= 5000 && teslaCoils.length < 3 && radarStations.length > 0) {
          buildingType = 'teslaCoil'
          cost = buildingData.teslaCoil.cost
        } else if (aiFactory.budget >= 4000) {
          buildingType = 'rocketTurret'
          cost = 4000
        } else {
          buildingType = 'turretGunV3'
          cost = 3000
        }

      // Phase 8: Power plants for high energy consumption
      } else if (powerPlants.length < 3 && aiFactory.budget >= buildingData.powerPlant.cost) {
        buildingType = 'powerPlant'
        cost = buildingData.powerPlant.cost
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

        if (DEBUG_AI_BUILDING) {
          console.log(`AI ${aiPlayerId} started building ${buildingType} at position (${position.x}, ${position.y}) for $${cost}`)
        }
      } else {
        console.log(`AI ${aiPlayerId} could not find position for ${buildingType}, trying simpler placement`)
        // Try a simpler placement algorithm as fallback
        const simplePosition = findSimpleBuildingPosition(buildingType, mapGrid, factories, aiPlayerId)
        if (simplePosition) {
          aiFactory.budget -= cost
          aiFactory.currentlyBuilding = buildingType
          aiFactory.buildStartTime = now
          aiFactory.buildDuration = 5000
          aiFactory.buildingPosition = simplePosition
          gameState[lastBuildingTimeKey] = now
        } else {
          console.log(`AI ${aiPlayerId} failed to find any position for ${buildingType}`)
          gameState[lastBuildingTimeKey] = now
        }
      }
    }
  }

  // Complete building construction when timer finishes
  if (aiFactory && aiFactory.currentlyBuilding && now - aiFactory.buildStartTime > aiFactory.buildDuration) {
    const buildingType = aiFactory.currentlyBuilding
    const position = aiFactory.buildingPosition

    // Validate that buildingType is valid before proceeding
    if (!buildingType) {
      console.error(`AI ${aiPlayerId} currentlyBuilding is null/undefined, resetting construction`, {
        currentlyBuilding: aiFactory.currentlyBuilding,
        buildStartTime: aiFactory.buildStartTime,
        buildDuration: aiFactory.buildDuration
      })
      aiFactory.currentlyBuilding = null
      aiFactory.buildStartTime = null
      aiFactory.buildDuration = null
      aiFactory.buildingPosition = null
      return
    }

    if (!buildingData[buildingType]) {
      console.error(`AI ${aiPlayerId} currentlyBuilding is invalid type: ${buildingType}, resetting construction`, {
        currentlyBuilding: aiFactory.currentlyBuilding,
        availableTypes: Object.keys(buildingData)
      })
      aiFactory.currentlyBuilding = null
      aiFactory.buildStartTime = null
      aiFactory.buildDuration = null
      aiFactory.buildingPosition = null
      return
    }

    if (DEBUG_AI_BUILDING) {
      console.log(`AI ${aiPlayerId} completing construction of ${buildingType}`)
    }

    if (position) {
      // Double-check position is still valid before placing
      if (canPlaceBuilding(buildingType, position.x, position.y, mapGrid, units, gameState.buildings, factories, aiPlayerId)) {
        const newBuilding = createBuilding(buildingType, position.x, position.y)
        newBuilding.owner = aiPlayerId
        gameState.buildings.push(newBuilding)
        placeBuilding(newBuilding, mapGrid)

        if (DEBUG_AI_BUILDING) {
          console.log(`AI ${aiPlayerId} successfully placed ${buildingType} at (${position.x}, ${position.y})`)
        }
      } else {
        // Position became invalid, try to find an alternative position immediately
        if (DEBUG_AI_BUILDING) {
          console.log(`AI ${aiPlayerId} original position became invalid for ${buildingType}, searching for alternative`)
        }
        
        // Try the advanced algorithm first
        let alternativePosition = findBuildingPosition(buildingType, mapGrid, units, gameState.buildings, factories, aiPlayerId)
        
        // If that fails, try the simple algorithm
        if (!alternativePosition) {
          alternativePosition = findSimpleBuildingPosition(buildingType, mapGrid, factories, aiPlayerId)
        }
        
        if (alternativePosition) {
          // Found an alternative position, place the building there
          const newBuilding = createBuilding(buildingType, alternativePosition.x, alternativePosition.y)
          newBuilding.owner = aiPlayerId
          gameState.buildings.push(newBuilding)
          placeBuilding(newBuilding, mapGrid)
          
          if (DEBUG_AI_BUILDING) {
            console.log(`AI ${aiPlayerId} placed ${buildingType} at alternative position (${alternativePosition.x}, ${alternativePosition.y})`)
          }
        } else {
          // No alternative position found, refund the cost as last resort
          aiFactory.budget += buildingData[buildingType]?.cost || 0
          
          if (DEBUG_AI_BUILDING) {
            console.log(`AI ${aiPlayerId} could not find any valid position for ${buildingType}, refunded cost`)
          }
        }
      }
    }

    // Clear construction state
    aiFactory.currentlyBuilding = null
    aiFactory.buildingPosition = null
  }

  // Complete unit production when timer finishes
  if (aiFactory && aiFactory.currentlyProducingUnit && now - aiFactory.unitBuildStartTime > aiFactory.unitBuildDuration) {
    const unitType = aiFactory.currentlyProducingUnit
    const spawnFactory = aiFactory.unitSpawnBuilding || aiFactory
    const newUnit = spawnEnemyUnit(spawnFactory, unitType, units, mapGrid, gameState, aiFactory.unitBuildStartTime, aiPlayerId)

    if (newUnit) {
      units.push(newUnit)
    } else {
      console.warn(`Failed to spawn ${aiPlayerId} ${unitType}`)
    }

    if (DEBUG_AI_BUILDING) {
      console.log(`AI ${aiPlayerId} completed production of ${unitType}`)
    }

    // Clear unit production state
    aiFactory.currentlyProducingUnit = null
    aiFactory.unitBuildStartTime = null
    aiFactory.unitBuildDuration = null
    aiFactory.unitSpawnBuilding = null
  }

  // --- AI Unit Production ---
  // Only allow unit production after all required buildings are present
  if (gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'powerPlant').length > 0 &&
      gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'vehicleFactory').length > 0 &&
      gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'oreRefinery').length > 0) {
    
    // Don't produce units if currently building something or already producing a unit
    if (aiFactory && !aiFactory.currentlyBuilding && !aiFactory.currentlyProducingUnit && 
        now - (gameState[lastProductionKey] || 0) >= 8000) {
      const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')
      const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
      const aiRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
      
      let unitType = 'tank_v1'
      let cost = 1000

      // Enhanced production rules:
      // 1. Build up to 6 harvesters first as priority
      // 2. Then build diverse combat units
      // 3. Focus on advanced units when budget is high
      // 4. Maintain harvester count but prioritize combat

      const MAX_HARVESTERS = Math.min(6 + aiRefineries.length * 2, 12) // Scale with refineries, cap at 12
      const HIGH_BUDGET_THRESHOLD = 12000
      const VERY_HIGH_BUDGET_THRESHOLD = 20000
      const isHighBudget = aiFactory.budget >= HIGH_BUDGET_THRESHOLD
      const isVeryHighBudget = aiFactory.budget >= VERY_HIGH_BUDGET_THRESHOLD

      if (aiHarvesters.length < MAX_HARVESTERS) {
        // Priority: Build up harvesters first, but only if we need more relative to our refineries
        unitType = 'harvester'
        cost = 500
      } else {
        // We have enough harvesters, now focus on diverse combat units
        const rand = Math.random()

        if (isVeryHighBudget) {
          // Very high budget: Focus on elite units
          if (rand < 0.1) {
            unitType = 'tank_v1'
            cost = 1000
          } else if (rand < 0.3) {
            unitType = 'tank-v2'
            cost = 2000
          } else if (rand < 0.6) {
            unitType = 'tank-v3'
            cost = 3000
          } else {
            unitType = 'rocketTank'
            cost = 2000
          }
        } else if (isHighBudget) {
          // High budget: Balanced advanced units
          if (rand < 0.2) {
            unitType = 'tank_v1'
            cost = 1000
          } else if (rand < 0.5) {
            unitType = 'tank-v2'
            cost = 2000
          } else if (rand < 0.75) {
            unitType = 'rocketTank'
            cost = 2000
          } else {
            unitType = 'tank-v3'
            cost = 3000
          }
        } else {
          // Normal budget: Mix of basic and medium units
          if (rand < 0.5) {
            unitType = 'tank_v1'
            cost = 1000
          } else if (rand < 0.8) {
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

        // Record production details and delay spawning until build time completes
        aiFactory.budget -= cost
        aiFactory.currentlyProducingUnit = unitType
        aiFactory.unitBuildStartTime = now
        aiFactory.unitBuildDuration = 5000
        aiFactory.unitSpawnBuilding = spawnFactory
        gameState[lastProductionKey] = now

        if (DEBUG_AI_BUILDING) {
          console.log(`AI ${aiPlayerId} started producing ${unitType} for $${cost}`)
        }

        // Reset attack directions periodically to ensure varied attack patterns
        // This happens roughly every 4-5 unit productions (40-50 seconds)
        if (Math.random() < 0.25) {
          resetAttackDirections()
        }
      }
    }
  }

  // --- Update AI Units ---
  units.forEach(unit => {
    if (unit.owner !== aiPlayerId) return

    updateAIUnit(unit, units, gameState, mapGrid, now, aiPlayerId, targetedOreTiles, bullets)
  })
}

export { updateAIPlayer }
