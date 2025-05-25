// rendering/factoryRenderer.js
import { TILE_SIZE } from '../config.js'
import { tileToPixel } from '../utils.js'
import { getBuildingImage } from '../buildingImageMap.js'
import { buildingImageMap } from '../buildingImageMap.js'

export class FactoryRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager
  }

  renderFactoryBase(ctx, factory, screenX, screenY, width, height) {
    // Use the construction yard image for factories
    getBuildingImage('constructionYard', width, height, (img) => {
      if (img) {
        // Draw the construction yard image without color overlay
        ctx.drawImage(img, screenX, screenY, width, height)

        // Draw a small colored indicator in the corner instead of an overlay
        const indicatorColor = factory.id === 'player' ? '#0A0' : '#A00'
        ctx.fillStyle = indicatorColor
        ctx.fillRect(
          screenX + 4,
          screenY + 4,
          12,
          12
        )

        // Add border around the indicator
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 1
        ctx.strokeRect(
          screenX + 4,
          screenY + 4,
          12,
          12
        )
      } else {
        // Fallback to the original colored rectangle if image fails to load
        ctx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00'
        ctx.fillRect(screenX, screenY, width, height)
      }
    })
  }

  renderHealthBar(ctx, factory, screenX, screenY, width) {
    // Draw health bar
    const barWidth = width
    const healthRatio = factory.health / factory.maxHealth
    ctx.fillStyle = '#0F0'
    ctx.fillRect(screenX, screenY - 10, barWidth * healthRatio, 5)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(screenX, screenY - 10, barWidth, 5)
  }

  renderSelection(ctx, factory, screenX, screenY, width, height) {
    // Draw yellow selection outline for selected factories
    if (factory.selected) {
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

  renderCurrentlyBuilding(ctx, factory, screenX, screenY, width, height) {
    // Show what the enemy is currently building (if anything)
    if (factory.id === 'enemy' && factory.currentlyBuilding) {
      // Calculate center of factory for image placement
      const centerX = screenX + (width / 2)
      const centerY = screenY + (height / 2)

      // Draw image or icon of what's being built
      const iconSize = TILE_SIZE * 2 // Keep the 2x size

      // Create a backdrop/background for the icon
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(
        centerX - iconSize / 2,
        centerY - iconSize / 2,
        iconSize,
        iconSize
      )

      // Get the correct image path based on what is being built
      let imagePath

      // First check if it's a building
      if (buildingImageMap[factory.currentlyBuilding]) {
        // It's a building, use its path from buildingImageMap
        imagePath = buildingImageMap[factory.currentlyBuilding]
      }
      // Then check if it's a unit
      else if (this.textureManager.getUnitImageMap()[factory.currentlyBuilding]) {
        // It's a unit, use its path from unitImageMap
        imagePath = this.textureManager.getUnitImageMap()[factory.currentlyBuilding]
      }
      // Special handling for turret guns
      else if (factory.currentlyBuilding.startsWith('turretGun')) {
        const version = factory.currentlyBuilding.slice(-2).toLowerCase()
        imagePath = `images/turret_gun_${version}.jpg`
      }
      // Fallback case
      else {
        // This is a fallback path, using lowercase name
        imagePath = `images/${factory.currentlyBuilding.toLowerCase()}`
      }

      // Use the image cache function instead of creating a new Image every time
      // If the path already has an extension, use it as is; otherwise try multiple extensions
      const hasExtension = /\.(jpg|webp|png)$/.test(imagePath)
      const imagePathToUse = hasExtension ? imagePath.replace(/\.(jpg|webp|png)$/, '') : imagePath
      const extensionsToTry = hasExtension ? [imagePath.match(/\.(jpg|webp|png)$/)[1], 'jpg', 'webp', 'png'] : ['jpg', 'webp', 'png']

      this.textureManager.getOrLoadImage(imagePathToUse, extensionsToTry, (img) => {
        if (img) {
          ctx.drawImage(img,
            centerX - iconSize / 2,
            centerY - iconSize / 2,
            iconSize,
            iconSize
          )
        } else {
          // Fallback if no image could be loaded
          ctx.fillStyle = '#FFF'
          ctx.font = '16px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(
            factory.currentlyBuilding,
            centerX,
            centerY
          )
        }
      })

      this.renderBuildProgress(ctx, factory, centerX, centerY, iconSize)
    }
  }

  renderBuildProgress(ctx, factory, centerX, centerY, iconSize) {
    // Add a "building" progress border
    const now = performance.now()
    const progress = Math.min((now - factory.buildStartTime) / factory.buildDuration, 1)

    ctx.strokeStyle = '#FF0'
    ctx.lineWidth = 3

    // Draw progress border segments - scaled with iconSize
    if (progress < 0.25) {
      // First segment (top)
      ctx.beginPath()
      ctx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX - iconSize / 2 + iconSize * (progress * 4), centerY - iconSize / 2)
      ctx.stroke()
    } else if (progress < 0.5) {
      // Top complete, drawing right side
      ctx.beginPath()
      ctx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2 + iconSize * ((progress - 0.25) * 4))
      ctx.stroke()
    } else if (progress < 0.75) {
      // Right complete, drawing bottom
      ctx.beginPath()
      ctx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2, centerY + iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2 - iconSize * ((progress - 0.5) * 4), centerY + iconSize / 2)
      ctx.stroke()
    } else {
      // Bottom complete, drawing left
      ctx.beginPath()
      ctx.moveTo(centerX - iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2, centerY - iconSize / 2)
      ctx.lineTo(centerX + iconSize / 2, centerY + iconSize / 2)
      ctx.lineTo(centerX - iconSize / 2, centerY + iconSize / 2)
      ctx.lineTo(centerX - iconSize / 2, centerY + iconSize / 2 - iconSize * ((progress - 0.75) * 4))
      ctx.stroke()
    }
  }

  renderBudget(ctx, factory, screenX, screenY) {
    if (factory.id === 'enemy' && factory.budget !== undefined) {
      ctx.fillStyle = '#FFF'
      ctx.font = '12px Arial'
      ctx.fillText(`Budget: ${factory.budget}`, screenX, screenY - 20)
    }
  }

  renderFactory(ctx, factory) {
    if (factory.destroyed) return
    const pos = tileToPixel(factory.x, factory.y)
    const screenX = pos.x - factory.scrollOffset?.x || 0
    const screenY = pos.y - factory.scrollOffset?.y || 0
    const width = factory.width * TILE_SIZE
    const height = factory.height * TILE_SIZE

    this.renderFactoryBase(ctx, factory, screenX, screenY, width, height)
    this.renderHealthBar(ctx, factory, screenX, screenY, width)
    this.renderSelection(ctx, factory, screenX, screenY, width, height)
    this.renderCurrentlyBuilding(ctx, factory, screenX, screenY, width, height)
    this.renderBudget(ctx, factory, screenX, screenY)
  }

  render(ctx, factories, scrollOffset) {
    // Draw factories.
    factories.forEach(factory => {
      // Store scroll offset temporarily for rendering
      factory.scrollOffset = scrollOffset
      this.renderFactory(ctx, factory)
      delete factory.scrollOffset
    })
  }
}
