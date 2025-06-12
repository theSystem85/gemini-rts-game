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
      // X key for dodge
      else if (e.key.toLowerCase() === 'x') {
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
    let alertToggledCount = 0
    let tankV2Count = 0
    
    selectedUnits.forEach(unit => {
      // Only tank-v2 units can use alert mode
      if (unit.type === 'tank-v2') {
        tankV2Count++
        unit.alertMode = !unit.alertMode
        alertToggledCount++
      }
    })
    
    // Provide feedback to the user
    if (tankV2Count === 0) {
      this.showNotification('Alert mode only works with Tank V2 units', 2000)
    } else if (alertToggledCount > 0) {
      const tank = selectedUnits.find(u => u.type === 'tank-v2')
      const modeStatus = tank.alertMode ? 'ON' : 'OFF'
      this.showNotification(`Alert mode ${modeStatus} for ${alertToggledCount} Tank V2 unit(s)`, 2000)
      playSound('unitSelection')
    }
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
    if (selectedUnits.length === 0) {
      this.showNotification('No units selected for dodge command', 2000)
      return
    }

    let dodgeSuccessCount = 0
    
    // Make all selected units try to dodge by moving one tile forward or backward
    selectedUnits.forEach(unit => {
      // Get current tile coordinates
      const tileX = Math.floor(unit.x / TILE_SIZE)
      const tileY = Math.floor(unit.y / TILE_SIZE)
      
      // Determine unit's facing direction (use movement direction if available, otherwise use last direction)
      let facingAngle = 0
      
      // Use movement direction if unit is moving
      if (unit.movement && unit.movement.isMoving && (unit.movement.velocity.x !== 0 || unit.movement.velocity.y !== 0)) {
        facingAngle = Math.atan2(unit.movement.velocity.y, unit.movement.velocity.x)
      }
      // Use target rotation if available
      else if (unit.movement && unit.movement.targetRotation !== undefined) {
        facingAngle = unit.movement.targetRotation
      }
      // Use stored rotation if available
      else if (unit.rotation !== undefined) {
        facingAngle = unit.rotation
      }
      // Use path direction if unit has a path
      else if (unit.path && unit.path.length > 0) {
        const nextTile = unit.path[0]
        const dx = nextTile.x * TILE_SIZE - unit.x
        const dy = nextTile.y * TILE_SIZE - unit.y
        facingAngle = Math.atan2(dy, dx)
      }
      
      // Calculate forward and backward positions (one tile away)
      const forwardX = Math.round(tileX + Math.cos(facingAngle))
      const forwardY = Math.round(tileY + Math.sin(facingAngle))
      const backwardX = Math.round(tileX - Math.cos(facingAngle))
      const backwardY = Math.round(tileY - Math.sin(facingAngle))
      
      // Check if forward position is valid
      const isForwardValid = this.isValidDodgePosition(forwardX, forwardY, mapGrid, units)
      
      // Check if backward position is valid
      const isBackwardValid = this.isValidDodgePosition(backwardX, backwardY, mapGrid, units)
      
      let dodgeTarget = null
      
      // Apply dodge logic based on requirements
      if (isForwardValid && isBackwardValid) {
        // Both are free - random decision
        dodgeTarget = Math.random() < 0.5 
          ? { x: forwardX, y: forwardY }
          : { x: backwardX, y: backwardY }
      } else if (isForwardValid && !isBackwardValid) {
        // Only forward is free
        dodgeTarget = { x: forwardX, y: forwardY }
      } else if (!isForwardValid && isBackwardValid) {
        // Only backward is free
        dodgeTarget = { x: backwardX, y: backwardY }
      }
      // If both are blocked, do not dodge (dodgeTarget remains null)
      
      if (dodgeTarget) {
        // Store current path and target for restoration after dodge
        unit.originalPath = unit.path ? [...unit.path] : []
        unit.originalTarget = unit.target
        unit.isDodging = true
        unit.dodgeEndTime = performance.now() + 3000 // Dodge lasts up to 3 seconds
        
        // Compute a new path to the dodge destination
        const newPath = findPath({ x: tileX, y: tileY }, dodgeTarget, mapGrid, null)
        if (newPath.length > 1) {
          unit.path = newPath.slice(1)
          dodgeSuccessCount++
        }
      }
    })

    // Show feedback to user
    if (dodgeSuccessCount > 0) {
      const message = dodgeSuccessCount === 1 
        ? 'Unit dodging!' 
        : `${dodgeSuccessCount} units dodging!`
      this.showNotification(message, 1500)
      playSound('movement', 0.3) // Play a subtle movement sound
    } else {
      this.showNotification('Unable to dodge - no clear path available', 2000)
    }
  }

  // Helper method to check if a position is valid for dodging
  isValidDodgePosition(x, y, mapGrid, units) {
    // Check boundaries
    if (x < 0 || x >= mapGrid[0].length || y < 0 || y >= mapGrid.length) {
      return false
    }
    
    // Check tile type and buildings
    const tile = mapGrid[y][x]
    if (tile.type === 'water' || tile.type === 'rock' || tile.building) {
      return false
    }
    
    // Check if any unit occupies this tile
    const occupied = units.some(u => 
      Math.floor(u.x / TILE_SIZE) === x && Math.floor(u.y / TILE_SIZE) === y
    )
    
    return !occupied
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

    if (selectedUnits.length > 0) {
      // Only store units, not factories
      const onlyUnits = selectedUnits.filter(unit => unit.type !== 'factory' && unit.owner === 'player')

      if (onlyUnits.length > 0) {
        // Store references to the units and assign group number to each
        this.controlGroups[groupNum] = [...onlyUnits]
        onlyUnits.forEach(unit => {
          unit.groupNumber = groupNum
        })
        playSound('unitSelection')

        // Visual feedback
        this.showNotification(`Group ${groupNum} assigned`, 2000)
      }
    }
  }

  handleControlGroupSelection(groupNum, units, selectedUnits, mapGrid) {

    // Check if we have units in this control group
    if (this.controlGroups[groupNum] && Array.isArray(this.controlGroups[groupNum]) && this.controlGroups[groupNum].length > 0) {

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
