import { TILE_SIZE, TILE_COLORS } from './config.js'
import { tileToPixel } from './utils.js'

export function renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, scrollOffset, isSelecting, selectionStart, selectionEnd) {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
  const startTileX = Math.floor(scrollOffset.x / TILE_SIZE)
  const startTileY = Math.floor(scrollOffset.y / TILE_SIZE)
  const endTileX = Math.min(mapGrid[0].length, Math.ceil((scrollOffset.x + gameCanvas.width) / TILE_SIZE))
  const endTileY = Math.min(mapGrid.length, Math.ceil((scrollOffset.y + gameCanvas.height) / TILE_SIZE))
  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = mapGrid[y][x]
      gameCtx.fillStyle = TILE_COLORS[tile.type]
      gameCtx.fillRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
      gameCtx.strokeStyle = 'rgba(0,0,0,0.1)'
      gameCtx.strokeRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE)
    }
  }
  factories.forEach(factory => {
    const pos = tileToPixel(factory.x, factory.y)
    gameCtx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - scrollOffset.y, factory.width * TILE_SIZE, factory.height * TILE_SIZE)
    const barWidth = factory.width * TILE_SIZE
    const healthRatio = factory.health / factory.maxHealth
    gameCtx.fillStyle = '#0F0'
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth * healthRatio, 5)
    gameCtx.strokeStyle = '#000'
    gameCtx.strokeRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth, 5)
  })
  units.forEach(unit => {
    gameCtx.fillStyle = unit.type === 'tank' ? '#00F' : '#9400D3'
    gameCtx.beginPath()
    gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3, 0, 2 * Math.PI)
    gameCtx.fill()
    if (unit.selected) {
      gameCtx.strokeStyle = '#FF0'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3 + 3, 0, 2 * Math.PI)
      gameCtx.stroke()
    }
    // Draw turret line for tanks (Requirement 3.1.5.4)
    if (unit.type === 'tank' && unit.target) {
      const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
      const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y
      let targetCenter = null
      if (unit.target.tileX !== undefined) {
        targetCenter = { x: unit.target.x + TILE_SIZE / 2 - scrollOffset.x, y: unit.target.y + TILE_SIZE / 2 - scrollOffset.y }
      } else {
        targetCenter = { x: unit.target.x + (unit.target.width * TILE_SIZE) / 2 - scrollOffset.x, y: unit.target.y + (unit.target.height * TILE_SIZE) / 2 - scrollOffset.y }
      }
      const dx = targetCenter.x - centerX
      const dy = targetCenter.y - centerY
      const angle = Math.atan2(dy, dx)
      const turretLength = 10
      const turretEndX = centerX + Math.cos(angle) * turretLength
      const turretEndY = centerY + Math.sin(angle) * turretLength
      gameCtx.strokeStyle = '#000'
      gameCtx.lineWidth = 2
      gameCtx.beginPath()
      gameCtx.moveTo(centerX, centerY)
      gameCtx.lineTo(turretEndX, turretEndY)
      gameCtx.stroke()
    }
    // Harvester harvesting progress bar (Requirement 3.2.8)
    if (unit.type === 'harvester' && unit.harvesting) {
      const progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1)
      const barWidth = TILE_SIZE
      const barHeight = 4
      const x = unit.x - scrollOffset.x
      const y = unit.y + TILE_SIZE - scrollOffset.y
      gameCtx.fillStyle = '#555'
      gameCtx.fillRect(x, y, barWidth, barHeight)
      gameCtx.fillStyle = '#0F0'
      gameCtx.fillRect(x, y, barWidth * progress, barHeight)
      gameCtx.strokeStyle = '#000'
      gameCtx.strokeRect(x, y, barWidth, barHeight)
    }
  })
  bullets.forEach(bullet => {
    gameCtx.fillStyle = '#FFF'
    gameCtx.beginPath()
    gameCtx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI)
    gameCtx.fill()
  })
  if (isSelecting) {
    const rectX = selectionStart.x - scrollOffset.x
    const rectY = selectionStart.y - scrollOffset.y
    const rectWidth = selectionEnd.x - selectionStart.x
    const rectHeight = selectionEnd.y - selectionStart.y
    gameCtx.strokeStyle = '#FF0'
    gameCtx.lineWidth = 1
    gameCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  }
}

export function renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas) {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height)
  const scaleX = minimapCanvas.width / (mapGrid[0].length * TILE_SIZE)
  const scaleY = minimapCanvas.height / (mapGrid.length * TILE_SIZE)
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type]
      minimapCtx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY)
    }
  }
  minimapCtx.strokeStyle = '#FF0'
  minimapCtx.lineWidth = 2
  minimapCtx.strokeRect(scrollOffset.x * scaleX, scrollOffset.y * scaleY, gameCanvas.width * scaleX, gameCanvas.height * scaleY)
}
