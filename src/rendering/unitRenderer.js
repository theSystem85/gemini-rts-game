// rendering/unitRenderer.js
import { TILE_SIZE, HARVESTER_CAPPACITY, HARVESTER_UNLOAD_TIME, RECOIL_DISTANCE, RECOIL_DURATION, MUZZLE_FLASH_DURATION, MUZZLE_FLASH_SIZE, TANK_FIRE_RANGE, ATTACK_TARGET_INDICATOR_SIZE, ATTACK_TARGET_BOUNCE_SPEED, UNIT_TYPE_COLORS, PARTY_COLORS, TANKER_SUPPLY_CAPACITY, UTILITY_SERVICE_INDICATOR_SIZE, UTILITY_SERVICE_INDICATOR_BOUNCE_SPEED, SERVICE_DISCOVERY_RANGE, SERVICE_SERVING_RANGE } from '../config.js'
import { gameState } from '../gameState.js'
import { selectedUnits } from '../inputHandler.js'
import { renderTankWithImages, areTankImagesLoaded } from './tankImageRenderer.js'
import { renderHarvesterWithImage, isHarvesterImageLoaded } from './harvesterImageRenderer.js'
import { renderRocketTankWithImage, isRocketTankImageLoaded } from './rocketTankImageRenderer.js'
import { renderHowitzerWithImage, isHowitzerImageLoaded } from './howitzerImageRenderer.js'
import { renderAmbulanceWithImage, isAmbulanceImageLoaded } from './ambulanceImageRenderer.js'
import { renderTankerTruckWithImage, isTankerTruckImageLoaded } from './tankerTruckImageRenderer.js'
import { renderRecoveryTankWithImage, isRecoveryTankImageLoaded } from './recoveryTankImageRenderer.js'
import { renderApacheWithImage, preloadApacheImages } from './apacheImageRenderer.js'
import { getExperienceProgress, initializeUnitLeveling } from '../utils.js'

export class UnitRenderer {
  constructor() {
    this.repairIcon = null
    this.loadRepairIcon()
    preloadApacheImages()
  }

  loadRepairIcon() {
    this.repairIcon = new Image()
    this.repairIcon.src = '/cursors/wrench_cursor.svg'
    this.repairIcon.onerror = () => {
      console.warn('Failed to load workshop repair indicator icon')
      this.repairIcon = null
    }
  }

  renderUnitBody(ctx, unit, centerX, centerY) {
    if (unit.type === 'apache') {
      if (renderApacheWithImage(ctx, unit, centerX, centerY)) {
        return
      }
    }
    // Use consistent colors for unit types regardless of owner
    ctx.fillStyle = UNIT_TYPE_COLORS[unit.type] || '#0000FF' // Default to blue if type not found

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

    // Draw front direction indicator (triangle) - use party color for this
    ctx.fillStyle = PARTY_COLORS[unit.owner] || PARTY_COLORS.player
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
    // Harvesters use image rendering. Show mining bar only if image not loaded
    if (unit.type === 'harvester') {
      if (!isHarvesterImageLoaded()) {
        this.renderHarvesterMiningBar(ctx, unit, centerX, centerY)
      }
      return
    }

    // Ambulances don't have turrets
    if (unit.type === 'ambulance') {
      return
    }

    if (unit.type === 'apache') {
      return
    }

    const now = performance.now()

    // Special handling for rocket tanks - render fallback tubes only if image not loaded
    if (unit.type === 'rocketTank' && !isRocketTankImageLoaded()) {
      this.renderRocketTubes(ctx, unit, centerX, centerY, now)
      return
    }
    if (unit.type === 'recoveryTank' && !isRecoveryTankImageLoaded()) {
      // no special fallback
    }

    if (unit.type === 'howitzer') {
      return
    }

    // Calculate recoil offset
    let recoilOffset = 0
    if (unit.recoilStartTime && now - unit.recoilStartTime <= RECOIL_DURATION) {
      const progress = (now - unit.recoilStartTime) / RECOIL_DURATION
      // Use a smooth easing function for recoil
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      recoilOffset = RECOIL_DISTANCE * (1 - easedProgress)
    }

    // Draw turret for combat units - use the turretDirection for rotation
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.turretDirection)

    // Apply recoil offset (move turret backwards)
    ctx.translate(-recoilOffset, 0)

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(TILE_SIZE / 2, 0)
    ctx.stroke()

    // Render muzzle flash
    if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
      const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
      const flashAlpha = 1 - flashProgress
      const flashSize = MUZZLE_FLASH_SIZE * (1 - flashProgress * 0.5)

      ctx.save()
      ctx.globalAlpha = flashAlpha

      // Create radial gradient for muzzle flash
      const gradient = ctx.createRadialGradient(TILE_SIZE / 2, 0, 0, TILE_SIZE / 2, 0, flashSize)
      gradient.addColorStop(0, '#FFF')
      gradient.addColorStop(0.3, '#FF0')
      gradient.addColorStop(1, 'rgba(255, 165, 0, 0)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(TILE_SIZE / 2, 0, flashSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

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
    // Draw selection corner indicators if unit is selected (like buildings)
    if (unit.selected) {
      ctx.strokeStyle = '#FF0'
      ctx.lineWidth = 2

      const cornerSize = 8 // Size of corner brackets (smaller than buildings)
      const offset = 2 // Offset from unit edge
      const halfTile = TILE_SIZE / 2

      // Calculate unit bounds
      const left = centerX - halfTile - offset
      const right = centerX + halfTile + offset
      const top = centerY - halfTile - offset
      const bottom = centerY + halfTile + offset

      // Top-left corner
      ctx.beginPath()
      ctx.moveTo(left, top + cornerSize)
      ctx.lineTo(left, top)
      ctx.lineTo(left + cornerSize, top)
      ctx.stroke()

      // Top-right corner
      ctx.beginPath()
      ctx.moveTo(right - cornerSize, top)
      ctx.lineTo(right, top)
      ctx.lineTo(right, top + cornerSize)
      ctx.stroke()

      // Bottom-left corner
      ctx.beginPath()
      ctx.moveTo(left, bottom - cornerSize)
      ctx.lineTo(left, bottom)
      ctx.lineTo(left + cornerSize, bottom)
      ctx.stroke()

      // Bottom-right corner
      ctx.beginPath()
      ctx.moveTo(right - cornerSize, bottom)
      ctx.lineTo(right, bottom)
      ctx.lineTo(right, bottom - cornerSize)
      ctx.stroke()
    }
  }

  renderUtilityServiceRange(ctx, unit, centerX, centerY) {
    if (!unit?.selected) return

    const rangeInTiles = unit?.isUtilityUnit ? SERVICE_SERVING_RANGE : undefined
    if (!rangeInTiles) return

    const radius = rangeInTiles * TILE_SIZE

    ctx.save()
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  renderAlertMode(ctx, unit, centerX, centerY) {
    // If unit is alert, draw an outer red circle.
    if (unit.alertMode && (unit.type === 'tank-v2' || unit.isUtilityUnit)) {
      const now = performance.now()
      const pulse = Math.sin(now * 0.005) * 0.3 + 0.7 // Pulsing effect between 0.4 and 1.0

      ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(centerX, centerY, TILE_SIZE / 2, 0, 2 * Math.PI)
      ctx.stroke()

      // Add inner range indicator
      ctx.strokeStyle = `rgba(255, 100, 100, ${pulse * 0.3})`
      ctx.lineWidth = 1
      ctx.beginPath()
      const indicatorRange = unit.isUtilityUnit ? SERVICE_DISCOVERY_RANGE : TANK_FIRE_RANGE
      ctx.arc(centerX, centerY, indicatorRange * TILE_SIZE, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }

  renderHealthBar(ctx, unit, scrollOffset) {
    // Only show health bar if unit is damaged or selected
    const isDamaged = unit.health < unit.maxHealth
    const isSelected = unit.selected

    if (!isDamaged && !isSelected) {
      return
    }

    // Draw health bar with party colors for owner distinction
    const unitHealthRatio = unit.health / unit.maxHealth
    const healthBarWidth = TILE_SIZE * 0.8
    const healthBarHeight = 4
    const healthBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - healthBarWidth / 2
    const healthBarY = unit.y - 10 - scrollOffset.y
    ctx.strokeStyle = '#000'
    ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight)

    // Use red color for critically damaged units (below 25% health when speed penalty kicks in)
    // Otherwise use party colors for health bar fill
    if (unitHealthRatio < 0.25) {
      ctx.fillStyle = '#FF0000' // Red for critical health
    } else {
      ctx.fillStyle = PARTY_COLORS[unit.owner] || PARTY_COLORS.player
    }
    ctx.fillRect(healthBarX, healthBarY, healthBarWidth * unitHealthRatio, healthBarHeight)
  }

  renderHarvesterProgress(ctx, unit, scrollOffset) {
    // Handle harvester progress, ambulance crew, and experience progress for combat units
    let progress = 0
    let barColor = '#FFD700' // Default gold
    let shouldShowBar = false

    if (unit.type === 'harvester') {
      // Harvester-specific progress logic
      shouldShowBar = true

      if (unit.unloadingAtRefinery && unit.unloadStartTime) {
        // Show unloading progress (reverse direction)
        const unloadProgress = Math.min((performance.now() - unit.unloadStartTime) / HARVESTER_UNLOAD_TIME, 1)
        progress = 1 - unloadProgress // Reverse the progress
        barColor = '#FF6B6B' // Red-ish for unloading
      } else if (unit.harvesting && unit.harvestTimer) {
        // Show harvesting progress
        progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1)
        barColor = '#32CD32' // Green for harvesting
      } else {
        // Show current ore load
        progress = unit.oreCarried / HARVESTER_CAPPACITY
        barColor = '#FFD700' // Gold for ore
      }
    } else if (unit.type === 'ambulance') {
      // Ambulance crew loading bar
      shouldShowBar = true
      progress = (unit.medics || 0) / (unit.maxMedics || 10)
      barColor = '#00FFFF' // Cyan for ambulance crew
    } else if (unit.type === 'tankerTruck') {
      shouldShowBar = true
      progress = (unit.supplyGas || 0) / (unit.maxSupplyGas || TANKER_SUPPLY_CAPACITY)
      barColor = '#4A90E2'
    } else {
      // Combat unit experience progress
      initializeUnitLeveling(unit)
      const expProgress = getExperienceProgress(unit)

      // Only show experience bar for selected combat units below max level
      if (unit.level < 3 && unit.selected) {
        shouldShowBar = true
        progress = expProgress
        barColor = '#FFFF00' // Bright yellow for experience
      }
    }

    if (shouldShowBar) {
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

  renderGasBar(ctx, unit, scrollOffset) {
    if (!unit.selected || typeof unit.maxGas !== 'number') return

    const ratio = unit.gas / unit.maxGas

    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y
    const halfTile = TILE_SIZE / 2
    const cornerSize = 8
    const offset = 2

    const right = centerX + halfTile + offset
    const top = centerY - halfTile - offset
    const bottom = centerY + halfTile + offset

    const barWidth = 3
    const barHeight = bottom - top - cornerSize * 2
    const barX = right - barWidth - 1
    const barTop = top + cornerSize

    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barTop, barWidth, barHeight)

    const fillHeight = barHeight * ratio
    ctx.fillStyle = '#4A90E2'
    ctx.fillRect(barX, barTop + barHeight - fillHeight, barWidth, fillHeight)

    ctx.strokeStyle = '#000'
    ctx.strokeRect(barX, barTop, barWidth, barHeight)
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
  renderCrewStatus(ctx, unit, scrollOffset) {
    if (!unit.selected || !unit.crew) return

    const size = 5
    const baseX = unit.x - scrollOffset.x
    const baseY = unit.y + TILE_SIZE - scrollOffset.y
    const colors = { driver: '#00F', gunner: '#F00', loader: '#FFA500', commander: '#006400' }
    const letters = { driver: 'D', gunner: 'G', loader: 'L', commander: 'C' }

    ctx.save()
    let idx = 0
    Object.entries(unit.crew).forEach(([role, alive]) => {
      if (!alive) return

      const x = baseX + idx * (size + 2)
      const y = baseY

      const rectHeight = size * 2 * 0.7

      ctx.fillStyle = colors[role]
      ctx.fillRect(x, y - rectHeight, size, rectHeight)

      ctx.fillStyle = '#FFF'
      ctx.font = '4px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letters[role], x + size / 2, y - rectHeight / 2)

      idx++
    })
    ctx.restore()
  }

  renderAttackTargetIndicator(ctx, unit, centerX, centerY) {
    // Check if this unit is in the attack group targets OR if it's currently being targeted by selected units
    const isInAttackGroupTargets = gameState.attackGroupTargets &&
                                   gameState.attackGroupTargets.some(target => target === unit)

    // Check if any selected unit is targeting this unit (for normal attacks and to show after reselection)
    const isTargetedBySelectedUnit = selectedUnits &&
                                     selectedUnits.some(selectedUnit =>
                                       (selectedUnit.target && selectedUnit.target.id === unit.id) ||
                                       (selectedUnit.attackQueue && selectedUnit.attackQueue.some(target => target.id === unit.id))
                                     )

    // Show red indicator if: unit is in AGF targets OR being targeted by a selected unit
    const shouldShowAttackIndicator = isInAttackGroupTargets || isTargetedBySelectedUnit

    if (shouldShowAttackIndicator) {
      const now = performance.now()
      const bounceOffset = Math.sin(now * ATTACK_TARGET_BOUNCE_SPEED) * 3 // 3 pixel bounce

      // Position above the health bar
      const indicatorX = centerX
      const indicatorY = centerY - TILE_SIZE / 2 - 15 + bounceOffset

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

  getUtilityQueuePosition(selectedUnit, targetUnit, overrideType = null) {
    if (!selectedUnit || !targetUnit || selectedUnit.id === targetUnit.id) {
      return null
    }

    const queue = selectedUnit.utilityQueue
    if (queue) {
      const targetType = overrideType || 'unit'
      const currentType = queue.currentTargetType || 'unit'
      if (queue.currentTargetId === targetUnit.id && currentType === targetType) {
        return 1
      }
      if (Array.isArray(queue.targets)) {
        const index = queue.targets.findIndex(entry => {
          if (!entry) return false
          if (typeof entry === 'object') {
            const entryType = entry.type || 'unit'
            return entry.id === targetUnit.id && entryType === targetType
          }
          return entry === targetUnit.id && targetType === 'unit'
        })
        if (index !== -1) {
          return (queue.currentTargetId ? 2 : 1) + index
        }
      }
    }

    switch (selectedUnit.type) {
      case 'recoveryTank':
        if (selectedUnit.repairTarget?.id === targetUnit.id) return 1
        if (selectedUnit.repairTargetUnit?.id === targetUnit.id) return 1
        if (selectedUnit.towedUnit?.id === targetUnit.id) return 1
        return null
      case 'ambulance':
        return selectedUnit.healingTarget?.id === targetUnit.id ? 1 : null
      case 'tankerTruck':
        if (selectedUnit.refuelTarget?.id === targetUnit.id) return 1
        if (selectedUnit.emergencyTarget?.id === targetUnit.id) return 1
        return null
      default:
        return null
    }
  }

  renderUtilityServiceIndicator(ctx, unit, centerX, centerY) {
    const isBeingServedByAmbulance = Boolean(unit?.beingServedByAmbulance)

    let queuePosition = null
    const hasSelectedUnits = Array.isArray(selectedUnits) && selectedUnits.length > 0

    // Avoid drawing duplicate utility indicators while path planning mode (Alt) is active.
    // However, still show active service indicators even when path planning is enabled.
    if (hasSelectedUnits && !gameState.altKeyDown) {
      selectedUnits.forEach(selectedUnit => {
        if (!selectedUnit?.selected) return
        if (!selectedUnit.type || (selectedUnit.type !== 'ambulance' && selectedUnit.type !== 'tankerTruck' && selectedUnit.type !== 'recoveryTank')) {
          return
        }
        const position = this.getUtilityQueuePosition(selectedUnit, unit)
        if (position !== null) {
          queuePosition = queuePosition === null ? position : Math.min(queuePosition, position)
        }
      })
    }

    if (!isBeingServedByAmbulance) {
      if (!hasSelectedUnits || gameState.altKeyDown || queuePosition === null) {
        return
      }
    }

    const now = performance.now()
    const bounceOffset = Math.sin(now * UTILITY_SERVICE_INDICATOR_BOUNCE_SPEED) * 3
    const baseIndicatorY = centerY - TILE_SIZE / 2 - 15 + bounceOffset
    const indicatorX = centerX
    const indicatorY = baseIndicatorY - UTILITY_SERVICE_INDICATOR_SIZE - 4
    const halfSize = UTILITY_SERVICE_INDICATOR_SIZE / 2

    ctx.save()
    ctx.fillStyle = 'rgba(255, 215, 0, 0.45)'
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)'
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.moveTo(indicatorX, indicatorY + halfSize)
    ctx.lineTo(indicatorX - halfSize, indicatorY - halfSize)
    ctx.lineTo(indicatorX + halfSize, indicatorY - halfSize)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    if (queuePosition !== null) {
      ctx.fillStyle = '#000'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(queuePosition), indicatorX, indicatorY - halfSize / 3 + 2)
    }

    ctx.restore()
  }

  renderWorkshopRepairIndicator(ctx, unit, centerX, centerY) {
    if (!unit?.repairingAtWorkshop) {
      return
    }

    const iconSize = TILE_SIZE * 0.75
    const bounce = Math.sin(performance.now() / 250) * 3
    const iconX = centerX - iconSize / 2
    const iconY = centerY - TILE_SIZE / 2 - iconSize - 6 + bounce

    ctx.save()
    if (this.repairIcon) {
      ctx.globalAlpha = 0.9
      ctx.drawImage(this.repairIcon, iconX, iconY, iconSize, iconSize)
    } else {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.85)'
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  renderLevelStars(ctx, unit, scrollOffset) {
    // Only render stars for combat units with levels > 0
    if (unit.type === 'harvester' || !unit.level || unit.level <= 0) {
      return
    }

    initializeUnitLeveling(unit)

    // Position stars above the health bar
    const starSize = 6
    const starSpacing = 8
    const totalWidth = (unit.level * starSpacing) - (starSpacing - starSize)
    const startX = unit.x + TILE_SIZE / 2 - scrollOffset.x - totalWidth / 2
    const starY = unit.y - 20 - scrollOffset.y // Above health bar
    ctx.save()
    ctx.fillStyle = '#FFD700' // Gold color for stars
    ctx.strokeStyle = '#FFA500' // Orange outline
    ctx.lineWidth = 1

    for (let i = 0; i < unit.level; i++) {
      const starX = startX + (i * starSpacing)

      // Draw a simple 5-pointed star
      ctx.beginPath()
      for (let j = 0; j < 5; j++) {
        const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2 // Start at top
        const outerRadius = starSize / 2
        const innerRadius = starSize / 4

        if (j === 0) {
          ctx.moveTo(starX + outerRadius * Math.cos(angle), starY + outerRadius * Math.sin(angle))
        } else {
          ctx.lineTo(starX + outerRadius * Math.cos(angle), starY + outerRadius * Math.sin(angle))
        }

        // Inner point
        const innerAngle = angle + (2 * Math.PI) / 10
        ctx.lineTo(starX + innerRadius * Math.cos(innerAngle), starY + innerRadius * Math.sin(innerAngle))
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    ctx.restore()
  }

  renderUnitBase(ctx, unit, scrollOffset) {
    if (!this.shouldRenderUnit(unit)) return

    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y

    // Check if this is a tank type and if image rendering is enabled
    const isTank = ['tank_v1', 'tank-v2', 'tank-v3', 'tank_v2', 'tank_v3'].includes(unit.type)
    const useTankImage = gameState.useTankImages && isTank && areTankImagesLoaded(unit.type)

    if (unit.type === 'harvester' && isHarvesterImageLoaded()) {
      const ok = renderHarvesterWithImage(ctx, unit, centerX, centerY)
      if (ok) {
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
    }

    if (unit.type === 'rocketTank' && isRocketTankImageLoaded()) {
      const ok = renderRocketTankWithImage(ctx, unit, centerX, centerY)
      if (ok) {
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
    }

    if (unit.type === 'recoveryTank' && isRecoveryTankImageLoaded()) {
      const ok = renderRecoveryTankWithImage(ctx, unit, centerX, centerY)
      if (ok) {
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
    }

    if (unit.type === 'ambulance' && isAmbulanceImageLoaded()) {
      const ok = renderAmbulanceWithImage(ctx, unit, centerX, centerY)
      if (ok) {
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
    }

    if (unit.type === 'tankerTruck' && isTankerTruckImageLoaded()) {
      const ok = renderTankerTruckWithImage(ctx, unit, centerX, centerY)
      if (ok) {
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
    }

    if (useTankImage) {
      // Try to render with images
      const imageRenderSuccess = renderTankWithImages(ctx, unit, centerX, centerY)

      if (imageRenderSuccess) {
        // Image rendering successful, still render other components
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
      // If image rendering failed, fall through to original rendering
    }

    if (unit.type === 'howitzer' && isHowitzerImageLoaded()) {
      const ok = renderHowitzerWithImage(ctx, unit, centerX, centerY)
      if (ok) {
        this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
        this.renderSelection(ctx, unit, centerX, centerY)
        this.renderAlertMode(ctx, unit, centerX, centerY)
        return
      }
    }

    // Original rendering method (for non-tanks or when image rendering is disabled/failed)
    this.renderUnitBody(ctx, unit, centerX, centerY)
    this.renderUtilityServiceRange(ctx, unit, centerX, centerY)
    this.renderSelection(ctx, unit, centerX, centerY)
    this.renderAlertMode(ctx, unit, centerX, centerY)
    this.renderTurret(ctx, unit, centerX, centerY)
  }

  renderUnitOverlay(ctx, unit, scrollOffset) {
    if (!this.shouldRenderUnit(unit)) return

    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y

    this.renderHealthBar(ctx, unit, scrollOffset)
    this.renderGasBar(ctx, unit, scrollOffset)
    this.renderLevelStars(ctx, unit, scrollOffset)
    this.renderHarvesterProgress(ctx, unit, scrollOffset)
    this.renderQueueNumber(ctx, unit, scrollOffset)
    this.renderGroupNumber(ctx, unit, scrollOffset)
    this.renderCrewStatus(ctx, unit, scrollOffset)
    this.renderAttackTargetIndicator(ctx, unit, centerX, centerY)
    this.renderUtilityServiceIndicator(ctx, unit, centerX, centerY)
    this.renderWorkshopRepairIndicator(ctx, unit, centerX, centerY)
    this.renderRecoveryProgressBar(ctx, unit, scrollOffset)
  }

  renderBases(ctx, units, scrollOffset) {
    units.forEach(unit => {
      this.renderUnitBase(ctx, unit, scrollOffset)
    })
  }

  renderOverlays(ctx, units, scrollOffset) {
    units.forEach(unit => {
      this.renderTowCable(ctx, unit, scrollOffset)
      this.renderFuelHose(ctx, unit, units, scrollOffset)
      this.renderUnitOverlay(ctx, unit, scrollOffset)
    })
  }

  renderFuelHose(ctx, unit, units, scrollOffset) {
    if (!unit || unit.type !== 'tankerTruck' || !unit.refuelTarget) {
      return
    }

    const targetInfo = unit.refuelTarget
    const target = (targetInfo && targetInfo.id !== undefined)
      ? units.find(u => u.id === targetInfo.id) || targetInfo
      : targetInfo

    if (!target || target.health <= 0) {
      return
    }

    if (typeof target.tileX !== 'number' || typeof target.tileY !== 'number') {
      return
    }

    const dx = Math.abs(target.tileX - unit.tileX)
    const dy = Math.abs(target.tileY - unit.tileY)

    if (dx > 1 || dy > 1) {
      return
    }

    if ((unit.movement && unit.movement.isMoving) || (target.movement && target.movement.isMoving)) {
      return
    }

    const startX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const startY = unit.y + TILE_SIZE / 2 - scrollOffset.y
    const targetX = (typeof target.x === 'number') ? target.x : target.tileX * TILE_SIZE
    const targetY = (typeof target.y === 'number') ? target.y : target.tileY * TILE_SIZE
    const endX = targetX + TILE_SIZE / 2 - scrollOffset.x
    const endY = targetY + TILE_SIZE / 2 - scrollOffset.y

    ctx.save()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.restore()
  }

  renderTowCable(ctx, unit, scrollOffset) {
    if (!unit || !unit.towedWreck) return
    const wreck = unit.towedWreck
    const startX = unit.x + TILE_SIZE / 2 - scrollOffset.x
    const startY = unit.y + TILE_SIZE / 2 - scrollOffset.y
    const endX = wreck.x + TILE_SIZE / 2 - scrollOffset.x
    const endY = wreck.y + TILE_SIZE / 2 - scrollOffset.y

    ctx.save()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.restore()
  }

  renderRecoveryProgressBar(ctx, unit, scrollOffset) {
    if (!unit || !unit.recoveryTask || unit.recoveryTask.mode !== 'recycle' || unit.recoveryTask.state !== 'recycling') {
      return
    }

    const progress = Math.max(0, Math.min(1, unit.recoveryProgress || 0))
    const barWidth = TILE_SIZE
    const barHeight = 4
    const x = unit.x - scrollOffset.x
    const y = unit.y - scrollOffset.y - 6

    ctx.save()
    ctx.fillStyle = 'rgba(30, 70, 140, 0.35)'
    ctx.fillRect(x, y, barWidth, barHeight)
    ctx.fillStyle = '#4BA6FF'
    ctx.fillRect(x, y, barWidth * progress, barHeight)
    ctx.strokeStyle = '#0D2A57'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, barWidth, barHeight)
    ctx.restore()
  }

  shouldRenderUnit(unit) {
    if (!unit || unit.health <= 0) return false

    if (!gameState.shadowOfWarEnabled) {
      return true
    }

    const visibilityMap = gameState.visibilityMap
    if (!visibilityMap || !visibilityMap.length) {
      return true
    }

    const friendlyOwners = new Set([gameState.humanPlayer, 'player'])
    if (gameState.humanPlayer === 'player1') {
      friendlyOwners.add('player1')
    }

    if (friendlyOwners.has(unit.owner)) {
      return true
    }

    const tileX = Math.floor((unit.x + TILE_SIZE / 2) / TILE_SIZE)
    const tileY = Math.floor((unit.y + TILE_SIZE / 2) / TILE_SIZE)

    if (
      tileY < 0 ||
      tileY >= visibilityMap.length ||
      tileX < 0 ||
      tileX >= (visibilityMap[tileY]?.length || 0)
    ) {
      return false
    }

    const visibility = visibilityMap[tileY]?.[tileX]
    return Boolean(visibility && visibility.visible)
  }

  renderRocketTubes(ctx, unit, centerX, centerY, now) {
    // Draw 3 static rocket tubes on top of the tank
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(unit.direction) // Use body direction instead of turret direction

    // Calculate recoil offset for rocket tubes
    let recoilOffset = 0
    if (unit.recoilStartTime && now - unit.recoilStartTime <= RECOIL_DURATION) {
      const progress = (now - unit.recoilStartTime) / RECOIL_DURATION
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      recoilOffset = RECOIL_DISTANCE * 0.5 * (1 - easedProgress) // Smaller recoil for rockets
    }

    // Apply recoil offset
    ctx.translate(-recoilOffset, 0)

    // Draw 3 rocket tubes in a row
    const tubeWidth = 3
    const tubeLength = TILE_SIZE * 0.4
    const tubeSpacing = 6

    for (let i = 0; i < 3; i++) {
      const tubeY = (i - 1) * tubeSpacing // Center tube at 0, others at +/- spacing

      ctx.fillStyle = '#444'
      ctx.fillRect(0, tubeY - tubeWidth / 2, tubeLength, tubeWidth)

      // Add tube caps
      ctx.fillStyle = '#222'
      ctx.fillRect(tubeLength - 2, tubeY - tubeWidth / 2, 2, tubeWidth)
    }

    // Render muzzle flash for rocket tubes
    if (unit.muzzleFlashStartTime && now - unit.muzzleFlashStartTime <= MUZZLE_FLASH_DURATION) {
      const flashProgress = (now - unit.muzzleFlashStartTime) / MUZZLE_FLASH_DURATION
      const flashAlpha = 1 - flashProgress
      const flashSize = MUZZLE_FLASH_SIZE * 0.8 * (1 - flashProgress * 0.5)

      ctx.save()
      ctx.globalAlpha = flashAlpha

      // Create muzzle flash for each tube
      for (let i = 0; i < 3; i++) {
        const tubeY = (i - 1) * tubeSpacing

        const gradient = ctx.createRadialGradient(tubeLength, tubeY, 0, tubeLength, tubeY, flashSize)
        gradient.addColorStop(0, '#FFF')
        gradient.addColorStop(0.3, '#FF0')
        gradient.addColorStop(0.7, '#FF4500')
        gradient.addColorStop(1, 'rgba(255, 69, 0, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(tubeLength, tubeY, flashSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.restore()
  }
}
