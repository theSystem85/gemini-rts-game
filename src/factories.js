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
  // Gegnerfabrik: oben rechts (verwende y=0 für oben)
  const enemyFactory = {
    id: 'enemy',
    x: mapGrid[0].length - 4,
    y: 0,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0,
    budget: 5000
  };
  factories.push(playerFactory, enemyFactory);

  // Markiere die Kacheln der Fabriken als "building"
  factories.forEach(factory => {
    for (let y = factory.y; y < factory.y + factory.height; y++) {
      for (let x = factory.x; x < factory.x + factory.width; x++) {
        mapGrid[y][x].type = 'building';
      }
    }
  });

  // Erzwinge einen Korridor zwischen den Basen:
  // Von der rechten Seite der Spielerfabrik (x = playerFactory.x + playerFactory.width)
  // bis zur x-Koordinate der Gegnerfabrik und dann vertikal von playerFactory.y bis enemyFactory.y.
  for (let x = playerFactory.x + playerFactory.width; x < enemyFactory.x; x++) {
    if (mapGrid[playerFactory.y] && mapGrid[playerFactory.y][x]) {
      mapGrid[playerFactory.y][x].type = 'street';
    }
  }
  // Vertikaler Abschnitt: Von playerFactory.y bis enemyFactory.y an enemyFactory.x
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
