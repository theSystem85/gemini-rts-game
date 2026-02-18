import { TILE_SIZE } from './config.js'
import { calculateRepairCost } from './buildings.js'
import { playSound } from './sound.js'
import { showNotification } from './ui/notifications.js'
import { updateMoneyBar } from './ui/moneyBar.js'

export function buildingRepairHandler(e, gameState, gameCanvas) {
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

        // Walls cannot be repaired
        if (building.type === 'concreteWall') {
          showNotification('Concrete walls cannot be repaired.')
          return
        }

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
          playSound('repairCancelled', 1.0, 0, true)
          // Update money display
          if (typeof updateMoneyBar === 'function') {
            updateMoneyBar()
          }
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
            isFactory: false,
            initiatedByAI: false
          })

          showNotification(`Building repair pending - waiting ${Math.ceil(10 - timeSinceLastAttack)}s for attack cooldown`)
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
          isFactory: false,
          initiatedByAI: false
        })

        showNotification('Building repair initiated')
        return
      }
    }

    showNotification('No player building found to repair.')
    return
  }
}
