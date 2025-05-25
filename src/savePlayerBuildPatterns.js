import { gameState } from './gameState.js'

// Add function to save player building patterns to localStorage
export function savePlayerBuildPatterns(buildingType) {
  try {
    // Initialize player build history if it doesn't exist
    if (!gameState.playerBuildHistory) {
      // First try to load from localStorage
      const savedHistory = localStorage.getItem('playerBuildHistory')
      gameState.playerBuildHistory = savedHistory ? JSON.parse(savedHistory) : []
    }

    // Get current game session ID (create one if it doesn't exist)
    if (!gameState.currentSessionId) {
      gameState.currentSessionId = Date.now().toString()
    }

    // Get the current session's build order
    let currentSession = gameState.playerBuildHistory.find(session =>
      session.id === gameState.currentSessionId
    )

    if (!currentSession) {
      // Create a new session
      currentSession = {
        id: gameState.currentSessionId,
        buildings: []
      }
      gameState.playerBuildHistory.push(currentSession)
    }

    // Add this building to the current session
    currentSession.buildings.push(buildingType)

    // Limit to last 20 sessions
    if (gameState.playerBuildHistory.length > 20) {
      gameState.playerBuildHistory = gameState.playerBuildHistory.slice(-20)
    }

    // Save to localStorage
    localStorage.setItem('playerBuildHistory', JSON.stringify(gameState.playerBuildHistory))

    console.log(`Saved building ${buildingType} to player build patterns. Session: ${gameState.currentSessionId}`)
  } catch (error) {
    console.error('Error saving player build patterns:', error)
  }
}
