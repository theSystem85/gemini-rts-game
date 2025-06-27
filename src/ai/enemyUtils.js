import { gameState } from '../gameState.js'
import { TILE_SIZE } from '../config.js'

export function areEnemies(player1, player2) {
  return player1 !== player2
}

export function getEnemyPlayers(playerId) {
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  return allPlayers.filter(p => p !== playerId)
}

export function isEnemyTo(unit, currentPlayer) {
  return areEnemies(unit.owner, currentPlayer)
}

export function getClosestEnemyFactory(unit, factories, aiPlayerId) {
  if (!factories || !Array.isArray(factories)) {
    console.warn('getClosestEnemyFactory: factories is undefined or not an array')
    return null
  }

  let closestFactory = null
  let closestDist = Infinity

  factories.forEach(factory => {
    if (areEnemies(factory.id, aiPlayerId)) {
      const factoryCenterX = (factory.x + factory.width / 2) * TILE_SIZE
      const factoryCenterY = (factory.y + factory.height / 2) * TILE_SIZE
      const dist = Math.hypot(
        factoryCenterX - (unit.x + TILE_SIZE / 2),
        factoryCenterY - (unit.y + TILE_SIZE / 2)
      )
      if (dist < closestDist) {
        closestDist = dist
        closestFactory = factory
      }
    }
  })

  return closestFactory
}

export function isPartOfFactory(x, y, factories) {
  if (!factories) return false

  for (const factory of factories) {
    if (
      x >= factory.x &&
      x < factory.x + factory.width &&
      y >= factory.y &&
      y < factory.y + factory.height
    ) {
      return true
    }
  }
  return false
}
