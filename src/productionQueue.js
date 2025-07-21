import { spawnUnit, findPath } from './units.js'
import { findClosestOre } from './logic.js'
import { buildingCosts, factories, units } from './main.js'
import { showNotification } from './ui/notifications.js'
import { gameState } from './gameState.js'
import { buildingData, createBuilding, placeBuilding, canPlaceBuilding, updatePowerSupply, isNearExistingBuilding } from './buildings.js'
import { unitCosts } from './units.js'
import { playSound } from './sound.js'
import { assignHarvesterToOptimalRefinery } from './game/harvesterLogic.js'

// List of unit types considered vehicles requiring a Vehicle Factory
const vehicleUnitTypes = ['tank', 'tank-v2', 'rocketTank', 'tank_v1', 'tank-v3', 'harvester'] // Added harvester as a vehicle

// Enhanced production queue system
export const productionQueue = {
  unitItems: [],
  buildingItems: [],
  currentUnit: null,
  currentBuilding: null,
  pausedUnit: false,
  pausedBuilding: false,
  completedBuildings: [], // Changed from completedBuilding to array

  // Store how much money has been paid so far for current productions
  unitPaid: 0,
  buildingPaid: 0,

  // Utility function to update batch counter display
  updateBatchCounter: function(button, count) {
    const batchCounter = button.querySelector('.batch-counter')
    if (count <= 0) {
      batchCounter.style.display = 'none'
      button.classList.remove('active')
      button.classList.remove('paused')
    } else {
      batchCounter.textContent = count
      batchCounter.style.display = 'flex'
    }
  },

  removeBlueprint: function(item) {
    if (item && item.blueprint) {
      gameState.blueprints = gameState.blueprints.filter(bp => bp !== item.blueprint)
    }
  },

  addItem: function(type, button, isBuilding = false, blueprint = null, rallyPoint = null) {
    // Only block queuing if game is paused
    if (gameState.gamePaused) {
      button.classList.add('error')
      setTimeout(() => button.classList.remove('error'), 300)
      showNotification('Cannot build while game is paused. Press Start to begin.')
      return
    }

    // DO NOT check for money or deduct money here

    if (isBuilding) {
      if (gameState.newBuildingTypes.has(type)) {
        gameState.newBuildingTypes.delete(type)
        const label = button.querySelector('.new-label')
        if (label) label.style.display = 'none'
      }
      this.buildingItems.push({ type, button, isBuilding, blueprint })
      const currentCount = this.buildingItems.filter(item => item.button === button).length
      this.updateBatchCounter(button, currentCount)

      if (!this.currentBuilding && !this.pausedBuilding) {
        this.startNextBuildingProduction()
      }
    } else {
      if (gameState.newUnitTypes.has(type)) {
        gameState.newUnitTypes.delete(type)
        const label = button.querySelector('.new-label')
        if (label) label.style.display = 'none'
      }
      this.unitItems.push({ type, button, isBuilding, rallyPoint })
      const currentCount = this.unitItems.filter(item => item.button === button).length
      this.updateBatchCounter(button, currentCount)

      if (!this.currentUnit && !this.pausedUnit) {
        this.startNextUnitProduction()
      }
    }
  },

  // Count player's vehicle factories for build speed bonus
  getVehicleFactoryMultiplier: function() {
    // Default multiplier is 1x speed if at least one factory exists
    if (!gameState.buildings || gameState.buildings.length === 0) {
      return 0 // No factories = 0 multiplier (cannot build)
    }

    // Count vehicle factories owned by player
    const vehicleFactories = gameState.buildings.filter(
      building => building.type === 'vehicleFactory' && building.owner === gameState.humanPlayer
    )

    // Speed multiplier is the number of factories (1 factory = 1x, 2 = 2x, etc.)
    // If 0 factories, return 0 to prevent production start.
    return vehicleFactories.length
  },

  startNextUnitProduction: function() {
    if (this.unitItems.length === 0 || this.pausedUnit) return

    // Don't start production if game is paused
    if (gameState.gamePaused) {
      return
    }

    const item = this.unitItems[0]
    const cost = unitCosts[item.type] || 0

    // Reset paid tracker for this production
    this.unitPaid = 0

    // Check for vehicle factory requirement and multiplier
    let vehicleMultiplier = 1 // Default multiplier
    if (vehicleUnitTypes.includes(item.type)) {
      vehicleMultiplier = this.getVehicleFactoryMultiplier()
      if (vehicleMultiplier === 0) {
        // This should ideally be caught by the button disable logic, but acts as a safeguard
        console.error(`Attempted to start ${item.type} production without a Vehicle Factory.`)
        showNotification(`Cannot produce ${item.type}: Vehicle Factory required.`)
        // Cancel this item? Or just wait? Let's remove it and refund.
        this.unitItems.shift() // Remove the item
        gameState.money += cost // Refund
        this.updateBatchCounter(item.button, this.unitItems.filter(i => i.button === item.button).length) // Update counter
        this.startNextUnitProduction() // Try the next item
        return
      }
    }

    // Set production duration proportional to cost.
    const baseDuration = 3000 // Restore to original (was 750 for 4x faster)
    let duration = baseDuration * (cost / 500) // Example scaling

    // Apply vehicle factory speedup (if applicable)
    // Duration is inversely proportional to the multiplier
    if (vehicleMultiplier > 0) {
      duration = duration / vehicleMultiplier
    }

    // Apply energy slowdown using the new power penalty formula
    if (gameState.playerPowerSupply < 0) {
      // Use the playerBuildSpeedModifier calculated in updatePowerSupply
      // This is already set to follow the formula: 1 / (1 + (negativePower / 100))
      duration = duration / gameState.playerBuildSpeedModifier
    }

    // Apply game speed multiplier to build speed
    // Lower duration = faster build, so we divide by the speed multiplier
    duration = duration / gameState.speedMultiplier

    this.currentUnit = {
      type: item.type,
      button: item.button,
      progress: 0,
      startTime: performance.now(),
      duration: duration,
      isBuilding: item.isBuilding, // Should always be false here
      rallyPoint: item.rallyPoint || null
    }

    // Mark button as active
    item.button.classList.add('active')
    playSound('constructionStarted', 1.0, 0, true)

    // Show notification about production speed if multiple factories exist
    if (vehicleUnitTypes.includes(item.type) && vehicleMultiplier > 1) {
      showNotification(`${item.type} production speed: ${vehicleMultiplier}x`)
    }
  },

  // Count player's construction yards for build speed bonus
  getConstructionYardMultiplier: function() {
    // Return 0 if there are no buildings at all
    if (!gameState.buildings || gameState.buildings.length === 0) {
      return 0
    }

    // Count active construction yards owned by the player
    const constructionYards = gameState.buildings.filter(
      building =>
        building.type === 'constructionYard' &&
        building.owner === gameState.humanPlayer &&
        building.health > 0
    )

    // If none exist, the player cannot construct buildings
    if (constructionYards.length === 0) return 0

    // Each additional yard speeds up construction by 1x
    return constructionYards.length + 1
  },

  startNextBuildingProduction: function() {
    if (this.buildingItems.length === 0 || this.pausedBuilding) return

    // Don't start production if there's already a building in production
    if (this.currentBuilding) return

    // Don't start production if game is paused
    if (gameState.gamePaused) {
      return
    }

    const item = this.buildingItems[0]

    const yardMultiplier = this.getConstructionYardMultiplier()
    if (yardMultiplier === 0) {
      // No construction yard left - cancel this item and notify player
      this.buildingItems.shift()
      this.updateBatchCounter(item.button, this.buildingItems.filter(i => i.button === item.button).length)
      showNotification('Cannot construct building: Construction Yard required.')
      return
    }

    if (item.blueprint) {
      const info = buildingData[item.type]
      let nearBase = false
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (
            isNearExistingBuilding(
              item.blueprint.x + x,
              item.blueprint.y + y,
              gameState.buildings,
              factories,
              2,
              gameState.humanPlayer
            )
          ) {
            nearBase = true
            break
          }
        }
        if (nearBase) break
      }
      if (!nearBase) {
        return
      }
    }

    const cost = buildingCosts[item.type] || 0

    // Reset paid tracker for this production
    this.buildingPaid = 0

    // Set production duration proportional to cost
    const baseDuration = 750 // 4x faster (was 3000)
    let duration = baseDuration * (cost / 500)

    // Apply construction yard speedup
    const constructionMultiplier = yardMultiplier
    duration = duration / constructionMultiplier

    // Apply energy slowdown using the new power penalty formula
    if (gameState.playerPowerSupply < 0) {
      // Use the playerBuildSpeedModifier calculated in updatePowerSupply
      // This is already set to follow the formula: 1 / (1 + (negativePower / 100))
      duration = duration / gameState.playerBuildSpeedModifier
    }

    // Apply game speed multiplier to building speed
    // Lower duration = faster build, so we divide by the speed multiplier
    duration = duration / gameState.speedMultiplier

    this.currentBuilding = {
      type: item.type,
      button: item.button,
      progress: 0,
      startTime: performance.now(),
      duration: duration,
      isBuilding: item.isBuilding,
      blueprint: item.blueprint || null
    }

    // Mark button as active
    item.button.classList.add('active')
    playSound('constructionStarted', 1.0, 0, true)

    // Show notification about construction speed if we have construction yards
    if (constructionMultiplier > 1) {
      showNotification(`Construction speed: ${constructionMultiplier}x`)
    }
  },

  updateProgress: function(timestamp) {
    // Skip progress updates if game is paused
    if (gameState.gamePaused) {
      return
    }

    // Update unit production
    if (this.currentUnit && !this.pausedUnit) {
      const item = this.unitItems[0]
      const cost = unitCosts[item.type] || 0
      const elapsed = (timestamp - this.currentUnit.startTime) * gameState.speedMultiplier
      const progress = Math.min(elapsed / this.currentUnit.duration, 1)

      // Calculate how much should be paid up to this progress
      const shouldHavePaid = Math.floor(cost * progress)
      const toPay = shouldHavePaid - this.unitPaid

      if (toPay > 0) {
        if (gameState.money >= toPay) {
          gameState.money -= toPay
          this.unitPaid += toPay
        } else {
          // Not enough money, pause progress here
          this.pausedUnit = true
          showNotification('Unit production paused: not enough money.')
          return
        }
      }

      this.currentUnit.progress = progress
      const progressBar = this.currentUnit.button.querySelector('.production-progress')
      if (progressBar) {
        progressBar.style.width = `${progress * 100}%`
      }
      if (progress >= 1) {
        this.completeCurrentUnitProduction()
      }
    }

    // Update building production
    if (this.currentBuilding && !this.pausedBuilding) {
      // Safety check: ensure there's a building item in the queue
      if (this.buildingItems.length === 0) {
        console.warn('Current building exists but buildingItems queue is empty, clearing current building')
        this.currentBuilding = null
        return
      }
      
      const item = this.buildingItems[0]
      const cost = buildingCosts[item.type] || 0
      const elapsed = (timestamp - this.currentBuilding.startTime) * gameState.speedMultiplier
      const progress = Math.min(elapsed / this.currentBuilding.duration, 1)

      // Calculate how much should be paid up to this progress
      const shouldHavePaid = Math.floor(cost * progress)
      const toPay = shouldHavePaid - this.buildingPaid

      if (toPay > 0) {
        if (gameState.money >= toPay) {
          gameState.money -= toPay
          this.buildingPaid += toPay
        } else {
          // Not enough money, pause progress here
          this.pausedBuilding = true
          showNotification('Building production paused: not enough money.')
          return
        }
      }

      this.currentBuilding.progress = progress
      const progressBar = this.currentBuilding.button.querySelector('.production-progress')
      if (progressBar) {
        progressBar.style.width = `${progress * 100}%`
      }
      if (progress >= 1) {
        this.completeCurrentBuildingProduction()
      }
    }
  },

  completeCurrentUnitProduction: function() {
    if (!this.currentUnit) return

    // Remove item from queue
    this.unitItems.shift()
    this.updateBatchCounter(this.currentUnit.button, this.unitItems.filter(item => item.button === this.currentUnit.button).length)

    const unitType = this.currentUnit.type
    let spawnFactory = null
    let rallyPointTarget = this.currentUnit.rallyPoint || null // Rally point from drag&drop

    // All vehicle units (including harvesters) should spawn from vehicle factories
    if (vehicleUnitTypes.includes(unitType)) {
      // Find player-owned vehicle factories
      const vehicleFactories = gameState.buildings.filter(
        b => b.type === 'vehicleFactory' && b.owner === gameState.humanPlayer
      )

      if (vehicleFactories.length > 0) {
        // Use round-robin to select the next factory
        gameState.nextVehicleFactoryIndex = gameState.nextVehicleFactoryIndex ?? 0
        spawnFactory = vehicleFactories[gameState.nextVehicleFactoryIndex % vehicleFactories.length]
        gameState.nextVehicleFactoryIndex++
        
        // Use this specific factory's rally point if no custom one was set
        if (!rallyPointTarget) {
          rallyPointTarget = spawnFactory.rallyPoint
        }
      } else {
        // This case should ideally not happen due to button disabling logic
        console.error(`Cannot spawn ${unitType}: No Vehicle Factory found.`)
        showNotification(`Production cancelled: ${unitType} requires a Vehicle Factory.`)
        // Reset and try next production
        this.currentUnit.button.classList.remove('active', 'paused')
        this.currentUnit = null
        this.startNextUnitProduction() // Try next in queue
        return
      }
    } else {
      // For any other non-vehicle units (currently none), use main factory
      const playerFactory = factories.find(f => f.id === gameState.humanPlayer)
      spawnFactory = playerFactory
      if (!rallyPointTarget) {
        rallyPointTarget = playerFactory?.rallyPoint
      }
    }

    if (spawnFactory) {
      // Pass the specific factory's rally point to spawnUnit
      const newUnit = spawnUnit(spawnFactory, unitType, units, gameState.mapGrid, rallyPointTarget, gameState.occupancyMap)
      if (newUnit) {
        units.push(newUnit)
        // Play random unit ready sound
        const readySounds = ['unitReady01', 'unitReady02', 'unitReady03']
        const randomSound = readySounds[Math.floor(Math.random() * readySounds.length)]
        playSound(randomSound, 1.0, 0, true)

        // If the produced unit is a harvester and no custom rally point was set, automatically send it to harvest
        if (newUnit.type === 'harvester' && !rallyPointTarget) {
          // Assign harvester to optimal refinery for even distribution
          assignHarvesterToOptimalRefinery(newUnit, gameState)
          
          // Access the targetedOreTiles from the imported module
          const targetedOreTiles = gameState?.targetedOreTiles || {}

          // Find closest ore, considering assigned refinery if applicable
          const orePos = findClosestOre(newUnit, gameState.mapGrid, targetedOreTiles, newUnit.assignedRefinery)
          if (orePos) {
            // Register this ore tile as targeted by this unit
            const tileKey = `${orePos.x},${orePos.y}`
            if (gameState?.targetedOreTiles) {
              gameState.targetedOreTiles[tileKey] = newUnit.id
            }

            const newPath = findPath({ x: newUnit.tileX, y: newUnit.tileY }, orePos, gameState.mapGrid, null)
            if (newPath.length > 1) {
              newUnit.path = newPath.slice(1)
              newUnit.oreField = orePos // Set initial ore field target
            }
          }
        }
      } else {
        // Handle spawn failure (e.g., no valid position)
        console.warn(`Failed to spawn ${unitType} from factory ${spawnFactory.id || spawnFactory.type}`)
        // Optional: Refund cost?
        // gameState.money += unitCosts[unitType] || 0;
        // moneyEl.textContent = gameState.money; // Assuming moneyEl is accessible
        showNotification(`Spawn failed for ${unitType}. Area might be blocked.`)
      }
    } else {
      console.error(`Could not find appropriate factory to spawn ${unitType}.`)
      // Optional: Refund cost?
    }

    // Reset and start next production
    this.currentUnit.button.classList.remove('active', 'paused')
    this.currentUnit = null
    this.pausedUnit = false  // Clear pause state when unit completes

    // Start next if available
    if (this.unitItems.length > 0) {
      this.startNextUnitProduction()
    }
  },

  completeCurrentBuildingProduction: function() {
    if (!this.currentBuilding) return

    // Remove item from queue immediately when completed
    this.buildingItems.shift()
    
    // Update batch counter (subtract 1 for the completed building)
    this.updateBatchCounter(this.currentBuilding.button, this.buildingItems.filter(item => item.button === this.currentBuilding.button).length)

    const blueprint = this.currentBuilding.blueprint
    if (blueprint) {
      if (canPlaceBuilding(this.currentBuilding.type, blueprint.x, blueprint.y, gameState.mapGrid, units, gameState.buildings, factories, gameState.humanPlayer)) {
        const newBuilding = createBuilding(this.currentBuilding.type, blueprint.x, blueprint.y)
        newBuilding.owner = gameState.humanPlayer
        if (!gameState.buildings) gameState.buildings = []
        gameState.buildings.push(newBuilding)
        placeBuilding(newBuilding, gameState.mapGrid)
        updatePowerSupply(gameState.buildings, gameState)
        playSound('buildingPlaced')
        showNotification(`${buildingData[this.currentBuilding.type].displayName} constructed`)
      } else {
        this.completedBuildings.push({ type: this.currentBuilding.type, button: this.currentBuilding.button })
        this.currentBuilding.button.classList.add('ready-for-placement')
        this.updateReadyBuildingCounter(this.currentBuilding.button)
        showNotification(`${buildingData[this.currentBuilding.type].displayName} ready! Click build button to place.`)
      }
      this.removeBlueprint(this.currentBuilding)
    } else {
      this.completedBuildings.push({ type: this.currentBuilding.type, button: this.currentBuilding.button })
      this.currentBuilding.button.classList.add('ready-for-placement')
      this.updateReadyBuildingCounter(this.currentBuilding.button)
      showNotification(`${buildingData[this.currentBuilding.type].displayName} ready! Click build button to place.`)
    }

    this.currentBuilding.button.classList.remove('active')

    const progressBar = this.currentBuilding.button.querySelector('.production-progress')
    if (progressBar) {
      progressBar.style.width = '0%'
    }

    playSound('constructionComplete', 1.0, 0, true)

    this.currentBuilding = null
    this.pausedBuilding = false  // Clear pause state when building completes

    // Start next building production if available
    if (this.buildingItems.length > 0) {
      this.startNextBuildingProduction()
    }
  },

  togglePauseUnit: function() {
    if (!this.currentUnit) return

    this.pausedUnit = !this.pausedUnit
    if (this.pausedUnit) {
      this.currentUnit.button.classList.add('paused')
      playSound('constructionPaused', 1.0, 0, true)
    } else {
      this.currentUnit.button.classList.remove('paused')
      playSound('constructionStarted', 1.0, 0, true)
    }
  },

  togglePauseBuilding: function() {
    if (!this.currentBuilding) return

    this.pausedBuilding = !this.pausedBuilding
    if (this.pausedBuilding) {
      this.currentBuilding.button.classList.add('paused')
      playSound('constructionPaused', 1.0, 0, true)
    } else {
      this.currentBuilding.button.classList.remove('paused')
      playSound('constructionStarted', 1.0, 0, true)
    }
  },

  cancelUnitProduction: function() {
    if (!this.currentUnit) return

    const button = this.currentUnit.button
    const type = this.currentUnit.type

    // Play cancel sound before cancelling
    playSound('constructionCancelled', 1.0, 0, true)

    // Return money for the current production (refund only paid amount)
    gameState.money += this.unitPaid || 0

    // Remove item from queue
    this.unitItems.shift()

    // Count remaining items of this type
    const remainingCount = this.unitItems.filter(item => item.button === button).length

    // Update batch counter
    this.updateBatchCounter(button, remainingCount)

    // Reset the progress bar
    const progressBar = button.querySelector('.production-progress')
    if (progressBar) {
      progressBar.style.width = '0%'
    }

    // Clear current production
    this.currentUnit = null
    this.pausedUnit = false

    // Start next item in queue if available
    if (this.unitItems.length > 0) {
      this.startNextUnitProduction()
    }
  },

  cancelBuildingProduction: function() {
    if (!this.currentBuilding) return

    const button = this.currentBuilding.button
    const type = this.currentBuilding.type

    // Play cancel sound before cancelling
    playSound('constructionCancelled', 1.0, 0, true)

    // Return money for the current production (refund only paid amount)
    gameState.money += this.buildingPaid || 0

    // Remove item from queue and blueprint
    this.buildingItems.shift()
    this.removeBlueprint(this.currentBuilding)

    // Count remaining items of this type
    const remainingCount = this.buildingItems.filter(item => item.button === button).length

    // Update batch counter
    this.updateBatchCounter(button, remainingCount)

    // Reset the progress bar
    const progressBar = button.querySelector('.production-progress')
    if (progressBar) {
      progressBar.style.width = '0%'
    }

    // Clear current production
    this.currentBuilding = null
    this.pausedBuilding = false

    // Start next item in queue if available
    if (this.buildingItems.length > 0) {
      this.startNextBuildingProduction()
    }
  },

  // Method to cancel a building placement
  cancelBuildingPlacement: function() {
    // Find the completed building that matches the current placement mode
    const buildingType = gameState.currentBuildingType
    if (!buildingType) return

    const completedBuildingIndex = this.completedBuildings.findIndex(building => building.type === buildingType)
    if (completedBuildingIndex === -1) return

    const completedBuilding = this.completedBuildings[completedBuildingIndex]
    const button = completedBuilding.button
    const type = completedBuilding.type

    // Play cancel sound
    playSound('constructionCancelled', 1.0, 0, true)

    // Return money for the building
    gameState.money += buildingCosts[type] || 0

    // Remove the completed building from the array
    this.completedBuildings.splice(completedBuildingIndex, 1)

    // Clear building placement mode
    gameState.buildingPlacementMode = false
    gameState.currentBuildingType = null

    // Remove ready-for-placement class only if there are no more completed buildings of this type
    const hasMoreOfThisType = this.completedBuildings.some(building => building.button === button)
    if (!hasMoreOfThisType) {
      button.classList.remove('ready-for-placement')
    }

    // Show notification
    showNotification(`${buildingData[type].displayName} construction canceled`)
  },

  // Method to enable building placement mode for a ready building
  enableBuildingPlacementMode: function(buildingType, button) {
    // Find the completed building for this button
    const completedBuilding = this.completedBuildings.find(building => building.button === button)
    if (!completedBuilding) {
      return false
    }

    // Enable placement mode
    gameState.buildingPlacementMode = true
    gameState.currentBuildingType = buildingType

    // Show notification to place building
    showNotification(`Click on the map to place your ${buildingData[buildingType].displayName}`)

    return true
  },

  // Method to exit building placement mode without canceling the building
  exitBuildingPlacementMode: function() {
    if (!gameState.buildingPlacementMode) return

    // Clear building placement mode
    gameState.buildingPlacementMode = false
    gameState.currentBuildingType = null

    // Show notification
    showNotification('Exited placement mode. Click build button again to place.')
  },

  // Resume production after the game is unpaused
  resumeProductionAfterUnpause: function() {
    // If there are items in the unit queue but no current production, start it
    if (this.unitItems.length > 0 && !this.currentUnit && !this.pausedUnit) {
      this.startNextUnitProduction()
    }

    // If there are items in the building queue but no current production, start it
    if (this.buildingItems.length > 0 && !this.currentBuilding && !this.pausedBuilding) {
      this.startNextBuildingProduction()
    }
  },

  // Call this whenever money is added (e.g., after harvesting or selling)
  tryResumeProduction: function() {
    let resumed = false
    // Resume unit production if paused and enough money for next step
    if (this.pausedUnit && this.currentUnit) {
      const item = this.unitItems[0]
      const cost = unitCosts[item.type] || 0
      if (gameState.money > 0 && this.unitPaid < cost) {
        this.pausedUnit = false
        // Adjust startTime so progress resumes smoothly
        this.currentUnit.startTime = performance.now() - this.currentUnit.progress * this.currentUnit.duration / gameState.speedMultiplier
        resumed = true
      }
    }
    // Resume building production if paused and enough money for next step
    if (this.pausedBuilding && this.currentBuilding) {
      const item = this.buildingItems[0]
      const cost = buildingCosts[item.type] || 0
      if (gameState.money > 0 && this.buildingPaid < cost) {
        this.pausedBuilding = false
        this.currentBuilding.startTime = performance.now() - this.currentBuilding.progress * this.currentBuilding.duration / gameState.speedMultiplier
        resumed = true
      }
    }
    // If no current production, try to start next
    if (!this.currentUnit && this.unitItems.length > 0) {
      this.startNextUnitProduction()
      resumed = true
    }
    if (!this.currentBuilding && this.buildingItems.length > 0) {
      this.startNextBuildingProduction()
      resumed = true
    }
    // Force a progress update if anything resumed
    if (resumed) {
      this.updateProgress(performance.now())
    }
  },

  // Method to cancel a specific ready building (called from right-click)
  cancelReadyBuilding: function(buildingType, button) {
    // Clear any lingering pause states that might interfere with cancellation
    if (this.currentBuilding === null) {
      this.pausedBuilding = false
    }
    
    // Find the completed building for this button
    const completedBuildingIndex = this.completedBuildings.findIndex(
      building => building.type === buildingType && building.button === button
    )
    
    if (completedBuildingIndex === -1) return

    const completedBuilding = this.completedBuildings[completedBuildingIndex]

    // Play cancel sound
    playSound('constructionCancelled', 1.0, 0, true)

    // Return money for the building
    gameState.money += buildingCosts[buildingType] || 0

    // Remove the completed building from the array
    this.completedBuildings.splice(completedBuildingIndex, 1)

    // If this building was in placement mode, exit placement mode
    if (
      gameState.buildingPlacementMode &&
      gameState.currentBuildingType === buildingType
    ) {
      gameState.buildingPlacementMode = false
      gameState.currentBuildingType = null
    }

    // Remove ready-for-placement class only if there are no more completed buildings of this type
    const hasMoreOfThisType = this.completedBuildings.some(building => building.button === button)
    if (!hasMoreOfThisType) {
      button.classList.remove('ready-for-placement')
      // Clear progress bar when no more ready buildings of this type
      const progressBar = button.querySelector('.production-progress')
      if (progressBar) {
        progressBar.style.width = '0%'
      }
    }

    // Update ready building counter
    this.updateReadyBuildingCounter(button)

    // Show notification
    showNotification(`${buildingData[buildingType].displayName} construction canceled`)
  },

  // Method to update the ready building counter display
  updateReadyBuildingCounter: function(button) {
    const readyCount = this.completedBuildings.filter(building => building.button === button).length
    
    let readyCounter = button.querySelector('.ready-counter')
    if (!readyCounter) {
      // Create the ready counter element if it doesn't exist
      readyCounter = document.createElement('div')
      readyCounter.classList.add('ready-counter')
      button.appendChild(readyCounter)
    }
    
    if (readyCount > 0) {
      readyCounter.textContent = readyCount
      readyCounter.style.display = 'flex'
    } else {
      readyCounter.style.display = 'none'
    }
  }
}