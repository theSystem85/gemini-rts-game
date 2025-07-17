// saveGame.js
import { gameState } from './gameState.js'
import { factories } from './main.js'
import { units } from './main.js'
import { mapGrid } from './main.js'
import { cleanupOreFromBuildings } from './gameSetup.js'
import { TILE_SIZE } from './config.js'
import { createUnit } from './units.js'
import { buildingData } from './buildings.js'
import { showNotification } from './ui/notifications.js'
import { milestoneSystem } from './game/milestoneSystem.js'
import { initializeOccupancyMap } from './units.js'
import { getTextureManager } from './rendering.js'
import { assignHarvesterToOptimalRefinery } from './game/harvesterLogic.js'
import { productionQueue } from './productionQueue.js'
import { getCurrentGame } from './main.js'
import { getKeyboardHandler } from './inputHandler.js'

// === Save/Load Game Logic ===
export function getSaveGames() {
  const saves = []
  for (const key in localStorage) {
    if (key.startsWith('rts_save_')) {
      try {
        const save = JSON.parse(localStorage.getItem(key))
        saves.push({
          key,
          label: save.label || '(no label)',
          time: save.time
        })
      } catch (err) {
        console.warn('Error processing saved game:', err)
      }
    }
  }
  // Sort by most recent
  saves.sort((a, b) => b.time - a.time)
  return saves
}

export function saveGame(label) {
  // Gather AI player money (budget) from all AI factories
  const aiFactoryBudgets = {}
  factories.forEach(factory => {
    if (factory.owner !== gameState.humanPlayer && factory.budget !== undefined) {
      aiFactoryBudgets[factory.owner || factory.id] = factory.budget
    }
  })

  // Gather all units (human player and AI players)
  const allUnits = units.map(u => ({
    type: u.type,
    owner: u.owner,
    x: u.x,
    y: u.y,
    tileX: u.tileX,
    tileY: u.tileY,
    health: u.health,
    maxHealth: u.maxHealth,
    id: u.id,
    // Harvester-specific properties
    oreCarried: u.oreCarried,
    assignedRefinery: u.assignedRefinery,
    oreField: u.oreField,
    path: u.path || [],
    // Save target as ID only to avoid circular references
    targetId: u.target?.id || null,
    targetType: u.target ? (u.target.type || 'unknown') : null,
    groupNumber: u.groupNumber,
    // Experience/Leveling system properties
    level: u.level || 0,
    experience: u.experience || 0,
    baseCost: u.baseCost,
    rangeMultiplier: u.rangeMultiplier,
    fireRateMultiplier: u.fireRateMultiplier,
    armor: u.armor,
    selfRepair: u.selfRepair
    // Note: lastAttacker is excluded to prevent circular references
    // Add more fields if needed
  }))

  // Gather all buildings (player and enemy)
  const allBuildings = gameState.buildings.map(b => ({
    type: b.type,
    owner: b.owner,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    health: b.health,
    maxHealth: b.maxHealth,
    id: b.id,
    rallyPoint: b.rallyPoint // Save rally point if it exists
    // Add more fields if needed
  }))

  // Gather factory rally points as well
  const factoryRallyPoints = factories.map(f => ({
    id: f.id,
    rallyPoint: f.rallyPoint
  }))

  // Gather all ore positions (now using ore property instead of tile type)
  const orePositions = []
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[y].length; x++) {
      if (mapGrid[y][x].ore) {
        orePositions.push({ x, y })
      }
    }
  }

  // Save the full mapGrid tile types for restoring building/wall/terrain occupancy
  const mapGridTypes = mapGrid.map(row => row.map(tile => tile.type))

  // Save everything in a single object
  const saveData = {
    // Only save specific gameState properties to avoid circular references and reduce size
    gameState: {
      money: gameState.money,
      gameTime: gameState.gameTime,
      frameCount: gameState.frameCount,
      wins: gameState.wins,
      losses: gameState.losses,
      gameStarted: gameState.gameStarted,
      gamePaused: gameState.gamePaused,
      gameOver: gameState.gameOver,
      gameOverMessage: gameState.gameOverMessage,
      gameResult: gameState.gameResult,
      playerUnitsDestroyed: gameState.playerUnitsDestroyed,
      enemyUnitsDestroyed: gameState.enemyUnitsDestroyed,
      playerBuildingsDestroyed: gameState.playerBuildingsDestroyed,
      enemyBuildingsDestroyed: gameState.enemyBuildingsDestroyed,
      totalMoneyEarned: gameState.totalMoneyEarned,
      scrollOffset: gameState.scrollOffset,
      speedMultiplier: gameState.speedMultiplier,
      powerSupply: gameState.powerSupply,
      playerBuildHistory: gameState.playerBuildHistory,
      currentSessionId: gameState.currentSessionId,
      enemyLastBuildingTime: gameState.enemyLastBuildingTime,
      radarActive: gameState.radarActive,
      gridVisible: gameState.gridVisible,
      occupancyVisible: gameState.occupancyVisible,
      fpsVisible: gameState.fpsVisible,
      useTankImages: gameState.useTankImages,
      nextVehicleFactoryIndex: gameState.nextVehicleFactoryIndex,
      refineryStatus: gameState.refineryStatus,
      playerCount: gameState.playerCount,
      humanPlayer: gameState.humanPlayer,
      availableUnitTypes: Array.from(gameState.availableUnitTypes || []),
      availableBuildingTypes: Array.from(gameState.availableBuildingTypes || []),
      newUnitTypes: Array.from(gameState.newUnitTypes || []),
      newBuildingTypes: Array.from(gameState.newBuildingTypes || []),
      defeatedPlayers: gameState.defeatedPlayers instanceof Set ? 
        Array.from(gameState.defeatedPlayers) : 
        (Array.isArray(gameState.defeatedPlayers) ? gameState.defeatedPlayers : [])
    },
    aiFactoryBudgets, // Save AI player budgets
    units: allUnits,
    buildings: allBuildings,
    factoryRallyPoints, // Save factory rally points
    orePositions,
    mapGridTypes, // ADDED: save mapGrid tile types
    targetedOreTiles: gameState.targetedOreTiles || {}, // Save targeted ore tiles for harvesters
    achievedMilestones: milestoneSystem.getAchievedMilestones() // Save milestone progress
  }

  const saveObj = {
    label: label || 'Unnamed',
    time: Date.now(),
    state: JSON.stringify(saveData)
  }
  localStorage.setItem('rts_save_' + saveObj.label, JSON.stringify(saveObj))
}

export function loadGame(key) {
  const saveObj = JSON.parse(localStorage.getItem(key))
  if (saveObj && saveObj.state) {
    const loaded = JSON.parse(saveObj.state)
    Object.assign(gameState, loaded.gameState)

    // Rehydrate Set from saved array
    if (Array.isArray(loaded.gameState.defeatedPlayers)) {
      gameState.defeatedPlayers = new Set(loaded.gameState.defeatedPlayers)
    } else if (!(gameState.defeatedPlayers instanceof Set)) {
      gameState.defeatedPlayers = new Set()
    }

    // Rehydrate other Set properties
    if (Array.isArray(loaded.gameState.availableUnitTypes)) {
      gameState.availableUnitTypes = new Set(loaded.gameState.availableUnitTypes)
    }
    if (Array.isArray(loaded.gameState.availableBuildingTypes)) {
      gameState.availableBuildingTypes = new Set(loaded.gameState.availableBuildingTypes)
    }
    if (Array.isArray(loaded.gameState.newUnitTypes)) {
      gameState.newUnitTypes = new Set(loaded.gameState.newUnitTypes)
    }
    if (Array.isArray(loaded.gameState.newBuildingTypes)) {
      gameState.newBuildingTypes = new Set(loaded.gameState.newBuildingTypes)
    }
    
    // Ensure smokeParticles is properly initialized and clean up any invalid particles
    if (!Array.isArray(gameState.smokeParticles)) {
      gameState.smokeParticles = []
    } else {
      // Clean up any invalid smoke particles from saved data
      gameState.smokeParticles = gameState.smokeParticles.filter(p => 
        p && typeof p === 'object' && 
        typeof p.x === 'number' && 
        typeof p.y === 'number' && 
        typeof p.size === 'number' && 
        p.size > 0 &&
        typeof p.startTime === 'number' &&
        typeof p.duration === 'number'
      )
    }
    
    // Restore AI player budgets
    if (loaded.aiFactoryBudgets) {
      Object.entries(loaded.aiFactoryBudgets).forEach(([playerId, budget]) => {
        const aiFactory = factories.find(f => f.owner === playerId || f.id === playerId)
        if (aiFactory && typeof budget === 'number') {
          aiFactory.budget = budget
        }
      })
    } else if (loaded.enemyMoney !== undefined) {
      // Fallback for old save format
      const enemyFactory = factories.find(f => f.id === 'enemy')
      if (enemyFactory && typeof loaded.enemyMoney === 'number') {
        enemyFactory.budget = loaded.enemyMoney
      }
    }
    
    units.length = 0
    loaded.units.forEach(u => {
      // Rehydrate unit using createUnit logic
      // Find the factory for owner (player/enemy)
      let factory = factories.find(f => (f.owner === u.owner || f.id === u.owner))
      if (!factory) {
        // fallback: use first factory of that owner
        factory = factories.find(f => f.owner === u.owner) || factories[0]
      }
      // Use tileX/tileY if present, else calculate from x/y
      const tileX = u.tileX !== undefined ? u.tileX : Math.floor(u.x / TILE_SIZE)
      const tileY = u.tileY !== undefined ? u.tileY : Math.floor(u.y / TILE_SIZE)
      const hydrated = createUnit(factory, u.type, tileX, tileY)
      // Copy over all saved properties (health, id, etc.)
      Object.assign(hydrated, u)
      // Ensure tileX/tileY/x/y are consistent
      hydrated.tileX = tileX
      hydrated.tileY = tileY
      hydrated.x = u.x
      hydrated.y = u.y
      // Ensure path is always an array
      if (!Array.isArray(hydrated.path)) hydrated.path = []
      
      // Initialize/restore experience system for combat units
      if (hydrated.type !== 'harvester') {
        // Ensure experience properties exist
        hydrated.level = u.level || 0
        hydrated.experience = u.experience || 0
        hydrated.baseCost = u.baseCost || (function() {
          const costs = { tank: 1000, rocketTank: 2000, 'tank-v2': 2000, 'tank-v3': 3000, tank_v1: 1000 }
          return costs[hydrated.type] || 1000
        })()
        
        // Restore level bonuses if they exist
        if (u.rangeMultiplier) hydrated.rangeMultiplier = u.rangeMultiplier
        if (u.fireRateMultiplier) hydrated.fireRateMultiplier = u.fireRateMultiplier
        if (u.armor && u.armor > 1) hydrated.armor = u.armor
        if (u.selfRepair) hydrated.selfRepair = u.selfRepair
        
        console.log(`🔄 Loaded ${hydrated.type}: Level ${hydrated.level}, Experience ${hydrated.experience}`)
      }
      
      // Restore harvester-specific properties and re-assign to refineries if needed
      if (hydrated.type === 'harvester') {
        hydrated.oreCarried = u.oreCarried || 0
        hydrated.oreField = u.oreField || null
        
        // If harvester had an assigned refinery but it's lost during save/load, reassign
        if (u.assignedRefinery) {
          hydrated.assignedRefinery = u.assignedRefinery
        } else {
          // Re-assign harvester to optimal refinery after loading
          // This will be handled after all buildings are loaded
          hydrated.needsRefineryAssignment = true
        }
      }
      
      units.push(hydrated)
    })

    // Restore target references after all units and buildings are loaded
    units.forEach(unit => {
      if (unit.targetId) {
        // Find target by ID in units or buildings
        let target = units.find(u => u.id === unit.targetId)
        if (!target) {
          target = gameState.buildings.find(b => b.id === unit.targetId)
        }
        if (target) {
          unit.target = target
        }
        // Clean up temporary properties
        delete unit.targetId
        delete unit.targetType
      }
    })

    // Rebuild control groups based on restored units
    const kbHandler = getKeyboardHandler()
    if (kbHandler && typeof kbHandler.rebuildControlGroupsFromUnits === 'function') {
      kbHandler.rebuildControlGroupsFromUnits(units)
    }

    gameState.buildings.length = 0
    loaded.buildings.forEach(b => {
      // Rehydrate defensive buildings (turrets) so they work after loading
      const building = { ...b }
      
      // Ensure all buildings have maxHealth restored for proper health bar rendering
      const data = buildingData[building.type]
      if (data) {
        // Always restore maxHealth from building data to ensure consistency
        building.maxHealth = data.health
      }
      
      // Defensive turrets: turretGunV1/V2/V3, rocketTurret, teslaCoil
      if (building.type && (building.type.startsWith('turretGun') || building.type === 'rocketTurret' || building.type === 'teslaCoil')) {
        // Get config from buildingData
        const data = buildingData[building.type]
        // Set all runtime properties if missing
        building.fireRange = data.fireRange
        building.fireCooldown = data.fireCooldown
        building.damage = data.damage
        building.armor = data.armor || 1
        building.projectileType = data.projectileType
        building.projectileSpeed = data.projectileSpeed
        if (typeof building.lastShotTime !== 'number') building.lastShotTime = 0
        if (typeof building.turretDirection !== 'number') building.turretDirection = 0
        if (typeof building.targetDirection !== 'number') building.targetDirection = 0
        // Burst fire
        if (data.burstFire) {
          building.burstFire = true
          building.burstCount = data.burstCount || 3
          building.burstDelay = data.burstDelay || 150
          if (typeof building.currentBurst !== 'number') building.currentBurst = 0
          if (typeof building.lastBurstTime !== 'number') building.lastBurstTime = 0
        }
        // Tesla coil specific properties
        if (data.isTeslaCoil) {
          building.isTeslaCoil = true
        }
      }
      
      // Restore rally point for vehicle factories only
      if (building.rallyPoint && building.type === 'vehicleFactory') {
        // Rally point is already in the building data from save
      } else if (building.type === 'vehicleFactory') {
        // Initialize rally point as null for vehicle factories
        building.rallyPoint = null
      }
      
      gameState.buildings.push(building)
    })

    // Restore factory rally points
    if (loaded.factoryRallyPoints) {
      loaded.factoryRallyPoints.forEach(factoryData => {
        const factory = factories.find(f => f.id === factoryData.id)
        if (factory && factoryData.rallyPoint) {
          factory.rallyPoint = factoryData.rallyPoint
        }
      })
    }
    // Restore mapGrid tile types (excluding 'building' to avoid black spots)
    if (loaded.mapGridTypes) {
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[y].length; x++) {
          if (loaded.mapGridTypes[y] && loaded.mapGridTypes[y][x]) {
            // Don't restore 'building' tile type - let building placement handle this
            if (loaded.mapGridTypes[y][x] !== 'building') {
              mapGrid[y][x].type = loaded.mapGridTypes[y][x]
            }
          }
        }
      }
    } else {
      // Fallback: clear ore overlays
      for (let y = 0; y < mapGrid.length; y++) {
        for (let x = 0; x < mapGrid[y].length; x++) {
          mapGrid[y][x].ore = false
        }
      }
    }

    // Restore ore overlays from saved positions
    if (loaded.orePositions) {
      loaded.orePositions.forEach(pos => {
        if (mapGrid[pos.y] && mapGrid[pos.y][pos.x]) {
          mapGrid[pos.y][pos.x].ore = true
        }
      })
    }

    // Re-place all buildings on the map to set building properties correctly
    gameState.buildings.forEach(building => {
      for (let y = building.y; y < building.y + building.height; y++) {
        for (let x = building.x; x < building.x + building.width; x++) {
          if (mapGrid[y] && mapGrid[y][x]) {
            mapGrid[y][x].building = building
          }
        }
      }
    })
    
    // Ensure no ore overlaps with buildings or factories after loading
    cleanupOreFromBuildings(mapGrid, gameState.buildings, factories)

    gameState.occupancyMap = initializeOccupancyMap(units, mapGrid, getTextureManager())

    // Restore targeted ore tiles for harvester system
    if (loaded.targetedOreTiles) {
      gameState.targetedOreTiles = loaded.targetedOreTiles
    } else {
      gameState.targetedOreTiles = {}
    }

    // Restore milestone progress
    if (loaded.achievedMilestones && Array.isArray(loaded.achievedMilestones)) {
      // Use the new method to set milestones
      milestoneSystem.setAchievedMilestones(loaded.achievedMilestones)
    }

    // Re-assign harvesters to refineries after all buildings are loaded
    units.forEach(unit => {
      if (unit.type === 'harvester' && unit.needsRefineryAssignment) {
        // Filter buildings by owner for assignment
        const ownerGameState = {
          buildings: gameState.buildings.filter(b => b.owner === unit.owner)
        }
        assignHarvesterToOptimalRefinery(unit, ownerGameState)
        delete unit.needsRefineryAssignment
      }
    })

    // Sync tech tree with player's existing buildings to enable correct build options
    const gameInstance = getCurrentGame()
    if (gameInstance && gameInstance.productionController) {
      gameInstance.productionController.syncTechTreeWithBuildings()
    }

    // Auto-start the game after loading
    gameState.gamePaused = false
    gameState.gameStarted = true
    
    // Update pause button to show pause icon since game is now running
    const pauseBtn = document.getElementById('pauseBtn')
    if (pauseBtn) {
      const playPauseIcon = pauseBtn.querySelector('.play-pause-icon')
      if (playPauseIcon) {
        playPauseIcon.textContent = '⏸'
      }
    }
    
    // Resume production after unpause
    productionQueue.resumeProductionAfterUnpause()

    showNotification('Game loaded: ' + (saveObj.label || key))
  }
}

export function deleteGame(key) {
  localStorage.removeItem(key)
}

export function updateSaveGamesList() {
  const list = document.getElementById('saveGamesList')
  if (!list) return // Early return if element doesn't exist

  list.innerHTML = ''
  const saves = getSaveGames()
  saves.forEach(save => {
    const li = document.createElement('li')
    li.style.display = 'flex'
    li.style.justifyContent = 'space-between'
    li.style.alignItems = 'center'
    li.style.padding = '2px 0'
    const label = document.createElement('span')
    label.innerHTML = save.label + '<br><small>' + new Date(save.time).toLocaleString() + '</small>'
    label.style.flex = '1'
    const loadBtn = document.createElement('button')
    loadBtn.textContent = '▶'
    loadBtn.title = 'Load save game'
    loadBtn.classList.add('action-button')
    loadBtn.style.marginLeft = '6px'
    loadBtn.onclick = () => { loadGame(save.key) }
    const delBtn = document.createElement('button')
    delBtn.textContent = '✗'
    delBtn.title = 'Delete save'
    delBtn.classList.add('action-button')
    delBtn.style.marginLeft = '5px'
    delBtn.onclick = () => { deleteGame(save.key); updateSaveGamesList() }
    li.appendChild(label)
    li.appendChild(loadBtn)
    li.appendChild(delBtn)
    list.appendChild(li)
  })
}

// Add initialization function to set up event listeners
export function initSaveGameSystem() {
  const saveGameBtn = document.getElementById('saveGameBtn')
  const saveLabelInput = document.getElementById('saveLabelInput')

  // Helper to perform the save action
  const performSave = () => {
    const label = document.getElementById('saveLabelInput').value.trim()
    saveGame(label)
    updateSaveGamesList()
    showNotification('Game saved as: ' + (label || 'Unnamed'))
  }

  if (saveGameBtn) {
    saveGameBtn.addEventListener('click', performSave)
  }

  // Allow saving by pressing Enter in the input field
  if (saveLabelInput) {
    saveLabelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        performSave()
      }
    })
  }

  // Initial population of save games list
  updateSaveGamesList()
}
