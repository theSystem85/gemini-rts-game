// mouseHandler.js
import { TILE_SIZE } from '../config.js'
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
  }

  setupMouseEvents(gameCanvas, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager) {
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
        this.handleLeftMouseDown(worldX, worldY, gameCanvas)
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
      } else if (!this.isSelecting) {
        gameCanvas.style.cursor = selectedUnits.length > 0 ? 'grab' : 'default'
      }

      // Update selection rectangle
      if (this.isSelecting) {
        this.updateSelectionRectangle(worldX, worldY)
      }

      // Update custom cursor position and visibility
      cursorManager.updateCustomCursor(e, mapGrid, factories, selectedUnits)
    })

    gameCanvas.addEventListener('mouseup', e => {
      // Don't process input if game is paused
      if (gameState.paused) return

      if (e.button === 2) {
        this.handleRightMouseUp(e, units, factories, selectedUnits, cursorManager)
      } else if (e.button === 0 && this.isSelecting) {
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

  handleLeftMouseDown(worldX, worldY, gameCanvas) {
    this.isSelecting = true
    gameState.selectionActive = true
    this.wasDragging = false
    this.selectionStart = { x: worldX, y: worldY }
    this.selectionEnd = { x: worldX, y: worldY }
    gameState.selectionStart = { ...this.selectionStart }
    gameState.selectionEnd = { ...this.selectionEnd }
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
    this.selectionEnd = { x: worldX, y: worldY }
    gameState.selectionEnd = { ...this.selectionEnd }

    if (!this.wasDragging && (Math.abs(this.selectionEnd.x - this.selectionStart.x) > 5 || Math.abs(this.selectionEnd.y - this.selectionStart.y) > 5)) {
      this.wasDragging = true
    }
  }

  handleRightMouseUp(e, units, factories, selectedUnits, cursorManager) {
    // End right-click drag
    gameState.isRightDragging = false
    const gameCanvas = document.getElementById('gameCanvas')
    gameCanvas.style.cursor = 'grab'

    // Only deselect units if this was NOT a drag operation
    if (!this.rightWasDragging) {
      units.forEach(u => { if (u.owner === 'player') u.selected = false })
      selectedUnits.length = 0
    }
    this.rightWasDragging = false

    // Update custom cursor visibility after unit selection changes
    cursorManager.updateCustomCursor(e, gameState.mapGrid, factories, selectedUnits)

    // Check if the player factory is selected
    const playerFactory = factories.find(f => f.id === 'player' && f.selected)
    if (playerFactory) {
      const rect = gameCanvas.getBoundingClientRect()
      const worldX = e.clientX - rect.left + gameState.scrollOffset.x
      const worldY = e.clientY - rect.top + gameState.scrollOffset.y

      // Set rally point at clicked tile
      playerFactory.rallyPoint = {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE)
      }

      // Visual feedback for rally point setting
      playSound('movement', 0.5)
    }
  }

  handleLeftMouseUp(e, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager) {
    const rect = e.target.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y

    // Variable to store if we've handled the Force Attack command
    let forceAttackHandled = false

    // First, handle Command Issuing in Force Attack Mode
    if (selectedUnits.length > 0 && !this.wasDragging && e.ctrlKey) {
      forceAttackHandled = this.handleForceAttackCommand(worldX, worldY, units, selectedUnits, unitCommands, mapGrid)
    }

    // If we handled Force Attack, skip normal selection/command processing
    if (!forceAttackHandled) {
      // Normal selection and command handling
      if (this.wasDragging) {
        selectionManager.handleBoundingBoxSelection(units, factories, selectedUnits, this.selectionStart, this.selectionEnd)
      } else {
        this.handleSingleClick(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid)
      }
    }

    this.isSelecting = false
    gameState.selectionActive = false
  }

  handleForceAttackCommand(worldX, worldY, units, selectedUnits, unitCommands, mapGrid) {
    // Only process Force Attack if units are selected, not factories
    if (selectedUnits[0].type !== 'factory') {
      let forceAttackTarget = null

      // Check friendly buildings first
      if (gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner === 'player') {
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
          if (unit.owner === 'player' && !unit.selected) {
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
    // Single unit or factory selection
    let selectedFactory = null
    for (const factory of factories) {
      if (factory.id === 'player') {
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
    } else {
      this.handleUnitSelection(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid)
    }
  }

  handleUnitSelection(worldX, worldY, e, units, factories, selectedUnits, selectionManager, unitCommands, mapGrid) {
    // Normal unit selection
    let clickedUnit = null
    for (const unit of units) {
      if (unit.owner === 'player') {
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
    }

    // Standard Command Issuing (no Force Attack)
    if (selectedUnits.length > 0 && !this.wasDragging && !e.shiftKey) {
      this.handleStandardCommands(worldX, worldY, selectedUnits, unitCommands, mapGrid)
    }
  }

  handleStandardCommands(worldX, worldY, selectedUnits, unitCommands, mapGrid) {
    // Skip command issuing for factory selection
    if (selectedUnits[0].type !== 'factory') {
      let target = null
      let oreTarget = null

      // Check if clicking on an ore tile with harvesters selected
      const tileX = Math.floor(worldX / TILE_SIZE)
      const tileY = Math.floor(worldY / TILE_SIZE)
      const hasSelectedHarvesters = selectedUnits.some(unit => unit.type === 'harvester')
      
      if (hasSelectedHarvesters && 
          mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
          tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length &&
          mapGrid[tileY][tileX].type === 'ore') {
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
          unitCommands.handleMovementCommand(selectedUnits, worldX, worldY, mapGrid, selectedUnits)
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
    const factories = gameState.factories || []
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
}
