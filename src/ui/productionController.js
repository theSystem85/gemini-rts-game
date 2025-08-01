// productionController.js
// Handle production button setup and state management

import { gameState } from '../gameState.js'
import { unitCosts, buildingCosts } from '../main.js'
import { productionQueue } from '../productionQueue.js'
import { showNotification } from './notifications.js'
import { buildingData } from '../buildings.js'
import { playSound } from '../sound.js'

export class ProductionController {
  constructor() {
    this.vehicleUnitTypes = ['tank', 'tank-v2', 'tank-v3', 'rocketTank', 'ambulance', 'tankerTruck', 'recoveryTank']
    this.unitButtons = new Map()
    this.buildingButtons = new Map()
    this.isSetup = false // Flag to prevent duplicate event listeners
  }

  // Function to update the enabled/disabled state of vehicle production buttons
  updateVehicleButtonStates() {
    const hasVehicleFactory = gameState.buildings.some(
      b => b.type === 'vehicleFactory' && b.owner === gameState.humanPlayer && b.health > 0
    )
    const hasRefinery = gameState.buildings.some(
      b => b.type === 'oreRefinery' && b.owner === gameState.humanPlayer && b.health > 0
    )
    const hasGasStation = gameState.buildings.some(
      b => b.type === 'gasStation' && b.owner === gameState.humanPlayer && b.health > 0
    )
    const hasWorkshop = gameState.buildings.some(
      b => b.type === 'vehicleWorkshop' && b.owner === gameState.humanPlayer && b.health > 0
    )
    const hasHospital = gameState.buildings.some(
      b => b.type === 'hospital' && b.owner === gameState.humanPlayer && b.health > 0
    )
    const unitButtons = document.querySelectorAll('.production-button[data-unit-type]')

    unitButtons.forEach(button => {
      const unitType = button.getAttribute('data-unit-type')

      if (unitType === 'tankerTruck') {
        if (hasVehicleFactory && hasGasStation) {
          button.classList.remove('disabled')
          button.title = ''
        } else {
          button.classList.add('disabled')
          button.title = 'Requires Vehicle Factory & Gas Station'
        }
      } else if (unitType === 'recoveryTank') {
        if (hasVehicleFactory && hasWorkshop) {
          button.classList.remove('disabled')
          button.title = ''
        } else {
          button.classList.add('disabled')
          button.title = 'Requires Vehicle Factory & Workshop'
        }
      } else if (unitType === 'ambulance') {
        if (hasVehicleFactory && hasHospital) {
          button.classList.remove('disabled')
          button.title = ''
        } else {
          button.classList.add('disabled')
          button.title = 'Requires Vehicle Factory & Hospital'
        }
      } else if (this.vehicleUnitTypes.includes(unitType)) {
        if (hasVehicleFactory) {
          button.classList.remove('disabled')
          button.title = '' // Clear tooltip
        } else {
          button.classList.add('disabled')
          button.title = 'Requires Vehicle Factory' // Add tooltip
        }
      } else if (unitType === 'harvester') {
        if (hasVehicleFactory && hasRefinery) {
          button.classList.remove('disabled')
          button.title = '' // Clear tooltip
        } else {
          button.classList.add('disabled')
          button.title = 'Requires Vehicle Factory & Ore Refinery' // Add tooltip
        }
      }
    })
  }

  // Update enabled/disabled state of building production buttons
  updateBuildingButtonStates() {
    const hasRadar = gameState.buildings.some(
      b =>
        b.type === 'radarStation' &&
        b.owner === gameState.humanPlayer &&
        b.health > 0
    )

    const hasConstructionYard = gameState.buildings.some(
      b =>
        b.type === 'constructionYard' &&
        b.owner === gameState.humanPlayer &&
        b.health > 0
    )

    const buildingButtons = document.querySelectorAll('.production-button[data-building-type]')

    buildingButtons.forEach(button => {
      const type = button.getAttribute('data-building-type')
      let disable = false
      const req = []

      if (!hasConstructionYard) {
        disable = true
        req.push('Construction Yard')
      }

      if (buildingData[type]?.requiresRadar && !hasRadar) {
        disable = true
        req.push('Radar Station')
      }

      if (disable) {
        button.classList.add('disabled')
        button.title = 'Requires ' + req.join(' & ')
      } else {
        button.classList.remove('disabled')
        button.title = ''
      }
    })
  }

  // Combined production button setup function that handles both unit and building buttons
  setupAllProductionButtons() {
    // Only setup once to prevent duplicate event listeners
    if (this.isSetup) {
      // Just update button states if already set up
      this.updateVehicleButtonStates()
      this.updateBuildingButtonStates()
      return
    }

    // Clear the button maps since we're refreshing all references
    this.unitButtons.clear()
    this.buildingButtons.clear()

    this.setupUnitButtons()
    this.setupBuildingButtons()

    // Initial update of button states when setting up
    this.updateVehicleButtonStates()
    this.updateBuildingButtonStates()

    this.isSetup = true
  }

  setupUnitButtons() {
    const unitButtons = document.querySelectorAll('.production-button[data-unit-type]')

    unitButtons.forEach(button => {
      const unitType = button.getAttribute('data-unit-type')
      this.unitButtons.set(unitType, button)

      if (!gameState.availableUnitTypes.has(unitType)) {
        button.style.display = 'none'
      } else if (gameState.newUnitTypes.has(unitType)) {
        const label = button.querySelector('.new-label')
        if (label) label.style.display = 'block'
      }

      button.addEventListener('click', () => {
        // Prevent action if game is paused or button is disabled
        if (gameState.gamePaused || button.classList.contains('disabled')) {
          // Optionally show a notification if disabled
          if (button.classList.contains('disabled')) {
            showNotification('Cannot produce unit: Required building missing.')
          }
          return
        }

        const unitType = button.getAttribute('data-unit-type')
        unitCosts[unitType] || 0 // Cost is used for validation but not directly referenced

        // Check requirements for the unit type
        let requirementsMet = true
        let requirementText = ''

        if (unitType === 'tankerTruck') {
          const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === gameState.humanPlayer)
          const hasGasStation = gameState.buildings.some(b => b.type === 'gasStation' && b.owner === gameState.humanPlayer)
          if (!hasVehicleFactory || !hasGasStation) {
            requirementsMet = false
            requirementText = 'Requires Vehicle Factory & Gas Station'
          }
        } else if (this.vehicleUnitTypes.includes(unitType)) {
          const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === gameState.humanPlayer)
          if (!hasVehicleFactory) {
            requirementsMet = false
            requirementText = 'Requires Vehicle Factory'
          }
        } else if (unitType === 'harvester') {
          const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === gameState.humanPlayer)
          const hasRefinery = gameState.buildings.some(b => b.type === 'oreRefinery' && b.owner === gameState.humanPlayer)
          if (!hasVehicleFactory || !hasRefinery) {
            requirementsMet = false
            requirementText = 'Requires Vehicle Factory & Ore Refinery'
          }
        }

        // If requirements are not met, disable the button and show tooltip
        if (!requirementsMet) {
          showNotification(`Cannot produce ${unitType}: ${requirementText}.`)
          button.classList.add('disabled')
          button.title = requirementText
          return // Stop processing
        }

        // Re-enable button if requirements were previously unmet but now are met
        button.classList.remove('disabled')
        button.title = '' // Clear requirement tooltip

        if (gameState.newUnitTypes.has(unitType)) {
          gameState.newUnitTypes.delete(unitType)
          const label = button.querySelector('.new-label')
          if (label) label.style.display = 'none'
        }

        // Always allow queuing
        productionQueue.addItem(unitType, button, false)
      })

      button.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        // Prevent action if game is paused
        if (gameState.gamePaused) return

        // Check if this button has the current production
        if (productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
          if (!productionQueue.pausedUnit) {
            // First right-click pauses
            productionQueue.togglePauseUnit()
          } else {
            // Second right-click cancels
            productionQueue.cancelUnitProduction()
          }
        } else {
          // Find the last queued item of this type
          // Allow canceling ALL queued items, including currently producing ones
          for (let i = productionQueue.unitItems.length - 1; i >= 0; i--) {
            if (productionQueue.unitItems[i].button === button) {
              // If we're canceling the currently producing unit, cancel it properly
              if (i === 0 && productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
                productionQueue.cancelUnitProduction()
                break
              } else {
                // Remove queued unit (no money refund for queued items)
                productionQueue.tryResumeProduction()
                productionQueue.unitItems.splice(i, 1)

                const remainingCount = productionQueue.unitItems.filter(
                  item => item.button === button
                ).length + (productionQueue.currentUnit && productionQueue.currentUnit.button === button ? 1 : 0)

                productionQueue.updateBatchCounter(button, remainingCount)
                break
              }
            }
          }
        }
      })

      // Shift + mouse wheel to adjust queued amount
      button.addEventListener('wheel', (e) => {
        // Check both gameState.shiftKeyDown and the event's shiftKey property as fallbacks
        const isShiftPressed = gameState.shiftKeyDown || e.shiftKey

        if (!isShiftPressed) return
        e.preventDefault()
        e.stopPropagation()

        // Determine scroll direction - use deltaX as primary (some systems report scroll in deltaX)
        // then fall back to deltaY, wheelDelta, and detail
        let scrollUp = false
        let scrollDown = false

        // Method 1: deltaX (some trackpads/systems report horizontal scroll for wheel)
        if (e.deltaX < 0) {
          scrollUp = true
        } else if (e.deltaX > 0) {
          scrollDown = true
        }

        // Method 2: deltaY (most standard) - only if deltaX didn't determine direction
        if (!scrollUp && !scrollDown) {
          if (e.deltaY < 0 || Object.is(e.deltaY, -0)) {
            scrollUp = true
          } else if (e.deltaY > 0) {
            scrollDown = true
          }
        }

        // Method 3: wheelDelta (older browsers/systems) - only if neither deltaX nor deltaY worked
        if (!scrollUp && !scrollDown && e.wheelDelta !== undefined) {
          if (e.wheelDelta > 0) {
            scrollUp = true
          } else if (e.wheelDelta < 0) {
            scrollDown = true
          }
        }

        // Method 4: detail (Firefox legacy) - final fallback
        if (!scrollUp && !scrollDown && e.detail !== undefined) {
          if (e.detail < 0) {
            scrollUp = true
          } else if (e.detail > 0) {
            scrollDown = true
          }
        }

        if (scrollUp) {
          // Scroll up - queue one more unit if possible
          if (!gameState.gamePaused && !button.classList.contains('disabled')) {
            const unitType = button.getAttribute('data-unit-type')
            productionQueue.addItem(unitType, button, false)
          }
        } else if (scrollDown) {
          // Scroll down - remove last queued unit of this type
          // Allow canceling ALL blue bubbles, including currently producing ones
          for (let i = productionQueue.unitItems.length - 1; i >= 0; i--) {
            if (productionQueue.unitItems[i].button === button) {
              // If we're canceling the currently producing unit, cancel it properly
              if (i === 0 && productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
                productionQueue.cancelUnitProduction()
                break
              } else {
                // Remove queued unit (no money refund for queued items)
                productionQueue.tryResumeProduction()
                productionQueue.unitItems.splice(i, 1)

                const remainingCount = productionQueue.unitItems.filter(
                  item => item.button === button
                ).length + (productionQueue.currentUnit && productionQueue.currentUnit.button === button ? 1 : 0)

                productionQueue.updateBatchCounter(button, remainingCount)
                break
              }
            }
          }
        }
      }, { passive: false })

      // Drag and drop rally point placement
      button.setAttribute('draggable', 'true')

      const img = button.querySelector('img')
      if (img) {
        img.setAttribute('draggable', 'false')
        img.addEventListener('dragstart', e => {
          e.preventDefault()
          return false
        })
      }

      button.addEventListener('dragstart', (e) => {
        if (gameState.gamePaused || button.classList.contains('disabled')) {
          e.preventDefault()
          return false
        }
        gameState.draggedUnitType = unitType
        gameState.draggedUnitButton = button

        const dragImage = document.createElement('div')
        dragImage.style.width = '1px'
        dragImage.style.height = '1px'
        dragImage.style.backgroundColor = 'transparent'
        dragImage.style.position = 'absolute'
        dragImage.style.top = '-1000px'
        document.body.appendChild(dragImage)

        try {
          e.dataTransfer.setDragImage(dragImage, 0, 0)
        } catch (err) {
          console.warn('Could not set custom drag image:', err)
        }

        setTimeout(() => {
          if (dragImage.parentNode) {
            document.body.removeChild(dragImage)
          }
        }, 10)
      })

      button.addEventListener('dragend', () => {
        gameState.draggedUnitType = null
        gameState.draggedUnitButton = null
      })
    })
  }

  setupBuildingButtons() {
    const buildingButtons = document.querySelectorAll('.production-button[data-building-type]')

    buildingButtons.forEach(button => {
      const buildingType = button.getAttribute('data-building-type')
      this.buildingButtons.set(buildingType, button)

      if (!gameState.availableBuildingTypes.has(buildingType)) {
        button.style.display = 'none'
      } else if (gameState.newBuildingTypes.has(buildingType)) {
        const label = button.querySelector('.new-label')
        if (label) label.style.display = 'block'
      }

      // Track double-click timing
      let lastClickTime = 0
      const DOUBLE_CLICK_THRESHOLD = 500 // 500ms for double-click

      // Drag and drop support
      button.setAttribute('draggable', 'true')

      // Disable dragging on the image inside the button to prevent it from interfering
      const img = button.querySelector('img')
      if (img) {
        img.setAttribute('draggable', 'false')
        // Also prevent default drag behavior on the image
        img.addEventListener('dragstart', (e) => {
          e.preventDefault()
          return false
        })
      }

      button.addEventListener('dragstart', (e) => {
        if (gameState.gamePaused || button.classList.contains('disabled')) {
          e.preventDefault()
          return false
        }
        gameState.draggedBuildingType = buildingType
        gameState.draggedBuildingButton = button
        gameState.chainBuildPrimed = gameState.shiftKeyDown

        // Method 1: Try using a transparent 1x1 pixel div
        const dragImage = document.createElement('div')
        dragImage.style.width = '1px'
        dragImage.style.height = '1px'
        dragImage.style.backgroundColor = 'transparent'
        dragImage.style.position = 'absolute'
        dragImage.style.top = '-1000px'
        document.body.appendChild(dragImage)

        try {
          e.dataTransfer.setDragImage(dragImage, 0, 0)
        } catch (err) {
          console.warn('Could not set custom drag image:', err)
        }

        // Clean up the temporary element after a brief delay
        setTimeout(() => {
          if (dragImage.parentNode) {
            document.body.removeChild(dragImage)
          }
        }, 10)
      })
      button.addEventListener('dragend', () => {
        gameState.draggedBuildingType = null
        gameState.draggedBuildingButton = null
        gameState.chainBuildPrimed = false
        gameState.buildingPlacementMode = false
        gameState.currentBuildingType = null
      })

      button.addEventListener('click', () => {
        const buildingType = button.getAttribute('data-building-type')
        const currentTime = performance.now()

        // Prevent action if game is paused or button is disabled
        if (gameState.gamePaused || button.classList.contains('disabled')) {
          if (button.classList.contains('disabled')) {
            showNotification('Cannot construct building: ' + (button.title || 'Prerequisite missing.'))
          }
          return
        }

        // Handle ready-for-placement buildings
        if (button.classList.contains('ready-for-placement')) {
          // Check if this is a double-click
          const timeSinceLastClick = currentTime - lastClickTime
          lastClickTime = currentTime

          if (timeSinceLastClick <= DOUBLE_CLICK_THRESHOLD) {
            // Double-click: Queue another building of the same type (stacking)
            if (gameState.newBuildingTypes.has(buildingType)) {
              gameState.newBuildingTypes.delete(buildingType)
              const label = button.querySelector('.new-label')
              if (label) label.style.display = 'none'
            }
            productionQueue.addItem(buildingType, button, true)
            showNotification(`Queued another ${buildingData[buildingType].displayName}`)
          } else {
            // Single click: Enable placement mode
            if (productionQueue.enableBuildingPlacementMode(buildingType, button)) {
              // Placement mode enabled successfully
            } else {
              console.warn('Failed to enable placement mode for building:', buildingType)
            }
          }
          return
        }

        // If a building placement is already in progress, don't queue another one
        if (gameState.buildingPlacementMode) {
          return
        }

        buildingCosts[buildingType] || 0 // Cost is used by productionQueue internally

        // Always allow queuing
        if (gameState.newBuildingTypes.has(buildingType)) {
          gameState.newBuildingTypes.delete(buildingType)
          const label = button.querySelector('.new-label')
          if (label) label.style.display = 'none'
        }

        productionQueue.addItem(buildingType, button, true)
        lastClickTime = currentTime
      })

      button.addEventListener('contextmenu', (e) => {
        e.preventDefault()

        // If this is a ready-for-placement building, handle cancellation properly
        if (button.classList.contains('ready-for-placement')) {
          // Clear any lingering pause states that might interfere
          if (productionQueue.currentBuilding === null) {
            productionQueue.pausedBuilding = false
          }

          // Check if there are stacked buildings in queue
          const stackedCount = productionQueue.buildingItems.filter(item => item.button === button).length

          if (stackedCount > 0) {
            // If there are stacked buildings, cancel the last one from the queue
            // Allow canceling ALL stacked buildings, including currently producing ones
            for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
              const queued = productionQueue.buildingItems[i]
              if (queued.button === button) {
                // If we're canceling the currently producing building, cancel it properly
                if (i === 0 && productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
                  productionQueue.cancelBuildingProduction()
                  showNotification('Cancelled building construction')
                  break
                } else {
                  // Remove queued building (no money refund for stacked buildings)
                  productionQueue.tryResumeProduction()
                  productionQueue.buildingItems.splice(i, 1)
                  productionQueue.removeBlueprint(queued)

                  const remainingCount = productionQueue.buildingItems.filter(
                    item => item.button === button
                  ).length

                  productionQueue.updateBatchCounter(button, remainingCount)
                  showNotification('Cancelled stacked building construction')
                  break
                }
              }
            }
          } else {
            // No stacked buildings, cancel the ready-for-placement building
            const buildingType = button.getAttribute('data-building-type')
            productionQueue.cancelReadyBuilding(buildingType, button)
          }
          return
        }

        // Check if this button has the current production
        if (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
          if (!productionQueue.pausedBuilding) {
            // First right-click pauses
            productionQueue.togglePauseBuilding()
          } else {
            // Second right-click cancels
            productionQueue.cancelBuildingProduction()
          }
        } else {
          // Find the last queued item of this type
          // Allow canceling ALL queued items, including currently producing ones
          for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
            const queued = productionQueue.buildingItems[i]
            if (queued.button === button) {
              // If we're canceling the currently producing building, cancel it properly
              if (i === 0 && productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
                productionQueue.cancelBuildingProduction()
                break
              } else {
                // Remove queued building (no money refund for queued items)
                productionQueue.tryResumeProduction()
                productionQueue.buildingItems.splice(i, 1)
                productionQueue.removeBlueprint(queued)

                const remainingCount = productionQueue.buildingItems.filter(
                  item => item.button === button
                ).length + (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button ? 1 : 0)

                productionQueue.updateBatchCounter(button, remainingCount)
                break
              }
            }
          }
        }
      })

      // Shift + mouse wheel to adjust queued amount for buildings
      button.addEventListener('wheel', (e) => {
        // Check both gameState.shiftKeyDown and the event's shiftKey property as fallbacks
        const isShiftPressed = gameState.shiftKeyDown || e.shiftKey

        if (!isShiftPressed) return
        e.preventDefault()
        e.stopPropagation()

        // Determine scroll direction - use deltaX as primary (some systems report scroll in deltaX)
        // then fall back to deltaY, wheelDelta, and detail
        let scrollUp = false
        let scrollDown = false

        // Method 1: deltaX (some trackpads/systems report horizontal scroll for wheel)
        if (e.deltaX < 0) {
          scrollUp = true
        } else if (e.deltaX > 0) {
          scrollDown = true
        }

        // Method 2: deltaY (most standard) - only if deltaX didn't determine direction
        if (!scrollUp && !scrollDown) {
          if (e.deltaY < 0 || Object.is(e.deltaY, -0)) {
            scrollUp = true
          } else if (e.deltaY > 0) {
            scrollDown = true
          }
        }

        // Method 3: wheelDelta (older browsers/systems) - only if neither deltaX nor deltaY worked
        if (!scrollUp && !scrollDown && e.wheelDelta !== undefined) {
          if (e.wheelDelta > 0) {
            scrollUp = true
          } else if (e.wheelDelta < 0) {
            scrollDown = true
          }
        }

        // Method 4: detail (Firefox legacy) - final fallback
        if (!scrollUp && !scrollDown && e.detail !== undefined) {
          if (e.detail < 0) {
            scrollUp = true
          } else if (e.detail > 0) {
            scrollDown = true
          }
        }

        if (scrollUp) {
          // Scroll up - queue one more building if possible
          if (!gameState.gamePaused && !button.classList.contains('disabled')) {
            productionQueue.addItem(buildingType, button, true)
          }
        } else if (scrollDown) {
          // Scroll down - remove last queued building of this type
          // Allow canceling ALL blue bubbles, including currently producing ones
          for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
            const queued = productionQueue.buildingItems[i]
            if (queued.button === button) {
              // If we're canceling the currently producing building, cancel it properly
              if (i === 0 && productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
                productionQueue.cancelBuildingProduction()
                break
              } else {
                // Remove queued building (no money refund for queued items)
                productionQueue.tryResumeProduction()
                productionQueue.buildingItems.splice(i, 1)
                productionQueue.removeBlueprint(queued)

                const remainingCount = productionQueue.buildingItems.filter(
                  item => item.button === button
                ).length + (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button ? 1 : 0)

                productionQueue.updateBatchCounter(button, remainingCount)
                break
              }
            }
          }
        }
      }, { passive: false })
    })
  }

  unlockUnitType(type, skipSound = false) {
    if (!gameState.availableUnitTypes.has(type)) {
      gameState.availableUnitTypes.add(type)
      gameState.newUnitTypes.add(type)
      const button = this.unitButtons.get(type)
      if (button) {
        button.style.display = ''
        const label = button.querySelector('.new-label')
        if (label) label.style.display = 'block'
      }
      if (!skipSound) {
        playSound('new_units_types_available', 1.0, 5, true) // Throttle for 5 seconds
      }
      // Update button states to ensure unlocked units are not disabled
      this.updateVehicleButtonStates()
      // Update tab states when units are unlocked
      this.updateTabStates()
    }
  }

  unlockBuildingType(type, skipSound = false) {
    if (!gameState.availableBuildingTypes.has(type)) {
      gameState.availableBuildingTypes.add(type)
      gameState.newBuildingTypes.add(type)
      const button = this.buildingButtons.get(type)
      if (button) {
        button.style.display = ''
        const label = button.querySelector('.new-label')
        if (label) label.style.display = 'block'
      }
      if (!skipSound) {
        playSound('new_building_types_available', 1.0, 5, true) // Throttle for 5 seconds
      }
      // Update button states to ensure unlocked buildings are not disabled
      this.updateBuildingButtonStates()
      // Update tab states when buildings are unlocked
      this.updateTabStates()
    }
  }

  /**
   * Unlock multiple units and buildings at once with appropriate sound
   */
  unlockMultipleTypes(unitTypes = [], buildingTypes = []) {
    let unlockedUnits = 0
    let unlockedBuildings = 0

    // Unlock units (skip individual sounds and button state updates)
    unitTypes.forEach(type => {
      if (!gameState.availableUnitTypes.has(type)) {
        gameState.availableUnitTypes.add(type)
        gameState.newUnitTypes.add(type)
        const button = this.unitButtons.get(type)
        if (button) {
          button.style.display = ''
          const label = button.querySelector('.new-label')
          if (label) label.style.display = 'block'
        }
        unlockedUnits++
      }
    })

    // Unlock buildings (skip individual sounds and button state updates)
    buildingTypes.forEach(type => {
      if (!gameState.availableBuildingTypes.has(type)) {
        gameState.availableBuildingTypes.add(type)
        gameState.newBuildingTypes.add(type)
        const button = this.buildingButtons.get(type)
        if (button) {
          button.style.display = ''
          const label = button.querySelector('.new-label')
          if (label) label.style.display = 'block'
        }
        unlockedBuildings++
      }
    })

    // Update button states once for all unlocked items
    if (unlockedUnits > 0) {
      this.updateVehicleButtonStates()
    }
    if (unlockedBuildings > 0) {
      this.updateBuildingButtonStates()
    }

    // Play appropriate sound based on what was unlocked
    if (unlockedUnits > 0 && unlockedBuildings > 0) {
      // Both units and buildings unlocked
      playSound('new_production_options', 1.0, 5, true)
    } else if (unlockedUnits > 0) {
      // Only units unlocked
      playSound('new_units_types_available', 1.0, 5, true)
    } else if (unlockedBuildings > 0) {
      // Only buildings unlocked
      playSound('new_building_types_available', 1.0, 5, true)
    }

    // Update tab states after batch unlock
    if (unlockedUnits > 0 || unlockedBuildings > 0) {
      this.updateTabStates()
    }
  }

  // Force-unlock a unit type without triggering sounds or "new" labels
  forceUnlockUnitType(type) {
    if (!gameState.availableUnitTypes.has(type)) {
      gameState.availableUnitTypes.add(type)
    }
    gameState.newUnitTypes.delete(type)
    const button = this.unitButtons.get(type)
    if (button) {
      button.style.display = ''
      const label = button.querySelector('.new-label')
      if (label) label.style.display = 'none'
    }
  }

  // Force-unlock a building type without triggering sounds or "new" labels
  forceUnlockBuildingType(type) {
    if (!gameState.availableBuildingTypes.has(type)) {
      gameState.availableBuildingTypes.add(type)
    }
    gameState.newBuildingTypes.delete(type)
    const button = this.buildingButtons.get(type)
    if (button) {
      button.style.display = ''
      const label = button.querySelector('.new-label')
      if (label) label.style.display = 'none'
    }
  }

  // Sync tech tree unlocks based on existing player buildings
  syncTechTreeWithBuildings() {
    const buildings = gameState.buildings.filter(b => b.owner === gameState.humanPlayer)
    const hasFactory = buildings.some(b => b.type === 'vehicleFactory')
    const hasRefinery = buildings.some(b => b.type === 'oreRefinery')
    const hasRocketTurret = buildings.some(b => b.type === 'rocketTurret')
    const hasRadar = buildings.some(b => b.type === 'radarStation')
    const hasGasStation = buildings.some(b => b.type === 'gasStation')
    const hasHospital = buildings.some(b => b.type === 'hospital')
    const hasWorkshop = buildings.some(b => b.type === 'vehicleWorkshop')
    const factoryCount = buildings.filter(b => b.type === 'vehicleFactory').length

    if (hasFactory) {
      this.forceUnlockUnitType('tank')
    }

    if (hasFactory && hasRefinery) {
      this.forceUnlockUnitType('harvester')
    }

    if (hasFactory && hasGasStation) {
      this.forceUnlockUnitType('tankerTruck')
    }

    if (hasHospital) {
      this.forceUnlockUnitType('ambulance')
    }

    if (hasFactory && hasWorkshop) {
      this.forceUnlockUnitType('recoveryTank')
    }

    if (factoryCount >= 2) {
      this.forceUnlockUnitType('tank-v3')
    }

    if (hasRocketTurret) {
      this.forceUnlockUnitType('rocketTank')
    }

    if (hasRadar) {
      this.forceUnlockUnitType('tank-v2')
      ;['turretGunV2', 'turretGunV3', 'rocketTurret', 'teslaCoil', 'artilleryTurret']
        .forEach(t => this.forceUnlockBuildingType(t))
    }

    this.updateVehicleButtonStates()
    this.updateBuildingButtonStates()
    this.updateTabStates()
  }

  // Initialize production tabs without setting up buttons again
  initProductionTabs() {
    const tabButtons = document.querySelectorAll('.tab-button')
    const tabContents = document.querySelectorAll('.tab-content')

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Don't allow clicking on disabled tabs
        if (button.classList.contains('disabled')) {
          return
        }

        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'))
        tabContents.forEach(content => content.classList.remove('active'))

        // Add active class to clicked button
        button.classList.add('active')

        // Show corresponding content
        const tabName = button.getAttribute('data-tab')
        const tabContent = document.getElementById(`${tabName}TabContent`)
        tabContent.classList.add('active')

        // Force image loading in the newly activated tab
        tabContent.querySelectorAll('img').forEach(img => {
          // Trick to force browser to load/reload image if it failed before
          if (!img.complete || img.naturalHeight === 0) {
            const originalSrc = img.src
            img.src = ''
            setTimeout(() => { img.src = originalSrc }, 10)
          }
        })
      })
    })

    // Initial tab state update
    this.updateTabStates()
  }

  /**
   * Update tab states based on available production options
   */
  updateTabStates() {
    const unitsTab = document.querySelector('.tab-button[data-tab="units"]')
    const buildingsTab = document.querySelector('.tab-button[data-tab="buildings"]')

    // Check if units tab should be enabled (any unit types available)
    const hasAvailableUnits = gameState.availableUnitTypes.size > 0
    if (hasAvailableUnits) {
      unitsTab.classList.remove('disabled')
    } else {
      unitsTab.classList.add('disabled')
    }

    // Check if buildings tab should be enabled (any building types available)
    const hasAvailableBuildings = gameState.availableBuildingTypes.size > 0
    if (hasAvailableBuildings) {
      buildingsTab.classList.remove('disabled')
    } else {
      buildingsTab.classList.add('disabled')
    }

    // If current active tab becomes disabled, switch to the other tab
    const activeTab = document.querySelector('.tab-button.active')
    if (activeTab && activeTab.classList.contains('disabled')) {
      // Find the first non-disabled tab and activate it
      const enabledTab = document.querySelector('.tab-button:not(.disabled)')
      if (enabledTab) {
        activeTab.classList.remove('active')
        enabledTab.classList.add('active')

        // Update content visibility
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'))
        const tabName = enabledTab.getAttribute('data-tab')
        const tabContent = document.getElementById(`${tabName}TabContent`)
        if (tabContent) {
          tabContent.classList.add('active')
        }
      }
    }
  }
}
