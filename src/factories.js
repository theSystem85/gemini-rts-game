// Initializes factories and carves a corridor between them.
export function initFactories(factories, mapGrid) {
    // Player factory: bottom left
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
    // Enemy factory: top right
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
    
    // Carve an L-shaped corridor so that water/rock do not block the path.
    const corridorStart = { x: playerFactory.x + playerFactory.width, y: playerFactory.y }
    const corridorEnd = { x: enemyFactory.x, y: enemyFactory.y + enemyFactory.height }
    for (let x = corridorStart.x; x <= corridorEnd.x; x++) {
      if (mapGrid[corridorStart.y] && mapGrid[corridorStart.y][x]) {
        mapGrid[corridorStart.y][x].type = 'land'
      }
    }
    for (let y = corridorStart.y; y <= corridorEnd.y; y++) {
      if (mapGrid[y] && mapGrid[y][corridorEnd.x]) {
        mapGrid[y][corridorEnd.x].type = 'land'
      }
    }
  }
  