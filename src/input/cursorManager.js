// cursorManager.js
import { TILE_SIZE } from '../config.js'
import { gameState } from '../gameState.js'

export class CursorManager {
  constructor() {
    this.isOverGameCanvas = false
    this.isOverEnemy = false
    this.isOverFriendlyUnit = false
    this.isOverBlockedTerrain = false
    this.isOverRepairableBuilding = false
    this.isOverSellableBuilding = false
    this.isOverOreTile = false
    this.isOverPlayerRefinery = false
    this.isForceAttackMode = false
    this.lastMouseEvent = null
    
    // DOM update throttling - only update cursor styles every 500ms
    this.lastDOMUpdate = 0
    this.DOM_UPDATE_INTERVAL = 500 // 500ms interval for DOM updates
    this.pendingCursorState = null
    this.pendingClassState = null
  }

  // Function to check if a location is a blocked tile (water, rock, building)
  isBlockedTerrain(tileX, tileY, mapGrid) {
    // First check if mapGrid is defined and properly structured
    if (!mapGrid || !Array.isArray(mapGrid) || mapGrid.length === 0) {
      return false // Can't determine if blocked, assume not blocked
    }

    // Check if tile coordinates are valid
    if (tileX < 0 || tileY < 0 || tileX >= mapGrid[0].length || tileY >= mapGrid.length) {
      return true
    }

    // Ensure we have a valid row before accessing the tile
    if (!mapGrid[tileY] || !mapGrid[tileY][tileX]) {
      return false // Can't determine if blocked, assume not blocked
    }

    // Check if the tile type is impassable
    const tile = mapGrid[tileY][tileX]
    const tileType = tile.type
    const hasBuilding = tile.building
    const hasSeedCrystal = tile.seedCrystal
    return tileType === 'water' || tileType === 'rock' || hasBuilding || hasSeedCrystal
  }

  // Function to update custom cursor position and visibility
  updateCustomCursor(e, mapGrid, factories, selectedUnits) {
    // Store last mouse event for later refreshes
    this.lastMouseEvent = e
    const gameCanvas = document.getElementById('gameCanvas')
    const rect = gameCanvas.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    // Check if cursor is over the game canvas
    this.isOverGameCanvas = (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    )

    // Calculate mouse position in world coordinates
    const worldX = x - rect.left + gameState.scrollOffset.x
    const worldY = y - rect.top + gameState.scrollOffset.y

    // Convert to tile coordinates
    const tileX = Math.floor(worldX / TILE_SIZE)
    const tileY = Math.floor(worldY / TILE_SIZE)

    // Check if mouse is over blocked terrain when in game canvas, with added safety check
    this.isOverBlockedTerrain = this.isOverGameCanvas &&
      mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
      this.isBlockedTerrain(tileX, tileY, mapGrid)

    // Check if mouse is over a player refinery when harvesters are selected
    this.isOverPlayerRefinery = false
    if (this.isOverGameCanvas && gameState.buildings && Array.isArray(gameState.buildings) &&
        tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length) {
      // Only show refinery cursor if harvesters are selected
      const hasSelectedHarvesters = selectedUnits.some(unit => unit.type === 'harvester')
      if (hasSelectedHarvesters) {
        for (const building of gameState.buildings) {
          if (building.type === 'oreRefinery' && 
              building.owner === gameState.humanPlayer &&
              building.health > 0 &&
              tileX >= building.x && tileX < building.x + building.width &&
              tileY >= building.y && tileY < building.y + building.height) {
            this.isOverPlayerRefinery = true
            break
          }
        }
      }
    }

    // Check if mouse is over an ore tile when harvesters are selected
    this.isOverOreTile = false
    if (this.isOverGameCanvas && mapGrid && Array.isArray(mapGrid) && mapGrid.length > 0 &&
        tileX >= 0 && tileY >= 0 && tileX < mapGrid[0].length && tileY < mapGrid.length) {
      // Only show ore tile cursor if harvesters are selected
      const hasSelectedHarvesters = selectedUnits.some(unit => unit.type === 'harvester')
      if (hasSelectedHarvesters && mapGrid[tileY][tileX].ore) {
        this.isOverOreTile = true
      }
    }

    // Check if mouse is over a repairable building (when in repair mode)
    this.isOverRepairableBuilding = false
    if (gameState.repairMode && this.isOverGameCanvas) {
      // Check player factory first - Added null check for factories
      if (factories && Array.isArray(factories)) {
        const playerFactory = factories.find(factory => factory && factory.id === gameState.humanPlayer)
        if (playerFactory &&
            tileX >= playerFactory.x && tileX < (playerFactory.x + playerFactory.width) &&
            tileY >= playerFactory.y && tileY < (playerFactory.y + playerFactory.height)) {
          // Factory is repairable if it's not at full health
          this.isOverRepairableBuilding = playerFactory.health < playerFactory.maxHealth
        }
      }

      // Check player buildings
      if (!this.isOverRepairableBuilding && gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner === gameState.humanPlayer &&
              tileX >= building.x && tileX < (building.x + building.width) &&
              tileY >= building.y && tileY < (building.y + building.height)) {
            // Building is repairable if it's not at full health
            this.isOverRepairableBuilding = building.health < building.maxHealth
            break
          }
        }
      }
    }

    // Check if mouse is over a sellable building (when in sell mode)
    this.isOverSellableBuilding = false
    if (gameState.sellMode && this.isOverGameCanvas) {
      // Check player factory first - Player factory can't be sold

      // Check player buildings
      if (gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner === gameState.humanPlayer &&
              tileX >= building.x && tileX < (building.x + building.width) &&
              tileY >= building.y && tileY < (building.y + building.height)) {
            // All player buildings can be sold
            this.isOverSellableBuilding = true
            break
          }
        }
      }
    }

    // If not over the game canvas, just use default cursor
    if (!this.isOverGameCanvas) {
      this.updateCursorDOM('default', [], ['repair-mode', 'repair-blocked-mode', 'sell-mode', 'sell-blocked-mode'])
      return
    }

    // REPAIR MODE TAKES PRIORITY
    if (gameState.repairMode) {
      // Use CSS class for cursors and hide system cursor
      if (this.isOverRepairableBuilding) {
        this.updateCursorDOM('none', ['repair-mode'], ['repair-blocked-mode', 'sell-mode', 'sell-blocked-mode'])
      } else {
        this.updateCursorDOM('none', ['repair-blocked-mode'], ['repair-mode', 'sell-mode', 'sell-blocked-mode'])
      }
      return // Exit early to prevent other cursors from showing
    }

    // SELL MODE TAKES SECOND PRIORITY
    if (gameState.sellMode) {
      // Use CSS class for cursors and hide system cursor
      if (this.isOverSellableBuilding) {
        this.updateCursorDOM('none', ['sell-mode'], ['sell-blocked-mode', 'repair-mode', 'repair-blocked-mode'])
      } else {
        this.updateCursorDOM('none', ['sell-blocked-mode'], ['sell-mode', 'repair-mode', 'repair-blocked-mode'])
      }
      return // Exit early to prevent other cursors from showing
    }

    // Default cursor behavior for regular movement/attack
    if (selectedUnits.length > 0) {
      const hasNonBuildingSelected = selectedUnits.some(u => !u.isBuilding)
      const selectedBuildings = selectedUnits.filter(u => u.isBuilding)

      const allCursorClasses = ['move-mode', 'move-blocked-mode', 'attack-mode', 'attack-blocked-mode', 'guard-mode']

      if (!hasNonBuildingSelected) {
        // Only buildings are selected
        const singleBuilding = selectedBuildings.length === 1 ? selectedBuildings[0] : null
        const isVehicleFactory = singleBuilding && singleBuilding.type === 'vehicleFactory'

        if (isVehicleFactory) {
          // Vehicle factory uses move cursor for rally point placement
          if (this.isOverBlockedTerrain) {
            this.updateCursorDOM('none', ['move-blocked-mode'], allCursorClasses.filter(c => c !== 'move-blocked-mode'))
          } else if (!gameState.isRightDragging) {
            this.updateCursorDOM('none', ['move-mode'], allCursorClasses.filter(c => c !== 'move-mode'))
          } else {
            this.updateCursorDOM('grabbing', [], allCursorClasses)
          }
        } else {
          // Other buildings: always show default cursor
          this.updateCursorDOM('default', [], allCursorClasses)
        }
      } else if (this.isForceAttackMode) {
        // Force attack mode - use attack cursor
        this.updateCursorDOM('none', ['attack-mode'], allCursorClasses.filter(c => c !== 'attack-mode'))
      } else if (this.isOverFriendlyUnit) {
        // Over friendly unit - use normal arrow cursor
        this.updateCursorDOM('default', [], allCursorClasses)
      } else if (this.isOverEnemy) {
        // Over enemy - use attack cursor
        this.updateCursorDOM('none', ['attack-mode'], allCursorClasses.filter(c => c !== 'attack-mode'))
      } else if (this.isOverPlayerRefinery) {
        // Over player refinery with harvesters selected - use attack cursor to indicate force unload
        this.updateCursorDOM('none', ['attack-mode'], allCursorClasses.filter(c => c !== 'attack-mode'))
      } else if (this.isOverOreTile) {
        // Over ore tile with harvesters selected - use attack cursor to indicate harvesting
        this.updateCursorDOM('none', ['attack-mode'], allCursorClasses.filter(c => c !== 'attack-mode'))
      } else if (this.isOverBlockedTerrain) {
        // Over blocked terrain - use move-blocked cursor
        this.updateCursorDOM('none', ['move-blocked-mode'], allCursorClasses.filter(c => c !== 'move-blocked-mode'))
      } else if (!gameState.isRightDragging) {
        // Normal move cursor
        this.updateCursorDOM('none', ['move-mode'], allCursorClasses.filter(c => c !== 'move-mode'))
      } else {
        // Right-drag scrolling
        this.updateCursorDOM('grabbing', [], allCursorClasses)
      }
    } else {
      // No units selected - use default cursor
      const allCursorClasses = ['move-mode', 'move-blocked-mode', 'attack-mode', 'attack-blocked-mode', 'guard-mode']
      this.updateCursorDOM('default', [], allCursorClasses)
    }
  }

  updateForceAttackMode(isActive) {
    const prev = this.isForceAttackMode
    this.isForceAttackMode = isActive
    if (prev !== isActive) {
      console.log(`[SAF] Self attack mode ${isActive ? 'ENABLED' : 'DISABLED'}`)
    }
  }

  // Reapply cursor appearance using the last known mouse position
  refreshCursor(mapGrid, factories, selectedUnits) {
    if (this.lastMouseEvent) {
      this.updateCustomCursor(this.lastMouseEvent, mapGrid, factories, selectedUnits)
      // Force apply any pending cursor changes during refresh
      this.applyCursorChanges()
    }
  }

  // Public method to force cursor updates (for important state changes)
  forceCursorUpdate(mapGrid, factories, selectedUnits) {
    if (this.lastMouseEvent) {
      this.updateCustomCursor(this.lastMouseEvent, mapGrid, factories, selectedUnits)
      this.applyCursorChanges()
      this.lastDOMUpdate = performance.now()
    }
  }

  setIsOverEnemy(value) {
    this.isOverEnemy = value
  }

  setIsOverFriendlyUnit(value) {
    this.isOverFriendlyUnit = value
  }

  // Throttled DOM cursor update - only actually updates DOM every 500ms
  updateCursorDOM(cursor, classesToAdd = [], classesToRemove = []) {
    const now = performance.now()
    
    // Store the pending state
    this.pendingCursorState = cursor
    this.pendingClassState = { add: classesToAdd, remove: classesToRemove }
    
    // Only update DOM if enough time has passed
    if (now - this.lastDOMUpdate >= this.DOM_UPDATE_INTERVAL) {
      this.applyCursorChanges()
      this.lastDOMUpdate = now
    }
  }

  // Actually apply cursor changes to DOM
  applyCursorChanges() {
    if (!this.pendingCursorState && !this.pendingClassState) return
    
    const gameCanvas = document.getElementById('gameCanvas')
    if (!gameCanvas) return
    
    // Apply cursor style
    if (this.pendingCursorState !== null) {
      gameCanvas.style.cursor = this.pendingCursorState
    }
    
    // Apply class changes
    if (this.pendingClassState) {
      if (this.pendingClassState.remove.length > 0) {
        gameCanvas.classList.remove(...this.pendingClassState.remove)
      }
      if (this.pendingClassState.add.length > 0) {
        gameCanvas.classList.add(...this.pendingClassState.add)
      }
    }
    
    // Clear pending state
    this.pendingCursorState = null
    this.pendingClassState = null
  }

  // Force immediate cursor update (for critical state changes)
  forceUpdateCursorDOM(cursor, classesToAdd = [], classesToRemove = []) {
    const gameCanvas = document.getElementById('gameCanvas')
    if (!gameCanvas) return
    
    gameCanvas.style.cursor = cursor
    if (classesToRemove.length > 0) {
      gameCanvas.classList.remove(...classesToRemove)
    }
    if (classesToAdd.length > 0) {
      gameCanvas.classList.add(...classesToAdd)
    }
    
    this.lastDOMUpdate = performance.now()
  }

  // Called from game loop to ensure pending cursor changes are applied
  update() {
    const now = performance.now()
    if (this.pendingCursorState !== null || this.pendingClassState !== null) {
      if (now - this.lastDOMUpdate >= this.DOM_UPDATE_INTERVAL) {
        this.applyCursorChanges()
        this.lastDOMUpdate = now
      }
    }
  }
}
