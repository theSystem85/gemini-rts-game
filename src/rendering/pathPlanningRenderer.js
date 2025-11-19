import { TILE_SIZE, MOVE_TARGET_INDICATOR_SIZE } from '../config.js'
import { gameState } from '../gameState.js'

export class PathPlanningRenderer {
  render(ctx, units, scrollOffset) {
    if (!units) return

    const buildUtilityQueueActions = unit => {
      const list = []
      const queue = unit.utilityQueue
      if (!queue) {
        return list
      }

      const seen = new Set()
      const pushTarget = (targetId, targetType) => {
        if (!targetId || seen.has(`${targetType}:${targetId}`)) {
          return
        }
        let targetX
        let targetY
        if (targetType === 'wreck') {
          const wreck = (gameState.unitWrecks || []).find(w => w.id === targetId)
          if (!wreck) {
            return
          }
          targetX = wreck.x + TILE_SIZE / 2
          targetY = wreck.y + TILE_SIZE / 2
        } else {
          const targetUnit = units.find(u => u.id === targetId)
          if (!targetUnit) {
            return
          }
          targetX = targetUnit.x + TILE_SIZE / 2
          targetY = targetUnit.y + TILE_SIZE / 2
        }
        seen.add(`${targetType}:${targetId}`)
        list.push({ type: 'utility', target: { x: targetX, y: targetY } })
      }

      if (queue.currentTargetId) {
        pushTarget(queue.currentTargetId, queue.currentTargetType || 'unit')
      }

      if (Array.isArray(queue.targets)) {
        queue.targets.forEach(entry => {
          if (!entry) return
          if (typeof entry === 'object') {
            pushTarget(entry.id, entry.type || 'unit')
          } else {
            pushTarget(entry, 'unit')
          }
        })
      }

      return list
    }

    const actionsForUnit = unit => {
      const list = []
      if (unit.currentCommand) list.push(unit.currentCommand)
      if (unit.commandQueue && unit.commandQueue.length > 0) {
        list.push(...unit.commandQueue)
      }
      if (unit.utilityQueue && (unit.utilityQueue.currentTargetId || (unit.utilityQueue.targets && unit.utilityQueue.targets.length > 0))) {
        list.push(...buildUtilityQueueActions(unit))
      }
      return list
    }

    units.forEach(unit => {
      if (!unit.selected) return
      const queue = actionsForUnit(unit)
      if (queue.length === 0) return

      let prevX =  unit.x + TILE_SIZE / 2
      let prevY =  unit.y + TILE_SIZE / 2

      queue.forEach((action, idx) => {
        let targetX
        let targetY
        switch (action.type) {
          case 'move':
          case 'retreat':
            targetX = action.x
            targetY = action.y
            break
          case 'attack': {
            const t = action.target
            if (t.tileX !== undefined) {
              targetX = t.x + TILE_SIZE / 2
              targetY = t.y + TILE_SIZE / 2
            } else {
              targetX = (t.x + t.width / 2) * TILE_SIZE
              targetY = (t.y + t.height / 2) * TILE_SIZE
            }
            break
          }
          case 'agf': {
            const t = action.targets && action.targets[0]
            if (!t) return
            if (t.tileX !== undefined) {
              targetX = t.x + TILE_SIZE / 2
              targetY = t.y + TILE_SIZE / 2
            } else {
              targetX = (t.x + t.width / 2) * TILE_SIZE
              targetY = (t.y + t.height / 2) * TILE_SIZE
            }
            break
          }
          case 'workshopRepair': {
            const workshops = gameState.buildings.filter(b =>
              b.type === 'vehicleWorkshop' && b.owner === gameState.humanPlayer && b.health > 0
            )
            if (workshops.length === 0) return
            let nearest = null
            let nearestDist = Infinity
            workshops.forEach(ws => {
              const dist = Math.hypot(unit.tileX - ws.x, unit.tileY - ws.y)
              if (dist < nearestDist) { nearest = ws; nearestDist = dist }
            })
            if (!nearest) return
            targetX = (nearest.x + nearest.width / 2) * TILE_SIZE
            targetY = (nearest.y + nearest.height) * TILE_SIZE
            break
          }
          case 'utility': {
            const t = action.target
            if (!t) return
            targetX = t.x
            targetY = t.y
            break
          }
          case 'deployMine': {
            // Mine deployment command - show marker at tile center
            targetX = action.x * TILE_SIZE + TILE_SIZE / 2
            targetY = action.y * TILE_SIZE + TILE_SIZE / 2
            break
          }
          case 'sweepArea': {
            // Sweep area command - show first tile in sweep path
            if (!action.path || action.path.length === 0) return
            const firstTile = action.path[0]
            targetX = firstTile.x * TILE_SIZE + TILE_SIZE / 2
            targetY = firstTile.y * TILE_SIZE + TILE_SIZE / 2
            break
          }
          default:
            return
        }

        const screenPrevX = prevX - scrollOffset.x
        const screenPrevY = prevY - scrollOffset.y
        const screenX = targetX - scrollOffset.x
        const screenY = targetY - scrollOffset.y

        ctx.save()
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(screenPrevX, screenPrevY)
        ctx.lineTo(screenX, screenY)
        ctx.stroke()

        const half = MOVE_TARGET_INDICATOR_SIZE / 2

        // Special rendering for sweep area commands - show entire path
        if (action.type === 'sweepArea' && action.path && action.path.length > 0) {
          // Render yellow markers for each tile in the sweep path (matching spec FR-019)
          let sweepPrevX = prevX
          let sweepPrevY = prevY

          action.path.forEach((tile, pathIdx) => {
            const sweepX = tile.x * TILE_SIZE + TILE_SIZE / 2
            const sweepY = tile.y * TILE_SIZE + TILE_SIZE / 2
            const sweepScreenX = sweepX - scrollOffset.x
            const sweepScreenY = sweepY - scrollOffset.y
            const sweepScreenPrevX = sweepPrevX - scrollOffset.x
            const sweepScreenPrevY = sweepPrevY - scrollOffset.y

            // Draw line from previous position (yellow like other PPF markers)
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)' // Yellow line
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(sweepScreenPrevX, sweepScreenPrevY)
            ctx.lineTo(sweepScreenX, sweepScreenY)
            ctx.stroke()

            // Draw yellow triangle marker (consistent with spec requirement for yellow markers)
            ctx.fillStyle = 'rgba(255, 165, 0, 0.6)' // Yellow fill
            ctx.strokeStyle = 'rgba(230, 150, 0, 0.9)' // Dark yellow outline
            ctx.beginPath()
            ctx.moveTo(sweepScreenX, sweepScreenY + half)
            ctx.lineTo(sweepScreenX - half, sweepScreenY - half)
            ctx.lineTo(sweepScreenX + half, sweepScreenY - half)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()

            // Draw sub-index number (show position within sweep path)
            if (pathIdx < 99) { // Only show numbers for first 99 positions to avoid clutter
              ctx.fillStyle = '#000'
              ctx.font = '7px Arial'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(String(pathIdx + 1), sweepScreenX, sweepScreenY - half / 2 + 2)
            }

            sweepPrevX = sweepX
            sweepPrevY = sweepY
          })

          // Update prevX/Y to end of sweep path
          const lastTile = action.path[action.path.length - 1]
          prevX = lastTile.x * TILE_SIZE + TILE_SIZE / 2
          prevY = lastTile.y * TILE_SIZE + TILE_SIZE / 2

          // Draw the main command number at the start
          ctx.fillStyle = '#000'
          ctx.font = '10px Arial'
          ctx.fontWeight = 'bold'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(idx + 1), screenX, screenY - half - 8)
        } else if (action.type !== 'utility') {
          // Standard marker for other command types
          const isDeployMine = action.type === 'deployMine'

          // Yellow for normal commands, slightly different yellow for mine deployment
          ctx.fillStyle = isDeployMine ? 'rgba(255, 200, 0, 0.7)' : 'rgba(255, 165, 0, 0.6)'
          ctx.strokeStyle = isDeployMine ? 'rgba(230, 180, 0, 0.9)' : 'rgba(230, 150, 0, 0.9)'
          ctx.beginPath()
          ctx.moveTo(screenX, screenY + half)
          ctx.lineTo(screenX - half, screenY - half)
          ctx.lineTo(screenX + half, screenY - half)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          // Draw command number
          ctx.fillStyle = '#000'
          ctx.font = '8px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(idx + 1), screenX, screenY - half / 2 + 2)

          prevX = targetX
          prevY = targetY
        } else {
          prevX = targetX
          prevY = targetY
        }

        ctx.restore()
      })
    })
  }
}

