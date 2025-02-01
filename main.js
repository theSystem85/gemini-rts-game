// ========= GAME CONSTANTS AND GLOBALS =========

const TILE_SIZE = 32
const MAP_TILES_X = 100
const MAP_TILES_Y = 100
const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE

const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700'
}

let money = 10000
let gameTime = 0
let wins = 0
let losses = 0
let gamePaused = false
let gameStarted = false

let scrollOffset = { x: 0, y: 0 }
let isRightDragging = false
let lastDragPos = { x: 0, y: 0 }
let dragVelocity = { x: 0, y: 0 }
const INERTIA_DECAY = 0.95

// New globals for automatic enemy production
let enemyLastProductionTime = performance.now()
const enemyProductionInterval = 10000 // 10 seconds
const enemyGroupSize = 3

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
// We'll hide the "start" button and combine start/pause functionality into pauseBtn
const startBtn = document.getElementById('startBtn')
const pauseBtn = document.getElementById('pauseBtn')
const restartBtn = document.getElementById('restartBtn')

// Hide startBtn and initialize pauseBtn as a toggle
startBtn.style.display = 'none'
pauseBtn.textContent = 'Start'

const mapGrid = []
const factories = []
const units = []
const bullets = []

let selectedUnits = []
let isSelecting = false
let selectionStart = { x: 0, y: 0 }
let selectionEnd = { x: 0, y: 0 }

// Variables for improved selection behavior
let wasDragging = false

let production = {
  inProgress: false,
  unitType: null,
  startTime: 0,
  duration: 3000
}

// ========= INITIALIZATION FUNCTIONS =========

function resizeCanvases () {
  gameCanvas.width = gameCanvas.clientWidth = window.innerWidth - 250
  gameCanvas.height = gameCanvas.clientHeight = window.innerHeight
  minimapCanvas.width = minimapCanvas.clientWidth
  minimapCanvas.height = minimapCanvas.clientHeight
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

function initMapGrid () {
  for (let y = 0; y < MAP_TILES_Y; y++) {
    mapGrid[y] = []
    for (let x = 0; x < MAP_TILES_X; x++) {
      mapGrid[y][x] = { type: 'land' }
    }
  }
  // Horizontal water river in the middle
  for (let y = 45; y < 55; y++) {
    for (let x = 10; x < MAP_TILES_X - 10; x++) {
      mapGrid[y][x].type = 'water'
    }
  }
  // Vertical rock formation on the left side
  for (let y = 20; y < 80; y++) {
    for (let x = 5; x < 15; x++) {
      mapGrid[y][x].type = 'rock'
    }
  }
  // Street (light gray) near the right side
  for (let y = 70; y < 75; y++) {
    for (let x = 50; x < MAP_TILES_X - 5; x++) {
      mapGrid[y][x].type = 'street'
    }
  }
  // Random ore patches on land
  for (let i = 0; i < 100; i++) {
    const x = Math.floor(Math.random() * MAP_TILES_X)
    const y = Math.floor(Math.random() * MAP_TILES_Y)
    if (mapGrid[y][x].type === 'land') {
      mapGrid[y][x].type = 'ore'
    }
  }
}

function initFactories () {
  // Player factory: bottom left
  const playerFactory = {
    id: 'player',
    x: 1,
    y: MAP_TILES_Y - 3,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0
  }
  // Enemy factory: top right
  const enemyFactory = {
    id: 'enemy',
    x: MAP_TILES_X - 4,
    y: 1,
    width: 3,
    height: 2,
    health: 1000,
    maxHealth: 1000,
    productionCountdown: 0
  }
  factories.push(playerFactory, enemyFactory)

  // Carve an L-shaped corridor between factories
  const corridorStart = { x: playerFactory.x + playerFactory.width, y: playerFactory.y }
  const corridorEnd = { x: enemyFactory.x, y: enemyFactory.y + enemyFactory.height }
  for (let x = corridorStart.x; x <= corridorEnd.x; x++) {
    if (mapGrid[corridorStart.y] && mapGrid[corridorStart.y][x]) {
      mapGrid[corridorStart.y][x].type = 'land'
    }
  }
  for (let y = corridorStart.y; y <= corridorEnd.y; y++) {
    if (mapGrid[y] && mapGrid[y][corridorEnd.x]) {
      mapGrid[y][corridorEnd.x].type = 'land'
    }
  }
}

// ========= GAME OBJECT FUNCTIONS =========

function tileToPixel (tileX, tileY) {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }
}

function findPath (start, end) {
  const openList = []
  const closedSet = new Set()
  const startNode = { x: start.x, y: start.y, g: 0, h: Math.abs(end.x - start.x) + Math.abs(end.y - start.y) }
  startNode.f = startNode.g + startNode.h
  openList.push(startNode)

  function nodeKey (node) {
    return `${node.x},${node.y}`
  }

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()
    if (current.x === end.x && current.y === end.y) {
      const path = []
      let node = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return path
    }
    closedSet.add(nodeKey(current))
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ]
    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= MAP_TILES_X || neighbor.y >= MAP_TILES_Y) continue
      const tileType = mapGrid[neighbor.y][neighbor.x].type
      if (tileType === 'water' || tileType === 'rock') continue
      if (closedSet.has(nodeKey(neighbor))) continue
      const gScore = current.g + 1
      const hScore = Math.abs(end.x - neighbor.x) + Math.abs(end.y - neighbor.y)
      const fScore = gScore + hScore
      const existing = openList.find(n => n.x === neighbor.x && n.y === neighbor.y)
      if (existing && existing.f <= fScore) continue
      openList.push({ x: neighbor.x, y: neighbor.y, g: gScore, h: hScore, f: fScore, parent: current })
    }
  }
  return []
}

function spawnUnit (factory, unitType) {
  // Prevent spawning into an occupied area:
  let spawnX = factory.x + factory.width
  let spawnY = factory.y
  while (units.some(u => u.tileX === spawnX && u.tileY === spawnY)) {
    spawnX++
    if (spawnX >= MAP_TILES_X) { spawnX = factory.x; spawnY++ }
  }
  const unit = {
    id: Date.now() + Math.random(),
    type: unitType, // "tank" or "harvester"
    tileX: spawnX,
    tileY: spawnY,
    x: spawnX * TILE_SIZE,
    y: spawnY * TILE_SIZE,
    speed: unitType === 'tank' ? 2 : 1,
    health: unitType === 'tank' ? 100 : 150,
    maxHealth: unitType === 'tank' ? 100 : 150,
    path: [],
    target: null,
    selected: false,
    oreCarried: 0,
    harvesting: false,
    harvestTimer: 0,
    owner: factory.id === 'player' ? 'player' : 'enemy'
  }
  units.push(unit)
  playSound('productionStart')
  return unit
}

// ========= SOUND EFFECTS =========

function playSound (eventName) {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.frequency.value = eventName === 'unitSelection' ? 600 :
      eventName === 'movement' ? 400 :
      eventName === 'shoot' ? 800 : 500
    oscillator.type = 'sine'
    oscillator.start()
    oscillator.stop(context.currentTime + 0.1)
  } catch (e) {
    // Do nothing if Web Audio API is unsupported
  }
}

// ========= INPUT HANDLING =========

// Prevent default right-click context menu
gameCanvas.addEventListener('contextmenu', e => e.preventDefault())

// --- Mousedown: start selection or initiate right-drag scrolling ---
gameCanvas.addEventListener('mousedown', e => {
  const rect = gameCanvas.getBoundingClientRect()
  const worldX = e.clientX - rect.left + scrollOffset.x
  const worldY = e.clientY - rect.top + scrollOffset.y

  if (e.button === 2) {
    isRightDragging = true
    lastDragPos = { x: e.clientX, y: e.clientY }
  } else if (e.button === 0) {
    isSelecting = true
    wasDragging = false
    selectionStart = { x: worldX, y: worldY }
    selectionEnd = { x: worldX, y: worldY }
  }
})

// --- Mousemove: update scrolling, track selection, and update hover cursor ---
gameCanvas.addEventListener('mousemove', e => {
  const rect = gameCanvas.getBoundingClientRect()
  const worldX = e.clientX - rect.left + scrollOffset.x
  const worldY = e.clientY - rect.top + scrollOffset.y

  if (isRightDragging) {
    const dx = e.clientX - lastDragPos.x
    const dy = e.clientY - lastDragPos.y
    scrollOffset.x = Math.max(0, Math.min(scrollOffset.x - dx, MAP_WIDTH - gameCanvas.width))
    scrollOffset.y = Math.max(0, Math.min(scrollOffset.y - dy, MAP_HEIGHT - gameCanvas.height))
    dragVelocity = { x: dx, y: dy }
    lastDragPos = { x: e.clientX, y: e.clientY }
  }
  if (isSelecting) {
    selectionEnd = { x: worldX, y: worldY }
    if (!wasDragging &&
        (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5)) {
      wasDragging = true
    }
  }
  // --- New hover-cursor logic (Requirements 3.1.5.1–3) ---
  if (!isRightDragging && !isSelecting && e.buttons === 0) {
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + scrollOffset.x
    const worldY = e.clientY - rect.top + scrollOffset.y
    if (selectedUnits.length > 0) {
      const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
      let targetObject = null
      // Check enemy factory first
      for (const factory of factories) {
        if (factory.id === 'enemy' &&
            targetTile.x >= factory.x && targetTile.x < factory.x + factory.width &&
            targetTile.y >= factory.y && targetTile.y < factory.y + factory.height) {
          targetObject = factory
          break
        }
      }
      // Then check enemy units
      if (!targetObject) {
        for (const unit of units) {
          if (unit.owner !== 'player' &&
              Math.floor(unit.x / TILE_SIZE) === targetTile.x &&
              Math.floor(unit.y / TILE_SIZE) === targetTile.y) {
            targetObject = unit
            break
          }
        }
      }
      const selUnit = selectedUnits[0]
      const path = findPath({ x: selUnit.tileX, y: selUnit.tileY }, targetTile)
      if (path.length === 0) {
        gameCanvas.style.cursor = 'not-allowed'
      } else if (targetObject) {
        let targetCenter = null
        if ('tileX' in targetObject) { // enemy unit
          targetCenter = { x: targetObject.x + TILE_SIZE / 2, y: targetObject.y + TILE_SIZE / 2 }
        } else { // enemy factory
          targetCenter = { x: (targetObject.x + (targetObject.width * TILE_SIZE) / 2), y: (targetObject.y + (targetObject.height * TILE_SIZE) / 2) }
        }
        const selCenter = { x: selUnit.x + TILE_SIZE / 2, y: selUnit.y + TILE_SIZE / 2 }
        const dx = targetCenter.x - selCenter.x
        const dy = targetCenter.y - selCenter.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const TANK_FIRE_RANGE = TILE_SIZE * 2
        if (dist <= TANK_FIRE_RANGE) {
          // Immediate attack possible (in range)
          gameCanvas.style.cursor = 'pointer'
        } else {
          // Enemy present but out of fire range
          gameCanvas.style.cursor = 'crosshair'
        }
      } else {
        gameCanvas.style.cursor = 'move'
      }
    } else {
      gameCanvas.style.cursor = 'default'
    }
  }
})

// --- Mouseup: finish selection or issue move/attack orders (fixing tank movement bug) ---
gameCanvas.addEventListener('mouseup', e => {
  if (e.button === 2) {
    isRightDragging = false
  } else if (e.button === 0 && isSelecting) {
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + scrollOffset.x
    const worldY = e.clientY - rect.top + scrollOffset.y

    if (wasDragging) {
      // Multi-unit selection via drag bounding box.
      const x1 = Math.min(selectionStart.x, selectionEnd.x)
      const y1 = Math.min(selectionStart.y, selectionEnd.y)
      const x2 = Math.max(selectionStart.x, selectionEnd.x)
      const y2 = Math.max(selectionStart.y, selectionEnd.y)
      selectedUnits = []
      units.forEach(unit => {
        if (unit.owner === 'player') {
          const centerX = unit.x + TILE_SIZE / 2
          const centerY = unit.y + TILE_SIZE / 2
          if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
            unit.selected = true
            selectedUnits.push(unit)
            playSound('unitSelection')
          } else {
            unit.selected = false
          }
        }
      })
      gameCanvas.style.cursor = selectedUnits.length > 0 ? 'move' : 'default'
    } else {
      // Single click: check if a player unit was clicked.
      let clickedUnit = null
      for (const unit of units) {
        if (unit.owner === 'player') {
          const centerX = unit.x + TILE_SIZE / 2
          const centerY = unit.y + TILE_SIZE / 2
          const dx = worldX - centerX
          const dy = worldY - centerY
          if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE / 2) {
            clickedUnit = unit
            break
          }
        }
      }
      if (clickedUnit) {
        selectedUnits.forEach(u => u.selected = false)
        selectedUnits = [clickedUnit]
        clickedUnit.selected = true
        playSound('unitSelection')
        gameCanvas.style.cursor = 'move'
      } else if (selectedUnits.length > 0) {
        // No player unit was clicked; issue move/attack orders.
        const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
        let target = null
        // Check enemy factory.
        for (const factory of factories) {
          if (factory.id === 'enemy' &&
              targetTile.x >= factory.x && targetTile.x < factory.x + factory.width &&
              targetTile.y >= factory.y && targetTile.y < factory.y + factory.height) {
            target = factory
            break
          }
        }
        // Check enemy units if factory not found.
        if (!target) {
          for (const unit of units) {
            if (unit.owner !== 'player' &&
                Math.floor(unit.x / TILE_SIZE) === targetTile.x &&
                Math.floor(unit.y / TILE_SIZE) === targetTile.y) {
              target = unit
              break
            }
          }
        }
        // Issue orders.
        selectedUnits.forEach(unit => {
          const start = { x: unit.tileX, y: unit.tileY }
          const end = target ? { x: target.x || target.tileX, y: target.y || target.tileY } : targetTile
          const path = findPath(start, end)
          if (path.length > 0) {
            unit.path = path.slice(1)
            unit.target = target
            playSound('movement')
            gameCanvas.style.cursor = target ? 'crosshair' : 'move'
          } else {
            gameCanvas.style.cursor = 'not-allowed'
          }
        })
      } else {
        // Clicked on empty space with no selection: clear selection.
        selectedUnits.forEach(u => u.selected = false)
        selectedUnits = []
        gameCanvas.style.cursor = 'default'
      }
    }
    isSelecting = false
  }
})

// --- Minimap click: recenter main view based on minimap click (bug fix #2) ---
minimapCanvas.addEventListener('click', e => {
  const rect = minimapCanvas.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top
  const scaleX = MAP_WIDTH / minimapCanvas.width
  const scaleY = MAP_HEIGHT / minimapCanvas.height
  scrollOffset.x = Math.max(0, Math.min(clickX * scaleX - gameCanvas.width / 2, MAP_WIDTH - gameCanvas.width))
  scrollOffset.y = Math.max(0, Math.min(clickY * scaleY - gameCanvas.height / 2, MAP_HEIGHT - gameCanvas.height))
})

// ========= UI BUTTONS (Toggle Start/Pause; bug fix #3) =========

pauseBtn.addEventListener('click', () => {
  if (!gameStarted) {
    gameStarted = true
    gamePaused = false
    pauseBtn.textContent = 'Pause'
  } else {
    gamePaused = !gamePaused
    pauseBtn.textContent = gamePaused ? 'Resume' : 'Pause'
  }
})
restartBtn.addEventListener('click', () => {
  window.location.reload()
})
produceBtn.addEventListener('click', () => {
  if (production.inProgress) return
  const unitType = unitTypeSelect.value
  const cost = unitType === 'tank' ? 1000 : 500
  if (money < cost) return
  money -= cost
  production.inProgress = true
  production.unitType = unitType
  production.startTime = performance.now()
  playSound('productionStart')
})

// ========= GAME UPDATE FUNCTIONS =========

function updateGame (delta) {
  if (gamePaused) return

  // --- New Enemy Production (Requirement 3.3.4) ---
  let now = performance.now()
  if (now - enemyLastProductionTime >= enemyProductionInterval) {
    for (let i = 0; i < enemyGroupSize; i++) {
      let enemyUnit = spawnUnit(factories[1], 'tank')
      enemyUnit.path = findPath({ x: enemyUnit.tileX, y: enemyUnit.tileY }, { x: factories[0].x, y: factories[0].y }).slice(1)
      enemyUnit.target = factories[0]
    }
    enemyLastProductionTime = now
  }

  gameTime += delta / 1000

  if (production.inProgress) {
    const elapsed = performance.now() - production.startTime
    productionProgressEl.textContent = `${Math.floor((elapsed / production.duration) * 100)}%`
    if (elapsed >= production.duration) {
      spawnUnit(factories[0], production.unitType)
      production.inProgress = false
      productionProgressEl.textContent = ''
      playSound('productionReady')
    }
  }

  if (!isRightDragging) {
    scrollOffset.x = Math.max(0, Math.min(scrollOffset.x - dragVelocity.x, MAP_WIDTH - gameCanvas.width))
    scrollOffset.y = Math.max(0, Math.min(scrollOffset.y - dragVelocity.y, MAP_HEIGHT - gameCanvas.height))
    dragVelocity.x *= INERTIA_DECAY
    dragVelocity.y *= INERTIA_DECAY
  }

  units.forEach(unit => {
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0]
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE }
      const dx = targetPos.x - unit.x
      const dy = targetPos.y - unit.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < unit.speed) {
        unit.x = targetPos.x
        unit.y = targetPos.y
        unit.tileX = nextTile.x
        unit.tileY = nextTile.y
        unit.path.shift()
      } else {
        unit.x += (dx / distance) * unit.speed
        unit.y += (dy / distance) * unit.speed
      }
    } else {
      if (unit.target && unit.type === 'tank') {
        const tx = unit.target.x || (unit.target.tileX * TILE_SIZE)
        const ty = unit.target.y || (unit.target.tileY * TILE_SIZE)
        const bullet = {
          id: Date.now() + Math.random(),
          x: unit.x + TILE_SIZE / 2,
          y: unit.y + TILE_SIZE / 2,
          target: unit.target,
          speed: 4,
          baseDamage: 20,
          active: true
        }
        bullets.push(bullet)
        unit.target = null
        playSound('shoot')
      }
    }
    if (unit.type === 'harvester' && !unit.harvesting) {
      const tileX = Math.floor(unit.x / TILE_SIZE)
      const tileY = Math.floor(unit.y / TILE_SIZE)
      if (mapGrid[tileY][tileX].type === 'ore' && unit.oreCarried < 5) {
        unit.harvesting = true
        unit.harvestTimer = performance.now()
        playSound('harvest')
      }
    }
    if (unit.type === 'harvester' && unit.harvesting) {
      if (performance.now() - unit.harvestTimer > 10000) {
        unit.oreCarried++
        unit.harvesting = false
        if (unit.oreCarried >= 5) {
          const factoryPos = { x: factories[0].x, y: factories[0].y }
          unit.path = findPath({ x: unit.tileX, y: unit.tileY }, factoryPos).slice(1)
        }
      }
    }
    if (unit.type === 'harvester' && unit.oreCarried > 0) {
      if (unit.tileX >= factories[0].x && unit.tileX < factories[0].x + factories[0].width &&
          unit.tileY >= factories[0].y && unit.tileY < factories[0].y + factories[0].height) {
        money += 500
        unit.oreCarried = 0
        playSound('deposit')
      }
    }
  })

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet.active) continue
    let targetPos = null
    if (bullet.target) {
      targetPos = { x: (bullet.target.x || bullet.target.tileX * TILE_SIZE), y: (bullet.target.y || bullet.target.tileY * TILE_SIZE) }
    } else {
      bullet.active = false
      continue
    }
    const dx = targetPos.x - bullet.x
    const dy = targetPos.y - bullet.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < bullet.speed || distance === 0) {
      const factor = 0.8 + Math.random() * 0.4
      const damage = bullet.baseDamage * factor
      if (bullet.target.health !== undefined) {
        bullet.target.health -= damage
        bullet.active = false
        playSound('bulletHit')
        if (bullet.target.health <= 0) {
          if (bullet.target.id === 'enemy' || bullet.target.id === 'player') {
            if (bullet.target.id === 'enemy') {
              wins++
            } else {
              losses++
            }
          }
          const index = units.findIndex(u => u.id === bullet.target.id)
          if (index !== -1) {
            units.splice(index, 1)
          }
          selectedUnits = selectedUnits.filter(u => u !== bullet.target)
          bullet.target = null
        }
      }
    } else {
      bullet.x += (dx / distance) * bullet.speed
      bullet.y += (dy / distance) * bullet.speed
    }
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].active) bullets.splice(i, 1)
  }
  if (Math.random() < (1 / 90000 * delta)) {
    for (let y = 0; y < MAP_TILES_Y; y++) {
      for (let x = 0; x < MAP_TILES_X; x++) {
        if (mapGrid[y][x].type === 'ore') {
          const neighbors = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 }
          ]
          const candidate = neighbors[Math.floor(Math.random() * neighbors.length)]
          if (candidate.x >= 0 && candidate.y >= 0 && candidate.x < MAP_TILES_X && candidate.y < MAP_TILES_Y) {
            if (mapGrid[candidate.y][candidate.x].type === 'land' && Math.random() < 0.3) {
              mapGrid[candidate.y][candidate.x].type = 'ore'
            }
          }
        }
      }
    }
  }
}

function renderGame () {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
  const startTileX = Math.floor(scrollOffset.x / TILE_SIZE)
  const startTileY = Math.floor(scrollOffset.y / TILE_SIZE)
  const endTileX = Math.min(MAP_TILES_X, Math.ceil((scrollOffset.x + gameCanvas.width) / TILE_SIZE))
  const endTileY = Math.min(MAP_TILES_Y, Math.ceil((scrollOffset.y + gameCanvas.height) / TILE_SIZE))
  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = mapGrid[y][x]
      gameCtx.fillStyle = TILE_COLORS[tile.type]
      gameCtx.fillRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
      gameCtx.strokeStyle = 'rgba(0,0,0,0.1)'
      gameCtx.strokeRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
    }
  }
  factories.forEach(factory => {
    const pos = tileToPixel(factory.x, factory.y)
    gameCtx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - scrollOffset.y, factory.width * TILE_SIZE, factory.height * TILE_SIZE)
    const barWidth = factory.width * TILE_SIZE
    const healthRatio = factory.health / factory.maxHealth
    gameCtx.fillStyle = '#0F0'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth * healthRatio, 5)
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth, 5)
  })
  units.forEach(unit => {
    gameCtx.fillStyle = unit.type === 'tank' ? '#00F' : '#9400D3'
    gameCtx.beginPath()
    gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3, 0, 2 * Math.PI)
    gameCtx.fill()
    if (unit.selected) {
      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3 + 3, 0, 2 * Math.PI)
      gameCtx.stroke()
    }
    // --- New: Draw turret for tanks (Requirement 3.1.5.4) ---
    if (unit.type === 'tank' && unit.target) {
      const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
      const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y
      let targetCenter = null
      if ('tileX' in unit.target) {
        targetCenter = { x: unit.target.x + TILE_SIZE / 2 - scrollOffset.x, y: unit.target.y + TILE_SIZE / 2 - scrollOffset.y }
      } else {
        targetCenter = { x: (unit.target.x + (unit.target.width * TILE_SIZE) / 2) - scrollOffset.x, y: (unit.target.y + (unit.target.height * TILE_SIZE) / 2) - scrollOffset.y }
      }
      const dx = targetCenter.x - centerX
      const dy = targetCenter.y - centerY
      const angle = Math.atan2(dy, dx)
      const turretLength = 10
      const turretEndX = centerX + Math.cos(angle) * turretLength
      const turretEndY = centerY + Math.sin(angle) * turretLength
      gameCtx.strokeStyle = '#000'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.moveTo(centerX, centerY)
      gameCtx.lineTo(turretEndX, turretEndY)
      gameCtx.stroke()
    }
    // --- New: Harvester harvesting progress bar (Requirement 3.2.8) ---
    if (unit.type === 'harvester' && unit.harvesting) {
      const progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1)
      const barWidth = TILE_SIZE
      const barHeight = 4
      const x = unit.x - scrollOffset.x
      const y = unit.y + TILE_SIZE - scrollOffset.y
      gameCtx.fillStyle = '#555'
      gameCtx.fillRect(x, y, barWidth, barHeight)
      gameCtx.fillStyle = '#0F0'
      gameCtx.fillRect(x, y, barWidth * progress, barHeight)
      gameCtx.strokeStyle = '#000'
      gameCtx.strokeRect(x, y, barWidth, barHeight)
    }
  })
  bullets.forEach(bullet => {
    gameCtx.fillStyle = '#FFF'
    gameCtx.beginPath()
    gameCtx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI)
    gameCtx.fill()
  })
  if (isSelecting) {
    const rectX = selectionStart.x - scrollOffset.x
    const rectY = selectionStart.y - scrollOffset.y
    const rectWidth = selectionEnd.x - selectionStart.x
    const rectHeight = selectionEnd.y - selectionStart.y
    gameCtx.strokeStyle = '#FF0'
    gameCtx.lineWidth = 1
    gameCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  }
}

function renderMinimap () {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)
  const scaleX = minimapCanvas.width / MAP_WIDTH
  const scaleY = minimapCanvas.height / MAP_HEIGHT
  for (let y = 0; y < MAP_TILES_Y; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type]
      minimapCtx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY)
    }
  }
  minimapCtx.strokeStyle = '#FF0'
  minimapCtx.lineWidth = 2
  minimapCtx.strokeRect(scrollOffset.x * scaleX, scrollOffset.y * scaleY, gameCanvas.width * scaleX, gameCanvas.height * scaleY)
}

let lastTime = performance.now()
function gameLoop (time) {
  const delta = time - lastTime
  lastTime = time
  if (gameStarted && !gamePaused) {
    updateGame(delta)
  }
  renderGame()
  renderMinimap()
  moneyEl.textContent = money
  gameTimeEl.textContent = Math.floor(gameTime)
  winsEl.textContent = wins
  lossesEl.textContent = losses
  requestAnimationFrame(gameLoop)
}

initMapGrid()
initFactories()
requestAnimationFrame(gameLoop)
