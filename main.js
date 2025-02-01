// ========= GAME CONSTANTS AND GLOBALS =========

// Tile size in pixels
const TILE_SIZE = 32
// Map grid dimensions (in tiles)
const MAP_TILES_X = 100
const MAP_TILES_Y = 100
// Pixel dimensions for the full map
const MAP_WIDTH = MAP_TILES_X * TILE_SIZE
const MAP_HEIGHT = MAP_TILES_Y * TILE_SIZE

// Colors for each tile type
const TILE_COLORS = {
  land: '#A0522D',
  water: '#1E90FF',
  rock: '#808080',
  street: '#D3D3D3',
  ore: '#FFD700'
}

// Game state globals
let money = 10000
let gameTime = 0 // in seconds
let wins = 0
let losses = 0
let gamePaused = false
let gameStarted = false

// Scroll offset for the main map view (in pixels)
let scrollOffset = { x: 0, y: 0 }
// Variables for inertia scrolling
let isRightDragging = false
let lastDragPos = { x: 0, y: 0 }
let dragVelocity = { x: 0, y: 0 }
const INERTIA_DECAY = 0.95

// Canvas & context references
const gameCanvas = document.getElementById('gameCanvas')
const gameCtx = gameCanvas.getContext('2d')
const minimapCanvas = document.getElementById('minimap')
const minimapCtx = minimapCanvas.getContext('2d')

// UI element references
const moneyEl = document.getElementById('money')
const gameTimeEl = document.getElementById('gameTime')
const winsEl = document.getElementById('wins')
const lossesEl = document.getElementById('losses')
const unitTypeSelect = document.getElementById('unitType')
const produceBtn = document.getElementById('produceBtn')
const productionProgressEl = document.getElementById('productionProgress')
const startBtn = document.getElementById('startBtn')
const pauseBtn = document.getElementById('pauseBtn')
const restartBtn = document.getElementById('restartBtn')

// Arrays for storing game objects
const mapGrid = []      // 2D array holding tile info
const factories = []    // Two factories: player and enemy
const units = []        // All moving units (tanks and harvesters)
const bullets = []      // Active bullets in flight

// Selection tracking
let selectedUnits = []
let isSelecting = false
let selectionStart = { x: 0, y: 0 }
let selectionEnd = { x: 0, y: 0 }

// Production variables (only one production at a time for simplicity)
let production = {
  inProgress: false,
  unitType: null,
  startTime: 0,
  duration: 3000 // production time in ms (for both types, adjust as needed)
}

// ========= INITIALIZATION FUNCTIONS =========

// Set canvas sizes to match container sizes
function resizeCanvases () {
  gameCanvas.width = gameCanvas.clientWidth = window.innerWidth - 250
  gameCanvas.height = gameCanvas.clientHeight = window.innerHeight
  minimapCanvas.width = minimapCanvas.clientWidth
  minimapCanvas.height = minimapCanvas.clientHeight
}
window.addEventListener('resize', resizeCanvases)
resizeCanvases()

// Initialize the map grid as a 2D array of tile objects
function initMapGrid () {
  for (let y = 0; y < MAP_TILES_Y; y++) {
    mapGrid[y] = []
    for (let x = 0; x < MAP_TILES_X; x++) {
      // Default tile is land
      mapGrid[y][x] = { type: 'land' }
    }
  }
  // Add connected water, rock, and street patterns using simple rectangles
  // (In a full game, you might use noise or cellular automata)
  // Example: a horizontal water river in the middle
  for (let y = 45; y < 55; y++) {
    for (let x = 10; x < MAP_TILES_X - 10; x++) {
      mapGrid[y][x].type = 'water'
    }
  }
  // Example: vertical rock formation on the left side
  for (let y = 20; y < 80; y++) {
    for (let x = 5; x < 15; x++) {
      mapGrid[y][x].type = 'rock'
    }
  }
  // Example: a street (light gray) forming a connected path near the right
  for (let y = 70; y < 75; y++) {
    for (let x = 50; x < MAP_TILES_X - 5; x++) {
      mapGrid[y][x].type = 'street'
    }
  }
  // Add some ore patches randomly on land and later allow them to spread
  for (let i = 0; i < 100; i++) {
    const x = Math.floor(Math.random() * MAP_TILES_X)
    const y = Math.floor(Math.random() * MAP_TILES_Y)
    if (mapGrid[y][x].type === 'land') {
      mapGrid[y][x].type = 'ore'
    }
  }
}

// Create factories (player and enemy) with designated positions and sizes
function initFactories () {
  // Player factory: bottom left (avoid map edge)
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

  // Carve an L-shaped corridor between the two factories so water/rock don’t block the path
  const corridorStart = { x: playerFactory.x + playerFactory.width, y: playerFactory.y }
  const corridorEnd = { x: enemyFactory.x, y: enemyFactory.y + enemyFactory.height }
  // Horizontal part
  for (let x = corridorStart.x; x <= corridorEnd.x; x++) {
    if (mapGrid[corridorStart.y] && mapGrid[corridorStart.y][x]) {
      mapGrid[corridorStart.y][x].type = 'land'
    }
  }
  // Vertical part
  for (let y = corridorStart.y; y <= corridorEnd.y; y++) {
    if (mapGrid[y] && mapGrid[y][corridorEnd.x]) {
      mapGrid[y][corridorEnd.x].type = 'land'
    }
  }
}

// ========= GAME OBJECT FUNCTIONS =========

// Helper to convert tile coordinates to pixel coordinates
function tileToPixel (tileX, tileY) {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }
}

// Basic A* pathfinding on the grid (very simplified)
function findPath (start, end) {
  // Each node: { x, y, f, g, h, parent }
  const openList = []
  const closedList = []
  const startNode = { x: start.x, y: start.y, g: 0, h: Math.abs(end.x - start.x) + Math.abs(end.y - start.y) }
  startNode.f = startNode.g + startNode.h
  openList.push(startNode)

  function nodeKey (node) {
    return `${node.x},${node.y}`
  }
  const closedSet = new Set()

  while (openList.length > 0) {
    // Get node with lowest f value
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()
    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path
      const path = []
      let node = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return path
    }
    closedSet.add(nodeKey(current))
    // Check 4 neighbors (up/down/left/right)
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ]
    for (const neighbor of neighbors) {
      // Check boundaries
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= MAP_TILES_X || neighbor.y >= MAP_TILES_Y) continue
      // Check if tile is passable (land, ore, street; factories and water/rock block tanks, but ore is passable)
      const tileType = mapGrid[neighbor.y][neighbor.x].type
      if (tileType === 'water' || tileType === 'rock') continue
      if (closedSet.has(nodeKey(neighbor))) continue
      const gScore = current.g + 1
      const hScore = Math.abs(end.x - neighbor.x) + Math.abs(end.y - neighbor.y)
      const fScore = gScore + hScore
      // Check if neighbor already in openList with a lower f value
      const existing = openList.find(n => n.x === neighbor.x && n.y === neighbor.y)
      if (existing && existing.f <= fScore) continue
      openList.push({ x: neighbor.x, y: neighbor.y, g: gScore, h: hScore, f: fScore, parent: current })
    }
  }
  // If no path is found, return an empty array.
  return []
}

// Create a new unit (tank or harvester) at a given factory
function spawnUnit (factory, unitType) {
  // Prevent spawning into an occupied area:
  // Here we simply add a unit at the factory’s adjacent tile.
  let spawnX = factory.x + factory.width
  let spawnY = factory.y
  // Check if the tile is already occupied by another unit – if so, move one tile further
  while (units.some(u => u.tileX === spawnX && u.tileY === spawnY)) {
    spawnX++
    if (spawnX >= MAP_TILES_X) { spawnX = factory.x; spawnY++ }
  }
  // Create a unit object.
  const unit = {
    id: Date.now() + Math.random(),
    type: unitType, // "tank" or "harvester"
    tileX: spawnX,
    tileY: spawnY,
    // For smooth movement we also track pixel coordinates.
    x: spawnX * TILE_SIZE,
    y: spawnY * TILE_SIZE,
    // Speed: tanks move 2 pixels per frame, harvesters 1 pixel per frame (50% slower)
    speed: unitType === 'tank' ? 2 : 1,
    health: unitType === 'tank' ? 100 : 150, // harvesters have 300% armor of tanks (example)
    maxHealth: unitType === 'tank' ? 100 : 150,
    path: [],
    target: null, // For movement orders or attacking enemy
    selected: false,
    // For harvesters: ore carried and timer
    oreCarried: 0,
    harvesting: false,
    harvestTimer: 0
  }
  units.push(unit)
  // Play production start sound
  playSound('productionStart')
}

// ========= SOUND EFFECTS (using Web Audio API beep) =========

function playSound (eventName) {
  // In a full implementation, you’d have distinct sounds per event.
  // For simplicity, we generate a short beep tone.
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    // Set frequency depending on event type
    oscillator.frequency.value = eventName === 'unitSelection' ? 600 :
      eventName === 'movement' ? 400 :
      eventName === 'shoot' ? 800 : 500
    oscillator.type = 'sine'
    oscillator.start()
    oscillator.stop(context.currentTime + 0.1)
  } catch (e) {
    // If Web Audio API is not supported, do nothing.
  }
}

// ========= INPUT HANDLING =========

// Prevent default right-click context menu on game canvas
gameCanvas.addEventListener('contextmenu', e => e.preventDefault())

// Mouse events on the main game canvas for selection and scrolling
gameCanvas.addEventListener('mousedown', e => {
  // Get mouse position relative to canvas and add scroll offset to convert to world coordinates
  const rect = gameCanvas.getBoundingClientRect()
  const worldX = e.clientX - rect.left + scrollOffset.x
  const worldY = e.clientY - rect.top + scrollOffset.y

  if (e.button === 2) {
    // Right-click: initiate drag for map scrolling
    isRightDragging = true
    lastDragPos = { x: e.clientX, y: e.clientY }
  } else if (e.button === 0) {
    // Left-click: begin unit selection or issue orders
    // For multi-select, start drawing selection rectangle.
    isSelecting = true
    selectionStart = { x: worldX, y: worldY }
    selectionEnd = { x: worldX, y: worldY }
  }
})

gameCanvas.addEventListener('mousemove', e => {
  const rect = gameCanvas.getBoundingClientRect()
  const worldX = e.clientX - rect.left + scrollOffset.x
  const worldY = e.clientY - rect.top + scrollOffset.y

  if (isRightDragging) {
    // Update scrolling offset based on mouse movement
    const dx = e.clientX - lastDragPos.x
    const dy = e.clientY - lastDragPos.y
    scrollOffset.x = Math.max(0, Math.min(scrollOffset.x - dx, MAP_WIDTH - gameCanvas.width))
    scrollOffset.y = Math.max(0, Math.min(scrollOffset.y - dy, MAP_HEIGHT - gameCanvas.height))
    // Save velocity for inertia effect
    dragVelocity = { x: dx, y: dy }
    lastDragPos = { x: e.clientX, y: e.clientY }
  }
  if (isSelecting) {
    selectionEnd = { x: worldX, y: worldY }
  }
})

gameCanvas.addEventListener('mouseup', e => {
  if (e.button === 2) {
    // End right-click dragging; inertia will take over
    isRightDragging = false
  } else if (e.button === 0) {
    if (isSelecting) {
      // Finish selection: select any unit whose center falls within the selection rectangle.
      const x1 = Math.min(selectionStart.x, selectionEnd.x)
      const y1 = Math.min(selectionStart.y, selectionEnd.y)
      const x2 = Math.max(selectionStart.x, selectionEnd.x)
      const y2 = Math.max(selectionStart.y, selectionEnd.y)
      selectedUnits = []
      for (const unit of units) {
        // Use unit’s center (x + half tile)
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
      isSelecting = false
    }
  }
})

// Left-click on canvas (if not dragging) to issue move/attack orders
gameCanvas.addEventListener('click', e => {
  // If units are selected, order them to move toward the clicked tile.
  // Convert click position to tile coordinates.
  const rect = gameCanvas.getBoundingClientRect()
  const worldX = e.clientX - rect.left + scrollOffset.x
  const worldY = e.clientY - rect.top + scrollOffset.y
  const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
  // Check if an enemy unit or factory exists at that tile.
  let target = null
  // Check enemy factories:
  for (const factory of factories) {
    if (factory.id === 'enemy') {
      if (targetTile.x >= factory.x && targetTile.x < factory.x + factory.width &&
          targetTile.y >= factory.y && targetTile.y < factory.y + factory.height) {
        target = factory
        break
      }
    }
  }
  // Check enemy units:
  if (!target) {
    for (const unit of units) {
      // For simplicity, assume enemy units are those not selected (i.e. not player-controlled)
      if (!unit.selected && unit.type === 'tank') {
        if (Math.floor(unit.x / TILE_SIZE) === targetTile.x &&
            Math.floor(unit.y / TILE_SIZE) === targetTile.y) {
          target = unit
          break
        }
      }
    }
  }
  // Issue orders to all selected units
  selectedUnits.forEach(unit => {
    // Calculate path from current tile to target tile using A*
    const start = { x: unit.tileX, y: unit.tileY }
    const end = target ? { x: target.x || target.tileX, y: target.y || target.tileY } : targetTile
    const path = findPath(start, end)
    if (path.length === 0) {
      // If no valid path, change cursor or indicate error (not implemented fully)
      gameCanvas.style.cursor = 'not-allowed'
    } else {
      unit.path = path.slice(1) // remove first tile which is current location
      unit.target = target
      gameCanvas.style.cursor = target ? 'crosshair' : 'pointer'
      playSound('movement')
    }
  })
})

// Minimap click: recenter main view to clicked location.
minimapCanvas.addEventListener('click', e => {
  const rect = minimapCanvas.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top
  // Determine scale factor between minimap and full map
  const scaleX = MAP_WIDTH / minimapCanvas.width
  const scaleY = MAP_HEIGHT / minimapCanvas.height
  // Center the view so that clicked point becomes the center of the game canvas
  scrollOffset.x = Math.max(0, Math.min(clickX * scaleX - gameCanvas.width / 2, MAP_WIDTH - gameCanvas.width))
  scrollOffset.y = Math.max(0, Math.min(clickY * scaleY - gameCanvas.height / 2, MAP_HEIGHT - gameCanvas.height))
})

// ========= UI BUTTONS =========

startBtn.addEventListener('click', () => {
  if (!gameStarted) {
    gameStarted = true
    gamePaused = false
  }
})
pauseBtn.addEventListener('click', () => {
  gamePaused = !gamePaused
})
restartBtn.addEventListener('click', () => {
  // Simply reload the page for a restart in this minimal version.
  window.location.reload()
})
produceBtn.addEventListener('click', () => {
  // Start production if not already in progress and player has enough money.
  if (production.inProgress) return
  const unitType = unitTypeSelect.value
  const cost = unitType === 'tank' ? 1000 : 500
  if (money < cost) return
  money -= cost
  production.inProgress = true
  production.unitType = unitType
  production.startTime = performance.now()
  // Trigger production start sound
  playSound('productionStart')
})

// ========= GAME UPDATE FUNCTIONS =========

// Update game logic each frame
function updateGame (delta) {
  if (gamePaused) return

  // Update game time (in seconds)
  gameTime += delta / 1000

  // Update production progress
  if (production.inProgress) {
    const elapsed = performance.now() - production.startTime
    productionProgressEl.textContent = `${Math.floor((elapsed / production.duration) * 100)}%`
    if (elapsed >= production.duration) {
      // Spawn a unit at the player factory (factories[0] is player)
      spawnUnit(factories[0], production.unitType)
      production.inProgress = false
      productionProgressEl.textContent = ''
      // Trigger production ready sound
      playSound('productionReady')
    }
  }

  // Update inertia scrolling if not dragging
  if (!isRightDragging) {
    scrollOffset.x = Math.max(0, Math.min(scrollOffset.x - dragVelocity.x, MAP_WIDTH - gameCanvas.width))
    scrollOffset.y = Math.max(0, Math.min(scrollOffset.y - dragVelocity.y, MAP_HEIGHT - gameCanvas.height))
    dragVelocity.x *= INERTIA_DECAY
    dragVelocity.y *= INERTIA_DECAY
  }

  // Update each unit’s movement along its path
  units.forEach(unit => {
    if (unit.path && unit.path.length > 0) {
      // Determine next target tile’s pixel coordinates
      const nextTile = unit.path[0]
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE }
      const dx = targetPos.x - unit.x
      const dy = targetPos.y - unit.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < unit.speed) {
        // Snap to tile center and remove the reached tile from path
        unit.x = targetPos.x
        unit.y = targetPos.y
        unit.tileX = nextTile.x
        unit.tileY = nextTile.y
        unit.path.shift()
      } else {
        // Move unit smoothly toward target
        unit.x += (dx / distance) * unit.speed
        unit.y += (dy / distance) * unit.speed
      }
    } else {
      // If unit has a target (e.g. enemy) and is within range, fire bullets.
      if (unit.target && unit.type === 'tank') {
        // For simplicity, fire a bullet every update cycle if target is in adjacent tile.
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
        // Prevent continuous firing by resetting target temporarily (in a full game, use a cooldown)
        unit.target = null
        playSound('shoot')
      }
    }
    // For harvesters: if on an ore tile, start harvesting.
    if (unit.type === 'harvester' && !unit.harvesting) {
      const tileX = Math.floor(unit.x / TILE_SIZE)
      const tileY = Math.floor(unit.y / TILE_SIZE)
      if (mapGrid[tileY][tileX].type === 'ore' && unit.oreCarried < 5) {
        unit.harvesting = true
        unit.harvestTimer = performance.now()
        playSound('harvest')
      }
    }
    // Check if harvest time (10 sec) has passed
    if (unit.type === 'harvester' && unit.harvesting) {
      if (performance.now() - unit.harvestTimer > 10000) {
        unit.oreCarried++
        unit.harvesting = false
        // When full, order the harvester to return to the player factory
        if (unit.oreCarried >= 5) {
          const factoryPos = { x: factories[0].x, y: factories[0].y }
          unit.path = findPath({ x: unit.tileX, y: unit.tileY }, factoryPos).slice(1)
        }
      }
    }
    // If harvester reaches player factory tile, unload ore.
    if (unit.type === 'harvester' && unit.oreCarried > 0) {
      if (unit.tileX >= factories[0].x && unit.tileX < factories[0].x + factories[0].width &&
          unit.tileY >= factories[0].y && unit.tileY < factories[0].y + factories[0].height) {
        money += 500
        unit.oreCarried = 0
        playSound('deposit')
      }
    }
  })

  // Update bullets movement
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i]
    if (!bullet.active) continue
    // Determine target position (if target exists)
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
      // Impact: apply randomized damage scaling
      const factor = 0.8 + Math.random() * 0.4
      const damage = bullet.baseDamage * factor
      // Apply damage if target has health (check null references)
      if (bullet.target.health !== undefined) {
        bullet.target.health -= damage
        // Remove bullet once it hits
        bullet.active = false
        playSound('bulletHit')
        // If target is destroyed, remove it from selection if needed.
        if (bullet.target.health <= 0) {
          // Remove unit or factory
          if (bullet.target.id === 'enemy' || bullet.target.id === 'player') {
            // Factory destruction triggers win/loss conditions.
            if (bullet.target.id === 'enemy') {
              wins++
            } else {
              losses++
            }
          }
          // Remove from units if applicable
          const index = units.findIndex(u => u.id === bullet.target.id)
          if (index !== -1) {
            units.splice(index, 1)
          }
          // Remove from selected units if present
          selectedUnits = selectedUnits.filter(u => u !== bullet.target)
          bullet.target = null
        }
      }
    } else {
      // Move bullet toward target.
      bullet.x += (dx / distance) * bullet.speed
      bullet.y += (dy / distance) * bullet.speed
    }
  }
  // Clean up inactive bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (!bullets[i].active) bullets.splice(i, 1)
  }
  // Ore spreading: every 90 sec (90000 ms) try to spread from ore tiles to adjacent land.
  // (For brevity, we check every frame with a small probability.)
  if (Math.random() < (1 / 90000 * delta)) {
    for (let y = 0; y < MAP_TILES_Y; y++) {
      for (let x = 0; x < MAP_TILES_X; x++) {
        if (mapGrid[y][x].type === 'ore') {
          // Try to spread to a random adjacent tile that is land.
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

// ========= RENDERING FUNCTIONS =========

function renderGame () {
  // Clear main canvas
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
  // Determine visible tile range based on scrollOffset and canvas size
  const startTileX = Math.floor(scrollOffset.x / TILE_SIZE)
  const startTileY = Math.floor(scrollOffset.y / TILE_SIZE)
  const endTileX = Math.min(MAP_TILES_X, Math.ceil((scrollOffset.x + gameCanvas.width) / TILE_SIZE))
  const endTileY = Math.min(MAP_TILES_Y, Math.ceil((scrollOffset.y + gameCanvas.height) / TILE_SIZE))
  // Draw tiles within visible range
  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = mapGrid[y][x]
      gameCtx.fillStyle = TILE_COLORS[tile.type]
      gameCtx.fillRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
      // Draw subtle borders
      gameCtx.strokeStyle = 'rgba(0,0,0,0.1)'
      gameCtx.strokeRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
    }
  }
  // Draw factories
  factories.forEach(factory => {
    const pos = tileToPixel(factory.x, factory.y)
    gameCtx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - scrollOffset.y, factory.width * TILE_SIZE, factory.height * TILE_SIZE)
    // Draw health bar above factory
    const barWidth = factory.width * TILE_SIZE
    const healthRatio = factory.health / factory.maxHealth
    gameCtx.fillStyle = '#0F0'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth * healthRatio, 5)
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth, 5)
  })
  // Draw units
  units.forEach(unit => {
    gameCtx.fillStyle = unit.type === 'tank' ? '#00F' : '#9400D3' // tanks blue, harvesters violet
    gameCtx.beginPath()
    // Represent units as circles centered in their tile
    gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3, 0, 2 * Math.PI)
    gameCtx.fill()
    // If selected, draw a highlight ring
    if (unit.selected) {
      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3 + 3, 0, 2 * Math.PI)
      gameCtx.stroke()
    }
  })
  // Draw bullets
  bullets.forEach(bullet => {
    gameCtx.fillStyle = '#FFF'
    gameCtx.beginPath()
    gameCtx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI)
    gameCtx.fill()
  })
  // Draw selection rectangle if in selection mode
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

// Draw the minimap in the sidebar
function renderMinimap () {
  // Clear minimap
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)
  // Scale factors for minimap
  const scaleX = minimapCanvas.width / MAP_WIDTH
  const scaleY = minimapCanvas.height / MAP_HEIGHT
  // Draw each tile as a tiny rectangle
  for (let y = 0; y < MAP_TILES_Y; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type]
      minimapCtx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY)
    }
  }
  // Draw current viewport bounding box
  minimapCtx.strokeStyle = '#FF0'
  minimapCtx.lineWidth = 2
  minimapCtx.strokeRect(scrollOffset.x * scaleX, scrollOffset.y * scaleY, gameCanvas.width * scaleX, gameCanvas.height * scaleY)
}

// ========= MAIN GAME LOOP =========

let lastTime = performance.now()
function gameLoop (time) {
  const delta = time - lastTime
  lastTime = time
  if (gameStarted && !gamePaused) {
    updateGame(delta)
  }
  renderGame()
  renderMinimap()
  // Update UI stats
  moneyEl.textContent = money
  gameTimeEl.textContent = Math.floor(gameTime)
  winsEl.textContent = wins
  lossesEl.textContent = losses
  requestAnimationFrame(gameLoop)
}

// ========= INITIALIZATION CALLS =========

initMapGrid()
initFactories()
// Start the game loop
requestAnimationFrame(gameLoop)
