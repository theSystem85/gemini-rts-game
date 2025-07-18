import { TILE_SIZE } from '../config.js'

export class GuardRenderer {
  render(ctx, units, scrollOffset) {
    if (!units || !Array.isArray(units)) return

    const now = performance.now()
    const lineOpacity = 0.25 * (Math.sin(now * 0.003) + 1) // 0 to 0.5

    const drawnTargets = new Set()

    units.forEach(unit => {
      if (!unit.selected || !unit.guardMode || !unit.guardTarget) return

      const guardianX = unit.x + TILE_SIZE / 2 - scrollOffset.x
      const guardianY = unit.y + TILE_SIZE / 2 - scrollOffset.y
      const target = unit.guardTarget
      const targetX = target.x + TILE_SIZE / 2 - scrollOffset.x
      const targetY = target.y + TILE_SIZE / 2 - scrollOffset.y

      // animated line between unit and guard target
      ctx.strokeStyle = `rgba(255, 165, 0, ${lineOpacity})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(guardianX, guardianY)
      ctx.lineTo(targetX, targetY)
      ctx.stroke()

      const id = target.id || `${target.x}_${target.y}`
      if (!drawnTargets.has(id)) {
        drawnTargets.add(id)
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(targetX, targetY, TILE_SIZE / 2, 0, Math.PI * 2)
        ctx.stroke()
      }
    })
  }
}

