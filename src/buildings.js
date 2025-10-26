// Building configuration and management
import { playSound } from './sound.js'
import { showNotification } from './ui/notifications.js'
import { gameState } from './gameState.js'
import { logPerformance } from './performanceUtils.js'
import { PLAYER_POSITIONS, MAP_TILES_X, MAP_TILES_Y, MAX_BUILDING_GAP_TILES } from './config.js'
import { updateDangerZoneMaps } from './game/dangerZoneMap.js'
import { ensureServiceRadius } from './utils/serviceRadius.js'

// Building dimensions and costs
export const buildingData = {
  powerPlant: {
    width: 3,
    height: 3,
    cost: 2000,
    power: 200,
    image: 'power_plant.webp',
    displayName: 'Power Plant',
    health: 200,
    smokeSpots: [
      { x: 80, y: 20 },
      { x: 130, y: 40 }
    ]
  },
  oreRefinery: {
    width: 3,
    height: 3,
    cost: 2500,
    power: -150,
    image: 'ore_refinery.webp',
    displayName: 'Ore Refinery',
    health: 200,
    smokeSpots: [
      { x: 55, y: 35 },
      { x: 78, y: 12 }
    ]
  },
  vehicleFactory: {
    width: 3,
    height: 3,
    cost: 3000,
    power: -50,
    image: 'vehicle_factory.webp',
    displayName: 'Vehicle Factory',
    health: 300,
    smokeSpots: []
  },
  vehicleWorkshop: {
    width: 3,
    height: 3,
    cost: 3000,
    power: -20,
    image: 'vehicle_workshop.webp',
    displayName: 'Vehicle Workshop',
    health: 300,
    armor: 3,
    smokeSpots: []
  },
  constructionYard: {
    width: 3,
    height: 3,
    cost: 5000,
    power: 50,
    image: 'construction_yard.webp',
    displayName: 'Construction Yard',
    health: 350,
    smokeSpots: []
  },
  radarStation: {
    width: 2,
    height: 2,
    cost: 1500,
    power: -50,
    image: 'radar_station.webp',
    displayName: 'Radar Station',
    health: 200,
    smokeSpots: []
  },
  hospital: {
    width: 3,
    height: 3,
    cost: 4000,
    power: -50,
    image: 'hospital.webp',
    displayName: 'Hospital',
    health: 200,
    smokeSpots: []
  },
  gasStation: {
    width: 3,
    height: 3,
    cost: 2000,
    power: -30,
    image: 'gas_station.webp',
    displayName: 'Gas Station',
    health: 50,
    smokeSpots: []
  },
  turretGunV1: {
    width: 1,
    height: 1,
    cost: 1200,
    power: -10,
    image: 'turret_gun_v1.webp',
    displayName: 'Turret Gun V1',
    health: 300,
    smokeSpots: [],
    // Add combat properties
    fireRange: 10, // 50% more than tank range (TANK_FIRE_RANGE + 50%)
    fireCooldown: 3000, // Same as regular tank
    damage: 10, // Reduced by 50% (was 20)
    armor: 1,
    projectileType: 'bullet',
    projectileSpeed: 12 // 4x faster (was 3)
  },
  turretGunV2: {
    width: 1,
    height: 1,
    cost: 2000,
    power: -20,
    image: 'turret_gun_v2.webp',
    displayName: 'Turret Gun V2',
    health: 300,
    smokeSpots: [],
    // Add combat properties
    fireRange: 10, // 50% more than tank range
    fireCooldown: 3000,
    damage: 12, // Reduced by 50% (was 24)
    armor: 1,
    projectileType: 'bullet',
    projectileSpeed: 16, // 4x faster (was 4)
    burstFire: true,
    burstCount: 2,
    burstDelay: 150 // ms between burst shots
  },
  turretGunV3: {
    width: 1,
    height: 1,
    cost: 3000,
    power: -30,
    image: 'turret_gun_v3.webp',
    displayName: 'Turret Gun V3',
    health: 300,
    smokeSpots: [],
    // Add combat properties
    fireRange: 12, // Even more range
    fireCooldown: 3500, // Faster firing
    damage: 15, // Reduced by 50% (was 30)
    armor: 1.5,
    projectileType: 'bullet',
    projectileSpeed: 15,
    burstFire: true, // Special feature: fires 3 shots in quick succession
    burstCount: 3,
    burstDelay: 150 // ms between burst shots
  },
  rocketTurret: {
    width: 2,
    height: 2,
    cost: 4000,
    power: -20,
    image: 'rocket_turret.webp',
    displayName: 'Rocket Turret',
    health: 200,
    requiresRadar: true,
    smokeSpots: [],
    // Add combat properties
    fireRange: 16,
    fireCooldown: 6000, // 3 seconds between shots
    damage: 18,
    armor: 2, // 2x the armor of a tank
    projectileType: 'rocket',
    projectileSpeed: 5,
    burstFire: true, // Special feature: fires 4 shots in quick succession
    burstCount: 4,
    burstDelay: 500 // ms between burst shots
  },
  teslaCoil: {
    width: 2,
    height: 2,
    cost: 5000,
    power: -60,
    image: 'tesla_coil.webp',
    displayName: 'Tesla Coil',
    health: 250,
    requiresRadar: true,
    smokeSpots: [],
    fireRange: 20, // in tiles
    fireCooldown: 8000, // ms
    damage: 5, // Tesla coil does not deal direct damage
    armor: 2,
    projectileType: 'tesla',
    projectileSpeed: 0,
    isTeslaCoil: true
  },
  artilleryTurret: {
    width: 2,
    height: 2,
    cost: 4000,
    power: -45,
    image: 'artillery_turret.webp',
    displayName: 'Artillery Turret',
    health: 300,
    smokeSpots: [],
    fireRange: 36,
    minFireRange: 5, // Units closer than 5 tiles cannot be attacked
    fireCooldown: 7000, // 7 seconds between shots
    damage: 100, // 500% of a tank's base damage
    armor: 2,
    projectileType: 'artillery',
    projectileSpeed: 3
  },
  concreteWall: {
    width: 1,
    height: 1,
    cost: 100,
    power: 0,
    image: 'concrete_wall.webp',
    displayName: 'Concrete Wall',
    health: 200,
    smokeSpots: []
  }
}

export function createBuilding(type, x, y) {
  if (!buildingData[type]) return null

  const data = buildingData[type]

  const building = {
    type,
    x,
    y,
    width: data.width,
    height: data.height,
    health: data.health,
    maxHealth: data.health,
    power: data.power,
    isBuilding: true,
    owner: 'neutral', // Default owner, should be set explicitly when added to gameState
    // Timestamp for construction animation
    constructionStartTime: performance.now(),
    constructionFinished: false
  }

  // Initialize rally point for vehicle factories and workshops
  if (type === 'vehicleFactory' || type === 'vehicleWorkshop') {
    building.rallyPoint = null
  }

  // Initialize service radius for support buildings
  ensureServiceRadius(building)

  // Add combat properties for defensive buildings (including teslaCoil)
  if (type === 'rocketTurret' || type.startsWith('turretGun') || type === 'teslaCoil' || type === 'artilleryTurret') {
    building.fireRange = data.fireRange
    building.minFireRange = data.minFireRange || 0
    building.fireCooldown = data.fireCooldown
    building.damage = data.damage
    building.armor = data.armor || 1
    building.projectileType = data.projectileType
    building.projectileSpeed = data.projectileSpeed
    building.lastShotTime = 0

    // Set initial turret direction towards nearest enemy base for defensive buildings
    if (data.fireRange && (building.type.startsWith('turretGun') || building.type === 'rocketTurret' || building.type === 'artilleryTurret')) {
      building.turretDirection = calculateInitialTurretDirection(building.x, building.y, building.owner)
    } else {
      building.turretDirection = 0 // Direction the turret is facing
    }

    building.targetDirection = 0 // Direction the turret should face
    if (data.isTeslaCoil) {
      building.isTeslaCoil = true
      building.teslaState = 'idle'
      building.teslaChargeStartTime = 0
      building.teslaFireStartTime = 0
    }
    if (building.type === 'artilleryTurret') {
      building.isArtillery = true
    }
    building.holdFire = false
    building.forcedAttackTarget = null
    // Add burst fire capabilities
    if (data.burstFire) {
      building.burstFire = true
      building.burstCount = data.burstCount || 3
      building.burstDelay = data.burstDelay || 150
      building.currentBurst = 0
      building.lastBurstTime = 0
    }
  }

  return building
}

/**
 * Calculate initial turret direction towards the nearest enemy base
 * @param {number} buildingX - Building X position in tiles
 * @param {number} buildingY - Building Y position in tiles
 * @param {string} owner - Building owner ('player' or enemy player ID)
 * @returns {number} Angle in radians pointing towards nearest enemy base
 */
function calculateInitialTurretDirection(buildingX, buildingY, owner) {
  const buildingCenterX = buildingX + 0.5 // Center of building tile
  const buildingCenterY = buildingY + 0.5

  let nearestEnemyDistance = Infinity
  let targetDirection = 0

  // Check all player positions for enemies
  Object.entries(PLAYER_POSITIONS).forEach(([playerId, position]) => {
    // Skip if this is the same owner
    if (playerId === owner || (owner === 'player' && playerId === 'player1')) {
      return
    }

    // For human player, all other players are enemies
    // For AI players, human player is the enemy
    const isEnemy = (owner === 'player' && playerId !== 'player1') ||
                   (owner !== 'player' && playerId === 'player1')

    if (isEnemy) {
      const enemyX = position.x * MAP_TILES_X
      const enemyY = position.y * MAP_TILES_Y
      const distance = Math.hypot(enemyX - buildingCenterX, enemyY - buildingCenterY)

      if (distance < nearestEnemyDistance) {
        nearestEnemyDistance = distance
        targetDirection = Math.atan2(enemyY - buildingCenterY, enemyX - buildingCenterX)
      }
    }
  })

  return targetDirection
}

// Helper function to check if a position is within the configured proximity range of any existing player building
// Uses Chebyshev distance so diagonal gaps respect the same maximum spacing as orthogonal gaps
export function isNearExistingBuilding(tileX, tileY, buildings, factories, maxDistance = MAX_BUILDING_GAP_TILES, owner = 'player') {
  // First check factories
  if (factories && factories.length > 0) {
    for (const factory of factories) {
      // Only consider factories belonging to the same owner
      if (factory.id === owner || factory.owner === owner) {
        // Calculate the shortest distance from the new position to any tile of the factory
        for (let bY = factory.y; bY < factory.y + factory.height; bY++) {
          for (let bX = factory.x; bX < factory.x + factory.width; bX++) {
            const chebyshevDistance = Math.max(
              Math.abs(tileX - bX),
              Math.abs(tileY - bY)
            )

            if (chebyshevDistance <= maxDistance) {
              return true
            }
          }
        }
      }
    }
  }

  // Then check buildings
  if (buildings && buildings.length > 0) {
    for (const building of buildings) {
      // Skip buildings not belonging to the same owner
      if (building.owner !== owner) {
        continue
      }

      // Calculate the shortest distance from the new position to any tile of the existing building
      for (let bY = building.y; bY < building.y + building.height; bY++) {
        for (let bX = building.x; bX < building.x + building.width; bX++) {
          const chebyshevDistance = Math.max(
            Math.abs(tileX - bX),
            Math.abs(tileY - bY)
          )

          if (chebyshevDistance <= maxDistance) {
            return true
          }
        }
      }
    }
  }

  return false
}

// Check if a building can be placed at given coordinates
export function canPlaceBuilding(type, tileX, tileY, mapGrid, units, buildings, factories, owner = 'player') {
  if (!buildingData[type]) return false

  // Validate mapGrid parameter
  if (!mapGrid || !Array.isArray(mapGrid) || mapGrid.length === 0 || !mapGrid[0]) {
    console.warn('canPlaceBuilding: Invalid mapGrid provided', { mapGrid, type, tileX, tileY })
    return false
  }

  const width = buildingData[type].width
  const height = buildingData[type].height

  const isFactoryOrRefinery = type === 'vehicleFactory' || type === 'oreRefinery' || type === 'vehicleWorkshop'

  // Check map boundaries
  if (tileX < 0 || tileY < 0 ||
      tileX + width > mapGrid[0].length ||
      tileY + height > mapGrid.length) {
    return false
  }

  // Check if ANY tile of the building is within range of an existing building
  let isAnyTileInRange = false
  for (let y = tileY; y < tileY + height; y++) {
    for (let x = tileX; x < tileX + width; x++) {
      if (isNearExistingBuilding(x, y, buildings, factories, MAX_BUILDING_GAP_TILES, owner)) {
        isAnyTileInRange = true
        break
      }
    }
    if (isAnyTileInRange) break
  }

  // If no tile is in range, return false
  if (!isAnyTileInRange) {
    return false
  }

  // Check if any tile is blocked
  for (let y = tileY; y < tileY + height; y++) {
    for (let x = tileX; x < tileX + width; x++) { // FIXED: use x in condition instead of y
      // Check map terrain
      if (mapGrid[y][x].type === 'water' ||
          mapGrid[y][x].type === 'rock' ||
          mapGrid[y][x].seedCrystal ||
          mapGrid[y][x].building ||
          (!isFactoryOrRefinery && mapGrid[y][x].noBuild)) {
        return false
      }

      // Check for units at this position
      const unitsAtTile = units.filter(unit =>
        Math.floor(unit.x / 32) === x &&
        Math.floor(unit.y / 32) === y
      )

      if (unitsAtTile.length > 0) {
        return false
      }
    }
  }

  // Additional protection area checks for factories and refineries
  if (isFactoryOrRefinery) {
    // Space directly below must be free of buildings
    const belowY = tileY + height
    if (belowY < mapGrid.length) {
      for (let x = tileX; x < tileX + width; x++) {
        if (mapGrid[belowY][x].building) {
          return false
        }
      }
    }

    // For vehicle workshop, also check the waiting area (2 tiles below)
    if (type === 'vehicleWorkshop') {
      const waitingY = tileY + height + 1
      if (waitingY < mapGrid.length) {
        for (let x = tileX; x < tileX + width; x++) {
          if (mapGrid[waitingY][x].building) {
            return false
          }
        }
      }
    }

    if (type === 'oreRefinery') {
      // 1 tile border around refinery must be free of buildings
      for (let y = tileY - 1; y <= tileY + height; y++) {
        for (let x = tileX - 1; x <= tileX + width; x++) {
          if (y < 0 || x < 0 || y >= mapGrid.length || x >= mapGrid[0].length) continue
          if (x >= tileX && x < tileX + width && y >= tileY && y < tileY + height) continue
          if (mapGrid[y][x].building) {
            return false
          }
        }
      }
    }
  }

  return true
}

// Check individual tile validity for coloring the placement overlay
export function isTileValid(tileX, tileY, mapGrid, _units, _buildings, _factories, buildingType = null) {
  // Out of bounds
  if (tileX < 0 || tileY < 0 ||
      tileX >= mapGrid[0].length ||
      tileY >= mapGrid.length) {
    return false
  }

  // Invalid terrain
  const isFactoryOrRefinery =
    buildingType === 'vehicleFactory' || buildingType === 'oreRefinery' || buildingType === 'vehicleWorkshop'

  if (mapGrid[tileY][tileX].type === 'water' ||
      mapGrid[tileY][tileX].type === 'rock' ||
      mapGrid[tileY][tileX].seedCrystal ||
      mapGrid[tileY][tileX].building ||
      (!isFactoryOrRefinery && mapGrid[tileY][tileX].noBuild)) {
    return false
  }

  // Check for units
  const unitsAtTile = _units.filter(unit =>
    Math.floor(unit.x / 32) === tileX &&
    Math.floor(unit.y / 32) === tileY
  )

  return unitsAtTile.length === 0
}

// Place building in the map grid
export function placeBuilding(building, mapGrid, occupancyMap = gameState.occupancyMap) {
  // Create an array to store original tile types
  building.originalTiles = []

  for (let y = building.y; y < building.y + building.height; y++) {
    building.originalTiles[y - building.y] = []

    for (let x = building.x; x < building.x + building.width; x++) {
      // Store the original tile type before changing it
      building.originalTiles[y - building.y][x - building.x] = mapGrid[y][x].type

      // Mark tile as having a building (for collision detection) but preserve the original tile type for rendering
      mapGrid[y][x].building = building
      if (occupancyMap && occupancyMap[y] && occupancyMap[y][x] !== undefined) {
        occupancyMap[y][x] = (occupancyMap[y][x] || 0) + 1
      }

      // Remove any ore from tiles where buildings are placed
      if (mapGrid[y][x].ore) {
        mapGrid[y][x].ore = false
        // Clear any cached texture variations for this tile to force re-render
        mapGrid[y][x].textureVariation = null
      }

      // DON'T change the tile type - keep the original background texture visible
      // mapGrid[y][x].type = 'building' // REMOVED: This was causing solid color rendering
    }
  }

  // Reserve tiles around certain buildings for pathing but keep them passable
  const addNoBuild = (x, y) => {
    if (!mapGrid[y] || !mapGrid[y][x]) return
    mapGrid[y][x].noBuild = (mapGrid[y][x].noBuild || 0) + 1
  }

  if (building.type === 'vehicleFactory' || building.type === 'oreRefinery' || building.type === 'vehicleWorkshop') {
    const belowY = building.y + building.height
    if (belowY < mapGrid.length) {
      for (let x = building.x; x < building.x + building.width; x++) {
        addNoBuild(x, belowY)
      }
    }

    // For vehicle workshop, also reserve an additional row for waiting area
    if (building.type === 'vehicleWorkshop') {
      const waitingY = building.y + building.height + 1
      if (waitingY < mapGrid.length) {
        for (let x = building.x; x < building.x + building.width; x++) {
          addNoBuild(x, waitingY)
        }
      }
    }
  }

  if (building.type === 'oreRefinery') {
    for (let y = building.y - 1; y <= building.y + building.height; y++) {
      for (let x = building.x - 1; x <= building.x + building.width; x++) {
        if (y >= 0 && x >= 0 && y < mapGrid.length && x < mapGrid[0].length) {
          if (x < building.x || x >= building.x + building.width ||
              y < building.y || y >= building.y + building.height) {
            addNoBuild(x, y)
          }
        }
      }
    }
  }
}

// Remove building from the map grid: restore original tiles and clear building flag
export function clearBuildingFromMapGrid(building, mapGrid, occupancyMap = gameState.occupancyMap) {
  for (let y = building.y; y < building.y + building.height; y++) {
    for (let x = building.x; x < building.x + building.width; x++) {
      if (mapGrid[y] && mapGrid[y][x]) {
        // Restore the original tile type if it was saved, otherwise default to 'land'
        if (building.originalTiles &&
            building.originalTiles[y - building.y] &&
            building.originalTiles[y - building.y][x - building.x]) {
          mapGrid[y][x].type = building.originalTiles[y - building.y][x - building.x]
        } else {
          mapGrid[y][x].type = 'land'
          // Make sure ore property exists when restoring tiles
          if (mapGrid[y][x].ore === undefined) {
            mapGrid[y][x].ore = false
          }
        }
        // Clear any building reference to unblock this tile for pathfinding
        delete mapGrid[y][x].building
        if (occupancyMap && occupancyMap[y] && occupancyMap[y][x] !== undefined) {
          occupancyMap[y][x] = Math.max(0, (occupancyMap[y][x] || 0) - 1)
        }
      }
    }
  }

  const removeNoBuild = (x, y) => {
    if (mapGrid[y] && mapGrid[y][x] && mapGrid[y][x].noBuild) {
      mapGrid[y][x].noBuild--
      if (mapGrid[y][x].noBuild <= 0) {
        delete mapGrid[y][x].noBuild
      }
    }
  }

  if (building.type === 'vehicleFactory' || building.type === 'oreRefinery' || building.type === 'vehicleWorkshop') {
    const belowY = building.y + building.height
    if (belowY < mapGrid.length) {
      for (let x = building.x; x < building.x + building.width; x++) {
        removeNoBuild(x, belowY)
      }
    }

    // For vehicle workshop, also clean up the waiting area
    if (building.type === 'vehicleWorkshop') {
      const waitingY = building.y + building.height + 1
      if (waitingY < mapGrid.length) {
        for (let x = building.x; x < building.x + building.width; x++) {
          removeNoBuild(x, waitingY)
        }
      }
    }
  }

  if (building.type === 'oreRefinery') {
    for (let y = building.y - 1; y <= building.y + building.height; y++) {
      for (let x = building.x - 1; x <= building.x + building.width; x++) {
        if (y >= 0 && x >= 0 && y < mapGrid.length && x < mapGrid[0].length) {
          if (x < building.x || x >= building.x + building.width ||
              y < building.y || y >= building.y + building.height) {
            removeNoBuild(x, y)
          }
        }
      }
    }
  }
}

// Update the game's power supply
export function updatePowerSupply(buildings, gameState) {
  const prevPlayerPower = gameState.playerPowerSupply || 0
  const prevEnemyPower = gameState.enemyPowerSupply || 0

  // Player power calculation
  let playerTotalPower = 0
  let playerTotalProduction = 0
  let playerTotalConsumption = 0

  // Enemy power calculation
  let enemyTotalPower = 0
  let enemyTotalProduction = 0
  let enemyTotalConsumption = 0

  // Track if player has a radar station
  let playerHasRadarStation = false

  // Add main factory power supply (+50) for each player if their factory is alive
  if (gameState.factories) {
    gameState.factories.forEach(factory => {
      if (factory.health > 0) {
        const factoryPower = buildingData.constructionYard.power // Use the building data value (+50)
        if (factory.owner === gameState.humanPlayer) {
          playerTotalPower += factoryPower
          playerTotalProduction += factoryPower
        } else if (factory.owner !== gameState.humanPlayer) {
          enemyTotalPower += factoryPower
          enemyTotalProduction += factoryPower
        }
      }
    })
  }

  buildings.forEach(building => {
    // Skip buildings with no owner
    if (!building.owner) return

    if (building.owner === gameState.humanPlayer) {
      playerTotalPower += building.power

      // Track production and consumption separately
      if (building.power > 0) {
        playerTotalProduction += building.power
      } else if (building.power < 0) {
        playerTotalConsumption += Math.abs(building.power)
      }

      // Check if player has a radar station
      if (building.type === 'radarStation' && building.health > 0) {
        playerHasRadarStation = true
      }
    } else if (building.owner !== gameState.humanPlayer) {
      // For now, aggregate all non-human players as "enemy" for power tracking
      enemyTotalPower += building.power

      // Track production and consumption separately
      if (building.power > 0) {
        enemyTotalProduction += building.power
      } else if (building.power < 0) {
        enemyTotalConsumption += Math.abs(building.power)
      }
    }
  })

  // Store values in gameState
  gameState.playerPowerSupply = playerTotalPower
  gameState.playerTotalPowerProduction = playerTotalProduction
  gameState.playerPowerConsumption = playerTotalConsumption

  gameState.enemyPowerSupply = enemyTotalPower
  gameState.enemyTotalPowerProduction = enemyTotalProduction
  gameState.enemyPowerConsumption = enemyTotalConsumption

  const playerCross = (prevPlayerPower >= 0 && playerTotalPower < 0) || (prevPlayerPower < 0 && playerTotalPower >= 0)
  const enemyCross = (prevEnemyPower >= 0 && enemyTotalPower < 0) || (prevEnemyPower < 0 && enemyTotalPower >= 0)

  if (playerCross || enemyCross) {
    updateDangerZoneMaps(gameState)
  }

  // Calculate energy percentage for UI display
  // Calculate energy percentage for informational purposes
  if (playerTotalProduction > 0) {
    Math.max(0, 100 - (playerTotalConsumption / playerTotalProduction) * 100)
  } else if (playerTotalConsumption > 0) {
    // If no production but consumption exists
    0
  }

  // Calculate production speed penalty when power is negative
  if (playerTotalPower < 0) {
    // New formula: scale production by (production capacity / consumption)
    if (playerTotalConsumption > 0) {
      gameState.playerBuildSpeedModifier =
        playerTotalProduction / playerTotalConsumption
    } else {
      // Shouldn't happen when power is negative, but guard against divide by zero
      gameState.playerBuildSpeedModifier = 0
    }

    // Enable low energy mode
    gameState.lowEnergyMode = true

    // Disable radar when power is negative, even if radar station exists
    gameState.radarActive = false
  } else {
    // Normal speed when power is positive
    gameState.playerBuildSpeedModifier = 1.0
    gameState.lowEnergyMode = false

    // Radar is active only if player has a radar station and power is positive
    gameState.radarActive = playerHasRadarStation
  }

  // Calculate enemy speed penalty when power is negative
  if (enemyTotalPower < 0) {
    if (enemyTotalConsumption > 0) {
      gameState.enemyBuildSpeedModifier =
        enemyTotalProduction / enemyTotalConsumption
    } else {
      gameState.enemyBuildSpeedModifier = 0
    }
  } else {
    gameState.enemyBuildSpeedModifier = 1.0
  }

  // For backward compatibility
  gameState.powerSupply = playerTotalPower
  gameState.totalPowerProduction = playerTotalProduction
  gameState.powerConsumption = playerTotalConsumption

  return playerTotalPower
}

// Calculate the repair cost for a building
export function calculateRepairCost(building) {
  // Get the original cost of the building
  const type = building.type
  const originalCost = buildingData[type].cost

  // Calculate the percentage of damage
  const damagePercent = 1 - (building.health / building.maxHealth)

  // Formula: repair cost = damage percentage * original cost * 0.3
  const repairCost = Math.ceil(damagePercent * originalCost * 0.3)

  return repairCost
}

// Repair a building to full health
export function repairBuilding(building, gameState) {
  if (building.type === 'concreteWall') {
    return { success: false, message: 'Concrete walls cannot be repaired' }
  }
  // Only repair if building is damaged
  if (building.health >= building.maxHealth) {
    return { success: false, message: 'Building already at full health' }
  }

  // Calculate repair cost
  const repairCost = calculateRepairCost(building)

  // Setup gradual repair
  if (!gameState.buildingsUnderRepair) {
    gameState.buildingsUnderRepair = []
  }

  const healthToRepair = building.maxHealth - building.health

  // Repair time is 2x of build time
  // Estimate build time based on building cost (500 cost = 1 second base duration)
  const baseDuration = 1000 // 1 second base
  const buildingCost = buildingData[building.type].cost
  const buildDuration = baseDuration * (buildingCost / 500)
  const repairDuration = buildDuration * 2.0 // 2x build time

  gameState.buildingsUnderRepair.push({
    building: building,
    startTime: performance.now(),
    duration: repairDuration,
    startHealth: building.health,
    targetHealth: building.maxHealth,
    healthToRepair: healthToRepair,
    cost: repairCost,
    costPaid: 0
  })
  return { success: true, message: 'Building repair started', cost: repairCost }
}

// Function to mark a building for repair pausing (deferred processing)
export function markBuildingForRepairPause(building) {
  // Simply mark the building - actual pausing will happen in update cycle
  if (building) {
    building.needsRepairPause = true
    building.lastAttackedTime = performance.now()
  }
}

// Function to pause active repair when a building is attacked
export function pauseActiveRepair(building) {
  // TEMPORARILY DISABLED - CAUSING INFINITE EXPLOSION BUG
  return false
}

// Update buildings that are currently under repair
export const updateBuildingsUnderRepair = logPerformance(function updateBuildingsUnderRepair(gameState, currentTime) {
  if (!gameState.buildingsUnderRepair || gameState.buildingsUnderRepair.length === 0) {
    return
  }

  // First, process any buildings marked for repair pause
  processPendingRepairPauses(gameState, currentTime)

  for (let i = gameState.buildingsUnderRepair.length - 1; i >= 0; i--) {
    const repairInfo = gameState.buildingsUnderRepair[i]
    let progress = (currentTime - repairInfo.startTime) / repairInfo.duration

    if (repairInfo.paused) {
      if (gameState.money > 0) {
        repairInfo.startTime = currentTime - progress * repairInfo.duration
        repairInfo.paused = false
      } else {
        repairInfo.startTime = currentTime - progress * repairInfo.duration
        continue
      }
    }

    progress = (currentTime - repairInfo.startTime) / repairInfo.duration

    const expectedPaid = Math.min(progress, 1) * repairInfo.cost
    const deltaCost = expectedPaid - repairInfo.costPaid
    if (deltaCost > 0) {
      if (gameState.money >= deltaCost) {
        gameState.money -= deltaCost
        repairInfo.costPaid += deltaCost
      } else {
        repairInfo.paused = true
        repairInfo.startTime = currentTime - progress * repairInfo.duration
        playSound('repairPaused', 1.0, 0, true)
        showNotification('Repair paused: not enough money.')
        continue
      }
    }

    if (progress >= 1.0) {
      repairInfo.building.health = repairInfo.targetHealth
      gameState.buildingsUnderRepair.splice(i, 1)
      playSound('repairFinished', 1.0, 0, true)
    } else {
      const newHealth = repairInfo.startHealth + (repairInfo.healthToRepair * progress)
      repairInfo.building.health = newHealth
    }
  }
})

// Process buildings marked for repair pause (safe deferred processing)
function processPendingRepairPauses(gameState, currentTime) {
  if (!gameState.buildingsUnderRepair) return

  // Collect buildings that need repair pause
  const buildingsToProcess = []

  // Check all buildings under repair for pause marks
  gameState.buildingsUnderRepair.forEach(repairInfo => {
    if (repairInfo.building.needsRepairPause) {
      buildingsToProcess.push(repairInfo.building)
    }
  })

  // Process pause requests safely
  buildingsToProcess.forEach(building => {
    actuallyPauseRepair(building, gameState, currentTime)
    delete building.needsRepairPause // Clear the mark
  })
}

// Actually pause the repair (safe version)
function actuallyPauseRepair(building, gameState, currentTime) {
  if (!gameState.buildingsUnderRepair) return

  // Find the repair entry for this building
  let repairIndex = -1
  let activeRepair = null

  for (let i = 0; i < gameState.buildingsUnderRepair.length; i++) {
    if (gameState.buildingsUnderRepair[i].building === building) {
      activeRepair = gameState.buildingsUnderRepair[i]
      repairIndex = i
      break
    }
  }

  if (activeRepair && repairIndex !== -1) {
    // Calculate remaining work
    const healthRepaired = Math.max(0, building.health - activeRepair.startHealth)
    const remainingHealthToRepair = Math.max(0, activeRepair.healthToRepair - healthRepaired)
    const remainingCost = Math.max(0, activeRepair.cost - activeRepair.costPaid)

    // Remove from active repairs
    gameState.buildingsUnderRepair.splice(repairIndex, 1)

    // Add to awaiting repairs if there's work remaining
    if (remainingHealthToRepair > 1 && remainingCost > 1) {
      if (!gameState.buildingsAwaitingRepair) {
        gameState.buildingsAwaitingRepair = []
      }

      // Check for duplicates
      const alreadyAwaiting = gameState.buildingsAwaitingRepair.some(ar => ar.building === building)
      if (!alreadyAwaiting) {
        const isFactory = (building.id !== undefined && building.type === undefined)

        gameState.buildingsAwaitingRepair.push({
          building: building,
          repairCost: remainingCost,
          healthToRepair: remainingHealthToRepair,
          lastAttackedTime: building.lastAttackedTime || currentTime,
          isFactory: isFactory,
          factoryCost: isFactory ? 5000 : undefined
        })

        playSound('repairPaused', 1.0, 0, true)
        showNotification('Repair paused due to attack!')
      }
    }
  }
}

// Update buildings that are awaiting repair (under attack cooldown)
export const updateBuildingsAwaitingRepair = logPerformance(function updateBuildingsAwaitingRepair(gameState, currentTime) {
  if (!gameState.buildingsAwaitingRepair || gameState.buildingsAwaitingRepair.length === 0) {
    return
  }

  for (let i = gameState.buildingsAwaitingRepair.length - 1; i >= 0; i--) {
    const awaitingRepair = gameState.buildingsAwaitingRepair[i]
    const building = awaitingRepair.building

    if (building.type === 'concreteWall') {
      gameState.buildingsAwaitingRepair.splice(i, 1)
      continue
    }

    // Check if building was attacked more recently than when we started waiting
    // This resets the countdown if the building gets attacked again
    if (building.lastAttackedTime && building.lastAttackedTime > awaitingRepair.lastAttackedTime) {
      // Building was attacked again - reset the countdown
      awaitingRepair.lastAttackedTime = building.lastAttackedTime
      playSound('Repair_impossible_when_under_attack', 1.0, 30, true)
      showNotification('Repair countdown reset - building under attack!')
    }

    const timeSinceLastAttack = (currentTime - awaitingRepair.lastAttackedTime) / 1000

    // Store countdown info for rendering
    awaitingRepair.remainingCooldown = Math.max(0, 10 - timeSinceLastAttack)

    if (timeSinceLastAttack >= 10) {
      // Cooldown complete - start the repair automatically
      const building = awaitingRepair.building

      // Check if building is still damaged
      if (building.health < building.maxHealth) {
        if (awaitingRepair.isFactory) {
          // Start factory repair
          if (!gameState.buildingsUnderRepair) {
            gameState.buildingsUnderRepair = []
          }

          const baseDuration = 1000
          const buildDuration = baseDuration * (awaitingRepair.factoryCost / 500)
          const repairDuration = buildDuration * 2.0

          gameState.buildingsUnderRepair.push({
            building: building,
            startTime: currentTime,
            duration: repairDuration,
            startHealth: building.health,
            targetHealth: building.maxHealth,
            healthToRepair: awaitingRepair.healthToRepair,
            cost: awaitingRepair.repairCost,
            costPaid: 0
          })

          showNotification(`Factory repair started for $${awaitingRepair.repairCost}`)
          playSound('repairStarted', 1.0, 0, true)
        } else {
          // Start building repair manually (don't use repairBuilding as it starts immediately)
          if (!gameState.buildingsUnderRepair) {
            gameState.buildingsUnderRepair = []
          }

          // Repair time is 2x of build time
          const baseDuration = 1000
          const buildingCost = buildingData[building.type].cost
          const buildDuration = baseDuration * (buildingCost / 500)
          const repairDuration = buildDuration * 2.0

          gameState.buildingsUnderRepair.push({
            building: building,
            startTime: currentTime,
            duration: repairDuration,
            startHealth: building.health,
            targetHealth: building.maxHealth,
            healthToRepair: awaitingRepair.healthToRepair,
            cost: awaitingRepair.repairCost,
            costPaid: 0
          })

          showNotification(`Building repair started for $${awaitingRepair.repairCost}`)
          playSound('repairStarted', 1.0, 0, true)
        }
      }

      // Remove from awaiting list
      gameState.buildingsAwaitingRepair.splice(i, 1)
    }
  }
})
