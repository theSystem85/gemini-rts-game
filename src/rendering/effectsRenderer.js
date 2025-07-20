// rendering/effectsRenderer.js
import { TILE_SIZE, SMOKE_PARTICLE_SIZE } from '../config.js'
import { drawTeslaCoilLightning } from './renderingUtils.js'

export class EffectsRenderer {
  renderBullets(ctx, bullets, scrollOffset) {
    // Draw bullets with improved appearance
    bullets.forEach(bullet => {
      const x = bullet.x - scrollOffset.x;
      const y = bullet.y - scrollOffset.y;
      
      // Different rendering for different projectile types
      if (bullet.homing || bullet.ballistic) {
        if (bullet.trail && bullet.trail.length > 1) {
          ctx.save()
          for (let i = 1; i < bullet.trail.length; i++) {
            const p1 = bullet.trail[i - 1]
            const p2 = bullet.trail[i]
            const alpha = i / bullet.trail.length
            ctx.strokeStyle = `rgba(200,200,200,${alpha * 0.4})`
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(p1.x - scrollOffset.x, p1.y - scrollOffset.y)
            ctx.lineTo(p2.x - scrollOffset.x, p2.y - scrollOffset.y)
            ctx.stroke()
          }
          ctx.restore()
        }
        // Rockets - small body with flame
        let angle = 0;
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
          angle = Math.atan2(bullet.vy, bullet.vx);
        } else if (bullet.dx !== undefined && bullet.dy !== undefined) {
          angle = Math.atan2(bullet.dy, bullet.dx);
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Rocket body
        ctx.fillStyle = '#CCCCCC';
        ctx.fillRect(-4, -1.5, 6, 3);

        // Rocket nose
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(2, -1.5);
        ctx.lineTo(4, 0);
        ctx.lineTo(2, 1.5);
        ctx.closePath();
        ctx.fill();

        // Flame with slight flicker
        const flicker = Math.sin(performance.now() / 100 + bullet.id) * 0.5;
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.moveTo(-4, -1 + flicker);
        ctx.lineTo(-8 - flicker * 2, 0);
        ctx.lineTo(-4, 1 - flicker);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
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

  renderSmoke(ctx, gameState, scrollOffset) {
    if (gameState?.smokeParticles && gameState.smokeParticles.length > 0) {
      gameState.smokeParticles.forEach(p => {
        // Safety check: ensure particle size is valid and positive
        if (!p.size || p.size <= 0) {
          return // Skip invalid particles
        }
        
        ctx.save()
        ctx.globalAlpha = p.alpha
        const x = p.x - scrollOffset.x
        const y = p.y - scrollOffset.y
        
        // Ensure size is positive for gradient creation
        const safeSize = Math.max(0.1, p.size)
        
        // Create a more balanced gradient
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, safeSize)
        gradient.addColorStop(0, 'rgba(70,70,70,0.7)') // Slightly lighter center
        gradient.addColorStop(0.4, 'rgba(85,85,85,0.5)') // Mid-tone
        gradient.addColorStop(0.8, 'rgba(100,100,100,0.3)') // Lighter edge
        gradient.addColorStop(1, 'rgba(110,110,110,0)') // Transparent edge
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, safeSize, 0, Math.PI * 2)
        ctx.fill()
        
        // Add a more subtle dark core
        ctx.globalAlpha = p.alpha * 0.4 // Reduced opacity for core
        const coreSize = Math.max(0.1, safeSize * 0.25) // Ensure core size is also positive
        const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreSize)
        coreGradient.addColorStop(0, 'rgba(50,50,50,0.6)') // Lighter dark core
        coreGradient.addColorStop(1, 'rgba(50,50,50,0)')
        ctx.fillStyle = coreGradient
        ctx.beginPath()
        ctx.arc(x, y, coreSize, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      })
    }
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
    this.renderSmoke(ctx, gameState, scrollOffset)
    this.renderExplosions(ctx, gameState, scrollOffset)
    this.renderTeslaLightning(ctx, units, scrollOffset)
  }
}
