// rendering.js
import { TILE_SIZE, TILE_COLORS, HARVESTER_CAPPACITY } from './config.js'
import { tileToPixel } from './utils.js'

export function renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, scrollOffset, selectionActive, selectionStart, selectionEnd, gameState) {
  // If game over, render win/lose overlay and stop drawing further
  if (gameState.gameOver && gameState.gameOverMessage) {
    const messageX = gameCanvas.width / 2; // added declaration
    const messageY = gameCanvas.height / 2;
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.font = 'bold 32px Arial';
    gameCtx.textAlign = 'center';
    gameCtx.fillStyle = '#FFFFFF';
    gameCtx.fillText(gameState.gameOverMessage, messageX, messageY);
    gameCtx.font = '20px Arial';
    gameCtx.fillText('Press R to start a new game', messageX, messageY + 50);
    return;
  }

  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
  const startTileX = Math.floor(scrollOffset.x / TILE_SIZE)
  const startTileY = Math.floor(scrollOffset.y / TILE_SIZE)
  const endTileX = Math.min(mapGrid[0].length, Math.ceil((scrollOffset.x + gameCanvas.width) / TILE_SIZE))
  const endTileY = Math.min(mapGrid.length, Math.ceil((scrollOffset.y + gameCanvas.height) / TILE_SIZE))
  
  // Draw map tiles.
  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = mapGrid[y][x]
      gameCtx.fillStyle = TILE_COLORS[tile.type]
      gameCtx.fillRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
      gameCtx.strokeStyle = 'rgba(0,0,0,0.1)'
      gameCtx.strokeRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
    }
  }
  
  // Draw factories.
  factories.forEach(factory => {
    if (factory.destroyed) return
    const pos = tileToPixel(factory.x, factory.y)
    gameCtx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - scrollOffset.y, factory.width * TILE_SIZE, factory.height * TILE_SIZE)
    const barWidth = factory.width * TILE_SIZE
    const healthRatio = factory.health / factory.maxHealth
    gameCtx.fillStyle = '#0F0'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth * healthRatio, 5)
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth, 5)
    if (factory.id === 'enemy' && factory.budget !== undefined) {
      gameCtx.fillStyle = '#FFF'
      gameCtx.font = '12px Arial'
      gameCtx.fillText(`Budget: ${factory.budget}`, pos.x - scrollOffset.x, pos.y - 20 - scrollOffset.y)
    }
  })
  
  // Draw units.
  units.forEach(unit => {
    if (unit.health <= 0) return

    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y
    
    // Set fill color based on unit type
    if (unit.type === 'tank') {
      gameCtx.fillStyle = unit.owner === 'player' ? '#0000FF' : '#FF0000'
    } else if (unit.type === 'tank-v2') {
      gameCtx.fillStyle = '#FFF'  // White for tank-v2
    } else if (unit.type === 'harvester') {
      gameCtx.fillStyle = '#9400D3'  // Purple for harvesters
    } else if (unit.type === 'rocketTank') {
      gameCtx.fillStyle = '#800000'  // Dark red for rocket tanks
    }
    
    // Draw rectangular body instead of circle
    const bodyWidth = TILE_SIZE * 0.7
    const bodyHeight = TILE_SIZE * 0.5
    
    // Save the current context state
    gameCtx.save()
    
    // Translate to center of unit and rotate
    gameCtx.translate(centerX, centerY)
    gameCtx.rotate(unit.direction)
    
    // Draw the rectangular body centered on the unit position
    gameCtx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight)
    
    // Draw front direction indicator (triangle)
    gameCtx.fillStyle = unit.owner === 'player' ? '#00FF00' : '#FFFF00'
    gameCtx.beginPath()
    gameCtx.moveTo(bodyWidth / 2, 0)
    gameCtx.lineTo(bodyWidth / 2 - 8, -8)
    gameCtx.lineTo(bodyWidth / 2 - 8, 8)
    gameCtx.closePath()
    gameCtx.fill()
    
    // Restore the context to its original state
    gameCtx.restore()

    // Draw selection circle if unit is selected
    if (unit.selected) {
      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(centerX, centerY, TILE_SIZE / 3 + 3, 0, 2 * Math.PI)
      gameCtx.stroke()
    }
    
    // If unit is alert, draw an outer red circle.
    if (unit.alertMode && unit.type === 'tank-v2') {
      gameCtx.strokeStyle = 'red'
      gameCtx.lineWidth = 3
      gameCtx.beginPath()
      gameCtx.arc(centerX, centerY, TILE_SIZE / 2, 0, 2 * Math.PI)
      gameCtx.stroke()
    }
    
    // Draw turret - use the turretDirection for rotation
    gameCtx.save()
    gameCtx.translate(centerX, centerY)
    gameCtx.rotate(unit.turretDirection)
    
    gameCtx.strokeStyle = '#000'
    gameCtx.lineWidth = 3
    gameCtx.beginPath()
    gameCtx.moveTo(0, 0)
    gameCtx.lineTo(TILE_SIZE / 2, 0)
    gameCtx.stroke()
    
    gameCtx.restore()
    
    // Draw health bar. For enemy units, force red fill.
    const unitHealthRatio = unit.health / unit.maxHealth
    const healthBarWidth = TILE_SIZE * 0.8
    const healthBarHeight = 4
    const healthBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - healthBarWidth / 2
    const healthBarY = unit.y - 10 - scrollOffset.y
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight)
    
    // Use green for player units, red for enemy units.
    gameCtx.fillStyle = (unit.owner === 'enemy') ? '#F00' : '#0F0'
    gameCtx.fillRect(healthBarX, healthBarY, healthBarWidth * unitHealthRatio, healthBarHeight)
    
    // Draw ore carried indicator for harvesters
    if (unit.type === 'harvester') {
      let progress = 0
      if (unit.harvesting) {
        progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1)
      }
      if (unit.oreCarried >= HARVESTER_CAPPACITY) {
        progress = 1
      }
      const progressBarWidth = TILE_SIZE * 0.8
      const progressBarHeight = 3
      const progressBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - progressBarWidth / 2
      const progressBarY = unit.y - 5 - scrollOffset.y
      gameCtx.fillStyle = '#FFD700'
      gameCtx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight)
      gameCtx.strokeStyle = '#000'
      gameCtx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
    }
  })
  
  // Draw bullets.
  bullets.forEach(bullet => {
    gameCtx.fillStyle = '#FFF'
    gameCtx.beginPath()
    gameCtx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI)
    gameCtx.fill()
  })
  
  // Draw explosion effects.
  if (gameState?.explosions && gameState?.explosions.length > 0) {
    const currentTime = performance.now()
    gameState.explosions.forEach(exp => {
      const progress = (currentTime - exp.startTime) / exp.duration
      const currentRadius = exp.maxRadius * progress
      const alpha = Math.max(0, 1 - progress)
      gameCtx.strokeStyle = `rgba(255,165,0,${alpha})`
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(exp.x - scrollOffset.x, exp.y - scrollOffset.y, currentRadius, 0, 2 * Math.PI)
      gameCtx.stroke()
    })
  }
  
  // Draw selection rectangle if active.
  if (selectionActive && selectionStart && selectionEnd) {
    const rectX = selectionStart.x - scrollOffset.x
    const rectY = selectionStart.y - scrollOffset.y
    const rectWidth = selectionEnd.x - selectionStart.x
    const rectHeight = selectionEnd.y - selectionStart.y
    gameCtx.strokeStyle = '#FF0'
    gameCtx.lineWidth = 2
    gameCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  }
}

export function renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units) {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)
  const scaleX = minimapCanvas.width / (mapGrid[0].length * TILE_SIZE)
  const scaleY = minimapCanvas.height / (mapGrid.length * TILE_SIZE)
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type]
      minimapCtx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY)
    }
  }
  units.forEach(unit => {
    minimapCtx.fillStyle = unit.owner === 'player' ? '#00F' : '#F00'
    const unitX = (unit.x + TILE_SIZE / 2) * scaleX
    const unitY = (unit.y + TILE_SIZE / 2) * scaleY
    minimapCtx.beginPath()
    minimapCtx.arc(unitX, unitY, 3, 0, 2 * Math.PI)
    minimapCtx.fill()
  })
  minimapCtx.strokeStyle = '#FF0'
  minimapCtx.lineWidth = 2
  minimapCtx.strokeRect(scrollOffset.x * scaleX, scrollOffset.y * scaleY, gameCanvas.width * scaleX, gameCanvas.height * scaleY)
}
