// aiComputeWorker.js - Web Worker for actual AI computations
// This worker handles all heavy AI processing to prevent blocking the main render loop

// Import AI computation modules
// Note: We'll use dynamic imports to handle potential module loading issues
let aiModules = null

// Worker state
let isProcessing = false
let processingStats = {
  totalIterations: 0,
  totalTime: 0,
  averageTime: 0,
  lastIterationTime: 0
}

// Initialize AI modules
async function initializeAIModules() {
  try {
    console.log('AI Compute Worker: Loading AI modules (worker-safe versions)...')
    
    // For now, we'll implement core AI logic directly in the worker
    // to avoid DOM dependencies from imports like sound.js, videoOverlay.js, etc.
    aiModules = {
      updateEnemyAI: (units, factories, bullets, mapGrid, gameState) => {
        // Core AI orchestration logic without DOM dependencies
        const occupancyMap = gameState.occupancyMap
        const now = performance.now()
        const humanPlayer = gameState.humanPlayer || 'player1'
        const playerCount = gameState.playerCount || 2
        const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
        const aiPlayers = allPlayers.filter(p => p !== humanPlayer)
        const targetedOreTiles = gameState.targetedOreTiles || {}
        
        aiPlayers.forEach(aiPlayerId => {
          workerUpdateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles)
        })
      }
    }

    console.log('AI Compute Worker: AI modules loaded successfully (worker-safe)')
    
    // Notify main thread that worker is ready
    self.postMessage({
      type: 'AI_COMPUTE_WORKER_READY',
      data: {
        modulesLoaded: Object.keys(aiModules).length,
        timestamp: performance.now()
      }
    })

  } catch (error) {
    console.error('AI Compute Worker: Failed to load AI modules:', error)
    
    self.postMessage({
      type: 'AI_COMPUTE_WORKER_ERROR',
      data: {
        error: error.message,
        stack: error.stack,
        phase: 'initialization'
      }
    })
  }
}

// Message handling from main thread
self.onmessage = function(e) {
  const { type, data } = e.data

  switch (type) {
    case 'INIT':
      initializeAIModules()
      break

    case 'PROCESS_AI':
      if (!isProcessing && aiModules) {
        processAI(data)
      } else if (isProcessing) {
        self.postMessage({
          type: 'AI_PROCESSING_SKIPPED',
          data: { reason: 'Already processing previous request' }
        })
      } else {
        self.postMessage({
          type: 'AI_PROCESSING_ERROR',
          data: { error: 'AI modules not initialized' }
        })
      }
      break

    case 'PROCESS_AI_CHUNK':
      if (!isProcessing && aiModules) {
        processAIChunk(data)
      }
      break

    case 'GET_PROCESSING_STATS':
      self.postMessage({
        type: 'AI_PROCESSING_STATS',
        data: processingStats
      })
      break

    case 'RESET_STATS':
      processingStats = {
        totalIterations: 0,
        totalTime: 0,
        averageTime: 0,
        lastIterationTime: 0
      }
      break

    default:
      console.warn('AI Compute Worker: Unknown message type:', type)
  }
}

/**
 * Process full AI computation
 * @param {Object} gameData - Complete game state snapshot
 */
async function processAI(gameData) {
  isProcessing = true
  const startTime = performance.now()

  try {
    const { units, factories, bullets, mapGrid, gameState } = gameData

    // Create deep copies to avoid modifying original data
    const processedUnits = JSON.parse(JSON.stringify(units))
    const processedFactories = JSON.parse(JSON.stringify(factories))
    const processedBullets = JSON.parse(JSON.stringify(bullets))
    const processedGameState = JSON.parse(JSON.stringify(gameState))

    // Execute the main AI orchestrator
    aiModules.updateEnemyAI(
      processedUnits,
      processedFactories,
      processedBullets,
      mapGrid,
      processedGameState
    )

    const endTime = performance.now()
    const processingTime = endTime - startTime

    // Update processing statistics
    updateProcessingStats(processingTime)

    // Send results back to main thread
    self.postMessage({
      type: 'AI_PROCESSING_COMPLETE',
      data: {
        units: processedUnits,
        factories: processedFactories,
        bullets: processedBullets,
        gameState: processedGameState,
        processingTime,
        startTime,
        endTime,
        stats: processingStats
      }
    })

  } catch (error) {
    const endTime = performance.now()
    const processingTime = endTime - startTime

    console.error('AI Compute Worker: Processing error:', error)

    self.postMessage({
      type: 'AI_PROCESSING_ERROR',
      data: {
        error: error.message,
        stack: error.stack,
        processingTime,
        phase: 'processing'
      }
    })
  } finally {
    isProcessing = false
  }
}

/**
 * Process AI in smaller chunks for better performance control
 * @param {Object} chunkData - Subset of game data to process
 */
async function processAIChunk(chunkData) {
  isProcessing = true
  const startTime = performance.now()

  try {
    const { chunkType, data, gameState } = chunkData

    let result = null

    switch (chunkType) {
      case 'AI_PLAYER':
        result = await processAIPlayerChunk(data, gameState)
        break

      case 'AI_UNITS':
        result = await processAIUnitsChunk(data, gameState)
        break

      case 'AI_STRATEGIES':
        result = await processAIStrategiesChunk(data, gameState)
        break

      case 'AI_BUILDING':
        result = await processAIBuildingChunk(data, gameState)
        break

      case 'AI_SPAWNER':
        result = await processAISpawnerChunk(data, gameState)
        break

      default:
        throw new Error(`Unknown chunk type: ${chunkType}`)
    }

    const endTime = performance.now()
    const processingTime = endTime - startTime

    updateProcessingStats(processingTime)

    self.postMessage({
      type: 'AI_CHUNK_COMPLETE',
      data: {
        chunkType,
        result,
        processingTime,
        startTime,
        endTime
      }
    })

  } catch (error) {
    const endTime = performance.now()
    const processingTime = endTime - startTime

    self.postMessage({
      type: 'AI_CHUNK_ERROR',
      data: {
        chunkType: chunkData.chunkType,
        error: error.message,
        stack: error.stack,
        processingTime
      }
    })
  } finally {
    isProcessing = false
  }
}

/**
 * Process AI player logic chunk
 */
async function processAIPlayerChunk(data, gameState) {
  const { playerId, units, factories, bullets, mapGrid, occupancyMap, targetedOreTiles } = data

  workerUpdateAIPlayer(
    playerId,
    units,
    factories,
    bullets,
    mapGrid,
    gameState,
    occupancyMap,
    performance.now(),
    targetedOreTiles
  )

  return {
    playerId,
    updatedUnits: units.filter(u => u.owner === playerId),
    updatedFactories: factories.filter(f => f.id === playerId),
    gameStateChanges: {
      money: gameState.money,
      powerSupply: gameState.powerSupply
    }
  }
}

/**
 * Process AI units behavior chunk
 */
async function processAIUnitsChunk(data, gameState) {
  const { units, allUnits, mapGrid, targetedOreTiles, ownerId } = data
  const now = performance.now()

  const processedUnits = units.map(unit => {
    const unitCopy = { ...unit }
    workerUpdateAIUnit(
      unitCopy,
      allUnits,
      gameState,
      mapGrid,
      now,
      ownerId,
      targetedOreTiles
    )
    return unitCopy
  })

  return {
    ownerId,
    processedUnits,
    processedCount: processedUnits.length
  }
}

/**
 * Process AI strategies chunk
 */
async function processAIStrategiesChunk(data, gameState) {
  // Basic strategic decision making
  const strategicDecisions = {}

  // Process each AI player's strategy
  for (const playerId of data.aiPlayerIds) {
    const playerUnits = data.units.filter(u => u.owner === playerId)
    const playerFactories = data.factories.filter(f => f.id === playerId)

    // Simple strategic analysis
    strategicDecisions[playerId] = {
      shouldExpand: playerUnits.length < 10,
      shouldDefend: playerUnits.filter(u => u.type.includes('tank')).length < 5,
      targetPriority: 'economy', // economy, military, expansion
      timestamp: performance.now()
    }
  }

  return {
    strategicDecisions,
    timestamp: performance.now()
  }
}

/**
 * Process AI building logic chunk
 */
async function processAIBuildingChunk(data, gameState) {
  const { playerId, mapGrid, occupancyMap, factories } = data

  // Simple building placement decisions
  const buildingDecisions = {
    recommendedBuildings: ['powerPlant', 'vehicleFactory', 'oreRefinery'],
    priority: 'infrastructure',
    timestamp: performance.now()
  }

  return {
    playerId,
    buildingDecisions,
    timestamp: performance.now()
  }
}

/**
 * Process AI spawner logic chunk
 */
async function processAISpawnerChunk(data, gameState) {
  const { playerId, factories, units, mapGrid } = data

  // Simple spawning decisions
  const spawningDecisions = {
    recommendedUnits: ['harvester', 'tank_v1', 'tank-v2'],
    priority: 'balanced',
    timestamp: performance.now()
  }

  return {
    playerId,
    spawningDecisions,
    timestamp: performance.now()
  }
}

/**
 * Update processing statistics
 * @param {number} processingTime - Time taken for this iteration
 */
function updateProcessingStats(processingTime) {
  processingStats.totalIterations++
  processingStats.totalTime += processingTime
  processingStats.lastIterationTime = processingTime
  processingStats.averageTime = processingStats.totalTime / processingStats.totalIterations
}

// Error handling for uncaught errors
self.onerror = function(error) {
  console.error('AI Compute Worker: Uncaught error:', error)
  
  self.postMessage({
    type: 'AI_COMPUTE_WORKER_ERROR',
    data: {
      error: error.message,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      phase: 'runtime'
    }
  })
}

// Worker-safe AI logic implementations (without DOM dependencies)

/**
 * Worker-safe building data (subset of buildingData without DOM imports)
 */
const workerBuildingData = {
  powerPlant: { width: 3, height: 3, cost: 2000, power: 200, health: 200 },
  oreRefinery: { width: 3, height: 3, cost: 2500, power: -30, health: 200 },
  vehicleFactory: { width: 3, height: 3, cost: 3000, power: -50, health: 300 },
  constructionYard: { width: 3, height: 3, cost: 5000, power: 50, health: 350 },
  turretGunV1: { width: 1, height: 1, cost: 1000, power: -10, health: 100 },
  turretGunV2: { width: 1, height: 1, cost: 2000, power: -15, health: 150 },
  turretGunV3: { width: 1, height: 1, cost: 3000, power: -20, health: 200 },
  rocketTurret: { width: 1, height: 1, cost: 4000, power: -25, health: 250 }
}

/**
 * Worker-safe AI player update function
 */
function workerUpdateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles) {
  const aiFactory = factories.find(f => f.id === aiPlayerId)
  
  // Check if AI player's construction yard still exists
  if (!aiFactory || aiFactory.destroyed || aiFactory.health <= 0) {
    return
  }

  // Define the keys we'll use for this AI player's state
  const lastBuildingTimeKey = `${aiPlayerId}LastBuildingTime`
  const lastProductionKey = `${aiPlayerId}LastProductionTime`

  // --- AI Building Construction ---
  if (now - (gameState[lastBuildingTimeKey] || 0) >= 10000 && aiFactory && aiFactory.budget > 1000 && gameState.buildings) {
    const aiBuildings = gameState.buildings.filter(b => b.owner === aiPlayerId)
    const powerPlants = aiBuildings.filter(b => b.type === 'powerPlant')
    const vehicleFactories = aiBuildings.filter(b => b.type === 'vehicleFactory')
    const oreRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
    const turrets = aiBuildings.filter(b => b.type.startsWith('turretGun') || b.type === 'rocketTurret')
    const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')

    let buildingType = null
    let cost = 0

    // Build order: Power Plant -> Vehicle Factory -> Ore Refinery -> Turrets
    if (powerPlants.length === 0) {
      buildingType = 'powerPlant'
      cost = workerBuildingData.powerPlant.cost
    } else if (vehicleFactories.length === 0) {
      buildingType = 'vehicleFactory'
      cost = workerBuildingData.vehicleFactory.cost
    } else if (oreRefineries.length === 0) {
      buildingType = 'oreRefinery'
      cost = workerBuildingData.oreRefinery.cost
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
      // More complex building logic
      const aiRefineries = aiBuildings.filter(b => b.type === 'oreRefinery')
      const maxHarvestersForRefineries = aiRefineries.length * 4
      
      if (aiHarvesters.length >= maxHarvestersForRefineries && aiFactory.budget >= workerBuildingData.oreRefinery.cost) {
        buildingType = 'oreRefinery'
        cost = workerBuildingData.oreRefinery.cost
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
      }
    }

    // Attempt to start building construction
    if (buildingType && aiFactory.budget >= cost) {
      const position = workerFindBuildingPosition(buildingType, mapGrid, units, gameState.buildings, factories, aiPlayerId)
      if (position) {
        aiFactory.budget -= cost
        aiFactory.currentlyBuilding = buildingType
        aiFactory.buildStartTime = now
        aiFactory.buildDuration = 5000
        aiFactory.buildingPosition = position
        gameState[lastBuildingTimeKey] = now
      } else {
        gameState[lastBuildingTimeKey] = now
      }
    }
  }

  // Complete building construction
  if (aiFactory && aiFactory.currentlyBuilding && now - aiFactory.buildStartTime > aiFactory.buildDuration) {
    const buildingType = aiFactory.currentlyBuilding
    const position = aiFactory.buildingPosition
    
    if (position) {
      if (workerCanPlaceBuilding(buildingType, position.x, position.y, mapGrid, units, gameState.buildings, factories, aiPlayerId)) {
        const newBuilding = workerCreateBuilding(buildingType, position.x, position.y, aiPlayerId)
        gameState.buildings.push(newBuilding)
        workerPlaceBuilding(newBuilding, mapGrid)
      } else {
        aiFactory.budget += workerBuildingData[buildingType]?.cost || 0
      }
    }
    
    aiFactory.currentlyBuilding = null
    aiFactory.buildingPosition = null
  }

  // --- AI Unit Production ---
  if (gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'powerPlant').length > 0 &&
      gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'vehicleFactory').length > 0 &&
      gameState.buildings.filter(b => b.owner === aiPlayerId && b.type === 'oreRefinery').length > 0) {
    
    if (now - (gameState[lastProductionKey] || 0) >= 10000 && aiFactory) {
      const aiHarvesters = units.filter(u => u.owner === aiPlayerId && u.type === 'harvester')
      const aiCombatUnits = units.filter(u => u.owner === aiPlayerId && 
        (u.type === 'tank' || u.type === 'tank_v1' || u.type === 'tank-v2' || u.type === 'tank-v3' || u.type === 'rocketTank'))
      
      let unitType = 'tank_v1'
      let cost = 1000
      
      const MAX_HARVESTERS = 8
      const HIGH_BUDGET_THRESHOLD = 15000
      const isHighBudget = aiFactory.budget >= HIGH_BUDGET_THRESHOLD
      
      if (aiHarvesters.length < MAX_HARVESTERS) {
        unitType = 'harvester'
        cost = 500
      } else {
        const rand = Math.random()
        
        if (isHighBudget) {
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
        let spawnFactory = aiFactory
        
        if (unitType === 'harvester' || unitType === 'tank_v1' || unitType === 'tank-v2' || unitType === 'tank-v3' || unitType === 'rocketTank') {
          const aiVehicleFactories = gameState.buildings.filter(
            b => b.type === 'vehicleFactory' && b.owner === aiPlayerId
          )
          
          if (aiVehicleFactories.length > 0) {
            const factoryIndexKey = `next${aiPlayerId}VehicleFactoryIndex`
            gameState[factoryIndexKey] = gameState[factoryIndexKey] ?? 0
            spawnFactory = aiVehicleFactories[gameState[factoryIndexKey] % aiVehicleFactories.length]
            gameState[factoryIndexKey]++
          } else {
            gameState[lastProductionKey] = now
            return
          }
        }
        
        const newUnit = workerSpawnEnemyUnit(spawnFactory, unitType, units, mapGrid, gameState, now, aiPlayerId)
        if (newUnit) {
          units.push(newUnit)
          aiFactory.budget -= cost
          aiFactory.currentlyBuilding = unitType
          aiFactory.buildStartTime = now
          aiFactory.buildDuration = 5000
          gameState[lastProductionKey] = now
        } else {
          gameState[lastProductionKey] = now
        }
      }
    }
  }

  // --- Update AI Units ---
  units.forEach(unit => {
    if (unit.owner !== aiPlayerId) return
    workerUpdateAIUnit(unit, units, gameState, mapGrid, now, aiPlayerId, targetedOreTiles)
  })
}

/**
 * Worker-safe building helper functions
 */
function workerFindBuildingPosition(buildingType, mapGrid, units, buildings, factories, aiPlayerId) {
  const buildingData = workerBuildingData[buildingType]
  if (!buildingData) return null

  const MAP_WIDTH = mapGrid[0].length
  const MAP_HEIGHT = mapGrid.length

  // Try to find a position near AI factory
  const aiFactory = factories.find(f => f.id === aiPlayerId)
  if (!aiFactory) return null

  // Search in expanding circles around the factory
  for (let radius = 5; radius < 30; radius += 3) {
    for (let angle = 0; angle < 360; angle += 30) {
      const rad = (angle * Math.PI) / 180
      const x = Math.round(aiFactory.x + Math.cos(rad) * radius)
      const y = Math.round(aiFactory.y + Math.sin(rad) * radius)

      if (x >= 0 && y >= 0 && x + buildingData.width <= MAP_WIDTH && y + buildingData.height <= MAP_HEIGHT) {
        if (workerCanPlaceBuilding(buildingType, x, y, mapGrid, units, buildings, factories, aiPlayerId)) {
          return { x, y }
        }
      }
    }
  }

  return null
}

function workerCanPlaceBuilding(buildingType, x, y, mapGrid, units, buildings, factories, aiPlayerId) {
  const buildingData = workerBuildingData[buildingType]
  if (!buildingData) return false

  // Check map bounds
  if (x < 0 || y < 0 || x + buildingData.width > mapGrid[0].length || y + buildingData.height > mapGrid.length) {
    return false
  }

  // Check terrain
  for (let dy = 0; dy < buildingData.height; dy++) {
    for (let dx = 0; dx < buildingData.width; dx++) {
      const tile = mapGrid[y + dy][x + dx]
      if (tile.type === 'water' || tile.type === 'ore' || tile.building) {
        return false
      }
    }
  }

  // Check for unit collisions
  for (const unit of units) {
    if (unit.x >= x && unit.x < x + buildingData.width &&
        unit.y >= y && unit.y < y + buildingData.height) {
      return false
    }
  }

  // Check for building collisions
  for (const building of buildings) {
    if (!(building.x + building.width <= x || building.x >= x + buildingData.width ||
          building.y + building.height <= y || building.y >= y + buildingData.height)) {
      return false
    }
  }

  return true
}

function workerCreateBuilding(buildingType, x, y, owner) {
  const buildingData = workerBuildingData[buildingType]
  return {
    id: `building_${Date.now()}_${Math.random()}`,
    type: buildingType,
    x: x,
    y: y,
    width: buildingData.width,
    height: buildingData.height,
    health: buildingData.health,
    maxHealth: buildingData.health,
    owner: owner,
    power: buildingData.power,
    constructionProgress: 100,
    isActive: true,
    destroyed: false
  }
}

function workerPlaceBuilding(building, mapGrid) {
  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      if (building.y + dy < mapGrid.length && building.x + dx < mapGrid[0].length) {
        mapGrid[building.y + dy][building.x + dx].building = building.id
      }
    }
  }
}

function workerSpawnEnemyUnit(factory, unitType, units, mapGrid, gameState, timestamp, ownerId) {
  // Basic unit spawning logic without sound/visual effects
  const spawnPositions = [
    { x: factory.x - 1, y: factory.y },
    { x: factory.x + factory.width, y: factory.y },
    { x: factory.x, y: factory.y - 1 },
    { x: factory.x, y: factory.y + factory.height }
  ]

  for (const pos of spawnPositions) {
    if (pos.x >= 0 && pos.y >= 0 && pos.x < mapGrid[0].length && pos.y < mapGrid.length) {
      const tile = mapGrid[pos.y][pos.x]
      if (tile.type !== 'water' && !tile.building) {
        // Check for unit collisions
        const hasCollision = units.some(unit => 
          Math.abs(unit.x - pos.x) < 1 && Math.abs(unit.y - pos.y) < 1
        )
        
        if (!hasCollision) {
          return {
            id: `unit_${timestamp}_${Math.random()}`,
            type: unitType,
            x: pos.x,
            y: pos.y,
            health: 100,
            maxHealth: 100,
            owner: ownerId,
            target: null,
            path: [],
            state: 'idle',
            lastMoveTime: 0,
            attackCooldown: 0,
            lastAttackTime: 0
          }
        }
      }
    }
  }

  return null
}

function workerUpdateAIUnit(unit, units, gameState, mapGrid, now, aiPlayerId, targetedOreTiles) {
  // Basic AI unit behavior without complex pathfinding or effects
  if (!unit || unit.health <= 0) return

  // Basic harvester logic
  if (unit.type === 'harvester') {
    if (!unit.target || unit.state === 'idle') {
      // Find nearest ore
      let nearestOre = null
      let nearestDistance = Infinity

      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[0].length; x++) {
          const tile = mapGrid[y][x]
          if (tile.type === 'ore' && tile.ore > 0) {
            const distance = Math.abs(unit.x - x) + Math.abs(unit.y - y)
            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestOre = { x, y }
            }
          }
        }
      }

      if (nearestOre) {
        unit.target = nearestOre
        unit.state = 'moving'
      }
    }

    // Simple movement towards target
    if (unit.target && unit.state === 'moving') {
      const dx = unit.target.x - unit.x
      const dy = unit.target.y - unit.y
      
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        // Reached target
        unit.state = 'harvesting'
        unit.target = null
      } else {
        // Move towards target
        if (now - unit.lastMoveTime > 500) {
          if (Math.abs(dx) > Math.abs(dy)) {
            unit.x += dx > 0 ? 0.5 : -0.5
          } else {
            unit.y += dy > 0 ? 0.5 : -0.5
          }
          unit.lastMoveTime = now
        }
      }
    }
  }

  // Basic combat unit logic
  if (unit.type.includes('tank') || unit.type === 'rocketTank') {
    if (!unit.target || unit.state === 'idle') {
      // Find nearest enemy
      const enemyUnits = units.filter(u => u.owner !== aiPlayerId && u.health > 0)
      let nearestEnemy = null
      let nearestDistance = Infinity

      for (const enemy of enemyUnits) {
        const distance = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestEnemy = enemy
        }
      }

      if (nearestEnemy) {
        unit.target = nearestEnemy
        unit.state = 'moving'
      }
    }

    // Simple movement and combat
    if (unit.target && unit.target.health > 0) {
      const dx = unit.target.x - unit.x
      const dy = unit.target.y - unit.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance <= 3) {
        // In range, attack
        if (now - unit.lastAttackTime > 2000) {
          unit.target.health -= 25
          unit.lastAttackTime = now
        }
      } else {
        // Move closer
        if (now - unit.lastMoveTime > 500) {
          if (Math.abs(dx) > Math.abs(dy)) {
            unit.x += dx > 0 ? 0.5 : -0.5
          } else {
            unit.y += dy > 0 ? 0.5 : -0.5
          }
          unit.lastMoveTime = now
        }
      }
    } else {
      unit.target = null
      unit.state = 'idle'
    }
  }
}

// Initialize the worker
console.log('AI Compute Worker: Initializing...')
self.postMessage({
  type: 'AI_COMPUTE_WORKER_INITIALIZED',
  data: {
    timestamp: performance.now()
  }
})
