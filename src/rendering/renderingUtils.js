// rendering/renderingUtils.js
import { TILE_SIZE } from '../config.js'

// Get device pixel ratio for high-DPI rendering
export const getDevicePixelRatio = () => {
  return window.devicePixelRatio || 1
}

// Tesla Coil Lightning Rendering
export function drawTeslaCoilLightning(gameCtx, fromX, fromY, toX, toY, scatterRadius = TILE_SIZE, colorStops = [
  { color: 'rgba(255,255,128,0.95)', pos: 0 },
  { color: 'rgba(0,200,255,0.7)', pos: 0.5 },
  { color: 'rgba(255,255,255,1)', pos: 1 }
], boltWidth = 5) {
  // Draw a jagged, glowing lightning bolt with some randomness
  const numSegments = 12
  const points = [{ x: fromX, y: fromY }]
  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments
    const x = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 18
    const y = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 18
    points.push({ x, y })
  }
  points.push({ x: toX, y: toY })

  // Glow effect (keep shadow for glow only)
  for (let glow = 18; glow > 0; glow -= 6) {
    gameCtx.save()
    gameCtx.strokeStyle = 'rgba(255,255,128,0.18)' // Increased alpha for visibility
    gameCtx.shadowColor = '#fff'
    gameCtx.shadowBlur = glow
    gameCtx.lineWidth = boltWidth + glow
    gameCtx.beginPath()
    gameCtx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      gameCtx.lineTo(points[i].x, points[i].y)
    }
    gameCtx.stroke()
    gameCtx.restore()
  }

  // Main bolt (NO shadow, solid gradient)
  gameCtx.save()
  const grad = gameCtx.createLinearGradient(fromX, fromY, toX, toY)
  colorStops.forEach(stop => grad.addColorStop(stop.pos, stop.color))
  gameCtx.strokeStyle = grad
  gameCtx.shadowBlur = 0
  gameCtx.lineWidth = boltWidth
  gameCtx.beginPath()
  gameCtx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    gameCtx.lineTo(points[i].x, points[i].y)
  }
  gameCtx.stroke()
  gameCtx.restore()

  // Impact scatter
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = scatterRadius * (0.5 + Math.random() * 0.5)
    const ex = toX + Math.cos(angle) * r
    const ey = toY + Math.sin(angle) * r
    gameCtx.save()
    gameCtx.strokeStyle = 'rgba(0,200,255,0.7)'
    gameCtx.lineWidth = 2
    gameCtx.beginPath()
    gameCtx.moveTo(toX, toY)
    gameCtx.lineTo(ex, ey)
    gameCtx.stroke()
    gameCtx.restore()
  }
}
