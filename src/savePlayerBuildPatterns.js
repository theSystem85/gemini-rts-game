import { gameState } from './gameState.js'

function readHistoryFromStorage() {
  if (typeof localStorage === 'undefined') {
    return []
  }

  try {
    const savedHistory = localStorage.getItem('playerBuildHistory')
    return savedHistory ? JSON.parse(savedHistory) : []
  } catch (error) {
    console.warn('Failed to parse playerBuildHistory from storage:', error)
    return []
  }
}

export function ensurePlayerBuildHistoryLoaded() {
  if (!Array.isArray(gameState.playerBuildHistory)) {
    gameState.playerBuildHistory = readHistoryFromStorage()
  }

  if (!Array.isArray(gameState.playerBuildHistory)) {
    gameState.playerBuildHistory = []
  }

  return gameState.playerBuildHistory
}

function ensureSessionId() {
  if (!gameState.currentSessionId) {
    gameState.currentSessionId = Date.now().toString()
  }
  return gameState.currentSessionId
}

// Add function to save player building patterns to localStorage
export function savePlayerBuildPatterns(buildingType) {
  try {
    const history = ensurePlayerBuildHistoryLoaded()
    const sessionId = ensureSessionId()

    let currentSession = history.find(session => session.id === sessionId)

    if (!currentSession) {
      currentSession = {
        id: sessionId,
        buildings: []
      }
      history.push(currentSession)
    }

    currentSession.buildings.push(buildingType)

    if (history.length > 20) {
      gameState.playerBuildHistory = history.slice(-20)
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('playerBuildHistory', JSON.stringify(gameState.playerBuildHistory))
    }
  } catch (error) {
    console.error('Error saving player build patterns:', error)
  }
}
