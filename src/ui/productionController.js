// productionController.js
// Handle production button setup and state management

import { gameState } from '../gameState.js'
import { unitCosts, buildingCosts } from '../main.js'
import { productionQueue } from '../productionQueue.js'
import { showNotification } from './notifications.js'
import { buildingData } from '../buildings.js'

export class ProductionController {
  constructor() {
    this.vehicleUnitTypes = ['tank', 'tank-v2', 'tank-v3', 'rocketTank']
  }

  // Function to update the enabled/disabled state of vehicle production buttons
  updateVehicleButtonStates() {
    const hasVehicleFactory = gameState.buildings.some(b => b.type === 'vehicleFactory' && b.owner === gameState.humanPlayer)
    const hasRefinery = gameState.buildings.some(b => b.type === 'oreRefinery' && b.owner === gameState.humanPlayer)
    const unitButtons = document.querySelectorAll('.production-button[data-unit-type]')

    unitButtons.forEach(button => {
      const unitType = button.getAttribute('data-unit-type')

      if (this.vehicleUnitTypes.includes(unitType)) {
        if (hasVehicleFactory) {
          button.classList.remove('disabled')
          button.title = '' // Clear tooltip
        } else {
          button.classList.add('disabled')
          button.title = 'Requires Vehicle Factory' // Add tooltip
        }
      }
      else if (unitType === 'harvester') {
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
      b => b.type === 'radarStation' && b.owner === gameState.humanPlayer && b.health > 0
    )

    const buildingButtons = document.querySelectorAll('.production-button[data-building-type]')

    buildingButtons.forEach(button => {
      const type = button.getAttribute('data-building-type')
      let disable = false
      let requirementText = ''

      if (buildingData[type]?.requiresRadar && !hasRadar) {
        disable = true
        requirementText = 'Requires Radar Station'
      }

      if (disable) {
        button.classList.add('disabled')
        button.title = requirementText
      } else {
        button.classList.remove('disabled')
        button.title = ''
      }
    })
  }

  // Combined production button setup function that handles both unit and building buttons
  setupAllProductionButtons() {

    // Clear any existing event listeners by cloning and replacing elements
    document.querySelectorAll('.production-button').forEach(button => {
      const clone = button.cloneNode(true)
      if (button.parentNode) {
        button.parentNode.replaceChild(clone, button)
      }
    })

    this.setupUnitButtons()
    this.setupBuildingButtons()

    // Initial update of button states when setting up
    this.updateVehicleButtonStates()
    this.updateBuildingButtonStates()
  }

  setupUnitButtons() {
    const unitButtons = document.querySelectorAll('.production-button[data-unit-type]')

    unitButtons.forEach(button => {
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

        if (this.vehicleUnitTypes.includes(unitType)) {
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
          for (let i = productionQueue.unitItems.length - 1; i >= 0; i--) {
            if (productionQueue.unitItems[i].button === button) {
              // Return money for the cancelled production
              gameState.money += unitCosts[productionQueue.unitItems[i].type] || 0
              productionQueue.tryResumeProduction()
              // Remove from queue
              productionQueue.unitItems.splice(i, 1)

              // Update batch counter
              const remainingCount = productionQueue.unitItems.filter(
                item => item.button === button
              ).length + (productionQueue.currentUnit && productionQueue.currentUnit.button === button ? 1 : 0)

              productionQueue.updateBatchCounter(button, remainingCount)

              break // Only remove one at a time
            }
          }
        }
      })
    })
  }

  setupBuildingButtons() {
    const buildingButtons = document.querySelectorAll('.production-button[data-building-type]')

    buildingButtons.forEach(button => {
      // Track double-click timing
      let lastClickTime = 0
      const DOUBLE_CLICK_THRESHOLD = 500 // 500ms for double-click

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
        productionQueue.addItem(buildingType, button, true)
        lastClickTime = currentTime
      })

      button.addEventListener('contextmenu', (e) => {
        e.preventDefault()

        // If this is a ready-for-placement building, handle cancellation properly
        if (button.classList.contains('ready-for-placement')) {
          // Check if there are stacked buildings in queue
          const stackedCount = productionQueue.buildingItems.filter(item => item.button === button).length
          
          if (stackedCount > 0) {
            // If there are stacked buildings, cancel the last one from the queue
            for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
              if (productionQueue.buildingItems[i].button === button) {
                // Return money for the cancelled production
                gameState.money += buildingCosts[productionQueue.buildingItems[i].type] || 0
                productionQueue.tryResumeProduction()
                // Remove from queue
                productionQueue.buildingItems.splice(i, 1)

                // Update batch counter
                const remainingCount = productionQueue.buildingItems.filter(
                  item => item.button === button
                ).length

                productionQueue.updateBatchCounter(button, remainingCount)
                
                showNotification('Cancelled stacked building construction')
                break // Only remove one at a time
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
          for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
            if (productionQueue.buildingItems[i].button === button) {
              // Return money for the cancelled production
              gameState.money += buildingCosts[productionQueue.buildingItems[i].type] || 0
              productionQueue.tryResumeProduction()
              // Remove from queue
              productionQueue.buildingItems.splice(i, 1)

              // Update batch counter
              const remainingCount = productionQueue.buildingItems.filter(
                item => item.button === button
              ).length + (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button ? 1 : 0)

              productionQueue.updateBatchCounter(button, remainingCount)

              break // Only remove one at a time
            }
          }
        }
      })
    })
  }

  // Initialize production tabs without setting up buttons again
  initProductionTabs() {
    const tabButtons = document.querySelectorAll('.tab-button')
    const tabContents = document.querySelectorAll('.tab-content')

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
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
  }
}
