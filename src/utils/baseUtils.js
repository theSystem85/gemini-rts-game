import { MAX_BUILDING_GAP_TILES } from '../config.js'
import { gameState } from '../gameState.js'

function normalizeStructures(structures) {
  return structures.filter(Boolean).map(structure => ({
    x: structure.x || 0,
    y: structure.y || 0,
    width: structure.width || 1,
    height: structure.height || 1
  }))
}

export function getBaseStructures(owner, {
  buildings = gameState.buildings,
  factories = gameState.factories
} = {}) {
  const baseStructures = []

  if (Array.isArray(factories)) {
    factories.forEach(factory => {
      const factoryOwner = factory?.owner ?? factory?.id
      if (factoryOwner !== owner) return
      baseStructures.push({
        x: factory.x || 0,
        y: factory.y || 0,
        width: factory.width || 1,
        height: factory.height || 1
      })
    })
  }

  if (Array.isArray(buildings)) {
    buildings.forEach(building => {
      if (!building || building.owner !== owner) return

      baseStructures.push({
        x: building.x || 0,
        y: building.y || 0,
        width: building.width || 1,
        height: building.height || 1
      })
    })
  }

  return normalizeStructures(baseStructures)
}

export function isWithinBaseRange(tileX, tileY, owner, {
  buildings = gameState.buildings,
  factories = gameState.factories,
  maxDistance = MAX_BUILDING_GAP_TILES
} = {}) {
  const structures = getBaseStructures(owner, { buildings, factories })
  if (structures.length === 0) {
    return true
  }

  return structures.some(structure => {
    const width = structure.width || 1
    const height = structure.height || 1

    for (let y = structure.y; y < structure.y + height; y++) {
      for (let x = structure.x; x < structure.x + width; x++) {
        const distance = Math.max(Math.abs(tileX - x), Math.abs(tileY - y))
        if (distance <= maxDistance) {
          return true
        }
      }
    }

    return false
  })
}
