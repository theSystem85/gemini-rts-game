import { updateEnemyAI } from './enemy.js'

let currentState = null

self.onmessage = (e) => {
  if (e.data.type === 'init' || e.data.type === 'state') {
    currentState = e.data.state
    if (e.data.type === 'init') {
      aiLoop()
    }
  }
}

function aiLoop() {
  const start = performance.now()
  if (currentState) {
    updateEnemyAI(
      currentState.units,
      currentState.factories,
      currentState.bullets,
      currentState.mapGrid,
      currentState.gameState
    )
  }
  const elapsed = performance.now() - start
  self.postMessage({ type: 'update', state: currentState })
  const interval = Math.max(300, Math.ceil(elapsed / 300) * 300)
  setTimeout(aiLoop, interval)
}
