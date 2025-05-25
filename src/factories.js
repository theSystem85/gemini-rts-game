// factories.js
import { buildingData } from './buildings.js'

export function initFactories(factories, mapGrid) {
  // Get the factory dimensions from buildingData
  const factoryWidth = buildingData.constructionYard.width
  const factoryHeight = buildingData.constructionYard.height

  // Position player factory at least 5 tiles from left and bottom.
  const playerFactory = {
    id: 'player',
    x: 5,
    y: mapGrid.length - factoryHeight - 5, // 5 tiles from bottom
    width: factoryWidth,
    height: factoryHeight,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 10000
  }
  // Position enemy factory at least 5 tiles from top and right.
  const enemyFactory = {
    id: 'enemy',
    x: mapGrid[0].length - factoryWidth - 5, // 5 tiles from right
    y: 5,
    width: factoryWidth,
    height: factoryHeight,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 10000
  }
  factories.push(playerFactory, enemyFactory)

  // Mark factory tiles as "building" to block unit movement.
  factories.forEach(factory => {
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        mapGrid[y][x].type = 'building'
        mapGrid[y][x].building = factory // Set reference to the factory object to properly block building placement
      }
    }
  })

  // Carve an L-shaped corridor between the factories.
  for (let x = playerFactory.x + playerFactory.width; x < enemyFactory.x; x++) {
    if (mapGrid[playerFactory.y] && mapGrid[playerFactory.y][x]) {
      mapGrid[playerFactory.y][x].type = 'street'
    }
  }
  if (enemyFactory.y < playerFactory.y) {
    for (let y = enemyFactory.y; y < playerFactory.y; y++) {
      if (mapGrid[y] && mapGrid[y][enemyFactory.x]) {
        mapGrid[y][enemyFactory.x].type = 'street'
      }
    }
  } else {
    for (let y = playerFactory.y; y < enemyFactory.y; y++) {
      if (mapGrid[y] && mapGrid[y][enemyFactory.x]) {
        mapGrid[y][enemyFactory.x].type = 'street'
      }
    }
  }
}
