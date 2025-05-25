// rendering/effectsRenderer.js
import { TILE_SIZE } from '../config.js'
import { drawTeslaCoilLightning } from './renderingUtils.js'

export class EffectsRenderer {
  renderBullets(ctx, bullets, scrollOffset) {
    // Draw bullets.
    bullets.forEach(bullet => {
      ctx.fillStyle = '#FFF'
      ctx.beginPath()
      ctx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })
  }

  renderExplosions(ctx, gameState, scrollOffset) {
    // Draw explosion effects.
    if (gameState?.explosions && gameState?.explosions.length > 0) {
      const currentTime = performance.now()
      gameState.explosions.forEach(exp => {
        const progress = (currentTime - exp.startTime) / exp.duration
        const currentRadius = exp.maxRadius * progress
        const alpha = Math.max(0, 1 - progress)
        ctx.strokeStyle = `rgba(255,165,0,${alpha})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(exp.x - scrollOffset.x, exp.y - scrollOffset.y, currentRadius, 0, 2 * Math.PI)
        ctx.stroke()
      })
    }
  }

  renderTeslaLightning(ctx, units, scrollOffset) {
    // Render Tesla Coil Lightning Effects ON TOP
    if (units && units.length > 0) {
      const now = performance.now()
      for (const unit of units) {
        if (unit.teslaCoilHit && now - unit.teslaCoilHit.impactTime < 400) {
          // Draw the lightning bolt for a short time after impact
          drawTeslaCoilLightning(
            ctx,
            unit.teslaCoilHit.fromX - scrollOffset.x,
            unit.teslaCoilHit.fromY - scrollOffset.y,
            unit.teslaCoilHit.toX - scrollOffset.x,
            unit.teslaCoilHit.toY - scrollOffset.y,
            TILE_SIZE
          )
        }
      }
    }
  }

  render(ctx, bullets, gameState, units, scrollOffset) {
    this.renderBullets(ctx, bullets, scrollOffset)
    this.renderExplosions(ctx, gameState, scrollOffset)
    this.renderTeslaLightning(ctx, units, scrollOffset)
  }
}
