// factories.js
export function initFactories(factories, mapGrid) {
  // Create player factory at bottom left
  const playerFactory = {
    id: 'player',
    x: 1,
    y: mapGrid.length - 3, // 3 tiles from the bottom
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 0
  };

  // Create enemy factory at top right (using y=0 for top)
  const enemyFactory = {
    id: 'enemy',
    x: mapGrid[0].length - 4, // 3 tiles wide (so x from ...-4 to ...-2)
    y: 0,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 5000
  };

  factories.push(playerFactory, enemyFactory);

  // Mark the factory tiles as "building" so units cannot move through them
  factories.forEach(factory => {
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        mapGrid[y][x].type = 'building';
      }
    }
  });

  // Carve an L-shaped corridor between the player and enemy factories.
  // First, clear horizontally from the right side of the player factory up to enemy factory's x.
  for (let x = playerFactory.x + playerFactory.width; x < enemyFactory.x; x++) {
    if (mapGrid[playerFactory.y] && mapGrid[playerFactory.y][x]) {
      mapGrid[playerFactory.y][x].type = 'street';
    }
  }
  // Then, clear vertically along the enemy factory's column.
  if (enemyFactory.y < playerFactory.y) {
    for (let y = enemyFactory.y; y < playerFactory.y; y++) {
      if (mapGrid[y] && mapGrid[y][enemyFactory.x]) {
        mapGrid[y][enemyFactory.x].type = 'street';
      }
    }
  } else {
    for (let y = playerFactory.y; y < enemyFactory.y; y++) {
      if (mapGrid[y] && mapGrid[y][enemyFactory.x]) {
        mapGrid[y][enemyFactory.x].type = 'street';
      }
    }
  }
}
