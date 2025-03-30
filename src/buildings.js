// Building configuration and management

// Building dimensions and costs
export const buildingData = {
  powerPlant: {
    width: 3,
    height: 3,
    cost: 2000,
    power: 100,
    image: 'power_plant.jpg',
    displayName: 'Power Plant',
    health: 200
  },
  oreRefinery: {
    width: 3,
    height: 3,
    cost: 2500,
    power: -30,
    image: 'ore_refinery.jpg',
    displayName: 'Ore Refinery',
    health: 200
  },
  vehicleFactory: {
    width: 3,
    height: 3,
    cost: 3000,
    power: -50,
    image: 'vehicle_factory.jpg',
    displayName: 'Vehicle Factory',
    health: 300
  },
  constructionYard: {
    width: 3,
    height: 3,
    cost: 5000,
    power: 50,
    image: 'construction_yard.jpg',
    displayName: 'Construction Yard',
    health: 350
  },
  radarStation: {
    width: 2,
    height: 2,
    cost: 1500,
    power: -30,
    image: 'radar_station.jpg',
    displayName: 'Radar Station',
    health: 200
  },
  turretGunV1: {
    width: 1,
    height: 1,
    cost: 1000,
    power: -10,
    image: 'turret_gun_v1.jpg',
    displayName: 'Turret Gun V1',
    health: 300,
    // Add combat properties
    fireRange: 10, // 50% more than tank range (TANK_FIRE_RANGE + 50%)
    fireCooldown: 1600, // Same as regular tank
    damage: 20, // Same as regular tank
    armor: 1,
    projectileType: 'bullet',
    projectileSpeed: 6, // Increased from 3 to 6
    useAimAhead: true // Enable aim-ahead feature for this turret
  },
  turretGunV2: {
    width: 1,
    height: 1,
    cost: 2000,
    power: -15,
    image: 'turret_gun_v2.jpg',
    displayName: 'Turret Gun V2',
    health: 300,
    // Add combat properties
    fireRange: 10, // 50% more than tank range
    fireCooldown: 1600,
    damage: 24, // Same as tank-v2 (20% more than V1)
    armor: 1,
    projectileType: 'bullet',
    projectileSpeed: 7, // Increased from 3 to 7
    useAimAhead: true // Enable aim-ahead feature for this turret
  },
  turretGunV3: {
    width: 1,
    height: 1,
    cost: 3000,
    power: -25,
    image: 'turret_gun_v3.jpg',
    displayName: 'Turret Gun V3',
    health: 300,
    // Add combat properties
    fireRange: 12, // Even more range
    fireCooldown: 1400, // Faster firing
    damage: 30, // Higher damage
    armor: 1.5,
    projectileType: 'bullet',
    projectileSpeed: 8, // Increased from 4 to 8
    burstFire: true, // Special feature: fires 3 shots in quick succession
    burstCount: 3, 
    burstDelay: 150, // ms between burst shots
    useAimAhead: true // Enable aim-ahead feature for this turret
  },
  rocketTurret: {
    width: 2,
    height: 2,
    cost: 4000,
    power: -40,
    image: 'rocket_turret.jpg',
    displayName: 'Rocket Turret',
    health: 200,
    // Add combat properties
    fireRange: 12, // Increased by 50% from 8 to 12
    fireCooldown: 3000, // 3 seconds between shots
    damage: 40,
    armor: 2, // 2x the armor of a tank
    projectileType: 'rocket',
    projectileSpeed: 6 // Increased from 4 to 6
      },
  teslaCoil: {
    width: 2,
    height: 2,
    cost: 5000,
    power: -60,
    image: 'tesla_coil.jpg',
    displayName: 'Tesla Coil',
    health: 250
  },
  artilleryTurret: {
    width: 2,
    height: 2,
    cost: 3500,
    power: -45,
    image: 'artillery_turret.jpg',
    displayName: 'Artillery Turret',
    health: 300
  },
  concreteWall: {
    width: 1,
    height: 1,
    cost: 100,
    power: 0,
    image: 'concrete_wall.jpg',
    displayName: 'Concrete Wall',
    health: 200
  }
};

export function createBuilding(type, x, y) {
  if (!buildingData[type]) return null;
  
  const data = buildingData[type];
  
  const building = {
    type,
    x,
    y,
    width: data.width,
    height: data.height,
    health: data.health,
    maxHealth: data.health,
    power: data.power,
    isBuilding: true
  };
  
  // Add combat properties for defensive buildings
  if (type === 'rocketTurret' || type.startsWith('turretGun')) {
    building.fireRange = data.fireRange;
    building.fireCooldown = data.fireCooldown;
    building.damage = data.damage;
    building.armor = data.armor || 1;
    building.projectileType = data.projectileType;
    building.projectileSpeed = data.projectileSpeed;
    building.lastShotTime = 0;
    building.turretDirection = 0; // Direction the turret is facing
    building.targetDirection = 0; // Direction the turret should face
    
    // Add special targeting features
    if (data.aimAhead) {
      building.aimAhead = true;
    }
    
    // Add burst fire capabilities
    if (data.burstFire) {
      building.burstFire = true;
      building.burstCount = data.burstCount || 3;
      building.burstDelay = data.burstDelay || 150;
      building.currentBurst = 0;
      building.lastBurstTime = 0;
    }
  }
  
  return building;
}

// Helper function to check if a position is within 3 tiles of any existing player building
export function isNearExistingBuilding(tileX, tileY, buildings, factories, maxDistance = 3, owner = 'player') {
  // First check factories
  if (factories && factories.length > 0) {
    for (const factory of factories) {
      // Only consider factories belonging to the same owner
      if (factory.id === owner || factory.owner === owner) {
        // Calculate the shortest distance from the new position to any tile of the factory
        for (let bY = factory.y; bY < factory.y + factory.height; bY++) {
          for (let bX = factory.x; bX < factory.x + factory.width; bX++) {
            // Calculate Manhattan distance
            const distance = Math.abs(tileX - bX) + Math.abs(tileY - bY);
            
            if (distance <= maxDistance) {
              return true;
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
        continue;
      }
      
      // Calculate the shortest distance from the new position to any tile of the existing building
      for (let bY = building.y; bY < building.y + building.height; bY++) {
        for (let bX = building.x; bX < building.x + building.width; bX++) {
          // Calculate Manhattan distance
          const distance = Math.abs(tileX - bX) + Math.abs(tileY - bY);
          
          if (distance <= maxDistance) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Check if a building can be placed at given coordinates
export function canPlaceBuilding(type, tileX, tileY, mapGrid, units, buildings, factories, owner = 'player') {
  if (!buildingData[type]) return false;
  
  const width = buildingData[type].width;
  const height = buildingData[type].height;
  
  // Check map boundaries
  if (tileX < 0 || tileY < 0 || 
      tileX + width > mapGrid[0].length || 
      tileY + height > mapGrid.length) {
    console.log('Building placement failed: Out of map boundaries');
    return false;
  }
  
  // Check if ANY tile of the building is within range of an existing building
  let isAnyTileInRange = false;
  for (let y = tileY; y < tileY + height; y++) {
    for (let x = tileX; x < tileX + width; x++) {
      if (isNearExistingBuilding(x, y, buildings, factories, 3, owner)) {
        isAnyTileInRange = true;
        break;
      }
    }
    if (isAnyTileInRange) break;
  }
  
  // If no tile is in range, return false
  if (!isAnyTileInRange) {
    console.log('Building placement failed: Not near an existing building');
    return false;
  }
  
  // Check if any tile is blocked
  for (let y = tileY; y < tileY + height; y++) {
    for (let x = tileX; x < tileX + width; x++) { // FIXED: use x in condition instead of y
      // Check map terrain
      if (mapGrid[y][x].type === 'water' || 
          mapGrid[y][x].type === 'rock' || 
          mapGrid[y][x].building) {
        console.log(`Building placement failed: Invalid terrain at (${x},${y}): ${mapGrid[y][x].type}`);
        return false;
      }
      
      // Check for units at this position
      const unitsAtTile = units.filter(unit => 
        Math.floor(unit.x / 32) === x && 
        Math.floor(unit.y / 32) === y
      );
      
      if (unitsAtTile.length > 0) {
        console.log(`Building placement failed: Unit present at (${x},${y})`);
        return false;
      }
    }
  }
  
  console.log(`Building placement successful for ${type} at (${tileX},${tileY})`);
  return true;
}

// Check individual tile validity for coloring the placement overlay
export function isTileValid(tileX, tileY, mapGrid, units, buildings, factories) {
  // Out of bounds
  if (tileX < 0 || tileY < 0 || 
      tileX >= mapGrid[0].length || 
      tileY >= mapGrid.length) {
    return false;
  }
  
  // Invalid terrain
  if (mapGrid[tileY][tileX].type === 'water' || 
      mapGrid[tileY][tileX].type === 'rock' || 
      mapGrid[tileY][tileX].building) {
    return false;
  }
  
  // Check for units
  const unitsAtTile = units.filter(unit => 
    Math.floor(unit.x / 32) === tileX && 
    Math.floor(unit.y / 32) === tileY
  );
  
  return unitsAtTile.length === 0;
}

// Place building in the map grid
export function placeBuilding(building, mapGrid) {
  for (let y = building.y; y < building.y + building.height; y++) {
    for (let x = building.x; x < building.x + building.width; x++) {
      mapGrid[y][x].building = building;
      mapGrid[y][x].type = 'building'; // Mark the tile as a building type for pathfinding
    }
  }
}

// Update the game's power supply
export function updatePowerSupply(buildings, gameState) {
  // Player power calculation
  let playerTotalPower = 0;
  let playerTotalProduction = 0;
  let playerTotalConsumption = 0;
  
  // Enemy power calculation
  let enemyTotalPower = 0;
  let enemyTotalProduction = 0;
  let enemyTotalConsumption = 0;
  
  // Track if player has a radar station
  let playerHasRadarStation = false;
  
  buildings.forEach(building => {
    // Skip buildings with no owner
    if (!building.owner) return;
    
    if (building.owner === 'player') {
      playerTotalPower += building.power;
      
      // Track production and consumption separately
      if (building.power > 0) {
        playerTotalProduction += building.power;
      } else if (building.power < 0) {
        playerTotalConsumption += Math.abs(building.power);
      }
      
      // Check if player has a radar station
      if (building.type === 'radarStation' && building.health > 0) {
        playerHasRadarStation = true;
      }
    } else if (building.owner === 'enemy') {
      enemyTotalPower += building.power;
      
      // Track production and consumption separately
      if (building.power > 0) {
        enemyTotalProduction += building.power;
      } else if (building.power < 0) {
        enemyTotalConsumption += Math.abs(building.power);
      }
    }
  });
  
  // Store values in gameState
  gameState.playerPowerSupply = playerTotalPower;
  gameState.playerTotalPowerProduction = playerTotalProduction;
  gameState.playerPowerConsumption = playerTotalConsumption;
  
  gameState.enemyPowerSupply = enemyTotalPower;
  gameState.enemyTotalPowerProduction = enemyTotalProduction;
  gameState.enemyPowerConsumption = enemyTotalConsumption;
  
  // Calculate energy percentage for UI display
  let playerEnergyPercentage = 100;
  if (playerTotalProduction > 0) {
    playerEnergyPercentage = Math.max(0, 100 - (playerTotalConsumption / playerTotalProduction) * 100);
  } else if (playerTotalConsumption > 0) {
    // If no production but consumption exists
    playerEnergyPercentage = 0;
  }
  
  // Calculate production speed penalty when power is negative
  if (playerTotalPower < 0) {
    // Calculate build speed modifier using the formula:
    // When power is -100, speed is 1/2
    // When power is -200, speed is 1/3
    // And so on
    const negativePower = Math.abs(playerTotalPower);
    // Speed penalty formula: 1 / (1 + (negativePower / 100))
    gameState.playerBuildSpeedModifier = 1 / (1 + (negativePower / 100));
    
    // Enable low energy mode
    gameState.lowEnergyMode = true;
    
    // Disable radar when power is negative, even if radar station exists
    gameState.radarActive = false;
  } else {
    // Normal speed when power is positive
    gameState.playerBuildSpeedModifier = 1.0;
    gameState.lowEnergyMode = false;
    
    // Radar is active only if player has a radar station and power is positive
    gameState.radarActive = playerHasRadarStation;
  }
  
  // Calculate enemy speed penalty when power is negative
  if (enemyTotalPower < 0) {
    const negativePower = Math.abs(enemyTotalPower);
    gameState.enemyBuildSpeedModifier = 1 / (1 + (negativePower / 100));
  } else {
    gameState.enemyBuildSpeedModifier = 1.0;
  }
  
  // For backward compatibility
  gameState.powerSupply = playerTotalPower;
  gameState.totalPowerProduction = playerTotalProduction;
  gameState.powerConsumption = playerTotalConsumption;
  
  return playerTotalPower;
}

// Calculate the repair cost for a building
export function calculateRepairCost(building) {
  // Get the original cost of the building
  const type = building.type;
  const originalCost = buildingData[type].cost;
  
  // Calculate the percentage of damage
  const damagePercent = 1 - (building.health / building.maxHealth);
  
  // Formula: repair cost = damage percentage * original cost * 0.3
  const repairCost = Math.ceil(damagePercent * originalCost * 0.3);
  
  return repairCost;
}

// Repair a building to full health
export function repairBuilding(building, gameState) {
  // Only repair if building is damaged
  if (building.health >= building.maxHealth) {
    return { success: false, message: "Building already at full health" };
  }
  
  // Calculate repair cost
  const repairCost = calculateRepairCost(building);
  
  // Check if player has enough money
  if (gameState.money < repairCost) {
    return { success: false, message: "Not enough money for repairs" };
  }
  
  // Deduct cost and repair
  gameState.money -= repairCost;
  building.health = building.maxHealth;
  
  return { success: true, message: "Building repaired", cost: repairCost };
}

// Update buildings that are currently under repair
export function updateBuildingsUnderRepair(gameState, currentTime) {
  if (!gameState.buildingsUnderRepair || gameState.buildingsUnderRepair.length === 0) {
    return;
  }

  // Create a new array to hold buildings still being repaired
  const stillRepairing = [];

  gameState.buildingsUnderRepair.forEach(repair => {
    const elapsed = currentTime - repair.startTime;
    const progress = Math.min(1, elapsed / repair.duration);
    
    if (progress < 1) {
      // Building is still being repaired
      const newHealth = repair.startHealth + (repair.healthToRepair * progress);
      repair.building.health = Math.min(repair.targetHealth, newHealth);
      stillRepairing.push(repair);
    } else {
      // Repair is complete
      repair.building.health = repair.targetHealth;
    }
  });

  // Replace the array with only the buildings still being repaired
  gameState.buildingsUnderRepair = stillRepairing;
}
