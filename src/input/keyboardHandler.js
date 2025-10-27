// keyboardHandler.js
import { gameState } from '../gameState.js'
import { TILE_SIZE } from '../config.js'
import { findPath } from '../units.js'
import { playSound, playPositionalSound } from '../sound.js'
import { HelpSystem } from './helpSystem.js'
import { CheatSystem } from './cheatSystem.js'
import { isInputFieldFocused } from '../utils/inputUtils.js'
import { toggleUnitLogging } from '../utils/logger.js'
import { cancelUnitMovement } from '../game/unifiedMovement.js'
import { handleAltKeyRelease, resetWaypointTracking } from '../game/waypointSounds.js'
import { performanceDialog } from '../ui/performanceDialog.js'
import { runtimeConfigDialog } from '../ui/runtimeConfigDialog.js'
import { GAME_DEFAULT_CURSOR } from './cursorStyles.js'

export class KeyboardHandler {
  constructor() {
    this.controlGroups = {}
    this.lastGroupKeyPressed = null
    this.lastGroupKeyPressTime = 0
    this.doublePressThreshold = 500 // 500ms threshold for double press
    this.groupFormationMode = false
    this.helpSystem = new HelpSystem()
    this.playerFactory = null
    this.cheatSystem = new CheatSystem()
    this.unitCommands = null
    this.requestRenderFrame = null
  }

  setPlayerFactory(factory) {
    this.playerFactory = factory
  }

  setUnitCommands(unitCommands) {
    this.unitCommands = unitCommands
  }

  setRenderScheduler(callback) {
    this.requestRenderFrame = callback
  }

  setupKeyboardEvents(units, selectedUnits, mapGrid, factories) {
    // Store references for use in other methods
    this.selectedUnits = selectedUnits
    this.cheatSystem.setSelectedUnitsRef(selectedUnits)
    this.units = units
    this.mapGrid = mapGrid
    this.factories = factories

    // Track Shift and Alt/Option key states globally
    document.addEventListener('keydown', e => {
      if (e.key === 'Shift') {
        gameState.shiftKeyDown = true
      }
      if (e.key === 'Alt') {
        gameState.altKeyDown = true
        resetWaypointTracking() // Reset tracking when Alt is pressed
      }

      // Enhanced keydown event listener
      // Check if an input field is currently focused
      if (isInputFieldFocused()) {
        // Allow input field events to process normally, don't handle game shortcuts
        return
      }

      // Some keys should work even when paused
      // New: Toggle keybindings overview when I is pressed
      if (e.key.toLowerCase() === 'i') {
        e.preventDefault()
        e.stopPropagation()
        this.helpSystem.showControlsHelp()
        return
      }

      // C key for cheat console (works even when paused)
      if (e.key.toLowerCase() === 'c' && !gameState.cheatDialogOpen) {
        e.preventDefault()
        e.stopPropagation()
        this.cheatSystem.openDialog()
        return
      }

      // K key for runtime config dialog (works even when paused)
      if (e.key.toLowerCase() === 'k' && !gameState.runtimeConfigDialogOpen) {
        e.preventDefault()
        e.stopPropagation()
        runtimeConfigDialog.openDialog()
        return
      }

      // Don't process other inputs if game is paused, cheat dialog is open, or runtime config dialog is open
      if (gameState.paused || gameState.cheatDialogOpen || gameState.runtimeConfigDialogOpen) return

      // ESC key to cancel attack group mode
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.handleEscapeKey()
        return
      }

      // A key for alert mode
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        this.handleAlertMode(selectedUnits)
      }
      // S key for sell mode or stop attacking
      else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        this.handleSellMode()
      }
      // R key to toggle repair mode
      else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        this.handleRepairMode()
      }
      // W key to send damaged units to workshop
      else if (e.key.toLowerCase() === 'w') {
        e.preventDefault()
        const queue = e.altKey
        if (this.unitCommands) {
          this.unitCommands.handleWorkshopRepairHotkey(selectedUnits, mapGrid, queue, false)
        }
        if (queue) markWaypointsAdded()
      }
      // X key for dodge
      else if (e.key.toLowerCase() === 'x') {
        e.preventDefault()
        this.handleDodgeCommand(selectedUnits, units, mapGrid)
      }
      // H key to focus on factory
      else if (e.key.toLowerCase() === 'h') {
        e.preventDefault()
        this.handleFactoryFocus(mapGrid)
      }
      // E key to focus on selected unit(s)
      else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        if (e.shiftKey || gameState.shiftKeyDown) {
          this.toggleAutoFocus(selectedUnits, mapGrid)
        } else {
          this.handleSelectedUnitFocus(selectedUnits, mapGrid)
        }
      }
      // Control group assignment (ctrl+number)
      else if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        this.handleControlGroupAssignment(e.key, selectedUnits)
      }
      // Control group selection (just number keys 1-9)
      else if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        this.handleControlGroupSelection(e.key, units, selectedUnits, mapGrid)
      }
      // F key to toggle formation mode
      else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        this.handleFormationToggle(selectedUnits)
      }
      // G key to toggle grid visibility
      else if (e.key.toLowerCase() === 'g') {
        e.preventDefault()
        this.handleGridToggle()
      }
      // O key to toggle occupancy map visibility
      else if (e.key.toLowerCase() === 'o') {
        e.preventDefault()
        this.handleOccupancyMapToggle()
      }
      else if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        this.handleDzmToggle()
      }
      // T key to toggle tank image rendering
      else if (e.key.toLowerCase() === 't') {
        e.preventDefault()
        this.handleTankImageToggle()
      }
      // R key to toggle turret image rendering
      else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        this.handleTurretImageToggle()
      }
      // P key to toggle FPS display
      else if (e.key.toLowerCase() === 'p') {
        e.preventDefault()
        this.handleFpsDisplayToggle()
      }
      // L key to toggle logging for selected units
      else if (e.key.toLowerCase() === 'l') {
        e.preventDefault()
        this.handleLoggingToggle(selectedUnits)
      }
      // M key to toggle performance dialog
      else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        this.handlePerformanceToggle()
      }
      // Arrow keys and Space for remote control or map scrolling
      else if (e.code === 'ArrowUp' || e.key === 'ArrowUp' || e.key === 'Up' || e.keyCode === 38) {
        e.preventDefault()
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (!gameState.remoteControl.forward) {
            console.log('Remote control: up key down')
          }
          gameState.remoteControl.forward = true
        } else {
          gameState.keyScroll.up = true
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40) {
        e.preventDefault()
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (!gameState.remoteControl.backward) {
            console.log('Remote control: down key down')
          }
          gameState.remoteControl.backward = true
        } else {
          gameState.keyScroll.down = true
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft' || e.key === 'Left' || e.keyCode === 37) {
        e.preventDefault()
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (gameState.shiftKeyDown) {
            if (!gameState.remoteControl.turretLeft) {
              console.log('Remote control: turret left key down')
            }
            gameState.remoteControl.turretLeft = true
          } else {
            if (!gameState.remoteControl.turnLeft) {
              console.log('Remote control: left key down')
            }
            gameState.remoteControl.turnLeft = true
          }
        } else {
          gameState.keyScroll.left = true
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight' || e.key === 'Right' || e.keyCode === 39) {
        e.preventDefault()
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (gameState.shiftKeyDown) {
            if (!gameState.remoteControl.turretRight) {
              console.log('Remote control: turret right key down')
            }
            gameState.remoteControl.turretRight = true
          } else {
            if (!gameState.remoteControl.turnRight) {
              console.log('Remote control: right key down')
            }
            gameState.remoteControl.turnRight = true
          }
        } else {
          gameState.keyScroll.right = true
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault()
        if (!gameState.remoteControl.fire) {
          console.log('Remote control: space pressed')
        }
        gameState.remoteControl.fire = true
      }
    })

    document.addEventListener('keyup', e => {
      if (e.key === 'Shift') {
        gameState.shiftKeyDown = false
        // Exit chain build mode when shift released
        if (gameState.chainBuildMode) {
          gameState.chainBuildMode = false
          gameState.chainBuildPrimed = false
        }
      }
      if (e.key === 'Alt') {
        gameState.altKeyDown = false
        handleAltKeyRelease() // Check if waypoints were added and play sound
      }
      if (e.code === 'ArrowUp' || e.key === 'ArrowUp' || e.key === 'Up' || e.keyCode === 38) {
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (gameState.remoteControl.forward) {
            console.log('Remote control: up key up')
          }
          gameState.remoteControl.forward = false
        } else {
          gameState.keyScroll.up = false
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40) {
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (gameState.remoteControl.backward) {
            console.log('Remote control: down key up')
          }
          gameState.remoteControl.backward = false
        } else {
          gameState.keyScroll.down = false
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft' || e.key === 'Left' || e.keyCode === 37) {
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (gameState.remoteControl.turnLeft || gameState.remoteControl.turretLeft) {
            console.log('Remote control: left key up')
          }
          gameState.remoteControl.turnLeft = false
          gameState.remoteControl.turretLeft = false
        } else {
          gameState.keyScroll.left = false
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight' || e.key === 'Right' || e.keyCode === 39) {
        if (this.selectedUnits && this.selectedUnits.length > 0) {
          if (gameState.remoteControl.turnRight || gameState.remoteControl.turretRight) {
            console.log('Remote control: right key up')
          }
          gameState.remoteControl.turnRight = false
          gameState.remoteControl.turretRight = false
        } else {
          gameState.keyScroll.right = false
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }
      } else if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        if (gameState.remoteControl.fire) {
          console.log('Remote control: space released')
        }
        gameState.remoteControl.fire = false
      }
    })
  }

  setMouseHandler(mouseHandler) {
    this.mouseHandler = mouseHandler
  }

  handleEscapeKey() {
    let modeWasCanceled = false

    // Cancel attack group mode if active
    if (gameState.attackGroupMode && this.mouseHandler) {
      this.mouseHandler.resetAttackGroupState()
      modeWasCanceled = true
    }

    // Cancel any other active modes
    if (gameState.buildingPlacementMode) {
      gameState.buildingPlacementMode = false
      gameState.selectedBuilding = null
      modeWasCanceled = true
    }

    if (gameState.repairMode) {
      gameState.repairMode = false
      const repairBtn = document.getElementById('repairBtn')
      if (repairBtn) repairBtn.classList.remove('active')
      modeWasCanceled = true
    }

    if (gameState.sellMode) {
      gameState.sellMode = false
      const sellBtn = document.getElementById('sellBtn')
      if (sellBtn) sellBtn.classList.remove('active')
      modeWasCanceled = true
    }

    // Deselect any selected factories or buildings (clear all selections)
    let hadSelections = false
    if (this.selectedUnits && this.selectedUnits.length > 0) {
      hadSelections = true
      // Clear unit selections
      if (this.units) {
        this.units.forEach(unit => { if (unit.owner === gameState.humanPlayer) unit.selected = false })
      }

      // Clear factory selections
      if (this.factories) {
        this.factories.forEach(factory => factory.selected = false)
      }

      // Clear building selections
      if (gameState.buildings) {
        gameState.buildings.forEach(building => { if (building.owner === gameState.humanPlayer) building.selected = false })
      }

      // Clear selectedUnits array
      this.selectedUnits.length = 0

      // Update AGF capability after clearing selections
      if (this.mouseHandler) {
        this.mouseHandler.updateAGFCapability(this.selectedUnits)
      }

      modeWasCanceled = true
    }

    if (modeWasCanceled) {
      const message = hadSelections ? 'Selection cleared' : 'Mode cancelled'
      this.showNotification(message, 1000)
    }
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
    // If units are selected, stop their attacks instead of toggling sell mode
    if (this.selectedUnits && this.selectedUnits.length > 0) {
      this.handleStopAttacking()
      return
    }

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
        gameCanvas.style.cursor = GAME_DEFAULT_CURSOR
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
      gameCanvas.style.cursor = GAME_DEFAULT_CURSOR
      gameCanvas.classList.remove('sell-mode', 'sell-blocked-mode')

      // Show notification
      this.showNotification('Sell mode deactivated', 2000)
    }
  }

  handleRepairMode() {
    const gameCanvas = document.getElementById('gameCanvas')
    const repairBtn = document.getElementById('repairBtn')

    if (!gameState.repairMode) {
      gameState.repairMode = true

      // Deactivate sell mode if it's active
      if (gameState.sellMode) {
        gameState.sellMode = false
        const sellBtn = document.getElementById('sellBtn')
        if (sellBtn) sellBtn.classList.remove('active')
        gameCanvas.classList.remove('sell-mode', 'sell-blocked-mode')
      }

      if (repairBtn) repairBtn.classList.add('active')
      this.showNotification('Repair mode activated. Click on a building to repair it.')
      gameCanvas.classList.add('repair-mode')
    } else {
      gameState.repairMode = false
      if (repairBtn) repairBtn.classList.remove('active')
      gameCanvas.classList.remove('repair-mode', 'repair-blocked-mode')
      gameCanvas.style.cursor = GAME_DEFAULT_CURSOR
      this.showNotification('Repair mode deactivated.')
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
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('movement', avgX, avgY, 0.3)
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
    if (tile.type === 'water' || tile.type === 'rock' || tile.seedCrystal || tile.building) {
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
      gameState.dragVelocity = { x: 0, y: 0 }
      playSound('unitSelection')
      if (this.requestRenderFrame) {
        this.requestRenderFrame()
      }
    }
  }

  handleSelectedUnitFocus(selectedUnits, mapGrid) {
    if (!selectedUnits || selectedUnits.length === 0) return

    const gameCanvas = document.getElementById('gameCanvas')

    // Get device pixel ratio to account for Retina displays
    const pixelRatio = window.devicePixelRatio || 1

    // Calculate logical canvas dimensions
    const logicalCanvasWidth = gameCanvas.width / pixelRatio
    const logicalCanvasHeight = gameCanvas.height / pixelRatio

    let focusX, focusY

    if (selectedUnits.length === 1) {
      focusX = selectedUnits[0].x
      focusY = selectedUnits[0].y
    } else {
      // Average position of all selected units
      focusX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      focusY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
    }

    gameState.scrollOffset.x = Math.max(0, Math.min(
      focusX - logicalCanvasWidth / 2,
      mapGrid[0].length * TILE_SIZE - logicalCanvasWidth
    ))

    gameState.scrollOffset.y = Math.max(0, Math.min(
      focusY - logicalCanvasHeight / 2,
      mapGrid.length * TILE_SIZE - logicalCanvasHeight
    ))

    gameState.dragVelocity = { x: 0, y: 0 }

    playSound('confirmed')
    if (this.requestRenderFrame) {
      this.requestRenderFrame()
    }
  }

  toggleAutoFocus(selectedUnits, mapGrid) {
    if (
      gameState.cameraFollowUnitId &&
      selectedUnits.length === 1 &&
      selectedUnits[0].id === gameState.cameraFollowUnitId
    ) {
      gameState.cameraFollowUnitId = null
      return
    }

    if (selectedUnits.length === 1) {
      gameState.cameraFollowUnitId = selectedUnits[0].id
      this.handleSelectedUnitFocus(selectedUnits, mapGrid)
    } else {
      gameState.cameraFollowUnitId = null
    }
  }

  handleControlGroupAssignment(groupNum, selectedUnits) {

    if (selectedUnits.length > 0) {
      // Only store units, not factories
      const onlyUnits = selectedUnits.filter(unit => unit.type !== 'factory' && unit.owner === gameState.humanPlayer)

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
      units.forEach(u => { if (u.owner === gameState.humanPlayer) u.selected = false })
      const factories = gameState.factories || []
      factories.forEach(f => f.selected = false)
      selectedUnits.length = 0

      // Select all units in the control group that are still alive
      const aliveUnits = this.controlGroups[groupNum].filter(unit =>
        unit && // unit exists
        typeof unit === 'object' && // is an object
        units.includes(unit) && // is in the game units array
        unit.health > 0 && // is alive
        unit.owner === gameState.humanPlayer // belongs to player (safety check)
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
          playSound('confirmed')
          if (this.requestRenderFrame) {
            this.requestRenderFrame()
          }
        }

        // Update the last key press time and key
        this.lastGroupKeyPressed = groupNum
        this.lastGroupKeyPressTime = currentTime

        // Play selection sounds
        playSound('unitSelection')
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

  handleOccupancyMapToggle() {
    // Toggle occupancy map visibility
    gameState.occupancyVisible = !gameState.occupancyVisible

    // Show notification to user
    const status = gameState.occupancyVisible ? 'ON' : 'OFF'
    this.showNotification(`Occupancy map: ${status}`, 2000)

    // Play a sound for feedback
    playSound('confirmed', 0.5)
  }

  handleDzmToggle() {
    const ids = Object.keys(gameState.dangerZoneMaps || {})
    if (ids.length === 0) return
    if (gameState.dzmOverlayIndex === -1) {
      gameState.dzmOverlayIndex = 0
    } else {
      gameState.dzmOverlayIndex++
      if (gameState.dzmOverlayIndex >= ids.length) {
        gameState.dzmOverlayIndex = -1
        this.showNotification('Danger zone map: OFF', 2000)
        playSound('confirmed', 0.5)
        return
      }
    }
    const pid = ids[gameState.dzmOverlayIndex]
    this.showNotification(`Danger zone map: ${pid}`, 2000)
    playSound('confirmed', 0.5)
  }

  handleTankImageToggle() {
    // Toggle tank image rendering
    gameState.useTankImages = !gameState.useTankImages

    // Show notification to user
    const status = gameState.useTankImages ? 'ON' : 'OFF'
    this.showNotification(`Tank image rendering: ${status}`, 2000)

    // Play a sound for feedback
    playSound('confirmed', 0.5)
  }

  handleTurretImageToggle() {
    // Toggle turret image rendering
    gameState.useTurretImages = !gameState.useTurretImages

    // Show notification to user
    const status = gameState.useTurretImages ? 'ON' : 'OFF'
    this.showNotification(`Turret image rendering: ${status}`, 2000)

    // Play a sound for feedback
    playSound('confirmed', 0.5)
  }

  handleFpsDisplayToggle() {
    // Toggle FPS display visibility
    gameState.fpsVisible = !gameState.fpsVisible

    // Update the display immediately
    const fpsElement = document.getElementById('fpsDisplay')
    if (fpsElement) {
      if (gameState.fpsVisible) {
        fpsElement.classList.add('visible')
      } else {
        fpsElement.classList.remove('visible')
      }
    }

    // Show notification to user
    const status = gameState.fpsVisible ? 'ON' : 'OFF'
    this.showNotification(`FPS display: ${status}`, 2000)

    // Play a sound for feedback
    playSound('confirmed', 0.5)
  }

  handlePerformanceToggle() {
    performanceDialog.toggle()
    const status = gameState.performanceVisible ? 'ON' : 'OFF'
    this.showNotification(`Performance stats: ${status}`, 2000)
    playSound('confirmed', 0.5)
  }

  handleLoggingToggle(selectedUnits) {
    if (!selectedUnits || selectedUnits.length === 0) return

    selectedUnits.forEach(unit => {
      toggleUnitLogging(unit)
    })

    const status = selectedUnits[0].loggingEnabled ? 'ON' : 'OFF'
    this.showNotification(`Unit logging: ${status}`, 2000)
    playSound('confirmed', 0.5)
  }

  // Add method to access cheat system for damage prevention
  getCheatSystem() {
    return this.cheatSystem
  }

  // Method to update new units with god mode if enabled
  updateNewUnitForCheat(unit) {
    this.cheatSystem.updateNewUnit(unit)
  }

  // Method to clean up destroyed units from cheat tracking
  cleanupDestroyedUnitFromCheat(unitId) {
    this.cheatSystem.cleanupDestroyedUnit(unitId)
  }

  // Rebuild control groups from units after loading a save game
  rebuildControlGroupsFromUnits(units) {
    this.controlGroups = {}
    if (!Array.isArray(units)) return
    units.forEach(unit => {
      if (unit && unit.groupNumber) {
        if (!this.controlGroups[unit.groupNumber]) {
          this.controlGroups[unit.groupNumber] = []
        }
        this.controlGroups[unit.groupNumber].push(unit)
      }
    })
  }

  handleStopAttacking() {
    if (!this.selectedUnits || this.selectedUnits.length === 0) {
      this.showNotification('No units selected to stop attacking', 2000)
      return
    }

    let stoppedCount = 0

    // Stop attacking for all selected units or buildings
    this.selectedUnits.forEach(unit => {
      if (unit.isBuilding) {
        unit.forcedAttackTarget = null
        unit.forcedAttack = false
        unit.holdFire = true
        stoppedCount++
        return
      }
      // Clear current attack target
      if (unit.target) {
        unit.target = null
        stoppedCount++
      }

      // End any dodge behaviour
      if (unit.isDodging) {
        unit.isDodging = false
        unit.dodgeEndTime = null
        unit.originalPath = null
        unit.originalTarget = null
      }

      // Stop ongoing movement but allow natural deceleration
      cancelUnitMovement(unit)

      // Clear attack queue if it exists
      if (unit.attackQueue) {
        unit.attackQueue = []
      }

      // Clear any attack group targets
      if (unit.attackGroupTargets) {
        unit.attackGroupTargets = []
      }
    })

    if (stoppedCount > 0) {
      this.showNotification(`${stoppedCount} unit${stoppedCount > 1 ? 's' : ''} stopped attacking`, 2000)
    } else {
      this.showNotification('Selected units were not attacking', 2000)
    }
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
