import { buildingData } from '../buildings.js'

const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

export function makeTileKey(x, y) {
  return `${x},${y}`
}

function addStructureFootprint(structure, footprint, bounds) {
  if (!structure || typeof structure.x !== 'number' || typeof structure.y !== 'number') {
    return
  }

  const width = Math.max(1, Math.round(structure.width || buildingData[structure.type]?.width || 1))
  const height = Math.max(1, Math.round(structure.height || buildingData[structure.type]?.height || 1))

  for (let y = structure.y; y < structure.y + height; y++) {
    for (let x = structure.x; x < structure.x + width; x++) {
      footprint.add(makeTileKey(x, y))
      if (x < bounds.minX) bounds.minX = x
      if (y < bounds.minY) bounds.minY = y
      if (x > bounds.maxX) bounds.maxX = x
      if (y > bounds.maxY) bounds.maxY = y
    }
  }
}

function isStructureAlive(structure) {
  if (!structure) return false
  if (typeof structure.health === 'number') {
    return structure.health > 0
  }
  return true
}

function structureMatchesOwner(structure, ownerId) {
  if (!structure) return false
  const structureOwner = structure.owner || structure.id
  return structureOwner === ownerId
}

export function getBaseLayout(ownerId, buildings = [], factories = []) {
  const footprint = new Set()
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  if (!ownerId) {
    return { footprint, bounds: null }
  }

  const addStructures = (collection = []) => {
    for (const structure of collection) {
      if (!structureMatchesOwner(structure, ownerId)) continue
      if (!isStructureAlive(structure)) continue
      addStructureFootprint(structure, footprint, bounds)
    }
  }

  addStructures(buildings)
  addStructures(factories)

  if (footprint.size === 0) {
    return { footprint, bounds: null }
  }

  return { footprint, bounds }
}

export function getBaseBounds(ownerId, buildings = [], factories = []) {
  return getBaseLayout(ownerId, buildings, factories).bounds
}

export function getBaseFootprint(ownerId, buildings = [], factories = []) {
  return getBaseLayout(ownerId, buildings, factories).footprint
}

export function getBaseFrontierTiles(ownerId, buildings = [], factories = [], mapGrid = null, baseLayout = null) {
  const layout = baseLayout || getBaseLayout(ownerId, buildings, factories)
  const footprint = layout.footprint
  if (!footprint || footprint.size === 0) {
    return []
  }

  const frontier = new Set()
  const mapHeight = Array.isArray(mapGrid) ? mapGrid.length : 0
  const mapWidth = mapHeight > 0 ? mapGrid[0]?.length || 0 : 0
  const hasBounds = mapWidth > 0 && mapHeight > 0

  footprint.forEach(key => {
    const [xStr, yStr] = key.split(',')
    const x = Number(xStr)
    const y = Number(yStr)

    for (const [dx, dy] of directions) {
      const nx = x + dx
      const ny = y + dy
      if (hasBounds) {
        if (nx < 0 || ny < 0 || ny >= mapHeight || nx >= mapWidth) {
          continue
        }
      }
      const neighborKey = makeTileKey(nx, ny)
      if (!footprint.has(neighborKey)) {
        frontier.add(neighborKey)
      }
    }
  })

  return Array.from(frontier).map(key => {
    const [xStr, yStr] = key.split(',')
    return { x: Number(xStr), y: Number(yStr) }
  })
}
