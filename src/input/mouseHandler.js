// mouseHandler.js
import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'
import { units } from '../main.js'
import { playSound, playPositionalSound } from '../sound.js'
import { showNotification } from '../ui/notifications.js'
import { isForceAttackModifierActive, isGuardModifierActive } from '../utils/inputUtils.js'
import { markWaypointsAdded } from '../game/waypointSounds.js'
import { initiateRetreat } from '../behaviours/retreat.js'
import { AttackGroupHandler } from './attackGroupHandler.js'

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
    
    // Attack Group feature manager
    this.attackGroupHandler = new AttackGroupHandler()

    // Track if a force attack click started while Ctrl was held
    this.forceAttackClick = false

    // Track if a guard click started while Meta was held
    this.guardClick = false
    
  }

  setupMouseEvents(gameCanvas, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager) {
    this.gameFactories = factories // Store the passed factories list
    this.gameUnits = units // Store the passed units list for recovery tank detection
    this.selectionManager = selectionManager
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
        // Left-click: start selection or force attack
        this.handleLeftMouseDown(e, worldX, worldY, gameCanvas, selectedUnits, cursorManager)
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
      } else if (!this.isSelecting && !this.attackGroupHandler.isAttackGroupSelecting) {
        gameCanvas.style.cursor = selectedUnits.length > 0 ? 'grab' : 'default'
      }

      // Update selection rectangle if we're actively selecting 
      // Remove the unreliable (e.buttons & 1) check that was causing cancellations
      if (this.isSelecting || this.attackGroupHandler.isAttackGroupSelecting) {
        this.updateSelectionRectangle(worldX, worldY, cursorManager)
      }

      // Update custom cursor position and visibility
      cursorManager.updateCustomCursor(e, mapGrid, factories, selectedUnits, units)
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

  handleLeftMouseDown(e, worldX, worldY, gameCanvas, selectedUnits, cursorManager) {
    // Track mouse down time and position
    this.mouseDownTime = performance.now()

    // Determine if this click should issue a force attack command
    this.forceAttackClick = selectedUnits.length > 0 && isForceAttackModifierActive(e)
    // Determine if this click should issue a guard command
    this.guardClick = selectedUnits.length > 0 && isGuardModifierActive(e)

    // Check if we're over a recovery tank with damaged units selected
    // This should prevent AGF mode from being triggered but allow normal selection
    const isRecoveryTankInteraction = cursorManager && cursorManager.isOverRecoveryTank
    
    // Additional direct check for recovery tank interaction
    const hasSelectedDamagedUnits = selectedUnits.some(unit => unit.health < unit.maxHealth)
    const hasSelectedRecoveryTanks = selectedUnits.some(unit => unit.type === 'recoveryTank')
    
    // Store this for use during dragging
    this.isRecoveryTankInteraction = isRecoveryTankInteraction || 
      (hasSelectedDamagedUnits && this.isOverRecoveryTankAt(worldX, worldY)) ||
      (hasSelectedRecoveryTanks && this.isOverDamagedUnitAt(worldX, worldY, selectedUnits))

    // Store potential attack group start position
    this.attackGroupHandler.potentialAttackGroupStart = { x: worldX, y: worldY }
    // Don't enable AGF mode if we're doing a recovery tank interaction
    this.attackGroupHandler.hasSelectedCombatUnits = !this.forceAttackClick && !this.guardClick && !this.isRecoveryTankInteraction && this.attackGroupHandler.shouldStartAttackGroupMode(selectedUnits)

    // Allow normal selection for recovery tank interactions (but AGF will be disabled)
    this.isSelecting = !this.forceAttackClick && !this.guardClick

    // Prevent selection box from appearing when assigning rally points
    if (selectedUnits.length === 1 && selectedUnits[0].isBuilding &&
        (selectedUnits[0].type === 'vehicleFactory' || selectedUnits[0].type === 'vehicleWorkshop')) {
      this.isSelecting = false
    }

    gameState.selectionActive = this.isSelecting
    this.wasDragging = false
    this.selectionStart = { x: worldX, y: worldY }
    this.selectionEnd = { x: worldX, y: worldY }
    gameState.selectionStart = { ...this.selectionStart }
    gameState.selectionEnd = { ...this.selectionEnd }
    
    // Reset AGF state initially
    gameState.attackGroupMode = false
    this.attackGroupHandler.isAttackGroupSelecting = false
    this.attackGroupHandler.attackGroupWasDragging = false
    gameState.attackGroupStart = { x: 0, y: 0 }
    gameState.attackGroupEnd = { x: 0, y: 0 }
    gameState.disableAGFRendering = false

    // If cursor is over a player gas station for refueling, disable selection/AGF
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)
    const needsGas = selectedUnits.some(
      u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75
    )
    if (needsGas && gameState.buildings && Array.isArray(gameState.buildings)) {
      for (const building of gameState.buildings) {
        if (
          building.type === 'gasStation' &&
          building.owner === gameState.humanPlayer &&
          building.health > 0 &&
          tileX >= building.x && tileX < building.x + building.width &&
          tileY >= building.y && tileY < building.y + building.height
        ) {
          this.isSelecting = false
          gameState.selectionActive = false
          gameState.disableAGFRendering = true
          break
        }
      }
    }
  }


  updateEnemyHover(worldX, worldY, units, factories, selectedUnits, cursorManager) {
    if (selectedUnits.length > 0) {
      let isOverEnemy = false
      let isOverFriendlyUnit = false

      // Check enemy factories
      for (const factory of factories) {
        const humanPlayer = gameState.humanPlayer || 'player1'
        if (factory.id !== humanPlayer && !(humanPlayer === 'player1' && factory.id === 'player')) {
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
        const humanPlayer = gameState.humanPlayer || 'player1'
        for (const building of gameState.buildings) {
          // Check if building is NOT owned by human player
          if (building.owner !== humanPlayer && !(humanPlayer === 'player1' && building.owner === 'player')) {
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

      // Check friendly units first (before enemy units)
      if (!isOverEnemy && !isOverFriendlyUnit) {
        const humanPlayer = gameState.humanPlayer || 'player1'
        for (const unit of units) {
          if (unit.owner === humanPlayer || (humanPlayer === 'player1' && unit.owner === 'player')) {
            const centerX = unit.x + TILE_SIZE / 2
            const centerY = unit.y + TILE_SIZE / 2
            if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
              isOverFriendlyUnit = true
              break
            }
          }
        }
      }

      // Check enemy units
      if (!isOverEnemy && !isOverFriendlyUnit) {
        const humanPlayer = gameState.humanPlayer || 'player1'
        for (const unit of units) {
          // Check if unit is NOT owned by human player
          if (unit.owner !== humanPlayer && !(humanPlayer === 'player1' && unit.owner === 'player')) {
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
      cursorManager.setIsOverFriendlyUnit(isOverFriendlyUnit)
      
      // Update artillery turret range detection for cursor changes
      let enemyInRange = false
      let enemyOutOfRange = false
      
      // Check if any selected unit is an artillery turret (for both enemy targeting and force attack mode)
      const selectedArtilleryTurrets = selectedUnits.filter(unit => 
        unit.type === 'artilleryTurret'  // Remove isBuilding check as it might be missing
      )
      
      // Also check gameState.buildings for selected artillery turrets (alternative selection method)
      let additionalArtilleryTurrets = []
      if (gameState.buildings) {
        additionalArtilleryTurrets = gameState.buildings.filter(b => 
          b.type === 'artilleryTurret' && b.selected && b.owner === gameState.humanPlayer
        )
      }
      
      const allArtilleryTurrets = [...selectedArtilleryTurrets, ...additionalArtilleryTurrets]
      
      // Calculate range for artillery turrets when they are selected (both for enemy targeting and force attack)
      if (allArtilleryTurrets.length > 0) {
        for (const turret of allArtilleryTurrets) {
          const turretCenterX = (turret.x + turret.width / 2) * TILE_SIZE
          const turretCenterY = (turret.y + turret.height / 2) * TILE_SIZE
          const distance = Math.hypot(worldX - turretCenterX, worldY - turretCenterY)
          const maxRange = turret.fireRange * TILE_SIZE
          
          if (distance <= maxRange) {
            enemyInRange = true
          } else {
            enemyOutOfRange = true
          }
        }
        
        // If some turrets can reach and some can't, prioritize in-range
        if (enemyInRange && enemyOutOfRange) {
          enemyInRange = true
          enemyOutOfRange = false
        } else if (!enemyInRange && enemyOutOfRange) {
          enemyInRange = false
          enemyOutOfRange = true
        }
      }
      
      cursorManager.setIsOverEnemyInRange(isOverEnemy && enemyInRange)
      cursorManager.setIsOverEnemyOutOfRange(isOverEnemy && enemyOutOfRange)
      
      // For force attack mode with artillery turrets, set range flags regardless of enemy presence
      if (allArtilleryTurrets.length > 0) {
        cursorManager.setIsInArtilleryRange(enemyInRange)
        cursorManager.setIsOutOfArtilleryRange(enemyOutOfRange)
      } else {
        cursorManager.setIsInArtilleryRange(false)
        cursorManager.setIsOutOfArtilleryRange(false)
      }
    } else {
      // No units selected, reset hover states
      cursorManager.setIsOverEnemy(false)
      cursorManager.setIsOverFriendlyUnit(false)
      cursorManager.setIsOverEnemyInRange(false)
      cursorManager.setIsOverEnemyOutOfRange(false)
      cursorManager.setIsInArtilleryRange(false)
      cursorManager.setIsOutOfArtilleryRange(false)
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
    if (!this.rightWasDragging && Math.hypot(e.clientX - this.rightDragStart.x, e.clientY - this.rightDragStart.y) > 3) {
      this.rightWasDragging = true
    }
  }

  updateSelectionRectangle(worldX, worldY, cursorManager) {
    // Use the stored recovery tank interaction state from mouse down
    const isRecoveryTankInteraction = this.isRecoveryTankInteraction || (cursorManager && cursorManager.isOverRecoveryTank)
    
    // Check if we should transition to attack group mode during dragging
    if (!this.attackGroupHandler.isAttackGroupSelecting && 
        this.attackGroupHandler.hasSelectedCombatUnits && 
        this.isSelecting && 
        !isRecoveryTankInteraction) { // Prevent AGF when recovery tank interaction is possible
      const dragDistance = Math.hypot(
        worldX - this.attackGroupHandler.potentialAttackGroupStart.x,
        worldY - this.attackGroupHandler.potentialAttackGroupStart.y
      )
      
      // Transition to AGF mode immediately if combat units are selected and we start dragging
      if (dragDistance > 3) { // Small threshold to avoid accidental activation
        // Transition from normal selection to attack group mode
        this.attackGroupHandler.isAttackGroupSelecting = true
        this.isSelecting = false
        gameState.selectionActive = false // Clear normal selection
        gameState.attackGroupMode = true
        this.attackGroupHandler.attackGroupStartWorld = { ...this.attackGroupHandler.potentialAttackGroupStart }
        gameState.attackGroupStart = { ...this.attackGroupHandler.potentialAttackGroupStart }
        gameState.attackGroupEnd = { x: worldX, y: worldY }
        this.attackGroupHandler.attackGroupWasDragging = true
        
        // Clear normal selection rectangle coordinates to prevent rendering
        gameState.selectionStart = { x: 0, y: 0 }
        gameState.selectionEnd = { x: 0, y: 0 }
        return
      }
    }

    if (this.attackGroupHandler.isAttackGroupSelecting) {
      // Update attack group rectangle (red box)
      gameState.attackGroupEnd = { x: worldX, y: worldY }
      this.attackGroupHandler.attackGroupWasDragging = true
    } else if (this.isSelecting && !isRecoveryTankInteraction) {
      // Update normal selection rectangle (yellow box) - but not during recovery tank interactions
      this.selectionEnd = { x: worldX, y: worldY }
      gameState.selectionEnd = { ...this.selectionEnd }

      if (!this.wasDragging && (Math.abs(this.selectionEnd.x - this.selectionStart.x) > 3 || Math.abs(this.selectionEnd.y - this.selectionStart.y) > 3)) {
        this.wasDragging = true
      }
    }
  }  handleRightMouseUp(e, units, factories, selectedUnits, selectionManager, cursorManager) {
    // End right-click drag
    gameState.isRightDragging = false
    const gameCanvas = document.getElementById('gameCanvas')
    gameCanvas.style.cursor = 'grab'

    // Check if any unit-producing factory/building is selected BEFORE deselecting
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y

    // Right click no longer sets rally points, it only deselects

    // Only deselect other units if this was NOT a drag operation AND no factory was selected
      if (!this.rightWasDragging) {
        units.forEach(u => { if (selectionManager.isSelectableUnit(u)) u.selected = false })
      
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
    cursorManager.updateCustomCursor(e, gameState.mapGrid || [], factories, selectedUnits, units)
  }

  handleLeftMouseUp(e, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager) {
    const rect = e.target.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y

    // Check if a player factory or workshop is selected to place a rally point
    const selectedFactory = factories.find(f => f.selected && f.id === gameState.humanPlayer)
    if (selectedFactory && !this.wasDragging && !gameState.repairMode) {
      selectedFactory.rallyPoint = {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE)
      }
      playPositionalSound('movement', worldX, worldY, 0.5)

      selectedFactory.selected = false
      const factoryIndex = selectedUnits.indexOf(selectedFactory)
      if (factoryIndex > -1) {
        selectedUnits.splice(factoryIndex, 1)
      }
      this.updateAGFCapability(selectedUnits)
      showNotification('Rally point set for Construction Yard', 1500)
      cursorManager.updateCustomCursor(e, gameState.mapGrid || [], factories, selectedUnits, units)
      return
    }

    const selectedBuilding = gameState.buildings && gameState.buildings.find(building =>
      building.selected &&
      building.owner === gameState.humanPlayer &&
      (building.type === 'vehicleFactory' || building.type === 'vehicleWorkshop')
    )
    if (selectedBuilding && !this.wasDragging && !gameState.repairMode) {
      selectedBuilding.rallyPoint = {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE)
      }
      playPositionalSound('movement', worldX, worldY, 0.5)

      // Keep the building selected so the rally point flag remains visible
      if (selectedUnits.indexOf(selectedBuilding) === -1) {
        selectedUnits.push(selectedBuilding)
      }
      this.updateAGFCapability(selectedUnits)

      let buildingName = 'Factory'
      if (selectedBuilding.type === 'vehicleFactory') {
        buildingName = 'Vehicle Factory'
      } else if (selectedBuilding.type === 'vehicleWorkshop') {
        buildingName = 'Vehicle Workshop'
      }
      showNotification(`Rally point set for ${buildingName}`, 1500)
      cursorManager.updateCustomCursor(e, gameState.mapGrid || [], factories, selectedUnits, units)
      return
    }

    // Handle attack group mode (only if it was actually activated during dragging)
    if (this.attackGroupHandler.isAttackGroupSelecting && gameState.attackGroupMode) {
      this.attackGroupHandler.handleMouseUp(worldX, worldY, units, selectedUnits, unitCommands, mapGrid,
        this.handleStandardCommands.bind(this))
      return // Exit early after handling attack group
    }

    // Variable to store if we've handled the Force Attack command
    let forceAttackHandled = false
    let guardHandled = false

    // First, handle Command Issuing in Force Attack Mode
    if (selectedUnits.length > 0 && !this.wasDragging && (this.forceAttackClick || isForceAttackModifierActive(e))) {
      forceAttackHandled = this.handleForceAttackCommand(worldX, worldY, units, selectedUnits, unitCommands, mapGrid, selectionManager)
    }

    if (selectedUnits.length > 0 && !this.wasDragging && (this.guardClick || isGuardModifierActive(e))) {
      guardHandled = this.handleGuardCommand(worldX, worldY, units, selectedUnits, unitCommands, selectionManager, mapGrid)
    }

    // If we handled Force Attack, skip normal selection/command processing
    if (!forceAttackHandled && !guardHandled) {
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
    this.attackGroupHandler.hasSelectedCombatUnits = false
    
    // Also reset potential attack group state
    this.attackGroupHandler.potentialAttackGroupStart = { x: 0, y: 0 }

    // Reset force attack state captured on mouse down
    this.forceAttackClick = false
    this.guardClick = false
    
    // Reset recovery tank interaction state
    this.isRecoveryTankInteraction = false
    
    // Clear any remaining AGF state if not handled above
    if (!this.attackGroupHandler.isAttackGroupSelecting) {
      gameState.attackGroupMode = false
      gameState.attackGroupStart = { x: 0, y: 0 }
      gameState.attackGroupEnd = { x: 0, y: 0 }
      gameState.disableAGFRendering = false
    }
  }


  handleForceAttackCommand(worldX, worldY, units, selectedUnits, unitCommands, mapGrid, selectionManager) {
    const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
    if (commandableUnits.length === 0) {
      return false
    }
    // Only process Force Attack if units or defensive buildings are selected, not factories
    if (commandableUnits[0].type !== 'factory') {
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

      // If no specific target found, create a ground target for force attacking empty ground
      if (!forceAttackTarget) {
        const targetTileX = Math.floor(worldX / TILE_SIZE)
        const targetTileY = Math.floor(worldY / TILE_SIZE)
        
        // Create a synthetic ground target object
        forceAttackTarget = {
          id: `ground_${targetTileX}_${targetTileY}_${Date.now()}`,
          type: 'groundTarget',
          x: worldX,
          y: worldY,
          tileX: targetTileX,
          tileY: targetTileY,
          health: 1, // Dummy health value to avoid targeting issues
          maxHealth: 1,
          isGroundTarget: true
        }
      }

      // If we found a target (friendly unit/building or ground), issue the Force Attack command
      if (forceAttackTarget) {
        const first = commandableUnits[0]
        if (first.isBuilding) {
          commandableUnits.forEach(b => {
            b.forcedAttackTarget = forceAttackTarget
            b.forcedAttack = true
            b.holdFire = false
          })
          return true
        } else {
          commandableUnits.forEach(unit => {
            unit.forcedAttack = true
          })
          unitCommands.handleAttackCommand(commandableUnits, forceAttackTarget, mapGrid, true)
          return true
        }
      }
    }
    return false
  }

  handleGuardCommand(worldX, worldY, units, selectedUnits, unitCommands, selectionManager, mapGrid) {
    const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
    if (commandableUnits.length === 0) {
      return false
    }
    let guardTarget = null
    for (const unit of units) {
      if (selectionManager.isHumanPlayerUnit(unit) && !unit.selected) {
        const centerX = unit.x + TILE_SIZE / 2
        const centerY = unit.y + TILE_SIZE / 2
        if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
          guardTarget = unit
          break
        }
      }
    }

    if (guardTarget) {
      commandableUnits.forEach(u => {
        u.guardTarget = guardTarget
        u.guardMode = true
        u.target = null
        u.moveTarget = null
      })
      playSound('confirmed', 0.5)
      return true
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
    // Check for AGF capability first - if units are AGF capable, prioritize normal AGF behavior
    const hasSelectedUnits = selectedUnits && selectedUnits.length > 0
    const hasCombatUnits = hasSelectedUnits && selectedUnits.some(unit =>
      unit.type !== 'harvester' && unit.owner === gameState.humanPlayer && !unit.isBuilding
    )
    const hasSelectedFactory = hasSelectedUnits && selectedUnits.some(unit =>
      (unit.isBuilding && (unit.type === 'vehicleFactory' || unit.type === 'constructionYard')) ||
      (unit.id && (unit.id === gameState.humanPlayer))
    )
    const isAGFCapable = hasSelectedUnits && hasCombatUnits && !hasSelectedFactory &&
                        !gameState.buildingPlacementMode &&
                        !gameState.repairMode &&
                        !gameState.sellMode &&
                        !gameState.attackGroupMode

    // PRIORITY 1: Check for refinery unload command if harvesters are already selected
    if (selectedUnits.length > 0) {
      const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
      const hasSelectedHarvesters = commandableUnits.some(unit => unit.type === 'harvester')
      
      if (hasSelectedHarvesters) {
        // Check if clicking on a player refinery with harvesters selected
        const tileX = Math.floor(worldX / TILE_SIZE)
        const tileY = Math.floor(worldY / TILE_SIZE)
        
        if (gameState.buildings && Array.isArray(gameState.buildings)) {
          for (const building of gameState.buildings) {
            if (building.type === 'oreRefinery' && 
                building.owner === gameState.humanPlayer &&
                building.health > 0 &&
                tileX >= building.x && tileX < building.x + building.width &&
                tileY >= building.y && tileY < building.y + building.height) {
              // Handle forced unload at specific refinery
              unitCommands.handleRefineryUnloadCommand(commandableUnits, building, mapGrid)
              return // Exit early, don't process building selection
            }
          }
        }
      }

      // Check for vehicle workshop repair command if any units are selected
      const tileX = Math.floor(worldX / TILE_SIZE)
      const tileY = Math.floor(worldY / TILE_SIZE)
      
      if (gameState.buildings && Array.isArray(gameState.buildings)) {
        for (const building of gameState.buildings) {
          if (building.type === 'vehicleWorkshop' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            // Handle repair workshop command - don't select the building
            unitCommands.handleRepairWorkshopCommand(commandableUnits, building, mapGrid)
            return // Exit early, don't process building selection
          }
        }
      }

      // Check for tanker truck refuel command
      const hasSelectedTankers = commandableUnits.some(unit => unit.type === 'tankerTruck')
      if (hasSelectedTankers) {
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && typeof unit.maxGas === 'number') {
            const uX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const uY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
            if (uX === tileX && uY === tileY && unit.gas < unit.maxGas) {
              unitCommands.handleTankerRefuelCommand(commandableUnits, unit, mapGrid)
              return
            }
          }
        }
      }

      // Check for ambulance healing command if ambulances are selected
      const hasSelectedAmbulances = commandableUnits.some(unit => unit.type === 'ambulance' && unit.medics > 0)
      
      if (hasSelectedAmbulances) {
        // Check if clicking on a friendly unit that needs healing
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && 
              unit.crew && typeof unit.crew === 'object') {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
            
            if (unitTileX === tileX && unitTileY === tileY) {
              // Check if unit has missing crew members
              const missingCrew = Object.entries(unit.crew).filter(([_, alive]) => !alive)
              if (missingCrew.length > 0) {
                // Handle ambulance healing command
                unitCommands.handleAmbulanceHealCommand(commandableUnits, unit, mapGrid)
                return // Exit early, don't process unit selection
              }
            }
          }
        }
      }

      // Check for recovery tank repair command if recovery tanks are selected
      const hasSelectedRecoveryTanks = commandableUnits.some(unit => unit.type === 'recoveryTank')
      
      if (hasSelectedRecoveryTanks) {
        // Check if clicking on a friendly unit that needs repair
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && 
              unit.type !== 'recoveryTank' &&
              unit.health < unit.maxHealth) {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
            
            if (unitTileX === tileX && unitTileY === tileY) {
              // Handle recovery tank repair command
              unitCommands.handleRecoveryTankRepairCommand(commandableUnits, unit, mapGrid)
              return // Exit early, don't process unit selection
            }
          }
        }
      }

      // Check for damaged unit requesting recovery tank help
      const hasSelectedDamagedUnits = commandableUnits.some(unit => unit.health < unit.maxHealth)
      
      if (hasSelectedDamagedUnits) {
        // Check if clicking on a recovery tank
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer && unit.type === 'recoveryTank') {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
            
            if (unitTileX === tileX && unitTileY === tileY) {
              // Handle damaged unit requesting recovery tank help
              unitCommands.handleDamagedUnitToRecoveryTankCommand(commandableUnits, unit, mapGrid)
              return // Exit early, don't process unit selection
            }
          }
        }
      }

      const hasSelectedRecovery = commandableUnits.some(unit => unit.type === 'recoveryTank')
      if (hasSelectedRecovery) {
        for (const unit of units) {
          if (unit.owner === gameState.humanPlayer) {
            const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
            const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
            if (unitTileX === tileX && unitTileY === tileY) {
              if (unit.crew && (!unit.crew.driver || !unit.crew.commander)) {
                unitCommands.handleRecoveryTowCommand(commandableUnits, unit)
                return
              }
            }
          }
        }
      }

      // Check for ambulance refilling command if ambulances are selected
      const hasSelectedNotFullyLoadedAmbulances = commandableUnits.some(unit => unit.type === 'ambulance' && unit.medics < 4)
      
      if (hasSelectedNotFullyLoadedAmbulances) {
        // Check if clicking on a player hospital
        for (const building of gameState.buildings) {
          if (building.type === 'hospital' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            // Handle ambulance refill command
            unitCommands.handleAmbulanceRefillCommand(commandableUnits, building, mapGrid)
            return // Exit early, don't process building selection
          }
        }
      }

      const needsGas = commandableUnits.some(
        u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75
      )
      if (needsGas) {
        for (const building of gameState.buildings) {
          if (building.type === 'gasStation' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            unitCommands.handleGasStationRefillCommand(commandableUnits, building, mapGrid)
            return
          }
        }
      }
    }

    // PRIORITY 2: Check for building selection (including vehicle factories)
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

    // PRIORITY 3: Normal unit selection
    let clickedUnit = null
    for (const unit of units) {
      if (selectionManager.isSelectableUnit(unit)) {
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

    const friendlySelected = selectedUnits.some(u => selectionManager.isHumanPlayerUnit(u))
    const clickedIsEnemy = clickedUnit && !selectionManager.isHumanPlayerUnit(clickedUnit)

    if (clickedUnit && !(friendlySelected && clickedIsEnemy)) {
      // Only allow enemy selection when no friendly units are currently selected
      selectionManager.handleUnitSelection(clickedUnit, e, units, factories, selectedUnits)
      // Update AGF capability after unit selection
      this.updateAGFCapability(selectedUnits)
    } else {
      // No unit clicked - handle as movement/attack command if commandable units are selected
      if (selectedUnits.length > 0 && !gameState.buildingPlacementMode && !gameState.repairMode && !gameState.sellMode) {
        const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
        if (commandableUnits.length > 0) {
          if (e.shiftKey) {
            // Initiate immediate retreat without using path planning
            initiateRetreat(commandableUnits, worldX, worldY, mapGrid)
          } else if (e.altKey) {
            // Queue planned action using Alt/Option
            this.handleStandardCommands(worldX, worldY, commandableUnits, unitCommands, mapGrid, true)
          } else if (!isForceAttackModifierActive(e)) {
            // Normal command (not Ctrl+Click which is self attack)
            this.handleStandardCommands(worldX, worldY, commandableUnits, unitCommands, mapGrid, false)
          }
        }
      }
    }
  }

  handleStandardCommands(worldX, worldY, selectedUnits, unitCommands, mapGrid, altPressed = false) {
    const selectionManager = this.selectionManager
    const commandableUnits = selectedUnits.filter(u => selectionManager.isCommandableUnit(u))
    // Skip command issuing for factory selection
    if (commandableUnits.length > 0 && commandableUnits[0].type !== 'factory') {
      let target = null
      let oreTarget = null
      let refineryTarget = null

      // Check if clicking on a player refinery with harvesters selected
      const tileX = Math.floor(worldX / TILE_SIZE)
      const tileY = Math.floor(worldY / TILE_SIZE)
      const hasSelectedHarvesters = commandableUnits.some(unit => unit.type === 'harvester')
      
      if (hasSelectedHarvesters && gameState.buildings && Array.isArray(gameState.buildings)) {
        for (const building of gameState.buildings) {
          if (building.type === 'oreRefinery' &&
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            refineryTarget = building
            break
          }
        }
      }

      // Check if clicking on an ore tile with harvesters selected
      if (hasSelectedHarvesters && 
          mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
          tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length &&
          mapGrid[tileY][tileX].ore) {
        oreTarget = { x: tileX, y: tileY }
      }

      let workshopTarget = null
      let hospitalTarget = null
      let gasStationTarget = null
      if (gameState.buildings && Array.isArray(gameState.buildings)) {
        for (const building of gameState.buildings) {
          if (building.type === 'vehicleWorkshop' && building.owner === gameState.humanPlayer && building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            workshopTarget = building
            break
          }
        }
        
        // Check for hospital if ambulances that need refilling are selected
      const hasNotFullyLoadedAmbulances = commandableUnits.some(unit => unit.type === 'ambulance' && unit.medics < 4)
        if (hasNotFullyLoadedAmbulances) {
          for (const building of gameState.buildings) {
            if (building.type === 'hospital' && building.owner === gameState.humanPlayer && building.health > 0 &&
                tileX >= building.x && tileX < building.x + building.width &&
                tileY >= building.y && tileY < building.y + building.height) {
              hospitalTarget = building
              break
            }
          }
        }

        const needsGas = commandableUnits.some(u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75)
        if (needsGas) {
          for (const building of gameState.buildings) {
            if (building.type === 'gasStation' && building.owner === gameState.humanPlayer && building.health > 0 &&
                tileX >= building.x && tileX < building.x + building.width &&
                tileY >= building.y && tileY < building.y + building.height) {
              gasStationTarget = building
              break
            }
          }
        }
      }

      if (refineryTarget) {
        unitCommands.handleRefineryUnloadCommand(commandableUnits, refineryTarget, mapGrid)
      } else if (workshopTarget) {
        unitCommands.handleRepairWorkshopCommand(commandableUnits, workshopTarget, mapGrid)
      } else if (hospitalTarget) {
        unitCommands.handleAmbulanceRefillCommand(commandableUnits, hospitalTarget, mapGrid)
      } else if (gasStationTarget) {
        unitCommands.handleGasStationRefillCommand(commandableUnits, gasStationTarget, mapGrid)
      } else if (oreTarget) {
        unitCommands.handleHarvesterCommand(commandableUnits, oreTarget, mapGrid)
      } else {
        target = this.findEnemyTarget(worldX, worldY)

        if (target) {
          if (altPressed) {
            commandableUnits.forEach(unit => {
              if (!unit.commandQueue) unit.commandQueue = []
              unit.commandQueue.push({ type: 'attack', target })
            })
            markWaypointsAdded() // Mark that waypoints were added during Alt press
          } else {
            unitCommands.handleAttackCommand(commandableUnits, target, mapGrid, false)
          }
        } else {
          if (altPressed) {
            commandableUnits.forEach(unit => {
              if (!unit.commandQueue) unit.commandQueue = []
              unit.commandQueue.push({ type: 'move', x: worldX, y: worldY })
            })
            markWaypointsAdded() // Mark that waypoints were added during Alt press
          } else {
            unitCommands.handleMovementCommand(commandableUnits, worldX, worldY, mapGrid)
          }
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
    }

    // Allow the event to continue for other right-click handlers
    return false
  }

  updateAGFCapability(selectedUnits) {
    this.attackGroupHandler.updateAGFCapability(selectedUnits)
  }

  // Helper method to check if mouse is over a recovery tank
  isOverRecoveryTankAt(worldX, worldY) {
    if (!this.gameUnits) return false
    
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)
    
    return this.gameUnits.some(unit => {
      if (unit.type === 'recoveryTank' && unit.owner === gameState.humanPlayer) {
        const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
        const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
        return unitTileX === tileX && unitTileY === tileY
      }
      return false
    })
  }

  // Helper method to check if mouse is over a damaged unit  
  isOverDamagedUnitAt(worldX, worldY, selectedUnits) {
    if (!this.gameUnits) return false
    
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)
    
    return this.gameUnits.some(unit => {
      if (unit.owner === gameState.humanPlayer && 
          unit.type !== 'recoveryTank' &&
          unit.health < unit.maxHealth &&
          !selectedUnits.includes(unit)) {
        const unitTileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
        const unitTileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)
        return unitTileX === tileX && unitTileY === tileY
      }
      return false
    })
  }
}
