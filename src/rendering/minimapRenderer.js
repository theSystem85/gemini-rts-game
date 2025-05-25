// rendering/minimapRenderer.js
import { TILE_SIZE, TILE_COLORS } from '../config.js'

export class MinimapRenderer {
  render(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units, buildings, gameState) {
    // Get the pixel ratio and CSS dimensions
    const pixelRatio = window.devicePixelRatio || 1

    // Clear the entire canvas with proper scaling
    minimapCtx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)

    // Use logical/CSS dimensions for calculations
    const minimapLogicalWidth = parseInt(minimapCanvas.style.width, 10) || 250
    const minimapLogicalHeight = parseInt(minimapCanvas.style.height, 10) || 150

    // Calculate scale based on logical dimensions
    const scaleX = minimapLogicalWidth / (mapGrid[0].length * TILE_SIZE)
    const scaleY = minimapLogicalHeight / (mapGrid.length * TILE_SIZE)

    // Apply pixel ratio scaling
    minimapCtx.scale(pixelRatio, pixelRatio)

    // Modified: Check if radar is active instead of lowEnergyMode to determine visibility
    // Only draw the minimap if we have radar capability
    if (gameState && gameState.radarActive === false) {
      // If radar is disabled, draw a static/noise pattern instead of the actual map
      minimapCtx.fillStyle = '#333'
      minimapCtx.fillRect(0, 0, minimapLogicalWidth, minimapLogicalHeight)

      // Draw "No signal" text
      minimapCtx.fillStyle = '#f00'
      minimapCtx.font = '16px Arial'
      minimapCtx.textAlign = 'center'
      minimapCtx.fillText('RADAR OFFLINE', minimapLogicalWidth / 2, minimapLogicalHeight / 2)

      // Draw some static noise pattern
      for (let i = 0; i < 300; i++) {
        const x = Math.random() * minimapLogicalWidth
        const y = Math.random() * minimapLogicalHeight
        const size = Math.random() * 3 + 1
        minimapCtx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`
        minimapCtx.fillRect(x, y, size, size)
      }

      return // Skip the rest of the rendering
    }

    // Draw map tiles
    for (let y = 0; y < mapGrid.length; y++) {
      for (let x = 0; x < mapGrid[0].length; x++) {
        // For minimap, always use color for simplicity and performance
        minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type]
        minimapCtx.fillRect(
          x * TILE_SIZE * scaleX,
          y * TILE_SIZE * scaleY,
          TILE_SIZE * scaleX,
          TILE_SIZE * scaleY
        )
      }
    }

    // Draw units
    units.forEach(unit => {
      minimapCtx.fillStyle = unit.owner === 'player' ? '#00F' : '#F00'
      const unitX = (unit.x + TILE_SIZE / 2) * scaleX
      const unitY = (unit.y + TILE_SIZE / 2) * scaleY
      minimapCtx.beginPath()
      minimapCtx.arc(unitX, unitY, 3, 0, 2 * Math.PI)
      minimapCtx.fill()
    })

    // Draw buildings if they exist
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        // Use different colors for player vs enemy buildings
        minimapCtx.fillStyle = building.owner === 'player' ? '#0A0' : '#A00'
        minimapCtx.fillRect(
          building.x * TILE_SIZE * scaleX,
          building.y * TILE_SIZE * scaleY,
          building.width * TILE_SIZE * scaleX,
          building.height * TILE_SIZE * scaleY
        )
      })
    }

    // Get logical canvas dimensions for viewport calculation
    const gameLogicalWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
    const gameLogicalHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight

    // Draw viewport border
    minimapCtx.strokeStyle = '#FF0'
    minimapCtx.lineWidth = 2
    minimapCtx.strokeRect(
      scrollOffset.x * scaleX,
      scrollOffset.y * scaleY,
      gameLogicalWidth * scaleX,
      gameLogicalHeight * scaleY
    )
  }
}
