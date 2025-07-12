import { TILE_SIZE } from './config.js'
import { canPlaceBuilding, createBuilding, placeBuilding, updatePowerSupply, calculateRepairCost, repairBuilding } from './buildings.js'
import { playSound } from './sound.js'
import { showNotification } from './ui/notifications.js'
import { buildingData } from './buildings.js'
import { savePlayerBuildPatterns } from './savePlayerBuildPatterns.js'

export function buildingRepairHandler(e, gameState, gameCanvas, mapGrid, units, factories, productionQueue, moneyEl) {
  // If repair mode is active, check for buildings and factories to repair
  if (gameState.repairMode) {
    const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
    const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

    // Convert to tile coordinates
    const tileX = Math.floor(mouseX / TILE_SIZE)
    const tileY = Math.floor(mouseY / TILE_SIZE)

    // Factory is treated like any other building, so skip special handling

    // Then check player buildings
    for (const building of gameState.buildings) {
      if (building.owner === gameState.humanPlayer &&
            tileX >= building.x && tileX < (building.x + building.width) &&
            tileY >= building.y && tileY < (building.y + building.height)) {

        // Skip if building is at full health
        if (building.health >= building.maxHealth) {
          showNotification('Building is already at full health.')
          return
        }

        // If building already under repair, cancel it
        const existing = gameState.buildingsUnderRepair?.find(r => r.building === building)
        if (existing) {
          const refund = existing.cost - existing.costPaid
          gameState.money += refund
          gameState.buildingsUnderRepair = gameState.buildingsUnderRepair.filter(r => r !== existing)
          showNotification('Building repair cancelled')
          playSound('constructionCancelled', 1.0, 0, true)
          moneyEl.textContent = gameState.money
          return
        }

        // Calculate repair cost
        const repairCost = calculateRepairCost(building)

        // Check if building was attacked recently (within 10 seconds)
        const now = performance.now()
        const timeSinceLastAttack = building.lastAttackedTime ? (now - building.lastAttackedTime) / 1000 : Infinity
        
        if (timeSinceLastAttack < 10) {
          // Building is under attack - enable repair mode but don't start repair yet
          // Play the sound immediately
          playSound('Repair_impossible_when_under_attack', 1.0, 30, true)
          
          // Set up delayed repair with countdown
          if (!gameState.buildingsAwaitingRepair) {
            gameState.buildingsAwaitingRepair = []
          }
          
          // Check if this building is already waiting for repair
          const existingAwaitingRepair = gameState.buildingsAwaitingRepair.find(ar => ar.building === building)
          if (existingAwaitingRepair) {
            showNotification('Building repair already pending - waiting for attack cooldown')
            return
          }
          
          // Add to awaiting repair list
          gameState.buildingsAwaitingRepair.push({
            building: building,
            repairCost: repairCost,
            healthToRepair: building.maxHealth - building.health,
            lastAttackedTime: building.lastAttackedTime,
            isFactory: false
          })
          
          showNotification(`Building repair pending - waiting ${Math.ceil(10 - timeSinceLastAttack)}s for attack cooldown`)
          return
        }

        // Check if player has enough money
        if (gameState.money < repairCost) {
          showNotification(`Not enough money for repairs. Cost: $${repairCost}`)
          return
        }

        // Always use awaiting repair system, even if not under attack
        // This ensures consistent behavior and allows for immediate start if no cooldown
        if (!gameState.buildingsAwaitingRepair) {
          gameState.buildingsAwaitingRepair = []
        }
        
        // Check if this building is already waiting for repair
        const existingAwaitingRepair = gameState.buildingsAwaitingRepair.find(ar => ar.building === building)
        if (existingAwaitingRepair) {
          showNotification('Building repair already pending')
          return
        }
        
        // Add to awaiting repair list (will start immediately in next update if no cooldown)
        gameState.buildingsAwaitingRepair.push({
          building: building,
          repairCost: repairCost,
          healthToRepair: building.maxHealth - building.health,
          lastAttackedTime: building.lastAttackedTime || 0,
          isFactory: false
        })
        
        showNotification('Building repair initiated')
        return
      }
    }

    showNotification('No player building found to repair.')
    return
  }

  if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
    const mouseX = e.clientX - gameCanvas.getBoundingClientRect().left + gameState.scrollOffset.x
    const mouseY = e.clientY - gameCanvas.getBoundingClientRect().top + gameState.scrollOffset.y

    // Convert to tile coordinates
    const tileX = Math.floor(mouseX / TILE_SIZE)
    const tileY = Math.floor(mouseY / TILE_SIZE)

    // Get building data
    const buildingType = gameState.currentBuildingType

    try {
      // Check if placement is valid - pass buildings and factories arrays
      if (canPlaceBuilding(buildingType, tileX, tileY, mapGrid, units, gameState.buildings, factories, gameState.humanPlayer)) {
        // Create and place the building
        const newBuilding = createBuilding(buildingType, tileX, tileY)

        // Add owner property to the building
        newBuilding.owner = gameState.humanPlayer

        // Add the building to gameState.buildings
        if (!gameState.buildings) {
          gameState.buildings = []
        }
        gameState.buildings.push(newBuilding)

        // Mark building tiles in the map grid
        placeBuilding(newBuilding, mapGrid)

        // Update power supply
        updatePowerSupply(gameState.buildings, gameState)

        // Exit placement mode
        gameState.buildingPlacementMode = false
        gameState.currentBuildingType = null

        // Remove ready-for-placement class from the button
        document.querySelectorAll('.ready-for-placement').forEach(button => {
          button.classList.remove('ready-for-placement')
        })

        // Remove the placed building from the completed buildings array
        const completedBuildingIndex = productionQueue.completedBuildings.findIndex(
          building => building.type === buildingType
        )
        let placedBuildingButton = null
        if (completedBuildingIndex !== -1) {
          placedBuildingButton = productionQueue.completedBuildings[completedBuildingIndex].button
          productionQueue.completedBuildings.splice(completedBuildingIndex, 1)
        }

        // Update the ready counter for the button that had a building placed
        if (placedBuildingButton) {
          productionQueue.updateReadyBuildingCounter(placedBuildingButton)
        }

        // Restore ready-for-placement class for buttons that still have completed buildings
        productionQueue.completedBuildings.forEach(building => {
          if (!building.button.classList.contains('ready-for-placement')) {
            building.button.classList.add('ready-for-placement')
          }
          // Update ready building counter for remaining buildings
          productionQueue.updateReadyBuildingCounter(building.button)
        })

        // Play placement sound
        playSound('buildingPlaced')

        // Show notification
        showNotification(`${buildingData[buildingType].displayName} constructed`)

        // Save player building patterns
        savePlayerBuildPatterns(buildingType)
      } else {
        // Play error sound for invalid placement
        playSound('construction_obstructed', 1.0, 0, true)
      }
    } catch (error) {
      console.error('Error during building placement:', error)
      showNotification('Error placing building: ' + error.message, 5000)
      playSound('error')
    }
  }
}
