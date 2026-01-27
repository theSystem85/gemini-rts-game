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

    const drawTriangleIndicator = (screenX, screenY, idx, options = {}) => {
      const half = MOVE_TARGET_INDICATOR_SIZE / 2
      const fillStyle = options.fillStyle || 'rgba(255, 165, 0, 0.6)'
      const strokeStyle = options.strokeStyle || 'rgba(230, 150, 0, 0.9)'

      if (options.drawTriangle !== false) {
        ctx.fillStyle = fillStyle
        ctx.strokeStyle = strokeStyle

        ctx.beginPath()
        ctx.moveTo(screenX, screenY + half)
        ctx.lineTo(screenX - half, screenY - half)
        ctx.lineTo(screenX + half, screenY - half)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }

      ctx.fillStyle = options.textColor || '#000'
      ctx.font = options.font || '8px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(idx + 1), screenX, screenY - half / 2 + 2)
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
          case 'deployMine':
            targetX = action.x * TILE_SIZE + TILE_SIZE / 2
            targetY = action.y * TILE_SIZE + TILE_SIZE / 2
            break
          case 'sweepArea':
            // For sweep area, we point to the first point in the path
            if (action.path && action.path.length > 0) {
              targetX = action.path[0].x * TILE_SIZE + TILE_SIZE / 2
              targetY = action.path[0].y * TILE_SIZE + TILE_SIZE / 2
            } else {
              return // No path left
            }
            break
          case 'utility': {
            const t = action.target
            if (!t) return
            targetX = t.x
            targetY = t.y
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

        if (action.type !== 'utility') {
          const markerStyle = {
            fillStyle: 'rgba(255, 165, 0, 0.6)',
            strokeStyle: 'rgba(230, 150, 0, 0.9)'
          }
          
          // Custom colors for mine commands
          if (action.type === 'deployMine') {
            markerStyle.fillStyle = 'rgba(255, 50, 50, 0.6)' // Reddish for mines
            markerStyle.strokeStyle = 'rgba(200, 0, 0, 0.9)'
          } else if (action.type === 'sweepArea') {
            markerStyle.fillStyle = 'rgba(200, 200, 50, 0.6)' // Yellowish for sweep
            markerStyle.strokeStyle = 'rgba(180, 180, 0, 0.9)'
          }

          drawTriangleIndicator(screenX, screenY, idx, markerStyle)
        } else {
          drawTriangleIndicator(screenX, screenY, idx, { drawTriangle: false })
        }
        ctx.restore()

        prevX = targetX
        prevY = targetY
      })
    })

    if (gameState.moveWaypointsVisible) {
      units.forEach(unit => {
        if (!unit.selected || !unit.path || unit.path.length === 0) return

        let prevX = unit.x + TILE_SIZE / 2
        let prevY = unit.y + TILE_SIZE / 2

        unit.path.forEach((tile, idx) => {
          const targetX = tile.x * TILE_SIZE + TILE_SIZE / 2
          const targetY = tile.y * TILE_SIZE + TILE_SIZE / 2

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

          drawTriangleIndicator(screenX, screenY, idx)
          ctx.restore()

          prevX = targetX
          prevY = targetY
        })
      })
    }
    
    // Render detailed sweep paths for sweepArea commands
    units.forEach(unit => {
      if (!unit.selected || !unit.commandQueue) return
      
      unit.commandQueue.forEach((action, cmdIdx) => {
        if (action.type === 'sweepArea' && action.path && action.path.length > 1) {
          // Draw path line
          ctx.save()
          ctx.strokeStyle = 'rgba(255, 200, 0, 0.4)'
          ctx.lineWidth = 2
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          
          action.path.forEach((tile, idx) => {
            const screenX = tile.x * TILE_SIZE + TILE_SIZE / 2 - scrollOffset.x
            const screenY = tile.y * TILE_SIZE + TILE_SIZE / 2 - scrollOffset.y
            if (idx === 0) {
              ctx.moveTo(screenX, screenY)
            } else {
              ctx.lineTo(screenX, screenY)
            }
          })
          ctx.stroke()
          ctx.setLineDash([])
          
          // Draw small numbered markers along the path (only show first 10 for clarity)
          const maxToShow = Math.min(action.path.length, 10)
          const step = Math.max(1, Math.floor(action.path.length / maxToShow))
          
          for (let i = 0; i < action.path.length; i += step) {
            if (i >= maxToShow) break
            const tile = action.path[i]
            const screenX = tile.x * TILE_SIZE + TILE_SIZE / 2 - scrollOffset.x
            const screenY = tile.y * TILE_SIZE + TILE_SIZE / 2 - scrollOffset.y
            
            // Small circle
            ctx.fillStyle = 'rgba(255, 200, 0, 0.5)'
            ctx.beginPath()
            ctx.arc(screenX, screenY, 4, 0, Math.PI * 2)
            ctx.fill()
            
            // Number
            ctx.fillStyle = '#000'
            ctx.font = '7px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(i + 1), screenX, screenY)
          }
          
          ctx.restore()
        }
      })
    })
  }
}
