import { preloadTileTextures } from './rendering.js'
import { preloadBuildingImages } from './buildingImageMap.js'

let texturesLoaded = false
let buildingImagesLoaded = false
let onAllAssetsLoadedCallback = null

function checkAllAssetsLoaded() {
  if (texturesLoaded && buildingImagesLoaded && onAllAssetsLoadedCallback) {
    onAllAssetsLoadedCallback()
  }
}

export function initializeGameAssets(callback) {
  onAllAssetsLoadedCallback = callback

  preloadTileTextures(() => {
    texturesLoaded = true
    checkAllAssetsLoaded()
  })

  preloadBuildingImages(() => {
    buildingImagesLoaded = true
    checkAllAssetsLoaded()
  })
}

// Seeded random generator
function seededRandom(seed) {
  const m = 0x80000000, a = 1103515245, c = 12345
  let state = seed
  return function() {
    state = (a * state + c) % m
    return state / (m - 1)
  }
}

// Helper: Draw a thick line (Bresenham-like)
function drawThickLine(grid, start, end, type, thickness) {
  const dx = end.x - start.x, dy = end.y - start.y
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  for (let j = 0; j <= steps; j++) {
    const x = Math.floor(start.x + (dx * j) / steps)
    const y = Math.floor(start.y + (dy * j) / steps)
    for (let ty = -Math.floor(thickness / 2); ty <= Math.floor(thickness / 2); ty++) {
      for (let tx = -Math.floor(thickness / 2); tx <= Math.floor(thickness / 2); tx++) {
        const nx = x + tx, ny = y + ty
        if (nx >= 0 && ny >= 0 && nx < grid[0].length && ny < grid.length) {
          grid[ny][nx].type = type
        }
      }
    }
  }
}

// Generate a new map using the given seed and organic features
export function generateMap(seed, mapGrid, MAP_TILES_X, MAP_TILES_Y) {
  const rand = seededRandom(parseInt(seed))
  // Clear any old content
  mapGrid.length = 0
  for (let y = 0; y < MAP_TILES_Y; y++) {
    mapGrid[y] = []
    for (let x = 0; x < MAP_TILES_X; x++) {
      // Initially all land
      mapGrid[y][x] = { type: 'land' }
    }
  }
  // -------- Step 0: Generate Ore Fields --------
  const oreClusterCount = 6
  const oreClusters = []
  for (let i = 0; i < oreClusterCount; i++) {
    const clusterCenterX = Math.floor(rand() * MAP_TILES_X)
    const clusterCenterY = Math.floor(rand() * MAP_TILES_Y)
    oreClusters.push({ x: clusterCenterX, y: clusterCenterY })
    const clusterRadius = Math.floor(rand() * 3) + 5 // radius between 5 and 7
    for (let y = Math.max(0, clusterCenterY - clusterRadius); y < Math.min(MAP_TILES_Y, clusterCenterY + clusterRadius); y++) {
      for (let x = Math.max(0, clusterCenterX - clusterRadius); x < Math.min(MAP_TILES_X, clusterCenterX + clusterRadius); x++) {
        const dx = x - clusterCenterX, dy = y - clusterCenterY
        if (Math.hypot(dx, dy) < clusterRadius && rand() < 0.9) {
          mapGrid[y][x].type = 'ore'
        }
      }
    }
  }

  // -------- Step 1: Generate Mountain Chains (Rock Clusters) --------
  const rockClusterCount = 9
  const rockClusters = []
  for (let i = 0; i < rockClusterCount; i++) {
    const clusterCenterX = Math.floor(rand() * MAP_TILES_X)
    const clusterCenterY = Math.floor(rand() * MAP_TILES_Y)
    rockClusters.push({ x: clusterCenterX, y: clusterCenterY })
    const clusterRadius = Math.floor(rand() * 3) + 2 // radius between 2 and 4
    for (let y = Math.max(0, clusterCenterY - clusterRadius); y < Math.min(MAP_TILES_Y, clusterCenterY + clusterRadius); y++) {
      for (let x = Math.max(0, clusterCenterX - clusterRadius); x < Math.min(MAP_TILES_X, clusterCenterX + clusterRadius); x++) {
        const dx = x - clusterCenterX, dy = y - clusterCenterY
        if (Math.hypot(dx, dy) < clusterRadius && rand() < 0.8) {
          mapGrid[y][x].type = 'rock'
        }
      }
    }
  }
  // Connect rock clusters in sequence (mountain chains)
  for (let i = 0; i < rockClusters.length - 1; i++) {
    drawThickLine(mapGrid, rockClusters[i], rockClusters[i + 1], 'rock', 2)
  }

  // -------- Step 2: Generate Lakes and Rivers --------
  const lakeCount = 2
  const lakeCenters = []
  for (let i = 0; i < lakeCount; i++) {
    const centerX = Math.floor(rand() * MAP_TILES_X)
    const centerY = Math.floor(rand() * MAP_TILES_Y)
    lakeCenters.push({ x: centerX, y: centerY })
    const radius = Math.floor(rand() * 4) + 4 // radius between 4 and 7
    for (let y = Math.max(0, centerY - radius); y < Math.min(MAP_TILES_Y, centerY + radius); y++) {
      for (let x = Math.max(0, centerX - radius); x < Math.min(MAP_TILES_X, centerX + radius); x++) {
        const dx = x - centerX, dy = y - centerY
        if (Math.hypot(dx, dy) < radius) {
          mapGrid[y][x].type = 'water'
        }
      }
    }
  }
  // Connect lakes with a river
  if (lakeCenters.length === 2) {
    const startLake = lakeCenters[0]
    const endLake = lakeCenters[1]
    const steps = Math.max(Math.abs(endLake.x - startLake.x), Math.abs(endLake.y - startLake.y))
    for (let j = 0; j <= steps; j++) {
      const x = Math.floor(startLake.x + ((endLake.x - startLake.x) * j) / steps)
      const y = Math.floor(startLake.y + ((endLake.y - startLake.y) * j) / steps)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < MAP_TILES_X && ny < MAP_TILES_Y) {
            if (rand() < 0.8) {
              mapGrid[ny][nx].type = 'water'
            }
          }
        }
      }
    }
    // Ensure at least one street crosses the river (midpoint)
    const riverMidX = Math.floor((startLake.x + endLake.x) / 2)
    const riverMidY = Math.floor((startLake.y + endLake.y) / 2)
    mapGrid[riverMidY][riverMidX].type = 'street'
  }

  // -------- Step 3: Generate Streets --------
  const playerFactoryPos = { x: Math.floor(MAP_TILES_X * 0.1), y: Math.floor(MAP_TILES_Y * 0.9) }
  const enemyFactoryPos = { x: Math.floor(MAP_TILES_X * 0.9), y: Math.floor(MAP_TILES_Y * 0.1) }

  // Connect ore fields to player factory
  oreClusters.forEach(cluster => {
    drawThickLine(mapGrid, playerFactoryPos, cluster, 'street', 2)
  })
  // Connect the two bases
  drawThickLine(mapGrid, playerFactoryPos, enemyFactoryPos, 'street', 2)

  // Existing base connectivity for redundancy
  const dxx = enemyFactoryPos.x - playerFactoryPos.x
  const dyy = enemyFactoryPos.y - playerFactoryPos.y
  const connectSteps = Math.max(Math.abs(dxx), Math.abs(dyy))
  for (let j = 0; j <= connectSteps; j++) {
    const x = Math.floor(playerFactoryPos.x + (dxx * j) / connectSteps)
    const y = Math.floor(playerFactoryPos.y + (dyy * j) / connectSteps)
    if (x >= 0 && y >= 0 && x < MAP_TILES_X && y < MAP_TILES_Y) {
      mapGrid[y][x].type = 'street'
      if (x + 1 < MAP_TILES_X) { mapGrid[y][x + 1].type = 'street' }
      if (y + 1 < MAP_TILES_Y) { mapGrid[y + 1][x].type = 'street' }
    }
  }
}
