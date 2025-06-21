// inputHandler.js
import { gameState } from './gameState.js'
import { CursorManager } from './input/cursorManager.js'
import { MouseHandler } from './input/mouseHandler.js'
import { KeyboardHandler } from './input/keyboardHandler.js'
import { SelectionManager } from './input/selectionManager.js'
import { UnitCommandsHandler } from './input/unitCommands.js'

export const selectedUnits = []
export let selectionActive = false
export let selectionStartExport = { x: 0, y: 0 }
export let selectionEndExport = { x: 0, y: 0 }

// Initialize input system components
const cursorManager = new CursorManager()
const mouseHandler = new MouseHandler()
const keyboardHandler = new KeyboardHandler()
const selectionManager = new SelectionManager()
const unitCommands = new UnitCommandsHandler()

export function setupInputHandlers(units, factories, mapGrid) {
  // Store human player factory reference for later use
  const humanPlayer = gameState.humanPlayer || 'player1'
  const playerFactory = factories.find(factory => factory.id === humanPlayer) || factories.find(factory => factory.id === 'player')
  keyboardHandler.setPlayerFactory(playerFactory)

  // Store a reference to gameState for direct updates
  gameState.selectionActive = false
  gameState.selectionStart = { x: 0, y: 0 }
  gameState.selectionEnd = { x: 0, y: 0 }

  const gameCanvas = document.getElementById('gameCanvas')

  // Setup input handlers
  mouseHandler.setupMouseEvents(gameCanvas, units, factories, mapGrid, selectedUnits, selectionManager, unitCommands, cursorManager)
  keyboardHandler.setupKeyboardEvents(units, selectedUnits, mapGrid, factories)
  
  // Give keyboard handler access to mouse handler for ESC key functionality
  keyboardHandler.setMouseHandler(mouseHandler)

  // Make cheat system globally accessible for damage prevention
  window.cheatSystem = keyboardHandler.getCheatSystem()

  // Apply the initial state for the custom cursor
  document.addEventListener('DOMContentLoaded', () => {
    // Set up the document-level mousemove event
    document.addEventListener('mousemove', (e) => {
      // Update Force Attack mode status based on Ctrl key
      cursorManager.updateForceAttackMode(e.ctrlKey)

      // Update custom cursor position
      cursorManager.updateCustomCursor(e, gameState.mapGrid || [], gameState.factories || [], selectedUnits)

      // Detect if over sidebar to ensure cursor is hidden there
      const sidebar = document.getElementById('sidebar')
      if (sidebar) {
        const sidebarRect = sidebar.getBoundingClientRect()
        const isOverSidebar = (
          e.clientX >= sidebarRect.left &&
          e.clientX <= sidebarRect.right &&
          e.clientY >= sidebarRect.top &&
          e.clientY <= sidebarRect.bottom
        )

        // Always hide custom cursor over sidebar
        if (isOverSidebar) {
          document.body.style.cursor = 'default'
        }
      }
    })
  })
}

// Safety function: Call this at the beginning of each frame update
// to remove any destroyed units from selection
export function cleanupDestroyedSelectedUnits() {
  selectionManager.cleanupDestroyedSelectedUnits(selectedUnits)
}