// factories.js
import { buildingData } from './buildings.js'
import { MAP_TILES_X, MAP_TILES_Y, PLAYER_POSITIONS } from './config.js'
import { gameState } from './gameState.js'

export function initFactories(factories, mapGrid) {
  // Clear existing factories
  factories.length = 0
  
  // Get the factory dimensions from buildingData
  const factoryWidth = buildingData.constructionYard.width
  const factoryHeight = buildingData.constructionYard.height

  // Create factories for each player based on player count
  const playerCount = gameState.playerCount || 2
  const playerIds = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  
  playerIds.forEach(playerId => {
    const position = PLAYER_POSITIONS[playerId]
    const factoryX = Math.floor(MAP_TILES_X * position.x) - Math.floor(factoryWidth / 2)
    const factoryY = Math.floor(MAP_TILES_Y * position.y) - Math.floor(factoryHeight / 2)

    // Create factory object
    const factory = {
      id: playerId,
      owner: playerId,
      x: factoryX,
      y: factoryY,
      width: factoryWidth,
      height: factoryHeight,
      health: 1000,
      maxHealth: 1000,
      productionCountdown: 0,
      budget: 10000,
      // Keep legacy compatibility
      isHuman: playerId === gameState.humanPlayer
    }

    factories.push(factory)
  })

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

  // Carve streets between factories for connectivity
  // Connect all factories to each other with streets for multi-player connectivity
  for (let i = 0; i < factories.length; i++) {
    for (let j = i + 1; j < factories.length; j++) {
      const factory1 = factories[i]
      const factory2 = factories[j]
      
      // Create L-shaped connection between each pair of factories
      const startX = factory1.x + Math.floor(factory1.width / 2)
      const startY = factory1.y + Math.floor(factory1.height / 2)
      const endX = factory2.x + Math.floor(factory2.width / 2)
      const endY = factory2.y + Math.floor(factory2.height / 2)
      
      // Horizontal then vertical connection
      for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
        if (mapGrid[startY] && mapGrid[startY][x]) {
          mapGrid[startY][x].type = 'street'
        }
      }
      for (let y = Math.min(startY, endY); y <= Math.max(startY, endY); y++) {
        if (mapGrid[y] && mapGrid[y][endX]) {
          mapGrid[y][endX].type = 'street'
        }
      }
    }
  }
}
