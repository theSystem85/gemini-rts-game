// rendering/factoryRenderer.js
import { TILE_SIZE, PARTY_COLORS } from '../config.js'
import { gameState } from '../gameState.js'
import { tileToPixel } from '../utils.js'
import { getBuildingImage } from '../buildingImageMap.js'
import { buildingImageMap } from '../buildingImageMap.js'

export class FactoryRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager
    // Cache for the wrench icon
    this.wrenchIcon = null
    this.loadWrenchIcon()
  }

  loadWrenchIcon() {
    this.wrenchIcon = new Image()
    this.wrenchIcon.src = '/cursors/repair.svg'
    this.wrenchIcon.onerror = () => {
      console.warn('Failed to load repair cursor icon for repair animation')
      this.wrenchIcon = null
    }
  }

  renderFactoryBase(ctx, factory, screenX, screenY, width, height) {
    // Use the construction yard image for factories
    getBuildingImage('constructionYard', (img) => {
      if (img) {
        // Calculate the scale to fit the image within the factory's grid space
        // while maintaining aspect ratio and positioning at top-left
        const maxWidth = width
        const maxHeight = height
        
        // Calculate scale to fit within the grid space
        const scaleX = maxWidth / img.width
        const scaleY = maxHeight / img.height
        const scale = Math.min(scaleX, scaleY, 1) // Don't scale up beyond original size
        
        // Calculate the final dimensions
        const drawWidth = img.width * scale
        const drawHeight = img.height * scale
        
        // Draw the construction yard image at top-left corner
        ctx.drawImage(img, screenX, screenY, drawWidth, drawHeight)

        // Draw a small colored indicator in the corner using party colors
        const indicatorColor = PARTY_COLORS[factory.id] || PARTY_COLORS[factory.owner] || (factory.id === gameState.humanPlayer ? '#0A0' : '#A00')
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
        ctx.fillStyle = factory.id === gameState.humanPlayer ? '#0A0' : '#A00'
        ctx.fillRect(screenX, screenY, width, height)
      }
    })
  }

  renderHealthBar(ctx, factory, screenX, screenY, width) {
    // Only show health bar if factory is damaged or selected
    const isDamaged = factory.health < factory.maxHealth
    const isSelected = factory.selected
    
    if (!isDamaged && !isSelected) {
      return
    }
    
    // Draw health bar
    const barWidth = width
    const healthRatio = factory.health / factory.maxHealth
    ctx.fillStyle = '#0F0'
    ctx.fillRect(screenX, screenY - 10, barWidth * healthRatio, 5)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(screenX, screenY - 10, barWidth, 5)
  }

  renderSelection(ctx, factory, screenX, screenY, width, height) {
    // Draw selection corner indicators for selected factories
    if (factory.selected) {
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 2
      
      const cornerSize = 12 // Size of corner brackets
      const offset = 2 // Offset from factory edge
      
      // Top-left corner
      ctx.beginPath()
      ctx.moveTo(screenX - offset, screenY - offset + cornerSize)
      ctx.lineTo(screenX - offset, screenY - offset)
      ctx.lineTo(screenX - offset + cornerSize, screenY - offset)
      ctx.stroke()
      
      // Top-right corner
      ctx.beginPath()
      ctx.moveTo(screenX + width + offset - cornerSize, screenY - offset)
      ctx.lineTo(screenX + width + offset, screenY - offset)
      ctx.lineTo(screenX + width + offset, screenY - offset + cornerSize)
      ctx.stroke()
      
      // Bottom-left corner
      ctx.beginPath()
      ctx.moveTo(screenX - offset, screenY + height + offset - cornerSize)
      ctx.lineTo(screenX - offset, screenY + height + offset)
      ctx.lineTo(screenX - offset + cornerSize, screenY + height + offset)
      ctx.stroke()
      
      // Bottom-right corner
      ctx.beginPath()
      ctx.moveTo(screenX + width + offset - cornerSize, screenY + height + offset)
      ctx.lineTo(screenX + width + offset, screenY + height + offset)
      ctx.lineTo(screenX + width + offset, screenY + height + offset - cornerSize)
      ctx.stroke()
    }
  }

  renderCurrentlyBuilding(ctx, factory, screenX, screenY, width, height) {
    // Show what AI players are currently building (if anything)
    if (factory.id !== gameState.humanPlayer && factory.currentlyBuilding) {
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
    if (factory.id !== gameState.humanPlayer && factory.budget !== undefined) {
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
    this.renderRepairAnimation(ctx, factory, screenX, screenY, width, height)
    this.renderPendingRepairCountdown(ctx, factory, screenX, screenY, width, height)
  }

  renderRepairAnimation(ctx, factory, screenX, screenY, width, height) {
    // Check if this factory is currently under repair
    const isUnderRepair = gameState.buildingsUnderRepair && 
                          gameState.buildingsUnderRepair.some(repair => repair.building === factory)
    
    if (!isUnderRepair || !this.wrenchIcon) {
      return
    }
    
    const now = performance.now()
    const cycleTime = 4000 // 4 second cycle time
    const cycleProgress = (now % cycleTime) / cycleTime
    
    // Create smooth in-out fading animation
    // Alpha varies from 0.3 to 1.0 in a sine wave pattern
    const alpha = 0.3 + 0.7 * (Math.sin(cycleProgress * Math.PI * 2) * 0.5 + 0.5)
    
    // Position at center of factory
    const centerX = screenX + width / 2
    const centerY = screenY + height / 2
    
    // Icon size - 3x bigger than before, scale based on factory size but cap it
    const iconSize = Math.min(72, Math.min(width, height) * 1.2)
    
    ctx.save()
    ctx.globalAlpha = alpha
    
    try {
      // Draw the repair cursor icon in yellow
      // Use canvas color manipulation to make it yellow
      ctx.filter = 'hue-rotate(40deg) saturate(2) brightness(1.5)'
      ctx.drawImage(
        this.wrenchIcon,
        centerX - iconSize / 2,
        centerY - iconSize / 2,
        iconSize,
        iconSize
      )
      
    } catch (error) {
      // Fallback: draw a simple wrench shape if image fails
      ctx.filter = 'none'
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})` // Gold color
      ctx.strokeStyle = `rgba(255, 165, 0, ${alpha})` // Orange outline
      ctx.lineWidth = 3
      
      // Draw simple wrench shape - 3x bigger
      const wrenchSize = iconSize * 0.8
      ctx.beginPath()
      // Handle
      ctx.rect(centerX - wrenchSize/8, centerY - wrenchSize/2, wrenchSize/4, wrenchSize * 0.6)
      // Head
      ctx.rect(centerX - wrenchSize/3, centerY + wrenchSize/6, wrenchSize * 0.6, wrenchSize/4)
      ctx.fill()
      ctx.stroke()
    }
    
    ctx.restore()
  }

  renderPendingRepairCountdown(ctx, factory, screenX, screenY, width, height) {
    // Check if this factory has a pending repair with countdown
    const pendingRepair = gameState.buildingsAwaitingRepair && 
                         gameState.buildingsAwaitingRepair.find(repair => repair.building === factory)
    
    if (!pendingRepair) {
      return
    }
    
    // Use the pre-computed countdown from the awaiting repair system
    const secondsRemaining = pendingRepair.remainingCooldown
    
    if (secondsRemaining <= 0) {
      return // Countdown is over
    }
    
    // Calculate progress (reverse progress bar: 100% to 0%)
    const progress = secondsRemaining / 10 // 10 seconds total
    
    // Position above the health bar to avoid overlap with selection markers
    // Health bar is at screenY - 10, so we place this at screenY - 13 (3px height)
    const progressBarWidth = width // Same width as health bar
    const progressBarHeight = 3 // Same height as harvester loading bars
    const progressBarX = screenX
    const progressBarY = screenY - 13
    
    ctx.save()
    
    // Background bar
    ctx.fillStyle = '#333'
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
    
    // Progress fill (red color for attack cooldown)
    ctx.fillStyle = '#ff4444'
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight)
    
    ctx.restore()
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
