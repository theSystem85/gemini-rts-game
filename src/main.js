import { MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { gameState } from './gameState.js'
import { setupInputHandlers } from './inputHandler.js'
import { renderGame, renderMinimap } from './rendering.js'
import { spawnUnit } from './units.js'
import { initFactories } from './factories.js'
import { playSound } from './sound.js'
import { updateGame } from './logic.js'

// Get DOM elements
const gameCanvas = document.getElementById('gameCanvas')
const gameCtx = gameCanvas.getContext('2d')
const minimapCanvas = document.getElementById('minimap')
const minimapCtx = minimapCanvas.getContext('2d')
const moneyEl = document.getElementById('money')
const gameTimeEl = document.getElementById('gameTime')
const winsEl = document.getElementById('wins')
const lossesEl = document.getElementById('losses')
const unitTypeSelect = document.getElementById('unitType')
const produceBtn = document.getElementById('produceBtn')
const productionProgressEl = document.getElementById('productionProgress')
const pauseBtn = document.getElementById('pauseBtn')
const restartBtn = document.getElementById('restartBtn')

// Set up toggle button for start/pause (Requirement bug #3)
pauseBtn.textContent = 'Start'

// Create and initialize map grid
export const mapGrid = []
window.mapGrid = mapGrid // make accessible for modules that need it (like inputHandler)
for (let y = 0; y < MAP_TILES_Y; y++) {
  mapGrid[y] = []
  for (let x = 0; x < MAP_TILES_X; x++) {
    mapGrid[y][x] = { type: 'land' }
  }
}
// Add patterns to mapGrid (water, rock, street, random ore) – same as in the monolithic version
for (let y = 45; y < 55; y++) {
  for (let x = 10; x < MAP_TILES_X - 10; x++) {
    mapGrid[y][x].type = 'water'
  }
}
for (let y = 20; y < 80; y++) {
  for (let x = 5; x < 15; x++) {
    mapGrid[y][x].type = 'rock'
  }
}
for (let y = 70; y < 75; y++) {
  for (let x = 50; x < MAP_TILES_X - 5; x++) {
    mapGrid[y][x].type = 'street'
  }
}
for (let i = 0; i < 100; i++) {
  const x = Math.floor(Math.random() * MAP_TILES_X)
  const y = Math.floor(Math.random() * MAP_TILES_Y)
  if (mapGrid[y][x].type === 'land') {
    mapGrid[y][x].type = 'ore'
  }
}

// Initialize factories
const factories = []
initFactories(factories, mapGrid)

// Global arrays for units and bullets
const units = []
const bullets = []

// Set up input handlers (pass units and factories so that input logic can check for enemy objects)
setupInputHandlers(units, factories)

// Production variables for player's factory
let production = {
  inProgress: false,
  unitType: null,
  startTime: 0,
  duration: 3000
}

produceBtn.addEventListener('click', () => {
  if (production.inProgress) return
  const unitType = unitTypeSelect.value
  const cost = unitType === 'tank' ? 1000 : 500
  if (gameState.money < cost) return
  gameState.money -= cost
  production.inProgress = true
  production.unitType = unitType
  production.startTime = performance.now()
  playSound('productionStart')
})

pauseBtn.addEventListener('click', () => {
  if (!gameState.gameStarted) {
    gameState.gameStarted = true
    gameState.gamePaused = false
    pauseBtn.textContent = 'Pause'
  } else {
    gameState.gamePaused = !gameState.gamePaused
    pauseBtn.textContent = gameState.gamePaused ? 'Resume' : 'Pause'
  }
})

restartBtn.addEventListener('click', () => {
  window.location.reload()
})

function resizeCanvases() {
  gameCanvas.width = window.innerWidth - 250
  gameCanvas.height = window.innerHeight
  minimapCanvas.width = minimapCanvas.clientWidth
  minimapCanvas.height = minimapCanvas.clientHeight
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

let lastTime = performance.now()
function gameLoop(time) {
  const delta = time - lastTime
  lastTime = time
  if (gameState.gameStarted && !gameState.gamePaused) {
    updateGame(delta, mapGrid, factories, units, bullets)
  }
  // Handle production progress
  if (production.inProgress) {
    const elapsed = performance.now() - production.startTime
    productionProgressEl.textContent = `${Math.floor((elapsed / production.duration) * 100)}%`
    if (elapsed >= production.duration) {
      const newUnit = spawnUnit(factories[0], production.unitType, units)
      units.push(newUnit)
      production.inProgress = false
      productionProgressEl.textContent = ''
      playSound('productionReady')
    }
  }
  renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, gameState.scrollOffset, false, null, null)
  renderMinimap(minimapCtx, minimapCanvas, mapGrid, gameState.scrollOffset, gameCanvas)
  moneyEl.textContent = gameState.money
  gameTimeEl.textContent = Math.floor(gameState.gameTime)
  winsEl.textContent = gameState.wins
  lossesEl.textContent = gameState.losses
  requestAnimationFrame(gameLoop)
}

gameLoop(performance.now())
