// Global state management module

// Initialize game state
window.gameState = window.gameState || {}

// Initialize targeted ore tiles registry
window.gameState.targetedOreTiles = window.gameState.targetedOreTiles || {}

// Export any global utilities or constants
export const getGameState = () => window.gameState
