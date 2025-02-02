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
    productionCountdown: 0
  }
  // Gegnerfabrik: oben rechts
  const enemyFactory = {
    id: 'enemy',
    x: mapGrid[0].length - 4,
    y: 1,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0
  }
  factories.push(playerFactory, enemyFactory)

  // Strecke als L-förmiger Korridor zwischen den Basen erzwingen:
  const corridorStartX = playerFactory.x + playerFactory.width
  const corridorStartY = playerFactory.y
  const corridorEndX = enemyFactory.x
  const corridorEndY = enemyFactory.y + enemyFactory.height

  // Horizontaler Teil von corridorStartX bis corridorEndX auf Höhe von corridorStartY
  for (let x = corridorStartX; x <= corridorEndX; x++) {
    if (mapGrid[corridorStartY] && mapGrid[corridorStartY][x]) {
      mapGrid[corridorStartY][x].type = 'street'
    }
  }
  // Vertikaler Teil von corridorStartY bis corridorEndY am corridorEndX
  for (let y = corridorStartY; y <= corridorEndY; y++) {
    if (mapGrid[y] && mapGrid[y][corridorEndX]) {
      mapGrid[y][corridorEndX].type = 'street'
    }
  }
}
