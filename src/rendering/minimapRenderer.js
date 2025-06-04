// rendering/minimapRenderer.js
import { TILE_SIZE, TILE_COLORS } from '../config.js'
import { videoOverlay } from '../ui/videoOverlay.js'

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

    // Check if there's a video overlay playing
    if (videoOverlay.isVideoPlaying()) {
      // Render video overlay over the minimap
      this.renderVideoOverlay(minimapCtx, minimapLogicalWidth, minimapLogicalHeight)
      return // Skip normal minimap rendering while video is playing
    }

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

  /**
   * Render video overlay directly on the minimap canvas
   */
  renderVideoOverlay(minimapCtx, minimapWidth, minimapHeight) {
    // Get the current video element from the overlay
    const videoElement = videoOverlay.getCurrentVideo()
    
    if (!videoElement || videoElement.readyState < 2) {
      // Video not ready, show loading state
      minimapCtx.fillStyle = '#000'
      minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight)
      
      minimapCtx.fillStyle = '#00ff00'
      minimapCtx.font = '14px Arial'
      minimapCtx.textAlign = 'center'
      minimapCtx.fillText('Loading...', minimapWidth / 2, minimapHeight / 2)
      return
    }

    // Calculate video dimensions maintaining aspect ratio
    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight
    const minimapAspectRatio = minimapWidth / minimapHeight
    
    let renderWidth, renderHeight, offsetX, offsetY
    
    if (videoAspectRatio > minimapAspectRatio) {
      // Video is wider, fit to width
      renderWidth = minimapWidth
      renderHeight = minimapWidth / videoAspectRatio
      offsetX = 0
      offsetY = (minimapHeight - renderHeight) / 2
    } else {
      // Video is taller or same ratio, fit to height
      renderHeight = minimapHeight
      renderWidth = minimapHeight * videoAspectRatio
      offsetX = (minimapWidth - renderWidth) / 2
      offsetY = 0
    }

    // Clear the minimap area
    minimapCtx.fillStyle = '#000'
    minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight)

    // Draw the video frame
    try {
      minimapCtx.drawImage(
        videoElement,
        offsetX,
        offsetY,
        renderWidth,
        renderHeight
      )
    } catch (error) {
      console.warn('Failed to draw video frame:', error)
      // Fallback to loading text
      minimapCtx.fillStyle = '#ff0000'
      minimapCtx.font = '12px Arial'
      minimapCtx.textAlign = 'center'
      minimapCtx.fillText('Video Error', minimapWidth / 2, minimapHeight / 2)
    }

    // Add a border to indicate video mode
    minimapCtx.strokeStyle = '#00ff00'
    minimapCtx.lineWidth = 2
    minimapCtx.strokeRect(1, 1, minimapWidth - 2, minimapHeight - 2)

    // Add video progress indicator
    const progress = videoOverlay.getVideoProgress()
    if (progress >= 0) {
      const progressBarHeight = 3
      const progressBarY = minimapHeight - progressBarHeight - 2
      
      // Progress background
      minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      minimapCtx.fillRect(2, progressBarY, minimapWidth - 4, progressBarHeight)
      
      // Progress bar
      minimapCtx.fillStyle = '#00ff00'
      minimapCtx.fillRect(2, progressBarY, (minimapWidth - 4) * progress, progressBarHeight)
    }
  }
}
