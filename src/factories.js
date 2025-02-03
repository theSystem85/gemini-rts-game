export function initFactories(factories, mapGrid) {
  // Spielerfabrik: unten links
  const playerFactory = {
    id: 'player',
    x: 1,
    y: mapGrid.length - 3,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 0
  };
  // Gegnerfabrik: oben rechts
  const enemyFactory = {
    id: 'enemy',
    x: mapGrid[0].length - 4,
    y: 1,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 5000
  };
  factories.push(playerFactory, enemyFactory);

  // Markiere alle Kacheln, die von Fabriken belegt sind, als "building"
  factories.forEach(factory => {
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        mapGrid[y][x].type = 'building';
      }
    }
  });

  // Erzwinge einen L-förmigen Korridor zwischen den Basen:
  const corridorStartX = playerFactory.x + playerFactory.width;
  const corridorStartY = playerFactory.y;
  const corridorEndX = enemyFactory.x;
  const corridorEndY = enemyFactory.y + enemyFactory.height;
  for (let x = corridorStartX; x <= corridorEndX; x++) {
    if (mapGrid[corridorStartY] && mapGrid[corridorStartY][x]) {
      mapGrid[corridorStartY][x].type = 'street';
    }
  }
  for (let y = corridorStartY; y <= corridorEndY; y++) {
    if (mapGrid[y] && mapGrid[y][corridorEndX]) {
      mapGrid[y][corridorEndX].type = 'street';
    }
  }
}
