// rendering/unitRenderer.js
import { TILE_SIZE, HARVESTER_CAPPACITY } from '../config.js'

export class UnitRenderer {
  renderUnitBody(ctx, unit, centerX, centerY) {
    // Set fill color based on unit type
    if (unit.type === 'tank' || unit.type === 'tank_v1') {
      ctx.fillStyle = unit.owner === 'player' ? '#0000FF' : '#FF0000'  // Blue for player, red for enemy
    } else if (unit.type === 'tank-v2') {
      ctx.fillStyle = unit.owner === 'player' ? '#FFFFFF' : '#FFB6C1'  // White for player, light pink for enemy
    } else if (unit.type === 'tank-v3') {
      ctx.fillStyle = unit.owner === 'player' ? '#32CD32' : '#90EE90'  // Lime green for player, light green for enemy
    } else if (unit.type === 'harvester') {
      ctx.fillStyle = unit.owner === 'player' ? '#9400D3' : '#DDA0DD'  // Purple for player, light purple for enemy
    } else if (unit.type === 'rocketTank') {
      ctx.fillStyle = unit.owner === 'player' ? '#800000' : '#F08080'  // Dark red for player, light red for enemy
    } else {
      // Fallback color
      ctx.fillStyle = unit.owner === 'player' ? '#0000FF' : '#FF0000'
    }

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

    // Draw front direction indicator (triangle)
    ctx.fillStyle = unit.owner === 'player' ? '#00FF00' : '#FFFF00'
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

    // Draw turret for combat units - use the turretDirection for rotation
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.turretDirection)

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(TILE_SIZE / 2, 0)
    ctx.stroke()

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
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(centerX, centerY, TILE_SIZE / 2, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  renderHealthBar(ctx, unit, scrollOffset) {
    // Draw health bar. For enemy units, force red fill.
    const unitHealthRatio = unit.health / unit.maxHealth
    const healthBarWidth = TILE_SIZE * 0.8
    const healthBarHeight = 4
    const healthBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - healthBarWidth / 2
    const healthBarY = unit.y - 10 - scrollOffset.y
    ctx.strokeStyle = '#000'
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight)

    // Use green for player units, red for enemy units.
    ctx.fillStyle = (unit.owner === 'enemy') ? '#F00' : '#0F0'
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth * unitHealthRatio, healthBarHeight)
  }

  renderHarvesterProgress(ctx, unit, scrollOffset) {
    // Draw ore carried indicator for harvesters
    if (unit.type === 'harvester') {
      let progress = 0
      let barColor = '#FFD700' // Gold for ore
      
      if (unit.unloadingAtRefinery && unit.unloadStartTime) {
        // Show unloading progress (reverse direction)
        const unloadProgress = Math.min((performance.now() - unit.unloadStartTime) / 10000, 1)
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
  }

  render(ctx, units, scrollOffset) {
    // Draw units.
    units.forEach(unit => {
      this.renderUnit(ctx, unit, scrollOffset)
    })
  }
}
