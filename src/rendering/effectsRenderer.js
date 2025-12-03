// rendering/effectsRenderer.js
import { TILE_SIZE, SMOKE_PARTICLE_SIZE } from '../config.js'
import { drawTeslaCoilLightning } from './renderingUtils.js'

export class EffectsRenderer {
  renderBullets(ctx, bullets, scrollOffset) {
    // Draw bullets with improved appearance
    const now = performance.now()

    bullets.forEach(bullet => {
      const x = bullet.x - scrollOffset.x
      const y = bullet.y - scrollOffset.y

      // Draw dissipating trail
      if (bullet.trail && bullet.trail.length > 1) {
        ctx.save()
        ctx.strokeStyle = 'rgba(200,200,200,0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        bullet.trail.forEach((p, idx) => {
          const px = p.x - scrollOffset.x
          const py = p.y - scrollOffset.y
          if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        })
        ctx.stroke()
        ctx.restore()
      }

      // Different rendering for different projectile types
      if (bullet.homing || bullet.ballistic) {
        // Check if this is an Apache rocket - render as tank bullet with trail
        if (bullet.originType === 'apacheRocket') {
          // Apache rockets: tank bullet style with trail
          const bulletLength = 6
          const bulletWidth = 2

          // Calculate bullet direction
          let angle = 0
          if (bullet.vx !== undefined && bullet.vy !== undefined) {
            angle = Math.atan2(bullet.vy, bullet.vx)
          } else if (bullet.dx !== undefined && bullet.dy !== undefined) {
            angle = Math.atan2(bullet.dy, bullet.dx)
          }

          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle)

          // Draw bullet shape with copper color
          ctx.fillStyle = '#B87333' // Copper color
          ctx.beginPath()
          ctx.ellipse(0, 0, bulletLength / 2, bulletWidth / 2, 0, 0, 2 * Math.PI)
          ctx.fill()

          // Add a darker tip for the bullet
          ctx.fillStyle = '#8B4513' // Darker copper/bronze
          ctx.beginPath()
          ctx.ellipse(bulletLength / 4, 0, bulletLength / 4, bulletWidth / 4, 0, 0, 2 * Math.PI)
          ctx.fill()

          ctx.restore()
        } else {
          // Regular rockets - small body with flame
          let angle = 0
          if (bullet.vx !== undefined && bullet.vy !== undefined) {
            angle = Math.atan2(bullet.vy, bullet.vx)
          } else if (bullet.dx !== undefined && bullet.dy !== undefined) {
            angle = Math.atan2(bullet.dy, bullet.dx)
          }

          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle)

          // Rocket body
          ctx.fillStyle = '#CCCCCC'
          ctx.fillRect(-4, -1.5, 6, 3)

          // Rocket nose
          ctx.fillStyle = '#888888'
          ctx.beginPath()
          ctx.moveTo(2, -1.5)
          ctx.lineTo(4, 0)
          ctx.lineTo(2, 1.5)
          ctx.closePath()
          ctx.fill()

          // Flame with slight flicker
          const flicker = Math.sin(now / 80 + bullet.id) * 1.2
          ctx.fillStyle = '#FF4500'
          ctx.beginPath()
          ctx.moveTo(-4, -1)
          ctx.lineTo(-4 - 4 - flicker, 0)
          ctx.lineTo(-4, 1)
          ctx.closePath()
          ctx.fill()

          ctx.restore()
        }
      } else {
        // Tank bullets - smaller, copper-colored, bullet-shaped
        const bulletLength = 6
        const bulletWidth = 2

        // Calculate bullet direction if it has velocity
        let angle = 0
        if (bullet.vx !== undefined && bullet.vy !== undefined) {
          angle = Math.atan2(bullet.vy, bullet.vx)
        }

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)

        // Draw bullet shape with copper color
        ctx.fillStyle = '#B87333' // Copper color
        ctx.beginPath()

        // Draw bullet as an elongated oval/capsule shape
        ctx.ellipse(0, 0, bulletLength / 2, bulletWidth / 2, 0, 0, 2 * Math.PI)
        ctx.fill()

        // Add a darker tip for the bullet
        ctx.fillStyle = '#8B4513' // Darker copper/bronze
        ctx.beginPath()
        ctx.ellipse(bulletLength / 4, 0, bulletLength / 4, bulletWidth / 4, 0, 0, 2 * Math.PI)
        ctx.fill()

        ctx.restore()
      }
    })
  }

  renderSmoke(ctx, gameState, scrollOffset) {
    const visibilityMap = gameState?.visibilityMap
    const shadowEnabled = Boolean(gameState?.shadowOfWarEnabled && visibilityMap && visibilityMap.length)

    const isParticleVisible = particle => {
      if (!shadowEnabled) {
        return true
      }

      if (!particle) {
        return false
      }

      const tileX = Math.floor(particle.x / TILE_SIZE)
      const tileY = Math.floor(particle.y / TILE_SIZE)

      if (!visibilityMap || tileY < 0 || tileY >= visibilityMap.length) {
        return false
      }

      const row = visibilityMap[tileY]
      if (!row || tileX < 0 || tileX >= row.length) {
        return false
      }

      const cell = row[tileX]
      return Boolean(cell && cell.visible)
    }

    if (gameState?.smokeParticles && gameState.smokeParticles.length > 0) {
      gameState.smokeParticles.forEach(p => {
        if (!isParticleVisible(p)) {
          return
        }

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

  renderDust(ctx, gameState, scrollOffset) {
    if (gameState?.dustParticles && gameState.dustParticles.length > 0) {
      gameState.dustParticles.forEach(p => {
        ctx.save()
        ctx.globalAlpha = p.alpha
        const x = p.x - scrollOffset.x
        const y = p.y - scrollOffset.y
        const size = p.currentSize || p.size

        ctx.fillStyle = p.color || '#D2B48C'
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    }
  }

  renderExplosions(ctx, gameState, scrollOffset) {
    // Draw explosion effects.
    if (gameState?.explosions && gameState?.explosions.length > 0) {
      const currentTime = performance.now()
      
      // Check shadow of war visibility
      const visibilityMap = gameState?.visibilityMap
      const shadowEnabled = Boolean(gameState?.shadowOfWarEnabled && visibilityMap && visibilityMap.length)
      
      const isExplosionVisible = explosion => {
        if (!shadowEnabled) {
          return true
        }
        
        if (!explosion) {
          return false
        }
        
        const tileX = Math.floor(explosion.x / TILE_SIZE)
        const tileY = Math.floor(explosion.y / TILE_SIZE)
        
        if (!visibilityMap || tileY < 0 || tileY >= visibilityMap.length) {
          return false
        }
        
        const row = visibilityMap[tileY]
        if (!row || tileX < 0 || tileX >= row.length) {
          return false
        }
        
        const cell = row[tileX]
        return Boolean(cell && cell.visible)
      }
      
      gameState.explosions.forEach(exp => {
        if (!exp) {
          return
        }
        
        // Skip explosions under fog of war
        if (!isExplosionVisible(exp)) {
          return
        }

        const safeDuration = Number.isFinite(exp.duration) && exp.duration > 0 ? exp.duration : 1
        const rawProgress = (currentTime - exp.startTime) / safeDuration
        const progress = Math.min(Math.max(rawProgress, 0), 1)
        const maxRadius = Number.isFinite(exp.maxRadius) && exp.maxRadius > 0 ? exp.maxRadius : TILE_SIZE * 2
        const currentRadius = maxRadius * progress
        const alpha = Math.max(0, 1 - progress)
        const centerX = exp.x - scrollOffset.x
        const centerY = exp.y - scrollOffset.y

        if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(currentRadius) || currentRadius <= 0) {
          return
        }

        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, currentRadius)
        gradient.addColorStop(0, `rgba(255,150,0,${alpha})`)
        gradient.addColorStop(0.4, `rgba(255,90,0,${alpha * 0.8})`)
        gradient.addColorStop(1, 'rgba(255,50,0,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI)
        ctx.fill()

        ctx.strokeStyle = `rgba(255,165,0,${alpha})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI)
        ctx.stroke()
      })
    }
  }

  renderDustParticles(ctx, gameState, scrollOffset) {
    // Draw dust particles from Mine Sweeper
    if (gameState?.dustParticles && gameState?.dustParticles.length > 0) {
      const currentTime = performance.now()
      
      // Clean up expired particles
      gameState.dustParticles = gameState.dustParticles.filter(dust => {
        const age = currentTime - dust.startTime
        return age < dust.lifetime
      })
      
      // Render active particles
      gameState.dustParticles.forEach(dust => {
        if (!dust) return
        
        const age = currentTime - dust.startTime
        const progress = age / dust.lifetime
        const alpha = Math.max(0, 1 - progress)
        
        const screenX = dust.x - scrollOffset.x
        const screenY = dust.y - scrollOffset.y
        
        // Particle expands and fades
        const currentSize = dust.size * (1 + progress * 0.5)
        
        ctx.save()
        ctx.globalAlpha = alpha * 0.4
        ctx.fillStyle = dust.color || '#D2B48C'
        ctx.beginPath()
        ctx.arc(screenX, screenY, currentSize, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
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
    this.renderDust(ctx, gameState, scrollOffset)
    this.renderDustParticles(ctx, gameState, scrollOffset)
    this.renderExplosions(ctx, gameState, scrollOffset)
    this.renderTeslaLightning(ctx, units, scrollOffset)
    
    // Debug: log smoke particle count periodically
    if (gameState?.smokeParticles?.length > 0 && gameState.frameCount % 100 === 0) {
      // Removed debug logging
    }
  }
}
