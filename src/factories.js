// factories.js
import { buildingData } from './buildings.js'
import { MAP_TILES_X, MAP_TILES_Y } from './config.js'

export function initFactories(factories, mapGrid) {
  // Get the factory dimensions from buildingData
  const factoryWidth = buildingData.constructionYard.width
  const factoryHeight = buildingData.constructionYard.height

  // Calculate positions - align with street planning from gameSetup.js
  const playerFactoryX = Math.floor(MAP_TILES_X * 0.1) - Math.floor(factoryWidth / 2)
  const playerFactoryY = Math.floor(MAP_TILES_Y * 0.9) - Math.floor(factoryHeight / 2)
  const enemyFactoryX = Math.floor(MAP_TILES_X * 0.9) - Math.floor(factoryWidth / 2)
  const enemyFactoryY = Math.floor(MAP_TILES_Y * 0.1) - Math.floor(factoryHeight / 2)

  // Position player factory to align with street planning
  const playerFactory = {
    id: 'player',
    x: playerFactoryX,
    y: playerFactoryY,
    width: factoryWidth,
    height: factoryHeight,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 10000
  }
  
  // Position enemy factory to align with street planning
  const enemyFactory = {
    id: 'enemy',
    x: enemyFactoryX,
    y: enemyFactoryY,
    width: factoryWidth,
    height: factoryHeight,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 10000
  }

  // Add factories to the array first
  factories.push(playerFactory, enemyFactory)

  // Ensure factory areas have proper background tiles (street or land)
  // Use the factories array instead of creating a new array
  factories.forEach(factory => {
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        // If the tile is void (undefined) or has no proper background, set it to street
        if (!mapGrid[y] || !mapGrid[y][x] || !mapGrid[y][x].type || mapGrid[y][x].type === 'building') {
          if (!mapGrid[y]) mapGrid[y] = []
          if (!mapGrid[y][x]) mapGrid[y][x] = {}
          mapGrid[y][x].type = 'street'
        }
      }
    }
  })

  // Mark factory tiles as "building" to block unit movement, but preserve background tiles.
  factories.forEach(factory => {
    // Store original tile types for factories (similar to placeBuilding in buildings.js)
    factory.originalTiles = []
    
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      factory.originalTiles[y - factory.y] = []
      
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        // Store the original tile type before marking as building
        factory.originalTiles[y - factory.y][x - factory.x] = mapGrid[y][x].type
        
        // Mark tile as having a building (for collision detection) but preserve the original tile type for rendering
        mapGrid[y][x].building = factory
        // DON'T change the tile type - keep the original background texture visible
        // mapGrid[y][x].type = 'building' // REMOVED: This was causing solid color rendering
      }
    }
  })

  // Carve an L-shaped corridor between the factories.
  const playerFactoryFromArray = factories.find(f => f.id === 'player')
  const enemyFactoryFromArray = factories.find(f => f.id === 'enemy')
  
  if (playerFactoryFromArray && enemyFactoryFromArray) {
    for (let x = playerFactoryFromArray.x + playerFactoryFromArray.width; x < enemyFactoryFromArray.x; x++) {
      if (mapGrid[playerFactoryFromArray.y] && mapGrid[playerFactoryFromArray.y][x]) {
        mapGrid[playerFactoryFromArray.y][x].type = 'street'
      }
    }
    if (enemyFactoryFromArray.y < playerFactoryFromArray.y) {
      for (let y = enemyFactoryFromArray.y; y < playerFactoryFromArray.y; y++) {
        if (mapGrid[y] && mapGrid[y][enemyFactoryFromArray.x]) {
          mapGrid[y][enemyFactoryFromArray.x].type = 'street'
        }
      }
    } else {
      for (let y = playerFactoryFromArray.y; y < enemyFactoryFromArray.y; y++) {
        if (mapGrid[y] && mapGrid[y][enemyFactoryFromArray.x]) {
          mapGrid[y][enemyFactoryFromArray.x].type = 'street'
        }
      }
    }
  }
}
