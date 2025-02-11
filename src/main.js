// main.js
import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { gameState } from './gameState.js'
import { tileToPixel } from './utils.js'
import { setupInputHandlers, selectedUnits, selectionActive, selectionStartExport, selectionEndExport } from './inputHandler.js'
import { renderGame, renderMinimap } from './rendering.js'
import { spawnUnit } from './units.js'
import { initFactories } from './factories.js'
import { playSound, initBackgroundMusic, toggleBackgroundMusic } from './sound.js'
import { updateGame } from './logic.js'

const gameCanvas = document.getElementById('gameCanvas')
const gameCtx = gameCanvas.getContext('2d')
const minimapCanvas = document.getElementById('minimap')
const minimapCtx = minimapCanvas.getContext('2d')
const moneyEl = document.getElementById('money')
const gameTimeEl = document.getElementById('gameTime')
const winsEl = document.getElementById('wins')
const lossesEl = document.getElementById('losses')
const productionProgressEl = document.getElementById('productionProgress')
const pauseBtn = document.getElementById('pauseBtn')
const restartBtn = document.getElementById('restartBtn')
const sidebar = document.getElementById('sidebar')

const productionButtons = document.getElementById('productionButtons')

const startBtn = document.getElementById('startBtn')
if (startBtn) {
  startBtn.style.display = 'none'
}
sidebar.style.backgroundColor = '#333'
sidebar.style.color = '#fff'

function resizeCanvases() {
  gameCanvas.width = window.innerWidth - 250
  gameCanvas.height = window.innerHeight
  minimapCanvas.width = 250
  minimapCanvas.height = 150
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

export const mapGrid = []
for (let y = 0; y < MAP_TILES_Y; y++) {
  mapGrid[y] = []
  for (let x = 0; x < MAP_TILES_X; x++) {
    mapGrid[y][x] = { type: 'land' }
  }
}
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

const factories = []
initFactories(factories, mapGrid)

const units = []
const bullets = []

setupInputHandlers(units, factories, mapGrid)

let production = {
  inProgress: false,
  unitType: null,
  startTime: 0,
  duration: 3000
}

const unitCosts = {
  tank: 1000,
  rocketTank: 2000,
  harvester: 500
}

productionButtons.querySelectorAll('.production-button').forEach(button => {
  button.addEventListener('click', () => {
    if (production.inProgress) return
    const unitType = button.getAttribute('data-unit-type')
    const cost = unitCosts[unitType] || 0
    if (gameState.money < cost) return
    gameState.money -= cost
    production.inProgress = true
    production.unitType = unitType
    production.startTime = performance.now()
    playSound('productionStart')
  })
})

pauseBtn.addEventListener('click', () => {
  gameState.gamePaused = !gameState.gamePaused
  pauseBtn.textContent = gameState.gamePaused ? 'Resume' : 'Pause'
})

restartBtn.addEventListener('click', () => {
  window.location.reload()
})

gameState.gameStarted = true
gameState.gamePaused = false
pauseBtn.textContent = 'Pause'

// Instead of auto-playing background music immediately,
// wait for the first user interaction.
document.addEventListener('click', initBackgroundMusic, { once: true })

const musicControlButton = document.getElementById('musicControl')
if (musicControlButton) {
  musicControlButton.addEventListener('click', () => {
    toggleBackgroundMusic()
    musicControlButton.textContent = musicControlButton.textContent === "Pause Music" ? "Play Music" : "Pause Music"
  })
}

let lastTime = performance.now()
function gameLoop(time) {
  const delta = time - lastTime
  lastTime = time
  if (gameState.gameStarted && !gameState.gamePaused) {
    updateGame(delta, mapGrid, factories, units, bullets, gameState)
  }
  if (production.inProgress) {
    const elapsed = performance.now() - production.startTime
    productionProgressEl.textContent = `${Math.floor((elapsed / production.duration) * 100)}%`
    if (elapsed >= production.duration) {
      const newUnit = spawnUnit(factories[0], production.unitType, units, mapGrid)
      newUnit.x = newUnit.tileX * TILE_SIZE
      newUnit.y = newUnit.tileY * TILE_SIZE
      newUnit.path = []
      newUnit.target = null
      if (production.unitType === 'tank') {
        newUnit.health = 100
        newUnit.maxHealth = 100
        newUnit.speed = 2
      } else if (production.unitType === 'rocketTank') {
        newUnit.health = 100
        newUnit.maxHealth = 100
        newUnit.speed = 2
      } else if (production.unitType === 'harvester') {
        newUnit.health = 150
        newUnit.maxHealth = 150
        newUnit.speed = 1
      }
      newUnit.owner = 'player'
      units.push(newUnit)
      production.inProgress = false
      productionProgressEl.textContent = ''
      playSound('productionReady')
    }
  }
  renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, gameState.scrollOffset, selectionActive, selectionStartExport, selectionEndExport)
  renderMinimap(minimapCtx, minimapCanvas, mapGrid, gameState.scrollOffset, gameCanvas, units)
  moneyEl.textContent = gameState.money
  gameTimeEl.textContent = Math.floor(gameState.gameTime)
  winsEl.textContent = gameState.wins
  lossesEl.textContent = gameState.losses
  requestAnimationFrame(gameLoop)
}

gameLoop(performance.now())
