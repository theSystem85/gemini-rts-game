import { TILE_SIZE } from '../config.js'

export class DangerZoneRenderer {
  render(ctx, canvas, scrollOffset, gameState) {
    if (!gameState || gameState.dzmOverlayIndex === -1) return
    if (!gameState.dangerZoneMaps) return
    const players = ['player1', 'player2', 'player3', 'player4'].slice(0, gameState.playerCount)
    const playerId = players[gameState.dzmOverlayIndex]
    const dzm = gameState.dangerZoneMaps[playerId]
    if (!dzm) return

    const startTileX = Math.max(0, Math.floor(scrollOffset.x / TILE_SIZE))
    const startTileY = Math.max(0, Math.floor(scrollOffset.y / TILE_SIZE))
    const tilesX = Math.ceil(canvas.width / TILE_SIZE) + 1
    const tilesY = Math.ceil(canvas.height / TILE_SIZE) + 1
    const endTileX = Math.min(dzm[0].length, startTileX + tilesX)
    const endTileY = Math.min(dzm.length, startTileY + tilesY)

    ctx.strokeStyle = 'rgba(255,0,0,0.5)'
    ctx.lineWidth = 1

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const dps = dzm[y][x]
        if (dps <= 0) continue
        const spacing = Math.max(2, 16 - Math.min(dps, 60) / 60 * 14)
        const sx = x * TILE_SIZE - scrollOffset.x
        const sy = y * TILE_SIZE - scrollOffset.y
        for (let off = 0; off < TILE_SIZE; off += spacing) {
          ctx.beginPath()
          ctx.moveTo(sx, sy + off)
          ctx.lineTo(sx + TILE_SIZE, sy + off)
          ctx.stroke()
        }
      }
    }
  }
}
