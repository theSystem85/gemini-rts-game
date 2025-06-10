// keyboardHandler.js
import { gameState } from '../gameState.js'
import { TILE_SIZE } from '../config.js'
import { findPath } from '../units.js'
import { playSound } from '../sound.js'
import { HelpSystem } from './helpSystem.js'

export class KeyboardHandler {
  constructor() {
    this.controlGroups = {}
    this.lastGroupKeyPressed = null
    this.lastGroupKeyPressTime = 0
    this.doublePressThreshold = 500 // 500ms threshold for double press
    this.groupFormationMode = false
    this.helpSystem = new HelpSystem()
    this.playerFactory = null
  }

  setPlayerFactory(factory) {
    this.playerFactory = factory
  }

  setupKeyboardEvents(units, selectedUnits, mapGrid) {
    // Enhanced keydown event listener
    document.addEventListener('keydown', e => {
      // Some keys should work even when paused
      // New: Toggle keybindings overview when I is pressed
      if (e.key.toLowerCase() === 'i') {
        this.helpSystem.showControlsHelp()
        return
      }

      // Don't process other inputs if game is paused
      if (gameState.paused) return

      // A key for alert mode
      if (e.key.toLowerCase() === 'a') {
        this.handleAlertMode(selectedUnits)
      }
      // S key for sell mode or stop attacking
      else if (e.key.toLowerCase() === 's') {
        this.handleSellMode()
      }
      // D key for dodge
      else if (e.key.toLowerCase() === 'd') {
        this.handleDodgeCommand(selectedUnits, units, mapGrid)
      }
      // H key to focus on factory
      else if (e.key.toLowerCase() === 'h') {
        this.handleFactoryFocus(mapGrid)
      }
      // Control group assignment (ctrl+number)
      else if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        this.handleControlGroupAssignment(e.key, selectedUnits)
      }
      // Control group selection (just number keys 1-9)
      else if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        this.handleControlGroupSelection(e.key, units, selectedUnits, mapGrid)
      }
      // F key to toggle formation mode
      else if (e.key.toLowerCase() === 'f') {
        this.handleFormationToggle(selectedUnits)
      }
      // G key to toggle grid visibility
      else if (e.key.toLowerCase() === 'g') {
        this.handleGridToggle()
      }
    })
  }

  handleAlertMode(selectedUnits) {
    // Toggle alert mode on all selected player units.
    selectedUnits.forEach(unit => {
      // Only tank-v2 units can use alert mode
      if (unit.type === 'tank-v2') {
        unit.alertMode = !unit.alertMode
      }
    })
  }

  handleSellMode() {
    const gameCanvas = document.getElementById('gameCanvas')
    
    // If not in sell mode, toggle it
    if (!gameState.sellMode) {
      // Toggle sell mode
      gameState.sellMode = !gameState.sellMode

      // Deactivate repair mode if it's on
      if (gameState.repairMode) {
        gameState.repairMode = false
        const repairBtn = document.getElementById('repairBtn')
        if (repairBtn) {
          repairBtn.classList.remove('active')
        }
      }

      // Update the sell button UI
      const sellBtn = document.getElementById('sellBtn')
      if (sellBtn) {
        sellBtn.classList.add('active')
        gameState.sellMode = true

        // Use CSS class for sell cursor - this ensures consistent usage of sell.svg
        gameCanvas.style.cursor = 'none'
        gameCanvas.classList.add('sell-mode')

        // Show notification
        this.showNotification('Sell mode activated - Click on a building to sell it for 70% of build price', 3000)
      }
    } else {
      // Turn off sell mode
      gameState.sellMode = false
      const sellBtn = document.getElementById('sellBtn')
      if (sellBtn) {
        sellBtn.classList.remove('active')
      }

      // Reset cursor and remove sell mode classes
      gameCanvas.style.cursor = 'default'
      gameCanvas.classList.remove('sell-mode', 'sell-blocked-mode')

      // Show notification
      this.showNotification('Sell mode deactivated', 2000)
    }
  }

  handleDodgeCommand(selectedUnits, units, mapGrid) {
    // Fix: Make all selected units dodge to a random nearby free tile regardless of their state.
    selectedUnits.forEach(unit => {
      // Compute current tile coordinates from unit position.
      const tileX = Math.floor(unit.x / TILE_SIZE)
      const tileY = Math.floor(unit.y / TILE_SIZE)
      const candidates = []
      const directions = [
        { dx: -1, dy:  0 },
        { dx:  1, dy:  0 },
        { dx:  0, dy: -1 },
        { dx:  0, dy:  1 },
        { dx: -1, dy: -1 },
        { dx: -1, dy:  1 },
        { dx:  1, dy: -1 },
        { dx:  1, dy:   1 }
      ]
      directions.forEach(dir => {
        const newX = tileX + dir.dx
        const newY = tileY + dir.dy
        // Check boundaries.
        if (newX >= 0 && newX < mapGrid[0].length && newY >= 0 && newY < mapGrid.length) {
          const tileType = mapGrid[newY][newX].type
          const hasBuilding = mapGrid[newY][newX].building
          if (tileType !== 'water' && tileType !== 'rock' && !hasBuilding) {
            // Check that no unit occupies the candidate tile.
            const occupied = units.some(u => Math.floor(u.x / TILE_SIZE) === newX && Math.floor(u.y / TILE_SIZE) === newY)
            if (!occupied) {
              candidates.push({ x: newX, y: newY })
            }
          }
        }
      })

      if (candidates.length > 0) {
        const candidate = candidates[Math.floor(Math.random() * candidates.length)]
        // Store current path and target regardless of state so dodge can always be triggered.
        unit.originalPath = unit.path ? [...unit.path] : []
        unit.originalTarget = unit.target
        unit.isDodging = true
        unit.dodgeEndTime = performance.now() + 3000 // Dodge lasts up to 3 seconds.

        // Compute a new path to the dodge destination using existing pathfinding.
        const newPath = findPath({ x: tileX, y: tileY }, candidate, mapGrid, null)
        if (newPath.length > 1) {
          unit.path = newPath.slice(1)
        }
      }
    })
  }

  handleFactoryFocus(mapGrid) {
    if (this.playerFactory) {
      const gameCanvas = document.getElementById('gameCanvas')
      // Calculate factory center
      const factoryX = (this.playerFactory.x + this.playerFactory.width / 2) * TILE_SIZE
      const factoryY = (this.playerFactory.y + this.playerFactory.height / 2) * TILE_SIZE

      // Center the view on the factory
      gameState.scrollOffset.x = Math.max(0, Math.min(factoryX - gameCanvas.width / 2,
        mapGrid[0].length * TILE_SIZE - gameCanvas.width))
      gameState.scrollOffset.y = Math.max(0, Math.min(factoryY - gameCanvas.height / 2,
        mapGrid.length * TILE_SIZE - gameCanvas.height))
      playSound('unitSelection')
    }
  }

  handleControlGroupAssignment(groupNum, selectedUnits) {
    console.log(`Attempting to assign control group ${groupNum} with ctrl key`)

    if (selectedUnits.length > 0) {
      // Only store units, not factories
      const onlyUnits = selectedUnits.filter(unit => unit.type !== 'factory' && unit.owner === 'player')

      if (onlyUnits.length > 0) {
        // Store references to the units and assign group number to each
        this.controlGroups[groupNum] = [...onlyUnits]
        onlyUnits.forEach(unit => {
          unit.groupNumber = groupNum
        })
        console.log(`Successfully assigned control group ${groupNum} with ${onlyUnits.length} units`)
        playSound('unitSelection')

        // Visual feedback
        this.showNotification(`Group ${groupNum} assigned`, 2000)
      }
    }
  }

  handleControlGroupSelection(groupNum, units, selectedUnits, mapGrid) {
    console.log(`Trying to select control group ${groupNum}`)
    console.log(`Available control groups: ${Object.keys(this.controlGroups).join(', ')}`)

    // Check if we have units in this control group
    if (this.controlGroups[groupNum] && Array.isArray(this.controlGroups[groupNum]) && this.controlGroups[groupNum].length > 0) {
      console.log(`Found control group ${groupNum} with ${this.controlGroups[groupNum].length} units`)

      // Clear current selection
      units.forEach(u => { if (u.owner === 'player') u.selected = false })
      const factories = gameState.factories || []
      factories.forEach(f => f.selected = false)
      selectedUnits.length = 0

      // Select all units in the control group that are still alive
      const aliveUnits = this.controlGroups[groupNum].filter(unit =>
        unit && // unit exists
        typeof unit === 'object' && // is an object
        units.includes(unit) && // is in the game units array
        unit.health > 0 && // is alive
        unit.owner === 'player' // belongs to player (safety check)
      )

      console.log(`Found ${aliveUnits.length} alive units in group ${groupNum}`)

      // Update the control group to only include alive units
      this.controlGroups[groupNum] = aliveUnits

      if (aliveUnits.length > 0) {
        aliveUnits.forEach(unit => {
          unit.selected = true
          selectedUnits.push(unit)
        })

        // Check if this is a double press of the same key within the threshold time
        const currentTime = performance.now()
        const isDoublePress = this.lastGroupKeyPressed === groupNum &&
                             (currentTime - this.lastGroupKeyPressTime) < this.doublePressThreshold

        // Only center view on double press, not on single press
        if (isDoublePress) {
          // Center view on the middle unit of the group with fix for Retina displays
          const middleUnit = aliveUnits[Math.floor(aliveUnits.length / 2)]
          const gameCanvas = document.getElementById('gameCanvas')

          // Get device pixel ratio to account for Retina displays
          const pixelRatio = window.devicePixelRatio || 1

          // Calculate logical canvas dimensions (not physical pixels)
          const logicalCanvasWidth = gameCanvas.width / pixelRatio
          const logicalCanvasHeight = gameCanvas.height / pixelRatio

          // Center properly accounting for the device pixel ratio
          gameState.scrollOffset.x = Math.max(0, Math.min(
            middleUnit.x - (logicalCanvasWidth / 2),
            mapGrid[0].length * TILE_SIZE - logicalCanvasWidth
          ))

          gameState.scrollOffset.y = Math.max(0, Math.min(
            middleUnit.y - (logicalCanvasHeight / 2),
            mapGrid.length * TILE_SIZE - logicalCanvasHeight
          ))

          // Play a sound for feedback on focus action
          playSound('confirmed', 0.7)
        }

        // Update the last key press time and key
        this.lastGroupKeyPressed = groupNum
        this.lastGroupKeyPressTime = currentTime

        // Play selection sounds
        playSound('unitSelection')
        playSound('yesSir01')
      }
    }
  }

  handleFormationToggle(selectedUnits) {
    this.groupFormationMode = !this.groupFormationMode

    // Toggle formationActive for selected units with a group number
    const groupedUnits = selectedUnits.filter(unit => unit.groupNumber)
    if (groupedUnits.length > 0) {
      // Find the center of the formation
      const centerX = groupedUnits.reduce((sum, unit) => sum + unit.x, 0) / groupedUnits.length
      const centerY = groupedUnits.reduce((sum, unit) => sum + unit.y, 0) / groupedUnits.length

      // Store relative positions for each unit
      groupedUnits.forEach(unit => {
        unit.formationActive = this.groupFormationMode
        if (this.groupFormationMode) {
          // Store the relative position from center when formation is activated
          unit.formationOffset = {
            x: unit.x - centerX,
            y: unit.y - centerY
          }
        } else {
          // Clear formation data when deactivated
          unit.formationOffset = null
        }
      })
    }
  }

  handleGridToggle() {
    // Toggle grid visibility
    gameState.gridVisible = !gameState.gridVisible
    // Play a sound for feedback
    playSound('confirmed', 0.5)
  }

  showNotification(message, duration = 2000) {
    const notificationDiv = document.createElement('div')
    notificationDiv.textContent = message
    notificationDiv.style.position = 'absolute'
    notificationDiv.style.left = '50%'
    notificationDiv.style.bottom = '10%'
    notificationDiv.style.transform = 'translateX(-50%)'
    notificationDiv.style.backgroundColor = 'rgba(0,0,0,0.7)'
    notificationDiv.style.color = 'white'
    notificationDiv.style.padding = '8px 16px'
    notificationDiv.style.borderRadius = '4px'
    notificationDiv.style.zIndex = '1000'
    document.body.appendChild(notificationDiv)

    // Remove the message after specified duration
    setTimeout(() => {
      if (document.body.contains(notificationDiv)) {
        document.body.removeChild(notificationDiv)
      }
    }, duration)
  }
}
