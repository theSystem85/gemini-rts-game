import { buildingData, createBuilding, canPlaceBuilding, placeBuilding } from '../buildings.js'
import { spawnEnemyUnit } from './enemySpawner.js'
import { resetAttackDirections, manageAICrewHealing } from './enemyStrategies.js'
import { getUnitCost } from '../utils.js'
import { updateAIUnit } from './enemyUnitBehavior.js'
import { findBuildingPosition } from './enemyBuilding.js'
import { updateDangerZoneMaps } from '../game/dangerZoneMap.js'
import { logPerformance } from '../performanceUtils.js'
import { gameState } from '../gameState.js'

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

  const isDefensive =
    buildingType.startsWith('turretGun') ||
    buildingType === 'rocketTurret' ||
    buildingType === 'teslaCoil' ||
    buildingType === 'artilleryTurret'

  let angleOffset = 0
  if (isDefensive) {
    const playerFactory = factories.find(
      f => f.id === gameState.humanPlayer || f.id === 'player1'
    )
    if (playerFactory) {
      const fx = factory.x + Math.floor(factory.width / 2)
      const fy = factory.y + Math.floor(factory.height / 2)
      const px = playerFactory.x + Math.floor(playerFactory.width / 2)
      const py = playerFactory.y + Math.floor(playerFactory.height / 2)
      angleOffset = (Math.atan2(py - fy, px - fx) * 180) / Math.PI
      if (angleOffset < 0) angleOffset += 360
    }
  }

  // Use appropriate spacing based on building type
  let minDistance = 2 // MINIMUM 2 tiles spacing for all buildings
  if (buildingType === 'oreRefinery' || buildingType === 'vehicleFactory') {
    minDistance = 4 // More space for refineries and factories
  } else if (buildingType === 'concreteWall') {
    minDistance = 2 // Walls now also require 2-tile spacing to prevent clustering
  }

  // Extended spiral search around the factory with appropriate spacing
  for (let radius = minDistance; radius <= 20; radius++) {
    for (let step = 0; step < 360; step += 30) {
      const angle = ((angleOffset + step) % 360) * (Math.PI / 180)
      const x = factory.x + Math.round(Math.cos(angle) * radius)
      const y = factory.y + Math.round(Math.sin(angle) * radius)

      // Check bounds
      if (x < 0 || y < 0 || x + buildingWidth >= mapGrid[0].length || y + buildingHeight >= mapGrid.length) {
        continue
      }

      // Check if all tiles are valid with minimal clearance requirements
      let valid = true

      // For refineries and vehicle factories, check extra clearance around the building
      let clearanceNeeded = 2 // Default minimum clearance to enforce 2-tile spacing
      if (buildingType === 'oreRefinery' || buildingType === 'vehicleFactory') {
        clearanceNeeded = 3
      } else if (buildingType === 'concreteWall') {
        clearanceNeeded = 2 // Walls now also require 2-tile clearance
      }

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

const updateAIPlayer = logPerformance(function updateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles) {
  const aiFactory = factories.find(
    f => (f.id === aiPlayerId || f.owner === aiPlayerId) && f.health > 0
  )

  // If no active construction yard remains this AI cannot build
  if (!aiFactory) {
    return
  }

  // Define the keys we'll use for this AI player's state
  const lastBuildingTimeKey = `${aiPlayerId}LastBuildingTime`
  const lastProductionKey = `${aiPlayerId}LastProductionTime`
  
  // Debug logging (enable temporarily to debug building issues)
  const DEBUG_AI_BUILDING = false  // Disable debugging
  // Enhanced build order: Core buildings -> Defense -> Advanced structures
  // Building construction runs independently from unit production
  if (now - (gameState[lastBuildingTimeKey] || 0) >= 6000 && aiFactory && aiFactory.budget > 1000 &&
      gameState.buildings && !aiFactory.currentlyBuilding) {
    const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
    const powerPlants = aiBuildings.filter(b => b.type === 'powerPlant')
    const vehicleFactories = aiBuildings.filter(b => b.type === 'vehicleFactory')
    const oreRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
    const turrets = aiBuildings.filter(
      b =>
        b.type.startsWith('turretGun') ||
        b.type === 'rocketTurret' ||
        b.type === 'artilleryTurret'
    )
    const rocketTurrets = aiBuildings.filter(b => b.type === 'rocketTurret')
    const artilleryTurrets = aiBuildings.filter(b => b.type === 'artilleryTurret')
    const radarStations = aiBuildings.filter(b => b.type === 'radarStation')
    const teslaCoils = aiBuildings.filter(b => b.type === 'teslaCoil')
    const hospitals = aiBuildings.filter(b => b.type === 'hospital')
    const gasStations = aiBuildings.filter(b => b.type === 'gasStation')
    const vehicleWorkshops = aiBuildings.filter(b => b.type === 'vehicleWorkshop')
    const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')
    const turretGunCount = aiBuildings.filter(b => b.type.startsWith('turretGun')).length
    const aiTanks = units.filter(
      u =>
        u.owner === aiPlayerId &&
        (u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3')
    )
    const tanksInProduction = ['tank_v1', 'tank-v2', 'tank-v3'].includes(
      aiFactory.currentlyProducingUnit
    )
      ? 1
      : 0
    const totalTanks = aiTanks.length + tanksInProduction

    // Debug logging (enable temporarily to debug building issues)
    if (DEBUG_AI_BUILDING) {
      console.log(`AI ${aiPlayerId} building check: Power=${powerPlants.length}, VF=${vehicleFactories.length}, Refinery=${oreRefineries.length}, Budget=${aiFactory.budget}`)
    }

    let buildingType = null
    let cost = 0

    // Early economy - Power Plant and first Ore Refinery
    if (powerPlants.length === 0 && aiFactory.budget >= buildingData.powerPlant.cost) {
      buildingType = 'powerPlant'
      cost = buildingData.powerPlant.cost

    } else if (oreRefineries.length === 0 && aiFactory.budget >= buildingData.oreRefinery.cost) {
      buildingType = 'oreRefinery'
      cost = buildingData.oreRefinery.cost
    } else if (oreRefineries.length > 0 && gasStations.length === 0 && aiFactory.budget >= buildingData.gasStation.cost) {
      buildingType = 'gasStation'
      cost = buildingData.gasStation.cost

    // Production - Vehicle Factory for unit production
    } else if (vehicleFactories.length === 0 && aiFactory.budget >= buildingData.vehicleFactory.cost) {
      buildingType = 'vehicleFactory'
      cost = buildingData.vehicleFactory.cost
    } else if (aiBuildings.filter(b => b.type === 'vehicleWorkshop').length === 0) {
      // Build a vehicle workshop once a factory exists
      buildingType = 'vehicleWorkshop'
      cost = buildingData.vehicleWorkshop.cost
    } else if (hospitals.length === 0 && aiFactory.budget >= buildingData.hospital.cost) {
      buildingType = 'hospital'
      cost = buildingData.hospital.cost
    } else if (turrets.length < 3) {
      // Basic defense: choose turret based on budget
      const allowTurretGun = turretGunCount < 2 || totalTanks >= 4
      if (aiFactory.budget >= buildingData.rocketTurret.cost) {
        buildingType = 'rocketTurret'
        cost = buildingData.rocketTurret.cost
      } else if (allowTurretGun && aiFactory.budget >= buildingData.turretGunV3.cost) {
        buildingType = 'turretGunV3'
        cost = buildingData.turretGunV3.cost
      } else if (allowTurretGun && aiFactory.budget >= buildingData.turretGunV2.cost) {
        buildingType = 'turretGunV2'
        cost = buildingData.turretGunV2.cost
      } else if (allowTurretGun && aiFactory.budget >= buildingData.turretGunV1.cost) {
        buildingType = 'turretGunV1'
        cost = buildingData.turretGunV1.cost
      }
    } else if (radarStations.length === 0 && aiFactory.budget >= buildingData.radarStation.cost) {
      // Radar station for advanced defense and map control
      buildingType = 'radarStation'
      cost = buildingData.radarStation.cost
    } else if (rocketTurrets.length === 0 && radarStations.length > 0 && aiFactory.budget >= 4000) {
      // Early special defenses - build at least one of each before expansion
      buildingType = 'rocketTurret'
      cost = buildingData.rocketTurret.cost
    } else if (teslaCoils.length === 0 && radarStations.length > 0 && aiFactory.budget >= buildingData.teslaCoil.cost) {
      buildingType = 'teslaCoil'
      cost = buildingData.teslaCoil.cost
    } else if (artilleryTurrets.length === 0 && aiFactory.budget >= buildingData.artilleryTurret.cost) {
      buildingType = 'artilleryTurret'
      cost = buildingData.artilleryTurret.cost
    } else if (oreRefineries.length === 1 && aiHarvesters.length >= 4 && aiFactory.budget >= buildingData.oreRefinery.cost) {
      // Second refinery (max 2 before advanced buildings)
      buildingType = 'oreRefinery'
      cost = buildingData.oreRefinery.cost
    // Core support buildings (required before expansion)
    } else if (teslaCoils.length < 2 && radarStations.length > 0 && aiFactory.budget >= buildingData.teslaCoil.cost) {
      // Advanced defense (Tesla Coils require radar)
      buildingType = 'teslaCoil'
      cost = buildingData.teslaCoil.cost

    // Expansion - more production buildings (only after core support buildings)
    } else if (vehicleFactories.length < 2 && hospitals.length > 0 && radarStations.length > 0 && vehicleWorkshops.length > 0 && aiFactory.budget >= buildingData.vehicleFactory.cost) {
      buildingType = 'vehicleFactory'
      cost = buildingData.vehicleFactory.cost

    // Additional refineries (only after core support buildings and if harvesters justify it)
    } else if (oreRefineries.length < 3 && hospitals.length > 0 && radarStations.length > 0 && vehicleWorkshops.length > 0) {
      const maxHarvestersForRefineries = oreRefineries.length * 4 // 1:4 ratio (4 harvesters per refinery)
      const harvesterCountInProduction = aiFactory.currentlyProducingUnit === 'harvester' ? 1 : 0

      if (aiHarvesters.length + harvesterCountInProduction >= maxHarvestersForRefineries && aiFactory.budget >= buildingData.oreRefinery.cost) {
        buildingType = 'oreRefinery'
        cost = buildingData.oreRefinery.cost
      }
    } else if (turrets.length < 6) {
      // Advanced defense: tesla coils, then rocket turrets, then V3 turrets
      if (aiFactory.budget >= buildingData.teslaCoil.cost && teslaCoils.length < 3 && radarStations.length > 0) {
        buildingType = 'teslaCoil'
        cost = buildingData.teslaCoil.cost
      } else if (aiFactory.budget >= buildingData.rocketTurret.cost) {
        buildingType = 'rocketTurret'
        cost = buildingData.rocketTurret.cost
      } else if (aiFactory.budget >= buildingData.artilleryTurret.cost) {
        buildingType = 'artilleryTurret'
        cost = buildingData.artilleryTurret.cost
      } else {
        const allowTurretGun = turretGunCount < 2 || totalTanks >= 4
        if (allowTurretGun) {
          buildingType = 'turretGunV3'
          cost = buildingData.turretGunV3.cost
        }
      }
    // Phase 9: Power plants for high energy consumption
    } else if (powerPlants.length < 3 && aiFactory.budget >= buildingData.powerPlant.cost) {
      buildingType = 'powerPlant'
      cost = buildingData.powerPlant.cost
    }

    // Attempt to start building construction (don't place immediately)
    if (buildingType && aiFactory.budget >= cost) {
      // Try advanced positioning first, then fallback to simple positioning
      let position = findBuildingPosition(buildingType, mapGrid, units, gameState.buildings, factories, aiPlayerId)
      
      if (!position) {
        console.log(`AI ${aiPlayerId} could not find position for ${buildingType}, trying simpler placement`)
        position = findSimpleBuildingPosition(buildingType, mapGrid, factories, aiPlayerId)
      }

      if (position) {
        // Start construction process instead of placing immediately
        aiFactory.budget -= cost
        aiFactory.currentlyBuilding = buildingType
        aiFactory.buildStartTime = now
        // Build duration aligned with player: base 750ms * (cost/500)
        aiFactory.buildDuration = 750 * (cost / 500)
        aiFactory.buildingPosition = position // Store position for completion
        gameState[lastBuildingTimeKey] = now

        if (DEBUG_AI_BUILDING) {
          console.log(`AI ${aiPlayerId} started building ${buildingType} at position (${position.x}, ${position.y}) for $${cost}`)
        }
      } else {
        console.log(`AI ${aiPlayerId} failed to find any position for ${buildingType}`)
        gameState[lastBuildingTimeKey] = now
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
      if (canPlaceBuilding(buildingType, position.x, position.y, gameState.mapGrid || mapGrid, units, gameState.buildings, factories, aiPlayerId)) {
        const newBuilding = createBuilding(buildingType, position.x, position.y)
        newBuilding.owner = aiPlayerId
        gameState.buildings.push(newBuilding)
        updateDangerZoneMaps(gameState)
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
          updateDangerZoneMaps(gameState)
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

    // If the spawn factory was destroyed before production completed, cancel the spawn
    if (!spawnFactory || spawnFactory.health <= 0 || !gameState.buildings.includes(spawnFactory)) {
      if (DEBUG_AI_BUILDING) {
        console.log(`AI ${aiPlayerId} lost factory during ${unitType} production - cancelling`)
      }
    } else {
      const newUnit = spawnEnemyUnit(spawnFactory, unitType, units, mapGrid, gameState, aiFactory.unitBuildStartTime, aiPlayerId)

      if (newUnit) {
        units.push(newUnit)
      } else {
        console.warn(`Failed to spawn ${aiPlayerId} ${unitType}`)
      }

      if (DEBUG_AI_BUILDING) {
        console.log(`AI ${aiPlayerId} completed production of ${unitType}`)
      }
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
    
    // Don't produce units if already producing a unit
    if ( aiFactory && !aiFactory.currentlyProducingUnit && now - (gameState[lastProductionKey] || 0) >= 8000 ) {
      const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')
      const aiAmbulances = units.filter(u => u.owner === aiPlayerId && u.type === 'ambulance')
      const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
      const aiRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
      const hasHospital = aiBuildings.some(b => b.type === 'hospital')
      const rocketTurretsBuilt = aiBuildings.filter(b => b.type === 'rocketTurret').length
      const teslaCoilsBuilt = aiBuildings.filter(b => b.type === 'teslaCoil').length
      const artilleryTurretsBuilt = aiBuildings.filter(b => b.type === 'artilleryTurret').length
      const specialDefensesReady = rocketTurretsBuilt > 0 && teslaCoilsBuilt > 0 && artilleryTurretsBuilt > 0
      let unitType = 'tank_v1'

      // Enhanced production rules:
      // 1. Build up to 4 harvesters per refinery (strict limit)
      // 2. Always build ambulance if none exists and hospital is available
      // 3. Only build tanks if hospital exists (for crew support)
      // 4. Then build diverse combat units
      // 5. Focus on advanced units when budget is high
      // 6. Maintain harvester count but prioritize combat

      const MAX_HARVESTERS = aiRefineries.length * 4 // Strict 4 harvesters per refinery limit
      const harvesterCountInProduction = aiFactory.currentlyProducingUnit === 'harvester' ? 1 : 0
      const currentHarvesterTotal = aiHarvesters.length + harvesterCountInProduction
      const HIGH_BUDGET_THRESHOLD = 12000
      const VERY_HIGH_BUDGET_THRESHOLD = 20000
      const isHighBudget = aiFactory.budget >= HIGH_BUDGET_THRESHOLD
      const isVeryHighBudget = aiFactory.budget >= VERY_HIGH_BUDGET_THRESHOLD

      if (currentHarvesterTotal < MAX_HARVESTERS) {
        // Priority: Build up harvesters first, but strict limit of 4 per refinery
        unitType = 'harvester'
      } else if (hasHospital && aiAmbulances.length === 0) {
        // Always ensure at least one ambulance exists if hospital is available
        unitType = 'ambulance'
      } else {
        // We have enough harvesters and ambulance, hospital exists, now focus on diverse combat units
        const rand = Math.random()
        if (!specialDefensesReady) {
          // Delay tank production until key defenses are built
          unitType = 'none' // No combat units until defenses are ready
        } else if (isVeryHighBudget) {
          // Very high budget: Focus on elite units
          if (rand < 0.1) unitType = 'tank_v1'
          else if (rand < 0.3) unitType = 'tank-v2'
          else if (rand < 0.6) unitType = 'tank-v3'
          else unitType = 'rocketTank'
        } else if (isHighBudget) {
          // High budget: Balanced advanced units
          if (rand < 0.2) unitType = 'tank_v1'
          else if (rand < 0.5) unitType = 'tank-v2'
          else if (rand < 0.75) unitType = 'rocketTank'
          else unitType = 'tank-v3'
        } else {
          // Normal budget: Mix of basic and medium units
          if (rand < 0.5) unitType = 'tank_v1'
          else if (rand < 0.8) unitType = 'tank-v2'
          else unitType = 'rocketTank'
        }
      }
      // Determine cost based on unit type
      const cost = getUnitCost(unitType)
      
      if (unitType !== 'none' && aiFactory.budget >= cost) {
        // Find appropriate spawn factory for this unit type
        let spawnFactory = aiFactory // Default to main construction yard

        // Harvesters and other vehicle units should spawn from vehicle factories
        if (unitType === 'harvester' || unitType === 'tank_v1' || unitType === 'tank-v2' || unitType === 'tank-v3' || unitType === 'rocketTank' || unitType === 'ambulance') {
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

        // Determine cost based on unit type
        const cost = getUnitCost(unitType)
        // Record production details and delay spawning until build time completes
        aiFactory.budget -= cost
        aiFactory.currentlyProducingUnit = unitType
        aiFactory.unitBuildStartTime = now
        aiFactory.unitBuildDuration = 10000
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
  
  // --- Manage AI Crew Healing ---
  // Run crew management for this AI player
  const aiUnits = units.filter(u => u.owner === aiPlayerId)
  if (aiUnits.length > 0) {
    manageAICrewHealing(units, gameState, now)
  }
}, false)

export { updateAIPlayer }
