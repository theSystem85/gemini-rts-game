// Building configuration and management

// Building dimensions and costs
export const buildingData = {
  powerPlant: {
    width: 2,
    height: 3,
    cost: 2000,
    power: 100,
    image: 'power_plant.jpg',
    displayName: 'Power Plant',
    health: 200
  },
  oreRefinery: {
    width: 3,
    height: 2,
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
    health: 300
  },
  turretGunV2: {
    width: 1,
    height: 1,
    cost: 2000,
    power: -15,
    image: 'turret_gun_v2.jpg',
    displayName: 'Turret Gun V2',
    health: 300
  },
  turretGunV3: {
    width: 1,
    height: 1,
    cost: 3000,
    power: -25,
    image: 'turret_gun_v3.jpg',
    displayName: 'Turret Gun V3',
    health: 300
  },
  rocketTurret: {
    width: 2,
    height: 2,
    cost: 4000,
    power: -40,
    image: 'rocket_turret.jpg',
    displayName: 'Rocket Turret',
    health: 200
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
  
  return {
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
}

// Check if a building can be placed at given coordinates
export function canPlaceBuilding(type, tileX, tileY, mapGrid, units) {
  if (!buildingData[type]) return false;
  
  const width = buildingData[type].width;
  const height = buildingData[type].height;
  
  // Check map boundaries
  if (tileX < 0 || tileY < 0 || 
      tileX + width > mapGrid[0].length || 
      tileY + height > mapGrid.length) {
    return false;
  }
  
  // Check if any tile is blocked
  for (let y = tileY; y < tileY + height; y++) {
    for (let x = tileX; x < tileX + width; x++) {
      // Check map terrain
      if (mapGrid[y][x].type === 'water' || 
          mapGrid[y][x].type === 'rock' || 
          mapGrid[y][x].building) {
        return false;
      }
      
      // Check for units at this position
      const unitsAtTile = units.filter(unit => 
        Math.floor(unit.x / 32) === x && 
        Math.floor(unit.y / 32) === y
      );
      
      if (unitsAtTile.length > 0) {
        return false;
      }
    }
  }
  
  return true;
}

// Check individual tile validity for coloring the placement overlay
export function isTileValid(tileX, tileY, mapGrid, units) {
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
    }
  }
}

// Update the game's power supply
export function updatePowerSupply(buildings, gameState) {
  let totalPower = 0;
  
  buildings.forEach(building => {
    totalPower += building.power;
  });
  
  gameState.powerSupply = totalPower;
  return totalPower;
}
