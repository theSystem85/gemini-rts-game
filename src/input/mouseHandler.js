// mouseHandler.js
import { TILE_SIZE, ATTACK_GROUP_MIN_DRAG_DISTANCE } from '../config.js'
import { gameState } from '../gameState.js'
import { units } from '../main.js'
import { playSound } from '../sound.js'
import { showNotification } from '../ui/notifications.js'

export class MouseHandler {
  constructor() {
    this.isSelecting = false
    this.wasDragging = false
    this.rightWasDragging = false
    this.selectionStart = { x: 0, y: 0 }
    this.selectionEnd = { x: 0, y: 0 }
    this.rightDragStart = { x: 0, y: 0 }
    this.gameFactories = [] // Initialize gameFactories
    this.mouseDownTime = 0
    this.isDraggingThreshold = 150 // 150ms threshold before dragging activates
    
    // Attack Group Feature state
    this.isAttackGroupSelecting = false
    this.attackGroupStartWorld = { x: 0, y: 0 }
    this.attackGroupWasDragging = false
    this.potentialAttackGroupStart = { x: 0, y: 0 }
    this.hasSelectedCombatUnits = false
    
    // Add a flag to forcibly disable AGF rendering
    this.disableAGFRendering = false
  }

  setupMouseEvents(gameCanvas, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager) {
    this.gameFactories = factories // Store the passed factories list
    // Disable right-click context menu
    gameCanvas.addEventListener('contextmenu', e => e.preventDefault())

    gameCanvas.addEventListener('mousedown', e => {
      // Don't process input if game is paused
      if (gameState.paused) return

      const rect = gameCanvas.getBoundingClientRect()
      const worldX = e.clientX - rect.left + gameState.scrollOffset.x
      const worldY = e.clientY - rect.top + gameState.scrollOffset.y

      if (e.button === 2) {
        // Right-click: start scrolling
        this.handleRightMouseDown(e, gameCanvas)
      } else if (e.button === 0) {
        // Left-click: start selection
        this.handleLeftMouseDown(worldX, worldY, gameCanvas, selectedUnits)
      }
    })

    gameCanvas.addEventListener('mousemove', e => {
      // Don't process input if game is paused
      if (gameState.paused) return

      const rect = gameCanvas.getBoundingClientRect()
      const worldX = e.clientX - rect.left + gameState.scrollOffset.x
      const worldY = e.clientY - rect.top + gameState.scrollOffset.y

      // Update enemy hover detection
      this.updateEnemyHover(worldX, worldY, units, factories, selectedUnits, cursorManager)

      // Handle right-drag scrolling
      if (gameState.isRightDragging) {
        this.handleRightDragScrolling(e, mapGrid, gameCanvas)
        return
      } else if (!this.isSelecting && !this.isAttackGroupSelecting) {
        gameCanvas.style.cursor = selectedUnits.length > 0 ? 'grab' : 'default'
      }

      // Update selection rectangle if we're actively selecting 
      // Remove the unreliable (e.buttons & 1) check that was causing cancellations
      if (this.isSelecting || this.isAttackGroupSelecting) {
        this.updateSelectionRectangle(worldX, worldY)
      }

      // Update custom cursor position and visibility
      cursorManager.updateCustomCursor(e, mapGrid, factories, selectedUnits)
    })

    gameCanvas.addEventListener('mouseup', e => {
      // Don't process input if game is paused
      if (gameState.paused) return

      if (e.button === 2) {
        this.handleRightMouseUp(e, units, factories, selectedUnits, selectionManager, cursorManager)
      } else if (e.button === 0) {
        // Handle left mouse up regardless of selection state to ensure cleanup
        this.handleLeftMouseUp(e, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager)
      }
    })

    // Add right-click event listener to cancel modes
    gameCanvas.addEventListener('contextmenu', (e) => {
      this.handleContextMenu(e, gameCanvas)
    })
  }

  handleRightMouseDown(e, gameCanvas) {
    gameState.isRightDragging = true
    this.rightDragStart = { x: e.clientX, y: e.clientY }
    this.rightWasDragging = false
    gameState.lastDragPos = { x: e.clientX, y: e.clientY }
    gameCanvas.style.cursor = 'grabbing'
  }

  handleLeftMouseDown(worldX, worldY, gameCanvas, selectedUnits) {
    // Track mouse down time and position
    this.mouseDownTime = performance.now()
    
    // Store potential attack group start position
    this.potentialAttackGroupStart = { x: worldX, y: worldY }
    this.hasSelectedCombatUnits = this.shouldStartAttackGroupMode(selectedUnits)
    
    // Always start with normal selection mode, but be ready to switch to AGF
    this.isSelecting = true
    gameState.selectionActive = true
    this.wasDragging = false
    this.selectionStart = { x: worldX, y: worldY }
    this.selectionEnd = { x: worldX, y: worldY }
    gameState.selectionStart = { ...this.selectionStart }
    gameState.selectionEnd = { ...this.selectionEnd }
    
    // Reset AGF state initially
    gameState.attackGroupMode = false
    this.isAttackGroupSelecting = false
    this.attackGroupWasDragging = false
    gameState.attackGroupStart = { x: 0, y: 0 }
    gameState.attackGroupEnd = { x: 0, y: 0 }
    gameState.disableAGFRendering = false
  }

  shouldStartAttackGroupMode(selectedUnits) {
    // Attack group mode activates when:
    // 1. Player has units selected
    // 2. At least one selected unit is a combat unit (not harvester)
    // 3. Not in any special mode (building placement, repair, sell)
    // 4. No modifier keys pressed (to avoid conflicts with other commands)
    // 5. No factories are selected (factories should not trigger AGF)
    
    const hasSelectedUnits = selectedUnits && selectedUnits.length > 0
    const hasCombatUnits = hasSelectedUnits && selectedUnits.some(unit => 
      unit.type !== 'harvester' && unit.owner === gameState.humanPlayer && !unit.isBuilding
    )
    const hasSelectedFactory = hasSelectedUnits && selectedUnits.some(unit => 
      (unit.isBuilding && (unit.type === 'vehicleFactory' || unit.type === 'constructionYard')) ||
      (unit.id && (unit.id === gameState.humanPlayer)) // Human player factory
    )
    const notInSpecialMode = !gameState.buildingPlacementMode && 
                            !gameState.repairMode && 
                            !gameState.sellMode &&
                            !gameState.attackGroupMode // Don't start if already in attack group mode
    
    return hasSelectedUnits && hasCombatUnits && !hasSelectedFactory && notInSpecialMode
  }

  updateEnemyHover(worldX, worldY, units, factories, selectedUnits, cursorManager) {
    if (selectedUnits.length > 0) {
      let isOverEnemy = false

      // Check enemy factories
      for (const factory of factories) {
        if (factory.id !== 'player') {
          const factoryPixelX = factory.x * TILE_SIZE
          const factoryPixelY = factory.y * TILE_SIZE
          if (worldX >= factoryPixelX &&
              worldX < factoryPixelX + factory.width * TILE_SIZE &&
              worldY >= factoryPixelY &&
              worldY < factoryPixelY + factory.height * TILE_SIZE) {
            isOverEnemy = true
            break
          }
        }
      }

      // Check enemy buildings
      if (!isOverEnemy && gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner !== 'player') {
            const buildingX = building.x * TILE_SIZE
            const buildingY = building.y * TILE_SIZE
            const buildingWidth = building.width * TILE_SIZE
            const buildingHeight = building.height * TILE_SIZE

            if (worldX >= buildingX &&
                worldX < buildingX + buildingWidth &&
                worldY >= buildingY &&
                worldY < buildingY + buildingHeight) {
              isOverEnemy = true
              break
            }
          }
        }
      }

      // Check enemy units
      if (!isOverEnemy) {
        for (const unit of units) {
          if (unit.owner !== 'player') {
            const centerX = unit.x + TILE_SIZE / 2
            const centerY = unit.y + TILE_SIZE / 2
            if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
              isOverEnemy = true
              break
            }
          }
        }
      }

      cursorManager.setIsOverEnemy(isOverEnemy)
    }
  }

  handleRightDragScrolling(e, mapGrid, gameCanvas) {
    const dx = e.clientX - gameState.lastDragPos.x
    const dy = e.clientY - gameState.lastDragPos.y

    // Get logical dimensions accounting for pixel ratio
    const logicalWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
    const logicalHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight

    // Multiply by 2 to make scrolling 2x faster
    const scrollSpeed = 2
    gameState.scrollOffset.x = Math.max(
      0,
      Math.min(gameState.scrollOffset.x - (dx * scrollSpeed), mapGrid[0].length * TILE_SIZE - logicalWidth)
    )
    gameState.scrollOffset.y = Math.max(
      0,
      Math.min(gameState.scrollOffset.y - (dy * scrollSpeed), mapGrid.length * TILE_SIZE - logicalHeight)
    )

    // Also update dragVelocity to match the scroll speed for consistent inertia
    gameState.dragVelocity = { x: dx * scrollSpeed, y: dy * scrollSpeed }
    gameState.lastDragPos = { x: e.clientX, y: e.clientY }

    // Check if right-drag exceeds threshold
    if (!this.rightWasDragging && Math.hypot(e.clientX - this.rightDragStart.x, e.clientY - this.rightDragStart.y) > 5) {
      this.rightWasDragging = true
    }
  }

  updateSelectionRectangle(worldX, worldY) {
    // Check if we should transition to attack group mode during dragging
    if (!this.isAttackGroupSelecting && this.hasSelectedCombatUnits && this.isSelecting) {
      const dragDistance = Math.hypot(
        worldX - this.potentialAttackGroupStart.x,
        worldY - this.potentialAttackGroupStart.y
      )
      
      // Transition to AGF mode immediately if combat units are selected and we start dragging
      if (dragDistance > 5) { // Small threshold to avoid accidental activation
        // Transition from normal selection to attack group mode
        this.isAttackGroupSelecting = true
        this.isSelecting = false
        gameState.selectionActive = false // Clear normal selection
        gameState.attackGroupMode = true
        this.attackGroupStartWorld = { ...this.potentialAttackGroupStart }
        gameState.attackGroupStart = { ...this.potentialAttackGroupStart }
        gameState.attackGroupEnd = { x: worldX, y: worldY }
        this.attackGroupWasDragging = true
        
        // Clear normal selection rectangle coordinates to prevent rendering
        gameState.selectionStart = { x: 0, y: 0 }
        gameState.selectionEnd = { x: 0, y: 0 }
        return
      }
    }
    
    if (this.isAttackGroupSelecting) {
      // Update attack group rectangle (red box)
      gameState.attackGroupEnd = { x: worldX, y: worldY }
      this.attackGroupWasDragging = true
    } else if (this.isSelecting) {
      // Update normal selection rectangle (yellow box)
      this.selectionEnd = { x: worldX, y: worldY }
      gameState.selectionEnd = { ...this.selectionEnd }

      if (!this.wasDragging && (Math.abs(this.selectionEnd.x - this.selectionStart.x) > 5 || Math.abs(this.selectionEnd.y - this.selectionStart.y) > 5)) {
        this.wasDragging = true
      }
    }
  }

  handleRightMouseUp(e, units, factories, selectedUnits, selectionManager, cursorManager) {
    // End right-click drag
    gameState.isRightDragging = false
    const gameCanvas = document.getElementById('gameCanvas')
    gameCanvas.style.cursor = 'grab'

    // Check if any unit-producing factory/building is selected BEFORE deselecting
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y
    
    // Check selected factories first
    const selectedFactory = factories.find(f => f.selected && f.id === gameState.humanPlayer)
    if (selectedFactory && !this.rightWasDragging) {
      // Set rally point at clicked tile
      selectedFactory.rallyPoint = {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE)
      }
      playSound('movement', 0.5)
      
      // Deselect the factory after setting rally point
      selectedFactory.selected = false
      const factoryIndex = selectedUnits.indexOf(selectedFactory)
      if (factoryIndex > -1) {
        selectedUnits.splice(factoryIndex, 1)
      }
      // Update AGF capability after deselection
      this.updateAGFCapability(selectedUnits)
      
      // Show notification
      showNotification('Rally point set for Construction Yard', 1500)
      
      this.rightWasDragging = false
      // Update custom cursor visibility after unit selection changes
      cursorManager.updateCustomCursor(e, gameState.mapGrid || [], factories, selectedUnits)
      return
    }
    
    // Check selected buildings that can produce units
    const selectedBuilding = gameState.buildings && gameState.buildings.find(building => 
      building.selected && 
      building.owner === gameState.humanPlayer && 
      (building.type === 'vehicleFactory' || building.type === 'constructionYard')
    )
    if (selectedBuilding && !this.rightWasDragging) {
      // Set rally point at clicked tile
      selectedBuilding.rallyPoint = {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE)
      }
      playSound('movement', 0.5)
      
      // Deselect the building after setting rally point
      selectedBuilding.selected = false
      const buildingIndex = selectedUnits.indexOf(selectedBuilding)
      if (buildingIndex > -1) {
        selectedUnits.splice(buildingIndex, 1)
      }
      // Update AGF capability after deselection
      this.updateAGFCapability(selectedUnits)
      
      // Show notification
      const buildingName = selectedBuilding.type === 'vehicleFactory' ? 'Vehicle Factory' : 'Factory'
      showNotification(`Rally point set for ${buildingName}`, 1500)
      
      this.rightWasDragging = false
      // Update custom cursor visibility after unit selection changes
      cursorManager.updateCustomCursor(e, gameState.mapGrid || [], factories, selectedUnits)
      return
    }

    // Only deselect other units if this was NOT a drag operation AND no factory was selected
    if (!this.rightWasDragging) {
      units.forEach(u => { if (selectionManager.isHumanPlayerUnit(u)) u.selected = false })
      
      // Clear factory selections
      factories.forEach(f => f.selected = false)
      
      // Clear building selections
      if (gameState.buildings) {
        gameState.buildings.forEach(b => { if (selectionManager.isHumanPlayerBuilding(b)) b.selected = false })
      }
      
      selectedUnits.length = 0
      // Update AGF capability after deselection
      this.updateAGFCapability(selectedUnits)
    }
    this.rightWasDragging = false

    // Update custom cursor visibility after unit selection changes
    cursorManager.updateCustomCursor(e, gameState.mapGrid || [], factories, selectedUnits)
  }

  handleLeftMouseUp(e, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager) {
    const rect = e.target.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y

    // Handle attack group mode (only if it was actually activated during dragging)
    if (this.isAttackGroupSelecting && gameState.attackGroupMode) {
      this.handleAttackGroupMouseUp(worldX, worldY, units, selectedUnits, unitCommands, mapGrid)
      return // Exit early after handling attack group
    }

    // Variable to store if we've handled the Force Attack command
    let forceAttackHandled = false

    // First, handle Command Issuing in Force Attack Mode
    if (selectedUnits.length > 0 && !this.wasDragging && e.ctrlKey) {
      forceAttackHandled = this.handleForceAttackCommand(worldX, worldY, units, selectedUnits, unitCommands, mapGrid)
    }

    // If we handled Force Attack, skip normal selection/command processing
    if (!forceAttackHandled) {
      // Normal selection and command handling - always check for unit selection first
      if (this.wasDragging) {
        selectionManager.handleBoundingBoxSelection(units, factories, selectedUnits, this.selectionStart, this.selectionEnd)
        // Update AGF capability after selection changes
        this.updateAGFCapability(selectedUnits)
      } else {
        // Handle single click - either unit selection or movement command
        // Always call handleSingleClick for non-dragging left clicks to preserve double-click functionality
        this.handleSingleClick(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid)
      }
    }

    // ALWAYS reset selection state after mouse up to prevent stuck selection rectangles
    this.isSelecting = false
    gameState.selectionActive = false
    this.wasDragging = false
    this.hasSelectedCombatUnits = false
    
    // Also reset potential attack group state
    this.potentialAttackGroupStart = { x: 0, y: 0 }
    
    // Clear any remaining AGF state if not handled above
    if (!this.isAttackGroupSelecting) {
      gameState.attackGroupMode = false
      gameState.attackGroupStart = { x: 0, y: 0 }
      gameState.attackGroupEnd = { x: 0, y: 0 }
      gameState.disableAGFRendering = false
    }
  }

  handleAttackGroupMouseUp(worldX, worldY, units, selectedUnits, unitCommands, mapGrid = null) {
    console.log('AGF Mouse Up - Before clearing:', {
      mode: gameState.attackGroupMode,
      start: gameState.attackGroupStart,
      end: gameState.attackGroupEnd,
      isSelecting: this.isAttackGroupSelecting,
      wasDragging: this.attackGroupWasDragging
    })
    
    // Immediately stop all selection activity to prevent further updates
    this.isAttackGroupSelecting = false
    this.isSelecting = false
    
    // Forcibly disable AGF rendering in gameState
    gameState.disableAGFRendering = true
    
    // Process commands based on whether this was a drag or click
    if (this.attackGroupWasDragging) {
      // Handle AGF drag - find enemies in the box
      const enemyTargets = this.findEnemyUnitsInAttackGroup(units)
      
      if (enemyTargets.length > 0) {
        // Set up attack queue for selected units
        this.setupAttackQueue(selectedUnits, enemyTargets, unitCommands, mapGrid)
      }
    } else {
      // Handle single click in AGF mode - issue normal commands
      this.handleStandardCommands(worldX, worldY, selectedUnits, unitCommands, mapGrid)
    }
    
    // Immediately clear the visual elements to stop red box rendering
    gameState.attackGroupMode = false
    gameState.attackGroupStart = { x: 0, y: 0 }
    gameState.attackGroupEnd = { x: 0, y: 0 }
    
    console.log('AGF Mouse Up - After clearing:', {
      mode: gameState.attackGroupMode,
      start: gameState.attackGroupStart,
      end: gameState.attackGroupEnd
    })
    
    // Reset the rest of the state
    this.resetAttackGroupState()
    
    // Re-enable AGF rendering after a delay to ensure this frame is rendered
    setTimeout(() => {
      gameState.disableAGFRendering = false
    }, 50)
  }

  resetAttackGroupState() {
    // Reset all attack group related state
    this.isAttackGroupSelecting = false
    this.attackGroupWasDragging = false
    this.hasSelectedCombatUnits = false
    this.potentialAttackGroupStart = { x: 0, y: 0 }
    this.attackGroupStartWorld = { x: 0, y: 0 }
    this.isSelecting = false
    
    // Reset selection state (visual elements already cleared in handleAttackGroupMouseUp)
    gameState.selectionActive = false
    
    // Also clear normal selection coordinates to prevent any rectangle rendering
    gameState.selectionStart = { x: 0, y: 0 }
    gameState.selectionEnd = { x: 0, y: 0 }
    
    // Clear instance selection coordinates
    this.selectionStart = { x: 0, y: 0 }
    this.selectionEnd = { x: 0, y: 0 }
    
    // Note: attackGroupTargets is cleared separately in setupAttackQueue with a delay
    // to allow units to register their targets before cleanup
  }

  findEnemyUnitsInAttackGroup(units) {
    const x1 = Math.min(gameState.attackGroupStart.x, gameState.attackGroupEnd.x)
    const y1 = Math.min(gameState.attackGroupStart.y, gameState.attackGroupEnd.y)
    const x2 = Math.max(gameState.attackGroupStart.x, gameState.attackGroupEnd.x)
    const y2 = Math.max(gameState.attackGroupStart.y, gameState.attackGroupEnd.y)

    const enemyTargets = []
    const humanPlayer = gameState.humanPlayer || 'player1'
    
    // Helper function to check if a target belongs to the human player
    const isHumanPlayerTarget = (target) => {
      return target.owner === humanPlayer || (humanPlayer === 'player1' && target.owner === 'player')
    }
    
    // Check all enemy units and buildings - exclude human player units
    for (const unit of units) {
      if (!isHumanPlayerTarget(unit) && unit.health > 0) {
        const centerX = unit.x + TILE_SIZE / 2
        const centerY = unit.y + TILE_SIZE / 2
        
        if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
          enemyTargets.push(unit)
        }
      }
    }
    
    // Check enemy buildings - exclude human player buildings
    if (gameState.buildings) {
      for (const building of gameState.buildings) {
        if (!isHumanPlayerTarget(building) && building.health > 0) {
          const buildingCenterX = (building.x + building.width / 2) * TILE_SIZE
          const buildingCenterY = (building.y + building.height / 2) * TILE_SIZE
          
          if (buildingCenterX >= x1 && buildingCenterX <= x2 && 
              buildingCenterY >= y1 && buildingCenterY <= y2) {
            enemyTargets.push(building)
          }
        }
      }
    }
    
    return enemyTargets
  }

  setupAttackQueue(selectedUnits, enemyTargets, unitCommands, mapGrid) {
    // Store the attack targets in gameState for visual indicators temporarily
    gameState.attackGroupTargets = [...enemyTargets]
    
    // Set flag to prevent clearing AGF state during AGF operations
    unitCommands.isAttackGroupOperation = true
    
    // Assign targets to units - ALL units attack ALL targets in the SAME order for efficiency
    const combatUnits = selectedUnits.filter(unit => 
      unit.type !== 'harvester' && unit.owner === gameState.humanPlayer
    )
    
    // Process all units BEFORE clearing the flag
    combatUnits.forEach((unit) => {
      // Clear any existing attack queue and target
      unit.attackQueue = []
      unit.target = null
      
      // Add all targets to the queue in the same order for all units
      enemyTargets.forEach(target => {
        unit.attackQueue.push(target)
      })
      
      // Set the first target as the current target
      if (unit.attackQueue.length > 0) {
        unit.target = unit.attackQueue[0]
      }
    })
    
    // Now issue attack commands to all units at once
    if (combatUnits.length > 0 && combatUnits[0].target) {
      unitCommands.handleAttackCommand(combatUnits, combatUnits[0].target, mapGrid, false)
    }
    
    // Clear the flag after ALL AGF operations are complete
    unitCommands.isAttackGroupOperation = false
    
    // Don't clear attack targets immediately - let them persist until user does something else
    // (They will be cleared when user issues other commands or selects new targets)
  }

  handleForceAttackCommand(worldX, worldY, units, selectedUnits, unitCommands, mapGrid) {
    // Only process Force Attack if units are selected, not factories
    if (selectedUnits[0].type !== 'factory') {
      let forceAttackTarget = null

      // Check friendly buildings first
      if (gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (selectionManager.isHumanPlayerBuilding(building)) {
            const buildingX = building.x * TILE_SIZE
            const buildingY = building.y * TILE_SIZE
            const buildingWidth = building.width * TILE_SIZE
            const buildingHeight = building.height * TILE_SIZE

            if (worldX >= buildingX &&
                worldX < buildingX + buildingWidth &&
                worldY >= buildingY &&
                worldY < buildingY + buildingHeight) {
              forceAttackTarget = building
              break
            }
          }
        }
      }

      // Check friendly units if no building was targeted
      if (!forceAttackTarget) {
        for (const unit of units) {
          if (selectionManager.isHumanPlayerUnit(unit) && !unit.selected) {
            const centerX = unit.x + TILE_SIZE / 2
            const centerY = unit.y + TILE_SIZE / 2
            if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
              forceAttackTarget = unit
              break
            }
          }
        }
      }

      // If we found a friendly target, issue the Force Attack command
      if (forceAttackTarget) {
        unitCommands.handleAttackCommand(selectedUnits, forceAttackTarget, mapGrid, true)
        return true // Mark that we've handled this click
      }
    }
    return false
  }

  handleSingleClick(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid) {
    // Priority 1: Check main construction yard factory first
    let selectedFactory = null
    for (const factory of factories) {
      if (factory.id === gameState.humanPlayer) {
        const factoryPixelX = factory.x * TILE_SIZE
        const factoryPixelY = factory.y * TILE_SIZE

        if (worldX >= factoryPixelX &&
            worldX < factoryPixelX + factory.width * TILE_SIZE &&
            worldY >= factoryPixelY &&
            worldY < factoryPixelY + factory.height * TILE_SIZE) {
          selectedFactory = factory
          break
        }
      }
    }

    if (selectedFactory) {
      selectionManager.handleFactorySelection(selectedFactory, e, units, selectedUnits)
      // Update AGF capability after factory selection
      this.updateAGFCapability(selectedUnits)
      return
    }

    // Priority 2: Check other buildings (including vehicle factories)
    this.handleUnitSelection(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid)
  }

  handleUnitSelection(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid) {
    // Check for building selection first (including vehicle factories)
    let clickedBuilding = null
    if (gameState.buildings && gameState.buildings.length > 0) {
      for (const building of gameState.buildings) {
        if (selectionManager.isHumanPlayerBuilding(building)) {
          const buildingX = building.x * TILE_SIZE
          const buildingY = building.y * TILE_SIZE
          const buildingWidth = building.width * TILE_SIZE
          const buildingHeight = building.height * TILE_SIZE

          if (worldX >= buildingX && worldX < buildingX + buildingWidth &&
              worldY >= buildingY && worldY < buildingY + buildingHeight) {
            clickedBuilding = building
            break
          }
        }
      }
    }

    if (clickedBuilding) {
      // Handle building selection (including unit-producing factories)
      selectionManager.handleBuildingSelection(clickedBuilding, e, units, selectedUnits)
      // Update AGF capability after building selection
      this.updateAGFCapability(selectedUnits)
      return
    }

    // Normal unit selection
    let clickedUnit = null
    for (const unit of units) {
      if (selectionManager.isHumanPlayerUnit(unit)) {
        const centerX = unit.x + TILE_SIZE / 2
        const centerY = unit.y + TILE_SIZE / 2
        const dx = worldX - centerX
        const dy = worldY - centerY
        if (Math.hypot(dx, dy) < TILE_SIZE / 2) {
          clickedUnit = unit
          break
        }
      }
    }

    if (clickedUnit) {
      selectionManager.handleUnitSelection(clickedUnit, e, units, factories, selectedUnits)
      // Update AGF capability after unit selection
      this.updateAGFCapability(selectedUnits)
    } else {
      // No unit clicked - handle as movement command if units are selected and not in special modes
      if (selectedUnits.length > 0 && !e.shiftKey && !e.ctrlKey && !gameState.buildingPlacementMode && !gameState.repairMode && !gameState.sellMode) {
        this.handleStandardCommands(worldX, worldY, selectedUnits, unitCommands, mapGrid)
      }
    }
  }

  handleStandardCommands(worldX, worldY, selectedUnits, unitCommands, mapGrid) {
    // Skip command issuing for factory selection
    if (selectedUnits.length > 0 && selectedUnits[0].type !== 'factory') {
      let target = null
      let oreTarget = null

      // Check if clicking on an ore tile with harvesters selected
      const tileX = Math.floor(worldX / TILE_SIZE)
      const tileY = Math.floor(worldY / TILE_SIZE)
      const hasSelectedHarvesters = selectedUnits.some(unit => unit.type === 'harvester')
      
      if (hasSelectedHarvesters && 
          mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
          tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length &&
          mapGrid[tileY][tileX].ore) {
        oreTarget = { x: tileX, y: tileY }
      }

      if (oreTarget) {
        unitCommands.handleHarvesterCommand(selectedUnits, oreTarget, mapGrid)
      } else {
        // Check for enemy targets
        target = this.findEnemyTarget(worldX, worldY)
        
        if (target) {
          unitCommands.handleAttackCommand(selectedUnits, target, mapGrid, false)
        } else {
          // No target: move to clicked location
          unitCommands.handleMovementCommand(selectedUnits, worldX, worldY, mapGrid)
        }
      }
    }
  }

  findEnemyTarget(worldX, worldY) {
    
    // Check enemy buildings first (they have priority)
    if (gameState.buildings && gameState.buildings.length > 0) {
      for (const building of gameState.buildings) {
        if (building.owner !== 'player') {
          const buildingX = building.x * TILE_SIZE
          const buildingY = building.y * TILE_SIZE
          const buildingWidth = building.width * TILE_SIZE
          const buildingHeight = building.height * TILE_SIZE

          if (worldX >= buildingX &&
              worldX < buildingX + buildingWidth &&
              worldY >= buildingY &&
              worldY < buildingY + buildingHeight) {
            return building
          }
        }
      }
    }

    // Check enemy factories if no building was targeted
    const factories = this.gameFactories || [] // Use stored gameFactories
    for (const factory of factories) {
      if (factory.id !== 'player' &&
          worldX >= factory.x * TILE_SIZE &&
          worldX < (factory.x + factory.width) * TILE_SIZE &&
          worldY >= factory.y * TILE_SIZE &&
          worldY < (factory.y + factory.height) * TILE_SIZE) {
        return factory
      }
    }

    // Check enemy units if no building or factory was targeted
    for (const unit of units) {
      if (unit.owner !== 'player') {
        const centerX = unit.x + TILE_SIZE / 2
        const centerY = unit.y + TILE_SIZE / 2
        const distance = Math.hypot(worldX - centerX, worldY - centerY)
        if (distance < TILE_SIZE / 2) {
          return unit
        }
      }
    }

    return null
  }

  handleContextMenu(e, gameCanvas) {
    // Prevent the default context menu
    e.preventDefault()

    // Track if any mode was active and canceled
    let modeWasCanceled = false

    // Cancel repair mode if it's active
    if (gameState.repairMode) {
      gameState.repairMode = false
      const repairBtn = document.getElementById('repairBtn')
      if (repairBtn) {
        repairBtn.classList.remove('active')
      }
      gameCanvas.classList.remove('repair-mode', 'repair-blocked-mode')
      modeWasCanceled = true
    }

    // Cancel sell mode if it's active
    if (gameState.sellMode) {
      gameState.sellMode = false
      const sellBtn = document.getElementById('sellBtn')
      if (sellBtn) {
        sellBtn.classList.remove('active')
      }
      gameCanvas.classList.remove('sell-mode', 'sell-blocked-mode')
      modeWasCanceled = true
    }

    // Reset cursor if any mode was canceled
    if (modeWasCanceled) {
      // Reset cursor
      gameCanvas.style.cursor = 'default'

      // Show notification
      showNotification('Action mode canceled')

      // Play a cancel sound for feedback
      playSound('cancel', 0.5)
    }

    // Allow the event to continue for other right-click handlers
    return false
  }

  // Method to check if AGF rendering should be disabled
  shouldDisableAGFRendering() {
    return this.disableAGFRendering
  }

  updateAGFCapability(selectedUnits) {
    // Update AGF capability based on current selection
    this.hasSelectedCombatUnits = this.shouldStartAttackGroupMode(selectedUnits)
  }
}
