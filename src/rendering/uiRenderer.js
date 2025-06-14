// rendering/uiRenderer.js
import { TILE_SIZE } from '../config.js'
import { buildingData, isTileValid, isNearExistingBuilding } from '../buildings.js'

export class UIRenderer {
  constructor() {
    this.gameOverEventListenerAdded = false
  }
  renderSelectionRectangle(ctx, selectionActive, selectionStart, selectionEnd, scrollOffset) {
    // Draw selection rectangle if active.
    if (selectionActive && selectionStart && selectionEnd) {
      const rectX = Math.min(selectionStart.x, selectionEnd.x) - scrollOffset.x
      const rectY = Math.min(selectionStart.y, selectionEnd.y) - scrollOffset.y
      const rectWidth = Math.abs(selectionEnd.x - selectionStart.x)
      const rectHeight = Math.abs(selectionEnd.y - selectionStart.y)
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 2
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    }
  }

  renderRallyPoints(ctx, factories, scrollOffset) {
    // Draw rally point flag if any factory has one
    factories.forEach(factory => {
      if (factory.rallyPoint && factory.id === 'player') {
        const flagX = factory.rallyPoint.x * TILE_SIZE - scrollOffset.x
        const flagY = factory.rallyPoint.y * TILE_SIZE - scrollOffset.y

        // Draw flag pole
        ctx.strokeStyle = '#8B4513' // Brown color for pole
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(flagX + TILE_SIZE / 2, flagY + TILE_SIZE)
        ctx.lineTo(flagX + TILE_SIZE / 2, flagY)
        ctx.stroke()

        // Draw triangular flag
        ctx.fillStyle = '#FFFF00' // Yellow flag
        ctx.beginPath()
        ctx.moveTo(flagX + TILE_SIZE / 2, flagY)
        ctx.lineTo(flagX + TILE_SIZE, flagY + TILE_SIZE / 3)
        ctx.lineTo(flagX + TILE_SIZE / 2, flagY + TILE_SIZE / 2)
        ctx.closePath()
        ctx.fill()

        // Draw outline around the rally point tile
        ctx.strokeStyle = '#FFFF00'
        ctx.lineWidth = 1
        ctx.strokeRect(flagX, flagY, TILE_SIZE, TILE_SIZE)
      }
    })
  }

  renderBuildingPlacement(ctx, gameState, scrollOffset, buildings, factories, mapGrid, units) {
    // Draw building placement overlay if in placement mode
    if (gameState.buildingPlacementMode && gameState.currentBuildingType) {
      const buildingInfo = buildingData[gameState.currentBuildingType]

      if (buildingInfo) {
        const mouseX = gameState.cursorX
        const mouseY = gameState.cursorY

        // Get tile position based on mouse coordinates
        const tileX = Math.floor(mouseX / TILE_SIZE)
        const tileY = Math.floor(mouseY / TILE_SIZE)

        // Check if any tile is in range of existing building
        let isAnyTileInRange = false
        for (let y = 0; y < buildingInfo.height; y++) {
          for (let x = 0; x < buildingInfo.width; x++) {
            const currentTileX = tileX + x
            const currentTileY = tileY + y

            if (isNearExistingBuilding(currentTileX, currentTileY, buildings, factories)) {
              isAnyTileInRange = true
              break
            }
          }
          if (isAnyTileInRange) break
        }

        // Draw placement grid
        for (let y = 0; y < buildingInfo.height; y++) {
          for (let x = 0; x < buildingInfo.width; x++) {
            const currentTileX = tileX + x
            const currentTileY = tileY + y

            // Calculate screen coordinates
            const screenX = currentTileX * TILE_SIZE - scrollOffset.x
            const screenY = currentTileY * TILE_SIZE - scrollOffset.y

            // Check if valid placement for this tile (terrain/units check only)
            const isValid = isTileValid(currentTileX, currentTileY, mapGrid, units, buildings, factories)

            // Determine final color: Red if not valid or not in range, Green if both valid and in range
            const validColor = isAnyTileInRange ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'
            ctx.fillStyle = isValid ? validColor : 'rgba(255, 0, 0, 0.5)'
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)

            // Draw tile outline
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
          }
        }

        // Draw building name above cursor
        ctx.fillStyle = '#fff'
        ctx.font = '14px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(
          buildingInfo.displayName,
          tileX * TILE_SIZE + (buildingInfo.width * TILE_SIZE / 2) - scrollOffset.x,
          tileY * TILE_SIZE - 10 - scrollOffset.y
        )
      }
    }
  }

  renderGameOver(ctx, gameCanvas, gameState) {
    // If game over, render win/lose overlay and stop drawing further
    if (gameState?.gameOver && gameState?.gameOverMessage) {
      // Use logical CSS dimensions for proper centering, not physical pixel dimensions
      const logicalWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
      const logicalHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight
      const messageX = logicalWidth / 2
      const messageY = logicalHeight / 2
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, logicalWidth, logicalHeight)

      // Render game over message
      ctx.font = 'bold 32px Arial'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText(gameState.gameOverMessage, messageX, messageY - 100)

      // Render statistics
      ctx.font = '20px Arial'
      ctx.fillText(`Player Units Destroyed: ${gameState.playerUnitsDestroyed}`, messageX, messageY - 50)
      ctx.fillText(`Enemy Units Destroyed: ${gameState.enemyUnitsDestroyed}`, messageX, messageY - 20)
      ctx.fillText(`Player Buildings Destroyed: ${gameState.playerBuildingsDestroyed}`, messageX, messageY + 10)
      ctx.fillText(`Enemy Buildings Destroyed: ${gameState.enemyBuildingsDestroyed}`, messageX, messageY + 40)
      ctx.fillText(`Total Money Earned: $${gameState.totalMoneyEarned}`, messageX, messageY + 70)

      // Render reset button
      ctx.fillStyle = '#FF0000'
      ctx.fillRect(messageX - 75, messageY + 100, 150, 40)
      ctx.font = 'bold 20px Arial'
      ctx.fillStyle = '#FFFFFF'
      ctx.fillText('Reset Game', messageX, messageY + 130)

      // Handle reset button click - only add listener once
      if (!this.gameOverEventListenerAdded) {
        this.gameOverClickHandler = (event) => {
          const rect = gameCanvas.getBoundingClientRect()
          const clickX = event.clientX - rect.left
          const clickY = event.clientY - rect.top

          // Recalculate button bounds since messageX/Y might have changed
          const currentLogicalWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250)
          const currentLogicalHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight
          const currentMessageX = currentLogicalWidth / 2
          const currentMessageY = currentLogicalHeight / 2

          // Check if click is within reset button bounds (using logical coordinates)
          if (
            clickX >= currentMessageX - 75 &&
            clickX <= currentMessageX + 75 &&
            clickY >= currentMessageY + 100 &&
            clickY <= currentMessageY + 140
          ) {
            // Reset the game instead of reloading the page
            (async () => {
              try {
                const module = await import('../main.js')
                const gameInstance = module.getCurrentGame()
                
                if (gameInstance && typeof gameInstance.resetGame === 'function') {
                  await gameInstance.resetGame()
                  // Import and show notification
                  try {
                    const notifModule = await import('../ui/notifications.js')
                    notifModule.showNotification('Game restarted while preserving win/loss statistics')
                  } catch (err) {
                    console.warn('Could not show notification:', err)
                  }
                } else {
                  console.warn('Game instance not found or resetGame method missing, falling back to page reload')
                  window.location.reload()
                }
              } catch (err) {
                console.error('Could not import game instance, falling back to page reload:', err)
                window.location.reload()
              }
            })()
          }
        }
        
        gameCanvas.addEventListener('click', this.gameOverClickHandler)
        this.gameOverEventListenerAdded = true
      }

      return true // Signal that game over was rendered
    } else {
      // Game is not over, remove event listener if it was added
      if (this.gameOverEventListenerAdded) {
        gameCanvas.removeEventListener('click', this.gameOverClickHandler)
        this.gameOverEventListenerAdded = false
        this.gameOverClickHandler = null
      }
    }
    return false
  }

  render(ctx, gameCanvas, gameState, selectionActive, selectionStart, selectionEnd, scrollOffset, factories, buildings, mapGrid, units) {
    // Check for game over first
    if (this.renderGameOver(ctx, gameCanvas, gameState)) {
      return // Stop rendering if game is over
    }

    this.renderSelectionRectangle(ctx, selectionActive, selectionStart, selectionEnd, scrollOffset)
    this.renderRallyPoints(ctx, factories, scrollOffset)
    this.renderBuildingPlacement(ctx, gameState, scrollOffset, buildings, factories, mapGrid, units)
  }
}
