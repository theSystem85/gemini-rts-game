import { TILE_SIZE, MOVE_TARGET_INDICATOR_SIZE } from '../config.js'
import { gameState } from '../gameState.js'

export class PathPlanningRenderer {
  render(ctx, units, scrollOffset) {
    if (!units) return

    const actionsForUnit = unit => {
      const list = []
      if (unit.currentCommand) list.push(unit.currentCommand)
      if (unit.commandQueue && unit.commandQueue.length > 0) {
        list.push(...unit.commandQueue)
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

        ctx.fillStyle = 'rgba(255, 165, 0, 0.6)'
        ctx.strokeStyle = 'rgba(230, 150, 0, 0.9)'
        const half = MOVE_TARGET_INDICATOR_SIZE / 2
        ctx.beginPath()
        ctx.moveTo(screenX, screenY + half)
        ctx.lineTo(screenX - half, screenY - half)
        ctx.lineTo(screenX + half, screenY - half)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#000'
        ctx.font = '8px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // Position the number slightly lower so it sits inside the triangle
        ctx.fillText(String(idx + 1), screenX, screenY - half / 2 + 3)
        ctx.restore()

        prevX = targetX
        prevY = targetY
      })
    })
  }
}

