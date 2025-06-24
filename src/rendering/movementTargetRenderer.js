// movementTargetRenderer.js - Renders green triangular indicators for movement targets
import { TILE_SIZE, MOVE_TARGET_INDICATOR_SIZE, MOVE_TARGET_BOUNCE_SPEED } from '../config.js'
import { gameState } from '../gameState.js'

export class MovementTargetRenderer {
  /**
   * Render green triangular indicators at the movement target destinations
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Array} units 
   * @param {Object} scrollOffset 
   */
  renderMovementTargets(ctx, units, scrollOffset) {
    if (!units || !Array.isArray(units)) return

    const now = performance.now()
    const bounceOffset = Math.sin(now * MOVE_TARGET_BOUNCE_SPEED) * 3 // 3 pixel bounce

    // Render movement targets for all units that have moveTarget and are either selected or were recently selected
    units.forEach(unit => {
      if (!unit.moveTarget) return
      
      // Show indicator only if unit is currently selected
      const shouldShowIndicator = unit.selected
      
      if (shouldShowIndicator && unit.owner === gameState.humanPlayer) {
        // Calculate screen position of the target
        const targetScreenX = unit.moveTarget.x * TILE_SIZE + TILE_SIZE / 2 - scrollOffset.x
        const targetScreenY = unit.moveTarget.y * TILE_SIZE + TILE_SIZE / 2 - scrollOffset.y + bounceOffset
        
        // Draw green semi-transparent triangle pointing down (same direction as attack indicator)
        ctx.save()
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)' // Green with good visibility
        ctx.strokeStyle = 'rgba(0, 200, 0, 0.8)' // Darker green border
        ctx.lineWidth = 1
        
        const halfSize = MOVE_TARGET_INDICATOR_SIZE / 2
        
        // Draw triangle pointing down
        ctx.beginPath()
        ctx.moveTo(targetScreenX, targetScreenY + halfSize) // Bottom point
        ctx.lineTo(targetScreenX - halfSize, targetScreenY - halfSize) // Top left
        ctx.lineTo(targetScreenX + halfSize, targetScreenY - halfSize) // Top right
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        
        ctx.restore()
      }
    })
  }

  /**
   * Main render method
   */
  render(ctx, units, scrollOffset) {
    this.renderMovementTargets(ctx, units, scrollOffset)
  }
}
