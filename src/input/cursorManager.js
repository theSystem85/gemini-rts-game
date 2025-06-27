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
    this.isForceAttackMode = false
    this.lastMouseEvent = null
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
    const tileType = mapGrid[tileY][tileX].type
    const hasBuilding = mapGrid[tileY][tileX].building
    return tileType === 'water' || tileType === 'rock' || hasBuilding
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
      gameCanvas.style.cursor = 'default'
      // Remove all cursor classes
      gameCanvas.classList.remove('repair-mode', 'repair-blocked-mode', 'sell-mode', 'sell-blocked-mode')
      return
    }

    // Apply CSS classes for cursor styles (will work with external SVG files)
    // Clear all cursor classes first
    gameCanvas.classList.remove('repair-mode', 'repair-blocked-mode', 'sell-mode', 'sell-blocked-mode')

    // REPAIR MODE TAKES PRIORITY
    if (gameState.repairMode) {
      // Use CSS class for cursors and hide system cursor
      gameCanvas.style.cursor = 'none'

      if (this.isOverRepairableBuilding) {
        gameCanvas.classList.add('repair-mode')
      } else {
        gameCanvas.classList.add('repair-blocked-mode')
      }
      return // Exit early to prevent other cursors from showing
    }

    // SELL MODE TAKES SECOND PRIORITY
    if (gameState.sellMode) {
      // Use CSS class for cursors and hide system cursor
      gameCanvas.style.cursor = 'none'

      if (this.isOverSellableBuilding) {
        gameCanvas.classList.add('sell-mode')
      } else {
        gameCanvas.classList.add('sell-blocked-mode')
      }
      return // Exit early to prevent other cursors from showing
    }

    // Default cursor behavior for regular movement/attack
    if (selectedUnits.length > 0) {
      // Clear all cursor classes first
      gameCanvas.classList.remove('move-mode', 'move-blocked-mode', 'attack-mode', 'attack-blocked-mode', 'guard-mode')

      if (this.isForceAttackMode) {
        // Force attack mode - use attack cursor
        gameCanvas.style.cursor = 'none'
        gameCanvas.classList.add('attack-mode')
      } else if (this.isOverFriendlyUnit) {
        // Over friendly unit - use normal arrow cursor
        gameCanvas.style.cursor = 'default'
      } else if (this.isOverEnemy) {
        // Over enemy - use attack cursor
        gameCanvas.style.cursor = 'none'
        gameCanvas.classList.add('attack-mode')
      } else if (this.isOverOreTile) {
        // Over ore tile with harvesters selected - use attack cursor to indicate harvesting
        gameCanvas.style.cursor = 'none'
        gameCanvas.classList.add('attack-mode')
      } else if (this.isOverBlockedTerrain) {
        // Over blocked terrain - use move-blocked cursor
        gameCanvas.style.cursor = 'none'
        gameCanvas.classList.add('move-blocked-mode')
      } else if (!gameState.isRightDragging) {
        // Normal move cursor
        gameCanvas.style.cursor = 'none'
        gameCanvas.classList.add('move-mode')
      } else {
        // Right-drag scrolling
        gameCanvas.style.cursor = 'grabbing'
        gameCanvas.classList.remove('move-mode', 'move-blocked-mode', 'attack-mode', 'attack-blocked-mode')
      }
    } else {
      // No units selected - use default cursor
      gameCanvas.style.cursor = 'default'
      gameCanvas.classList.remove('move-mode', 'move-blocked-mode', 'attack-mode', 'attack-blocked-mode', 'guard-mode')
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
    }
  }

  setIsOverEnemy(value) {
    this.isOverEnemy = value
  }

  setIsOverFriendlyUnit(value) {
    this.isOverFriendlyUnit = value
  }
}
