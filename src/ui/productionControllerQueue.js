import { productionQueue } from '../productionQueue.js'

export function getUnitProductionCount(_controller, button) {
  if (!button) return 0

  let count = productionQueue.unitItems.filter(item => item.button === button).length
  if (productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
    count += 1
  }

  return count
}

export function removeQueuedUnit(controller, button) {
  if (!button) return false

  for (let i = productionQueue.unitItems.length - 1; i >= 0; i--) {
    const queued = productionQueue.unitItems[i]
    if (queued.button === button) {
      if (i === 0 && productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
        productionQueue.cancelUnitProduction()
      } else {
        productionQueue.tryResumeProduction()
        productionQueue.unitItems.splice(i, 1)
      }

      productionQueue.updateBatchCounter(button, controller.getUnitProductionCount(button))
      return true
    }
  }

  if (productionQueue.currentUnit && productionQueue.currentUnit.button === button) {
    productionQueue.cancelUnitProduction()
    productionQueue.updateBatchCounter(button, controller.getUnitProductionCount(button))
    return true
  }

  return false
}

export function getBuildingProductionCount(_controller, button) {
  if (!button) return 0

  let count = productionQueue.buildingItems.filter(item => item.button === button).length
  if (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
    count += 1
  }

  return count
}

export function removeQueuedBuilding(controller, button) {
  if (!button) return false

  for (let i = productionQueue.buildingItems.length - 1; i >= 0; i--) {
    const queued = productionQueue.buildingItems[i]
    if (queued.button === button) {
      if (i === 0 && productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
        productionQueue.cancelBuildingProduction()
      } else {
        productionQueue.tryResumeProduction()
        productionQueue.buildingItems.splice(i, 1)
        productionQueue.removeBlueprint(queued)
      }

      productionQueue.updateBatchCounter(button, controller.getBuildingProductionCount(button))
      return true
    }
  }

  if (productionQueue.currentBuilding && productionQueue.currentBuilding.button === button) {
    productionQueue.cancelBuildingProduction()
    productionQueue.updateBatchCounter(button, controller.getBuildingProductionCount(button))
    return true
  }

  if (button.classList.contains('ready-for-placement')) {
    const buildingType = button.getAttribute('data-building-type')
    productionQueue.cancelReadyBuilding(buildingType, button)
    productionQueue.updateBatchCounter(button, controller.getBuildingProductionCount(button))
    return true
  }

  return false
}
