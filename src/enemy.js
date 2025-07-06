// enemy orchestrator
import { updateAIPlayer } from './ai/enemyAIPlayer.js'
import { aiScheduler } from './ai/aiScheduler.js'
import { aiEventSystem } from './ai/aiEventSystem.js'

export function updateEnemyAI(units, factories, bullets, mapGrid, gameState) {
  const occupancyMap = gameState.occupancyMap
  const now = performance.now()
  const humanPlayer = gameState.humanPlayer || 'player1'
  const playerCount = gameState.playerCount || 2
  const allPlayers = ['player1', 'player2', 'player3', 'player4'].slice(0, playerCount)
  const aiPlayers = allPlayers.filter(p => p !== humanPlayer)
  const targetedOreTiles = gameState.targetedOreTiles || {}
  
  // Process scheduled AI updates (spread across frames)
  aiScheduler.processScheduledUpdates(now, units, gameState, mapGrid)
  
  // Process AI events
  aiEventSystem.processEvents(now)
  
  aiPlayers.forEach(aiPlayerId => {
    updateAIPlayer(aiPlayerId, units, factories, bullets, mapGrid, gameState, occupancyMap, now, targetedOreTiles)
  })
}
