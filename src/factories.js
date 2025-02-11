// factories.js
export function initFactories(factories, mapGrid) {
  // Position player factory at least 5 tiles from left and bottom.
  const playerFactory = {
    id: 'player',
    x: 5,
    y: mapGrid.length - 3 - 5, // 5 tiles from bottom
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 0
  }
  // Position enemy factory at least 5 tiles from top and right.
  const enemyFactory = {
    id: 'enemy',
    x: mapGrid[0].length - 4 - 5, // 5 tiles from right
    y: 5,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 5000
  }
  factories.push(playerFactory, enemyFactory)

  // Mark factory tiles as "building" to block unit movement.
  factories.forEach(factory => {
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        mapGrid[y][x].type = 'building'
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
