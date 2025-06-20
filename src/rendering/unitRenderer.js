// rendering/unitRenderer.js
import { TILE_SIZE, HARVESTER_CAPPACITY, HARVESTER_UNLOAD_TIME, RECOIL_DISTANCE, RECOIL_DURATION, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE, TANK_FIRE_RANGE, ATTACK_TARGET_INDICATOR_SIZE, ATTACK_TARGET_BOUNCE_SPEED, UNIT_TYPE_COLORS, PARTY_COLORS } from '../config.js'
import { gameState } from '../gameState.js'

export class UnitRenderer {
  renderUnitBody(ctx, unit, centerX, centerY) {
    // Use consistent colors for unit types regardless of owner
    ctx.fillStyle = UNIT_TYPE_COLORS[unit.type] || '#0000FF' // Default to blue if type not found

    // Draw rectangular body instead of circle
    const bodyWidth = TILE_SIZE * 0.7
    const bodyHeight = TILE_SIZE * 0.5

    // Save the current context state
    ctx.save()

    // Translate to center of unit and rotate
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.direction)

    // Draw the rectangular body centered on the unit position
    ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight)

    // Draw front direction indicator (triangle) - use party color for this
    ctx.fillStyle = PARTY_COLORS[unit.owner] || PARTY_COLORS.player
    ctx.beginPath()
    ctx.moveTo(bodyWidth / 2, 0)
    ctx.lineTo(bodyWidth / 2 - 8, -8)
    ctx.lineTo(bodyWidth / 2 - 8, 8)
    ctx.closePath()
    ctx.fill()

    // Restore the context to its original state
    ctx.restore()
  }

  renderTurret(ctx, unit, centerX, centerY) {
    // Harvesters have a mining bar instead of a turret
    if (unit.type === 'harvester') {
      this.renderHarvesterMiningBar(ctx, unit, centerX, centerY)
      return
    }

    const now = performance.now()
    
    // Special handling for rocket tanks - render 3 static tubes instead of turret
    if (unit.type === 'rocketTank') {
      this.renderRocketTubes(ctx, unit, centerX, centerY, now)
      return
    }
    
    // Calculate recoil offset
    let recoilOffset = 0
    if (unit.recoilStartTime && now - unit.recoilStartTime <= RECOIL_DURATION) {
      const progress = (now - unit.recoilStartTime) / RECOIL_DURATION
      // Use a smooth easing function for recoil
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      recoilOffset = RECOIL_DISTANCE * (1 - easedProgress)
    }

    // Draw turret for combat units - use the turretDirection for rotation
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.turretDirection)

    // Apply recoil offset (move turret backwards)
    ctx.translate(-recoilOffset, 0)

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(TILE_SIZE / 2, 0)
    ctx.stroke()

    // Render muzzle flash
    if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
      const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
      const flashAlpha = 1 - flashProgress
      const flashSize = MUZZLE_FLASH_SIZE * (1 - flashProgress * 0.5)
      
      ctx.save()
      ctx.globalAlpha = flashAlpha
      
      // Create radial gradient for muzzle flash
      const gradient = ctx.createRadialGradient(TILE_SIZE / 2, 0, 0, TILE_SIZE / 2, 0, flashSize)
      gradient.addColorStop(0, '#FFF')
      gradient.addColorStop(0.3, '#FF0')
      gradient.addColorStop(1, 'rgba(255, 165, 0, 0)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(TILE_SIZE / 2, 0, flashSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.restore()
  }

  renderHarvesterMiningBar(ctx, unit, centerX, centerY) {
    // Only show mining bar when harvesting
    if (!unit.harvesting) return

    const now = performance.now()
    const miningProgress = unit.harvestTimer ? 
      Math.sin((now - unit.harvestTimer) / 200) * 0.5 + 0.5 : 0  // Oscillating animation
    
    const barWidth = TILE_SIZE * 0.6
    const barHeight = 4
    const barExtension = miningProgress * (barWidth * 0.3) // Bar moves back and forth

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.direction) // Orient with the unit

    // Draw mining bar base
    ctx.fillStyle = '#444'
    ctx.fillRect(-barWidth / 2, -barHeight / 2, barWidth, barHeight)

    // Draw moving part of the bar
    ctx.fillStyle = '#FFD700'
    ctx.fillRect(-barWidth / 2 + barExtension, -barHeight / 2, 8, barHeight)

    ctx.restore()
  }

  renderSelection(ctx, unit, centerX, centerY) {
    // Draw selection circle if unit is selected
    if (unit.selected) {
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, TILE_SIZE / 3 + 3, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  renderAlertMode(ctx, unit, centerX, centerY) {
    // If unit is alert, draw an outer red circle.
    if (unit.alertMode && unit.type === 'tank-v2') {
      const now = performance.now()
      const pulse = Math.sin(now * 0.005) * 0.3 + 0.7 // Pulsing effect between 0.4 and 1.0
      
      ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(centerX, centerY, TILE_SIZE / 2, 0, 2 * Math.PI)
      ctx.stroke()
      
      // Add inner range indicator
      ctx.strokeStyle = `rgba(255, 100, 100, ${pulse * 0.3})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(centerX, centerY, TANK_FIRE_RANGE * TILE_SIZE, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  renderHealthBar(ctx, unit, scrollOffset) {
    // Only show health bar if unit is damaged or selected
    const isDamaged = unit.health < unit.maxHealth
    const isSelected = unit.selected
    
    if (!isDamaged && !isSelected) {
      return
    }
    
    // Draw health bar with party colors for owner distinction
    const unitHealthRatio = unit.health / unit.maxHealth
    const healthBarWidth = TILE_SIZE * 0.8
    const healthBarHeight = 4
    const healthBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - healthBarWidth / 2
    const healthBarY = unit.y - 10 - scrollOffset.y
    ctx.strokeStyle = '#000'
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight)

    // Use party colors for health bar fill
    ctx.fillStyle = PARTY_COLORS[unit.owner] || PARTY_COLORS.player
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth * unitHealthRatio, healthBarHeight)
  }

  renderHarvesterProgress(ctx, unit, scrollOffset) {
    // Draw ore carried indicator for harvesters
    if (unit.type === 'harvester') {
      let progress = 0
      let barColor = '#FFD700' // Gold for ore
      
      if (unit.unloadingAtRefinery && unit.unloadStartTime) {
        // Show unloading progress (reverse direction)
        const unloadProgress = Math.min((performance.now() - unit.unloadStartTime) / HARVESTER_UNLOAD_TIME, 1)
        progress = 1 - unloadProgress // Reverse the progress
        barColor = '#FF6B6B' // Red-ish for unloading
      } else if (unit.harvesting && unit.harvestTimer) {
        // Show harvesting progress
        progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1)
        barColor = '#32CD32' // Green for harvesting
      } else {
        // Show current ore load
        progress = unit.oreCarried / HARVESTER_CAPPACITY
      }
      
      const progressBarWidth = TILE_SIZE * 0.8
      const progressBarHeight = 3
      const progressBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - progressBarWidth / 2
      const progressBarY = unit.y - 5 - scrollOffset.y
      
      // Background bar
      ctx.fillStyle = '#333'
      ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
      
      // Progress fill
      ctx.fillStyle = barColor
      ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight)
      
      // Border
      ctx.strokeStyle = '#000'
      ctx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
    }
  }

  renderQueueNumber(ctx, unit, scrollOffset) {
    // Queue numbers are now handled by the HarvesterHUD overlay
    // This function is kept for compatibility but no longer renders anything
  }

  renderGroupNumber(ctx, unit, scrollOffset) {
    // Draw group number if assigned.
    if (unit.groupNumber) {
      // Use green color if formation mode is active, else default white.
      ctx.fillStyle = unit.formationActive ? 'green' : '#FFF'
      ctx.font = '10px Arial'
      ctx.textAlign = 'left'
      // Position at bottom left of unit rectangle.
      ctx.fillText(
        unit.groupNumber,
        unit.x + 2 - scrollOffset.x,
        unit.y + TILE_SIZE - 2 - scrollOffset.y
      )
    }
  }

  renderAttackTargetIndicator(ctx, unit, centerX, centerY) {
    // Check if this unit is in the attack group targets
    const isAttackTarget = gameState.attackGroupTargets && 
                           gameState.attackGroupTargets.some(target => target === unit)
    
    if (isAttackTarget) {
      const now = performance.now()
      const bounceOffset = Math.sin(now * ATTACK_TARGET_BOUNCE_SPEED) * 3 // 3 pixel bounce
      
      // Position above the health bar
      const indicatorX = centerX
      const indicatorY = centerY - TILE_SIZE / 2 - 15 + bounceOffset
      
      // Draw semi-transparent red triangle
      ctx.save()
      ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'
      ctx.strokeStyle = 'rgba(255, 0, 0, 1)'
      ctx.lineWidth = 1
      
      // Draw triangle pointing down
      ctx.beginPath()
      ctx.moveTo(indicatorX, indicatorY + ATTACK_TARGET_INDICATOR_SIZE)
      ctx.lineTo(indicatorX - ATTACK_TARGET_INDICATOR_SIZE, indicatorY - ATTACK_TARGET_INDICATOR_SIZE)
      ctx.lineTo(indicatorX + ATTACK_TARGET_INDICATOR_SIZE, indicatorY - ATTACK_TARGET_INDICATOR_SIZE)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      ctx.restore()
    }
  }

  renderUnit(ctx, unit, scrollOffset) {
    if (unit.health <= 0) return

    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y

    this.renderUnitBody(ctx, unit, centerX, centerY)
    this.renderSelection(ctx, unit, centerX, centerY)
    this.renderAlertMode(ctx, unit, centerX, centerY)
    this.renderTurret(ctx, unit, centerX, centerY)
    this.renderHealthBar(ctx, unit, scrollOffset)
    this.renderHarvesterProgress(ctx, unit, scrollOffset)
    this.renderQueueNumber(ctx, unit, scrollOffset)
    this.renderGroupNumber(ctx, unit, scrollOffset)
    this.renderAttackTargetIndicator(ctx, unit, centerX, centerY)
    this.renderAttackTargetIndicator(ctx, unit, centerX, centerY)
  }

  render(ctx, units, scrollOffset) {
    // Draw units.
    units.forEach(unit => {
      this.renderUnit(ctx, unit, scrollOffset)
    })
  }

  renderRocketTubes(ctx, unit, centerX, centerY, now) {
    // Draw 3 static rocket tubes on top of the tank
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.direction) // Use body direction instead of turret direction

    // Calculate recoil offset for rocket tubes
    let recoilOffset = 0
    if (unit.recoilStartTime && now - unit.recoilStartTime <= RECOIL_DURATION) {
      const progress = (now - unit.recoilStartTime) / RECOIL_DURATION
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      recoilOffset = RECOIL_DISTANCE * 0.5 * (1 - easedProgress) // Smaller recoil for rockets
    }

    // Apply recoil offset
    ctx.translate(-recoilOffset, 0)

    // Draw 3 rocket tubes in a row
    const tubeWidth = 3
    const tubeLength = TILE_SIZE * 0.4
    const tubeSpacing = 6

    for (let i = 0; i < 3; i++) {
      const tubeY = (i - 1) * tubeSpacing // Center tube at 0, others at +/- spacing
      
      ctx.fillStyle = '#444'
      ctx.fillRect(0, tubeY - tubeWidth/2, tubeLength, tubeWidth)
      
      // Add tube caps
      ctx.fillStyle = '#222'
      ctx.fillRect(tubeLength - 2, tubeY - tubeWidth/2, 2, tubeWidth)
    }

    // Render muzzle flash for rocket tubes
    if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
      const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
      const flashAlpha = 1 - flashProgress
      const flashSize = MUZZLE_FLASH_SIZE * 0.8 * (1 - flashProgress * 0.5)
      
      ctx.save()
      ctx.globalAlpha = flashAlpha
      
      // Create muzzle flash for each tube
      for (let i = 0; i < 3; i++) {
        const tubeY = (i - 1) * tubeSpacing
        
        const gradient = ctx.createRadialGradient(tubeLength, tubeY, 0, tubeLength, tubeY, flashSize)
        gradient.addColorStop(0, '#FFF')
        gradient.addColorStop(0.3, '#FF0')
        gradient.addColorStop(0.7, '#FF4500')
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(tubeLength, tubeY, flashSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.restore()
  }
}
