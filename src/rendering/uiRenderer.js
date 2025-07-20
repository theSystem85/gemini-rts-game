// rendering/uiRenderer.js
import { TILE_SIZE } from '../config.js'
import { buildingData, isTileValid, canPlaceBuilding } from '../buildings.js'
import { gameState } from '../gameState.js'
import { showNotification } from '../ui/notifications.js'
import { getCurrentGame } from '../main.js'

export class UIRenderer {
  constructor() {
    this.gameOverEventListenerAdded = false
  }
  renderSelectionRectangle(ctx, selectionActive, selectionStart, selectionEnd, scrollOffset) {
    // Draw normal selection rectangle if active
    if (selectionActive && selectionStart && selectionEnd) {
      const rectX = Math.min(selectionStart.x, selectionEnd.x) - scrollOffset.x
      const rectY = Math.min(selectionStart.y, selectionEnd.y) - scrollOffset.y
      const rectWidth = Math.abs(selectionEnd.x - selectionStart.x)
      const rectHeight = Math.abs(selectionEnd.y - selectionStart.y)
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 2
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    }
    
    // Draw attack group rectangle in red - with debug logging and disable check
    const shouldDrawAGF = !gameState.disableAGFRendering &&
        gameState.attackGroupMode && 
        gameState.attackGroupStart && gameState.attackGroupEnd &&
        (gameState.attackGroupStart.x !== gameState.attackGroupEnd.x || 
         gameState.attackGroupStart.y !== gameState.attackGroupEnd.y)
    
    if (shouldDrawAGF) {
      const rectX = Math.min(gameState.attackGroupStart.x, gameState.attackGroupEnd.x) - scrollOffset.x
      const rectY = Math.min(gameState.attackGroupStart.y, gameState.attackGroupEnd.y) - scrollOffset.y
      const rectWidth = Math.abs(gameState.attackGroupEnd.x - gameState.attackGroupStart.x)
      const rectHeight = Math.abs(gameState.attackGroupEnd.y - gameState.attackGroupStart.y)
      
      ctx.strokeStyle = '#FF0000'
      ctx.lineWidth = 2
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)
      
      // Add a subtle red fill
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)'
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight)
    }
  }

  renderRallyPoints(ctx, factories, scrollOffset) {
    // Draw rally point flags only for selected unit-producing factories/buildings
    
    // Check selected factories
    factories.forEach(factory => {
      if (factory.rallyPoint && factory.id === gameState.humanPlayer && factory.selected) {
        this.drawRallyPointFlag(ctx, factory.rallyPoint, scrollOffset)
      }
    })
    
    // Check selected buildings that can produce units
    // Vehicle factory and vehicle workshop should show rally points, not construction yard
    if (gameState.buildings) {
      gameState.buildings.forEach(building => {
        if (building.rallyPoint && 
            building.owner === gameState.humanPlayer && 
            building.selected && 
            (building.type === 'vehicleFactory' || building.type === 'vehicleWorkshop')) {
          this.drawRallyPointFlag(ctx, building.rallyPoint, scrollOffset)
        }
      })
    }
  }

  drawRallyPointFlag(ctx, rallyPoint, scrollOffset) {
    const flagX = rallyPoint.x * TILE_SIZE - scrollOffset.x
    const flagY = rallyPoint.y * TILE_SIZE - scrollOffset.y

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

  renderBlueprints(ctx, blueprints, scrollOffset) {
    blueprints.forEach(bp => {
      const info = buildingData[bp.type]
      if (!info) return
      const x = bp.x * TILE_SIZE - scrollOffset.x
      const y = bp.y * TILE_SIZE - scrollOffset.y
      ctx.fillStyle = 'rgba(0, 0, 255, 0.3)'
      ctx.fillRect(x, y, info.width * TILE_SIZE, info.height * TILE_SIZE)
      ctx.strokeStyle = '#0000FF'
      ctx.strokeRect(x, y, info.width * TILE_SIZE, info.height * TILE_SIZE)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(info.displayName, x + (info.width * TILE_SIZE) / 2, y + (info.height * TILE_SIZE) / 2)
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

        const isPlacementAllowed = canPlaceBuilding(
          gameState.currentBuildingType,
          tileX,
          tileY,
          gameState.mapGrid || mapGrid,
          units,
          buildings,
          factories,
          gameState.humanPlayer
        )

        // Draw placement grid
        for (let y = 0; y < buildingInfo.height; y++) {
          for (let x = 0; x < buildingInfo.width; x++) {
            const currentTileX = tileX + x
            const currentTileY = tileY + y

            // Calculate screen coordinates
            const screenX = currentTileX * TILE_SIZE - scrollOffset.x
            const screenY = currentTileY * TILE_SIZE - scrollOffset.y

            // Check if valid placement for this tile (terrain/units check only)
            const isValid = isTileValid(
              currentTileX,
              currentTileY,
              mapGrid,
              units,
              buildings,
              factories,
              gameState.currentBuildingType
            )

            // Determine final color
            ctx.fillStyle = isValid && isPlacementAllowed ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'
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

  computeChainPositions(startX, startY, endX, endY, info) {
    const dx = endX - startX
    const dy = endY - startY
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const stepX = horizontal ? (dx >= 0 ? info.width : -info.width) : 0
    const stepY = horizontal ? 0 : (dy >= 0 ? info.height : -info.height)
    const count = horizontal
      ? Math.floor(Math.abs(dx) / info.width)
      : Math.floor(Math.abs(dy) / info.height)
    const positions = []
    for (let i = 1; i <= count; i++) {
      positions.push({ x: startX + stepX * i, y: startY + stepY * i })
    }
    return positions
  }

  renderChainPlacement(ctx, gameState, scrollOffset, mapGrid, units) {
    if (gameState.chainBuildMode && gameState.chainBuildingType) {
      const info = buildingData[gameState.chainBuildingType]
      const startX = gameState.chainStartX
      const startY = gameState.chainStartY
      const endX = Math.floor(gameState.cursorX / TILE_SIZE)
      const endY = Math.floor(gameState.cursorY / TILE_SIZE)
      const positions = this.computeChainPositions(startX, startY, endX, endY, info)

      positions.forEach(pos => {
        for (let y = 0; y < info.height; y++) {
          for (let x = 0; x < info.width; x++) {
            const tx = pos.x + x
            const ty = pos.y + y
            const screenX = tx * TILE_SIZE - scrollOffset.x
            const screenY = ty * TILE_SIZE - scrollOffset.y
            const isValid = isTileValid(
              tx,
              ty,
              mapGrid,
              units,
              [],
              [],
              gameState.chainBuildingType
            )
            ctx.fillStyle = isValid ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)'
            ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE)
          }
        }
      })
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
                const gameInstance = getCurrentGame()
                
                if (gameInstance && typeof gameInstance.resetGame === 'function') {
                  await gameInstance.resetGame()
                  // Show notification
                  showNotification('Game restarted while preserving win/loss statistics')
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
    this.renderBlueprints(ctx, gameState.blueprints || [], scrollOffset)
    this.renderBuildingPlacement(ctx, gameState, scrollOffset, buildings, factories, mapGrid, units)
    this.renderChainPlacement(ctx, gameState, scrollOffset, mapGrid, units)
  }
}
