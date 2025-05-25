// rendering/buildingRenderer.js
import { TILE_SIZE } from '../config.js'
import { getBuildingImage } from '../buildingImageMap.js'

export class BuildingRenderer {
  renderBuilding(ctx, building, scrollOffset) {
    const screenX = building.x * TILE_SIZE - scrollOffset.x
    const screenY = building.y * TILE_SIZE - scrollOffset.y
    const width = building.width * TILE_SIZE
    const height = building.height * TILE_SIZE

    // Use the building image if available
    getBuildingImage(building.type, width, height, (img) => {
      if (img) {
        // Draw the building image
        ctx.drawImage(img, screenX, screenY, width, height)
      } else {
        // Fallback to the old rectangle rendering if no image is available
        ctx.fillStyle = '#777'
        ctx.fillRect(screenX, screenY, width, height)

        // Draw building outline
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.strokeRect(screenX, screenY, width, height)

        // Draw building type identifier as text
        ctx.fillStyle = '#fff'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(building.type, screenX + width / 2, screenY + height / 2)
      }
    })

    this.renderTurret(ctx, building, screenX, screenY, width, height)
    this.renderSelection(ctx, building, screenX, screenY, width, height)
    this.renderHealthBar(ctx, building, screenX, screenY, width)
    this.renderOwnerIndicator(ctx, building, screenX, screenY)
  }

  renderTurret(ctx, building, screenX, screenY, width, height) {
    // Draw turret for defensive buildings
    if (building.type === 'rocketTurret' || building.type.startsWith('turretGun') || building.type === 'teslaCoil') {
      const centerX = screenX + width / 2
      const centerY = screenY + height / 2

      // For Tesla Coil, draw a special base and range indicator
      if (building.type === 'teslaCoil') {
        // Draw Tesla Coil base
        ctx.save()
        ctx.translate(centerX, centerY)
        // Draw coil base
        ctx.fillStyle = '#222'
        ctx.beginPath()
        ctx.arc(0, 0, 14, 0, Math.PI * 2)
        ctx.fill()
        // Draw coil core
        ctx.fillStyle = '#ff0'
        ctx.beginPath()
        ctx.arc(0, 0, 7, 0, Math.PI * 2)
        ctx.fill()
        // Draw blue electric ring
        ctx.strokeStyle = '#0cf'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, 11, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()

        // Draw range indicator if selected
        if (building.selected) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.25)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(centerX, centerY, building.fireRange * TILE_SIZE, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }
      // For turret guns, draw rotating barrel
      else if (building.type.startsWith('turretGun')) {
        // Draw turret with rotation
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(building.turretDirection || 0)

        // Draw the turret barrel with different styles based on turret type
        if (building.type === 'turretGunV1') {
          // V1 - Basic turret
          ctx.strokeStyle = '#00F'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(TILE_SIZE * 0.7, 0)
          ctx.stroke()
        } else if (building.type === 'turretGunV2') {
          // V2 - Advanced targeting turret
          ctx.strokeStyle = '#0FF'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(TILE_SIZE * 0.8, 0)
          ctx.stroke()

          // Add targeting reticle
          ctx.strokeStyle = '#0FF'
          ctx.beginPath()
          ctx.arc(TILE_SIZE * 0.4, 0, 4, 0, Math.PI * 2)
          ctx.stroke()
        } else if (building.type === 'turretGunV3') {
          // V3 - Heavy burst fire turret
          ctx.strokeStyle = '#FF0'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(TILE_SIZE * 0.9, 0)
          ctx.stroke()

          // Draw double barrel
          ctx.strokeStyle = '#FF0'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(TILE_SIZE * 0.3, -3)
          ctx.lineTo(TILE_SIZE * 0.9, -3)
          ctx.moveTo(TILE_SIZE * 0.3, 3)
          ctx.lineTo(TILE_SIZE * 0.9, 3)
          ctx.stroke()
        }

        // Draw turret base
        ctx.fillStyle = '#222'
        ctx.beginPath()
        ctx.arc(0, 0, 8, 0, Math.PI * 2)
        ctx.fill()

        // Draw ready indicator if the turret can fire
        if (!building.lastShotTime || performance.now() - building.lastShotTime >= building.fireCooldown) {
          ctx.fillStyle = '#0F0'
          ctx.beginPath()
          ctx.arc(0, 0, 4, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      } else if (building.type === 'rocketTurret') {
        // For rocket turret, only draw the ready indicator in bottom left corner
        if (!building.lastShotTime || performance.now() - building.lastShotTime >= building.fireCooldown) {
          ctx.fillStyle = '#0F0'
          ctx.beginPath()
          ctx.arc(screenX + 10, screenY + height - 10, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Draw range indicator if selected (for non-tesla coil buildings)
      if (building.selected && building.type !== 'teslaCoil') {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
        ctx.beginPath()
        ctx.arc(centerX, centerY, building.fireRange * TILE_SIZE, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  renderSelection(ctx, building, screenX, screenY, width, height) {
    // Draw selection outline if building is selected
    if (building.selected) {
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 3
      ctx.strokeRect(
        screenX - 2,
        screenY - 2,
        width + 4,
        height + 4
      )
    }
  }

  renderHealthBar(ctx, building, screenX, screenY, width) {
    // Draw health bar if damaged
    if (building.health < building.maxHealth) {
      const healthBarWidth = width
      const healthBarHeight = 5
      const healthPercentage = building.health / building.maxHealth

      // Background
      ctx.fillStyle = '#333'
      ctx.fillRect(screenX, screenY - 10, healthBarWidth, healthBarHeight)

      // Health
      ctx.fillStyle = healthPercentage > 0.6 ? '#0f0' :
        healthPercentage > 0.3 ? '#ff0' : '#f00'
      ctx.fillRect(screenX, screenY - 10, healthBarWidth * healthPercentage, healthBarHeight)
    }
  }

  renderOwnerIndicator(ctx, building, screenX, screenY) {
    // Draw owner indicator
    const ownerColor = building.owner === 'player' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'
    ctx.fillStyle = ownerColor
    ctx.fillRect(
      screenX + 2,
      screenY + 2,
      8,
      8
    )
  }

  render(ctx, buildings, scrollOffset) {
    // Draw buildings if they exist
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        this.renderBuilding(ctx, building, scrollOffset)
      })
    }
  }
}
