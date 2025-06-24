// rendering/buildingRenderer.js
import { TILE_SIZE, TURRET_RECOIL_DISTANCE, RECOIL_DURATION, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE, ATTACK_TARGET_INDICATOR_SIZE, ATTACK_TARGET_BOUNCE_SPEED, PARTY_COLORS } from '../config.js'
import { getBuildingImage } from '../buildingImageMap.js'
import { gameState } from '../gameState.js'
import { selectedUnits } from '../inputHandler.js'

export class BuildingRenderer {
  renderBuilding(ctx, building, scrollOffset) {
    const screenX = building.x * TILE_SIZE - scrollOffset.x
    const screenY = building.y * TILE_SIZE - scrollOffset.y
    const width = building.width * TILE_SIZE
    const height = building.height * TILE_SIZE

    // Try to get the building image synchronously first
    const img = getBuildingImage(building.type)
    
    if (img) {
      // Image is available, draw it immediately at natural size, positioned at top-left
      this.drawBuildingImageNatural(ctx, img, screenX, screenY, width, height)
    } else {
      // No image available, use fallback
      this.drawFallbackBuilding(ctx, building, screenX, screenY, width, height)
    }

    this.renderTurret(ctx, building, screenX, screenY, width, height)
    this.renderSelection(ctx, building, screenX, screenY, width, height)
    this.renderHealthBar(ctx, building, screenX, screenY, width)
    this.renderOwnerIndicator(ctx, building, screenX, screenY)
    this.renderAttackTargetIndicator(ctx, building, screenX, screenY, width, height)
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
      // For turret guns, draw rotating barrel
      else if (building.type.startsWith('turretGun')) {
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
    // Draw owner indicator using party colors
    const partyColor = PARTY_COLORS[building.owner] || PARTY_COLORS.player
    const ownerColor = partyColor.replace(')', ', 0.3)').replace('rgb', 'rgba')
    ctx.fillStyle = ownerColor
    ctx.fillRect(
      screenX + 2,
      screenY + 2,
      8,
      8
    )
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

  render(ctx, buildings, scrollOffset) {
    // Draw buildings if they exist
    if (buildings && buildings.length > 0) {
      buildings.forEach(building => {
        this.renderBuilding(ctx, building, scrollOffset)
      })
    }
  }
}
