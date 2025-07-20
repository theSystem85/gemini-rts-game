// rendering/buildingRenderer.js
import { TILE_SIZE, TURRET_RECOIL_DISTANCE, RECOIL_DURATION, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE, ATTACK_TARGET_INDICATOR_SIZE, ATTACK_TARGET_BOUNCE_SPEED, PARTY_COLORS, WIND_DIRECTION } from '../config.js'
import { getBuildingImage } from '../buildingImageMap.js'
import { gameState } from '../gameState.js'
import { selectedUnits } from '../inputHandler.js'
import { renderTurretWithImages, turretImagesAvailable } from './turretImageRenderer.js'

export class BuildingRenderer {
  constructor() {
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

  renderBuildingBase(ctx, building, scrollOffset) {
    const screenX = building.x * TILE_SIZE - scrollOffset.x
    const screenY = building.y * TILE_SIZE - scrollOffset.y
    const width = building.width * TILE_SIZE
    const height = building.height * TILE_SIZE

    // Try to get the building image synchronously first
    const img = getBuildingImage(building.type)
    
    if (img) {
      const now = performance.now()
      const elapsed = now - (building.constructionStartTime || 0)

      if (!building.constructionFinished) {
        // Calculate progress for construction animation
        const heightProgress = Math.min(elapsed / 3000, 1)
        const colorProgress = elapsed > 3000 ? Math.min((elapsed - 3000) / 2000, 1) : 0

        // Mark as finished after animation completes
        if (elapsed >= 5000) {
          building.constructionFinished = true
        }

        this.drawBuildingUnderConstruction(
          ctx,
          img,
          screenX,
          screenY,
          width,
          height,
          heightProgress,
          colorProgress
        )
      } else {
        // Image is available, draw it immediately at natural size, positioned at top-left
        this.drawBuildingImageNatural(ctx, img, screenX, screenY, width, height)
      }
    } else {
      // No image available, use fallback
      this.drawFallbackBuilding(ctx, building, screenX, screenY, width, height)
    }

    this.renderTurret(ctx, building, screenX, screenY, width, height)
    this.renderSelection(ctx, building, screenX, screenY, width, height)
    if (building.type !== 'concreteWall') {
      this.renderOwnerIndicator(ctx, building, screenX, screenY)
    }
    this.renderRepairAnimation(ctx, building, screenX, screenY, width, height)
    this.renderPendingRepairCountdown(ctx, building, screenX, screenY, width, height)
  }

  renderBuildingOverlays(ctx, building, scrollOffset) {
    const screenX = building.x * TILE_SIZE - scrollOffset.x
    const screenY = building.y * TILE_SIZE - scrollOffset.y
    const width = building.width * TILE_SIZE
    const height = building.height * TILE_SIZE

    this.renderHealthBar(ctx, building, screenX, screenY, width)
    this.renderAttackTargetIndicator(ctx, building, screenX, screenY, width, height)
    this.renderFactoryProductionProgress(ctx, building, screenX, screenY, width, height)
  }

  drawBuildingImageNatural(ctx, img, screenX, screenY, maxWidth, maxHeight) {
    // Save canvas state to isolate our rendering
    ctx.save()
    
    // Don't reset transforms - use the existing canvas state to maintain proper coordinate system
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    // Draw the image to fill the entire building grid space
    // This ensures buildings appear at the correct size and position
    ctx.drawImage(img, screenX, screenY, maxWidth, maxHeight)
    
    // Restore canvas state
    ctx.restore()
  }

  drawBuildingUnderConstruction(
    ctx,
    img,
    screenX,
    screenY,
    maxWidth,
    maxHeight,
    heightProgress,
    colorProgress
  ) {
    ctx.save()

    // Apply grayscale filter that decreases as colorProgress increases
    const grayscale = 100 - colorProgress * 100
    ctx.filter = `grayscale(${grayscale}%)`

    // Clip the image from bottom to top according to heightProgress
    const clipHeight = maxHeight * heightProgress
    ctx.beginPath()
    ctx.rect(screenX, screenY + maxHeight - clipHeight, maxWidth, clipHeight)
    ctx.clip()

    ctx.drawImage(img, screenX, screenY, maxWidth, maxHeight)

    ctx.restore()
  }

  drawFallbackBuilding(ctx, building, screenX, screenY, width, height) {
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

  renderTurret(ctx, building, screenX, screenY, width, height) {
    // Draw turret for defensive buildings
    if (building.type === 'rocketTurret' || building.type.startsWith('turretGun') || building.type === 'teslaCoil') {
      const centerX = screenX + width / 2
      const centerY = screenY + height / 2

      // For Tesla Coil, draw range indicator if selected
      if (building.type === 'teslaCoil') {
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
      // For turret guns, try image-based rendering first
      else if (building.type.startsWith('turretGun')) {
        // Try to render with images first (for turretGunV1) if the toggle is enabled
        if (gameState.useTurretImages && turretImagesAvailable(building.type)) {
          const rendered = renderTurretWithImages(ctx, building, screenX, screenY, width, height)
          if (rendered) {
            return // Successfully rendered with images, skip fallback rendering
          }
        }
        
        // Fallback to original drawing method
        const now = performance.now()
        
        // Calculate recoil offset
        let recoilOffset = 0
        if (building.recoilStartTime && now - building.recoilStartTime <= RECOIL_DURATION) {
          const progress = (now - building.recoilStartTime) / RECOIL_DURATION
          // Use a smooth easing function for recoil
          const easedProgress = 1 - Math.pow(1 - progress, 3)
          recoilOffset = TURRET_RECOIL_DISTANCE * (1 - easedProgress)
        }
        
        // Draw turret with rotation
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(building.turretDirection || 0)
        
        // Apply recoil offset (move turret backwards)
        ctx.translate(-recoilOffset, 0)

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

        // Render muzzle flash for turrets
        if (building.muzzleFlashStartTime && now - building.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
          const flashProgress = (now - building.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
          const flashAlpha = 1 - flashProgress
          const flashSize = MUZZLE_FLASH_SIZE * (1 - flashProgress * 0.5)
          
          ctx.save()
          ctx.globalAlpha = flashAlpha
          
          // Create radial gradient for muzzle flash
          const gradient = ctx.createRadialGradient(TILE_SIZE * 0.7, 0, 0, TILE_SIZE * 0.7, 0, flashSize)
          gradient.addColorStop(0, '#FFF')
          gradient.addColorStop(0.3, '#FF0')
          gradient.addColorStop(1, 'rgba(255, 165, 0, 0)')
          
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(TILE_SIZE * 0.7, 0, flashSize, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
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
        const now = performance.now()
        
        // Render muzzle flash for rocket turret (appears at center of building)
        if (building.muzzleFlashStartTime && now - building.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
          const flashProgress = (now - building.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
          const flashAlpha = 1 - flashProgress
          const flashSize = MUZZLE_FLASH_SIZE * 1.5 * (1 - flashProgress * 0.5) // Larger flash for rockets
          
          ctx.save()
          ctx.globalAlpha = flashAlpha
          
          // Create radial gradient for rocket muzzle flash
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashSize)
          gradient.addColorStop(0, '#FFF')
          gradient.addColorStop(0.2, '#FF0')
          gradient.addColorStop(0.5, '#FF4500')
          gradient.addColorStop(1, 'rgba(255, 69, 0, 0)')
          
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(centerX, centerY, flashSize, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        
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
    // Draw selection corner indicators if building is selected
    if (building.selected) {
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 2
      
      const cornerSize = 12 // Size of corner brackets
      const offset = 2 // Offset from building edge
      
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

  renderHealthBar(ctx, building, screenX, screenY, width) {
    // Only show health bar if building is damaged or selected
    const isDamaged = building.health < building.maxHealth
    const isSelected = building.selected
    
    if (!isDamaged && !isSelected) {
      return
    }
    
    // Draw health bar
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

  renderOwnerIndicator(ctx, building, screenX, screenY) {
    // Draw a small flag instead of a filled square
    const partyColor = PARTY_COLORS[building.owner] || PARTY_COLORS.player

    const width = building.width * TILE_SIZE
    const height = building.height * TILE_SIZE

    // Position the flag pole at ground level in the top left corner
    const baseX = screenX + 2
    const baseY = screenY + height - 2

    const poleHeight = 10
    const poleWidth = 2
    const flagWidth = 6 // Should not exceed previous indicator width
    const flagHeight = 4

    // Draw pole
    ctx.fillStyle = '#777' // Dark silver
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.fillRect(baseX - poleWidth / 2, baseY - poleHeight, poleWidth, poleHeight)
    ctx.strokeRect(baseX - poleWidth / 2, baseY - poleHeight, poleWidth, poleHeight)

    // Calculate waving flag polygon
    const topX = baseX + poleWidth / 2
    const topY = baseY - poleHeight + 1

    const time = performance.now()
    const amplitude = 1.5
    const segments = 3

    ctx.fillStyle = partyColor
    ctx.beginPath()
    ctx.moveTo(topX, topY)

    for (let i = 1; i <= segments; i++) {
      const t = i / segments
      const x = topX + t * flagWidth
      const wave = Math.sin(time / 200 + t * 3) * amplitude
      const y = topY + WIND_DIRECTION.y * flagWidth * t + wave
      ctx.lineTo(x, y)
    }
    for (let i = segments; i >= 0; i--) {
      const t = i / segments
      const x = topX + t * flagWidth
      const wave = Math.sin(time / 200 + t * 3 + 0.5) * amplitude
      const y = topY + flagHeight + WIND_DIRECTION.y * flagWidth * t + wave
      ctx.lineTo(x, y)
    }

    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  renderAttackTargetIndicator(ctx, building, screenX, screenY, width, height) {
    // Check if this building is in the attack group targets OR if it's currently being targeted by selected units
    const isInAttackGroupTargets = gameState.attackGroupTargets && 
                                   gameState.attackGroupTargets.some(target => target === building)
    
    // Check if any selected unit is targeting this building (for normal attacks and to show after reselection)
    const isTargetedBySelectedUnit = selectedUnits && 
                                     selectedUnits.some(selectedUnit => 
                                       selectedUnit.target === building || 
                                       (selectedUnit.attackQueue && selectedUnit.attackQueue.includes(building))
                                     )
    
    // Show red indicator if: building is in AGF targets OR being targeted by a selected unit
    const shouldShowAttackIndicator = isInAttackGroupTargets || isTargetedBySelectedUnit
    
    if (shouldShowAttackIndicator) {
      const now = performance.now()
      const bounceOffset = Math.sin(now * ATTACK_TARGET_BOUNCE_SPEED) * 3 // 3 pixel bounce
      
      // Position above the building center
      const indicatorX = screenX + width / 2
      const indicatorY = screenY - 15 + bounceOffset
      
      // Draw semi-transparent red triangle (50% transparency, half size)
      ctx.save()
      ctx.fillStyle = 'rgba(255, 0, 0, 0.35)' // Reduced from 0.7 to 0.35
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)' // Reduced from 1.0 to 0.5
      ctx.lineWidth = 1
      
      const halfSize = ATTACK_TARGET_INDICATOR_SIZE / 2 // Half the original size
      
      // Draw triangle pointing down
      ctx.beginPath()
      ctx.moveTo(indicatorX, indicatorY + halfSize)
      ctx.lineTo(indicatorX - halfSize, indicatorY - halfSize)
      ctx.lineTo(indicatorX + halfSize, indicatorY - halfSize)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      
      ctx.restore()
    }
  }

  renderRepairAnimation(ctx, building, screenX, screenY, width, height) {
    // Check if this building is currently under repair
    const isUnderRepair = gameState.buildingsUnderRepair && 
                          gameState.buildingsUnderRepair.some(repair => repair.building === building)
    
    if (!isUnderRepair || !this.wrenchIcon) {
      return
    }
    
    const now = performance.now()
    const cycleTime = 4000 // 4 second cycle time
    const cycleProgress = (now % cycleTime) / cycleTime
    
    // Create smooth in-out fading animation
    // Alpha varies from 0.3 to 1.0 in a sine wave pattern
    const alpha = 0.3 + 0.7 * (Math.sin(cycleProgress * Math.PI * 2) * 0.5 + 0.5)
    
    // Position at center of building
    const centerX = screenX + width / 2
    const centerY = screenY + height / 2
    
    // Icon size - 3x bigger than before, scale based on building size but cap it
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

  renderPendingRepairCountdown(ctx, building, screenX, screenY, width, height) {
    // Check if this building has a pending repair with countdown
    const pendingRepair = gameState.buildingsAwaitingRepair && 
                         gameState.buildingsAwaitingRepair.find(repair => repair.building === building)
    
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

  renderFactoryProductionProgress(ctx, building, screenX, screenY, width, height) {
    // Check if this is a factory (construction yard or vehicle factory) that's currently building something
    let factory = null
    let isFactory = false
    let currentlyBuilding = null
    let buildStartTime = null
    let buildDuration = null
    
    // Check if it's a construction yard factory
    if (building.type === 'constructionYard' && building.id && gameState.factories) {
      factory = gameState.factories.find(f => f.id === building.owner)
      if (factory && factory.currentlyBuilding) {
        isFactory = true
        currentlyBuilding = factory.currentlyBuilding
        buildStartTime = factory.buildStartTime
        buildDuration = factory.buildDuration
      }
    }
    // Check if it's a vehicle factory building (AI can use these for unit production)
    else if (building.type === 'vehicleFactory' && building.owner && building.owner !== gameState.humanPlayer) {
      // For enemy vehicle factories, we need to check if they're producing something
      // We can use the factory system to track this
      factory = gameState.factories?.find(f => f.id === building.owner)
      if (factory && factory.currentlyProducingUnit && 
          ['harvester', 'tank_v1', 'tank-v2', 'tank-v3', 'rocketTank'].includes(factory.currentlyProducingUnit)) {
        isFactory = true
        currentlyBuilding = factory.currentlyProducingUnit
        buildStartTime = factory.unitBuildStartTime
        buildDuration = factory.unitBuildDuration
      }
    }
    
    if (!isFactory || !currentlyBuilding) {
      return
    }
    
    const now = performance.now()
    const elapsed = now - (buildStartTime || 0)
    const progress = Math.min(elapsed / (buildDuration || 5000), 1)
    
    if (progress <= 0 || progress >= 1) {
      return // No progress to show
    }
    
    // Position the progress bar below the health bar to avoid overlap
    // Health bar is at screenY - 10, so we place this at screenY - 16 (6px gap + 3px height)
    const progressBarWidth = width
    const progressBarHeight = 3
    const progressBarX = screenX
    const progressBarY = screenY - 16
    
    ctx.save()
    
    // Background bar
    ctx.fillStyle = '#333'
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
    
    // Progress fill (blue color for production)
    ctx.fillStyle = '#4CAF50' // Green for building production
    if (['harvester', 'tank_v1', 'tank-v2', 'tank-v3', 'rocketTank'].includes(currentlyBuilding)) {
      ctx.fillStyle = '#2196F3' // Blue for unit production
    }
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight)
    
    // Border
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
    
    // Show what's being built (text above the progress bar)
    if (building.owner !== gameState.humanPlayer) { // Only show for enemy factories
      ctx.fillStyle = '#FFF'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      
      // Create more readable building names
      let displayName = currentlyBuilding
      if (currentlyBuilding === 'tank_v1') displayName = 'Tank'
      else if (currentlyBuilding === 'tank-v2') displayName = 'Tank V2'
      else if (currentlyBuilding === 'tank-v3') displayName = 'Tank V3'
      else if (currentlyBuilding === 'rocketTank') displayName = 'Rocket Tank'
      else if (currentlyBuilding === 'oreRefinery') displayName = 'Refinery'
      else if (currentlyBuilding === 'vehicleFactory') displayName = 'Vehicle Factory'
      else if (currentlyBuilding === 'powerPlant') displayName = 'Power Plant'
      else if (currentlyBuilding === 'turretGunV1') displayName = 'Turret'
      else if (currentlyBuilding === 'turretGunV2') displayName = 'Turret V2'
      else if (currentlyBuilding === 'turretGunV3') displayName = 'Turret V3'
      else if (currentlyBuilding === 'rocketTurret') displayName = 'Rocket Turret'
      else if (currentlyBuilding === 'radarStation') displayName = 'Radar'
      else if (currentlyBuilding === 'teslaCoil') displayName = 'Tesla Coil'
      else if (currentlyBuilding === 'harvester') displayName = 'Harvester'
      
      // Add black outline for better readability
      ctx.strokeText(displayName, screenX + width / 2, screenY - 18)
      ctx.fillText(displayName, screenX + width / 2, screenY - 18)
    }
    
    ctx.restore()
  }

  renderBases(ctx, buildings, scrollOffset) {
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        this.renderBuildingBase(ctx, building, scrollOffset)
      })
    }
  }

  renderOverlays(ctx, buildings, scrollOffset) {
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        this.renderBuildingOverlays(ctx, building, scrollOffset)
      })
    }
  }
}
