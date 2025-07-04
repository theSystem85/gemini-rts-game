// rendering/effectsRenderer.js
import { TILE_SIZE } from '../config.js'
import { drawTeslaCoilLightning } from './renderingUtils.js'

export class EffectsRenderer {
  renderBullets(ctx, bullets, scrollOffset) {
    // Draw bullets with improved appearance
    bullets.forEach(bullet => {
      const x = bullet.x - scrollOffset.x;
      const y = bullet.y - scrollOffset.y;
      
      // Different rendering for different projectile types
      if (bullet.homing) {
        // Rockets - larger, yellow/orange
        ctx.fillStyle = '#FFD700'; // Gold color for rockets
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add glow effect for rockets
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#FF4500';
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Tank bullets - smaller, copper-colored, bullet-shaped
        const bulletLength = 6;
        const bulletWidth = 2;
        
        // Calculate bullet direction if it has velocity
        let angle = 0;
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
          angle = Math.atan2(bullet.vy, bullet.vx);
        }
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Draw bullet shape with copper color
        ctx.fillStyle = '#B87333'; // Copper color
        ctx.beginPath();
        
        // Draw bullet as an elongated oval/capsule shape
        ctx.ellipse(0, 0, bulletLength / 2, bulletWidth / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add a darker tip for the bullet
        ctx.fillStyle = '#8B4513'; // Darker copper/bronze
        ctx.beginPath();
        ctx.ellipse(bulletLength / 4, 0, bulletLength / 4, bulletWidth / 4, 0, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.restore();
      }
    });
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
