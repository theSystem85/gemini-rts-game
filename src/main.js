import { TILE_SIZE, MAP_TILES_X, MAP_TILES_Y } from './config.js'
import { gameState } from './gameState.js'
import { tileToPixel } from './utils.js'
import { setupInputHandlers, selectedUnits, selectionActive, selectionStartExport, selectionEndExport } from './inputHandler.js'
import { renderGame, renderMinimap } from './rendering.js'
import { spawnUnit } from './units.js'
import { initFactories } from './factories.js'
import { playSound } from './sound.js'
import { updateGame } from './logic.js'

// DOM-Elemente
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
const sidebar = document.getElementById('sidebar')

// Entferne den redundanten Start-Button – nur der Toggle (Start/Resume) wird genutzt
pauseBtn.textContent = 'Start'

// Sidebar im Dark Mode
sidebar.style.backgroundColor = '#333'
sidebar.style.color = '#fff'

// Canvas-Größen setzen
function resizeCanvases() {
  gameCanvas.width = window.innerWidth - 250
  gameCanvas.height = window.innerHeight
  minimapCanvas.width = 250
  minimapCanvas.height = 150
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

// Map-Grid erstellen
export const mapGrid = []
for (let y = 0; y < MAP_TILES_Y; y++) {
  mapGrid[y] = []
  for (let x = 0; x < MAP_TILES_X; x++) {
    mapGrid[y][x] = { type: 'land' }
  }
}
// Features hinzufügen:
// Wasser: horizontales Flussband
for (let y = 45; y < 55; y++) {
  for (let x = 10; x < MAP_TILES_X - 10; x++) {
    mapGrid[y][x].type = 'water'
  }
}
// Felsen: vertikale Formation
for (let y = 20; y < 80; y++) {
  for (let x = 5; x < 15; x++) {
    mapGrid[y][x].type = 'rock'
  }
}
// Straße (wird später durch den Korridor der Fabriken überschrieben)
for (let y = 70; y < 75; y++) {
  for (let x = 50; x < MAP_TILES_X - 5; x++) {
    mapGrid[y][x].type = 'street'
  }
}
// Zufällige Ore-Patches
for (let i = 0; i < 100; i++) {
  const x = Math.floor(Math.random() * MAP_TILES_X)
  const y = Math.floor(Math.random() * MAP_TILES_Y)
  if (mapGrid[y][x].type === 'land') {
    mapGrid[y][x].type = 'ore'
  }
}

// Fabriken initialisieren
const factories = []
initFactories(factories, mapGrid)

// Globale Arrays für Einheiten und Geschosse
const units = []
const bullets = []

// Input-Handler initialisieren (Einheiten, Fabriken, Map-Grid übergeben)
setupInputHandlers(units, factories, mapGrid)

// Produktionsvariablen für die Spielerfabrik
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
      const newUnit = spawnUnit(factories[0], production.unitType, units)
      newUnit.x = newUnit.tileX * TILE_SIZE
      newUnit.y = newUnit.tileY * TILE_SIZE
      newUnit.path = []
      newUnit.target = null
      newUnit.health = production.unitType === 'tank' ? 100 : 150
      newUnit.maxHealth = newUnit.health
      newUnit.speed = production.unitType === 'tank' ? 2 : 1
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
