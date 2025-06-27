// enemy orchestrator
import { buildOccupancyMap } from './units.js'
import { updateAIPlayer } from './ai/enemyAIPlayer.js'
export { spawnEnemyUnit } from './ai/enemySpawner.js'

export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)
  const now = performance.now()
  const humanPlayer = gameState.humanPlayer || 'player1'
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  const aiPlayers = allPlayers.filter(p => p !== humanPlayer)
  const targetedOreTiles = gameState.targetedOreTiles || {}
  aiPlayers.forEach(aiPlayerId => {
    updateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles)
  })
}
