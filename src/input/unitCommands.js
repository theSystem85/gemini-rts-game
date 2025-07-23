// unitCommands.js
import { TILE_SIZE, TANK_FIRE_RANGE } from '../config.js'
import { findPath } from '../units.js'
import { playSound, playPositionalSound } from '../sound.js'
import { gameState } from '../gameState.js'
import { cancelRetreatForUnits } from '../behaviours/retreat.js'
import { forceHarvesterUnloadPriority } from '../game/harvesterLogic.js'
import { showNotification } from '../ui/notifications.js'
import { units } from '../main.js'

export class UnitCommandsHandler {

  // Helper function to clear attack group feature state for units
  clearAttackGroupState(units) {
    units.forEach(unit => {
      // Clear attack queue for this unit
      if (unit.attackQueue) {
        unit.attackQueue = null
      }
    })

    // Only clear attack group targets when explicitly requested (not based on attack queue status)
    // This allows the indicators to persist until user performs a different action
    gameState.attackGroupTargets = []
  }

  handleMovementCommand(selectedUnits, targetX, targetY, mapGrid, skipQueueClear = false) {
    // Filter out units that cannot be commanded due to missing commander
    const commandableUnits = selectedUnits.filter(unit => {
      if (unit.crew && typeof unit.crew === 'object' && !unit.crew.commander) {
        // Unit cannot be commanded without commander
        return false
      }
      return true
    })

    // If no commandable units, show notification and return
    if (commandableUnits.length === 0 && selectedUnits.some(unit => 
      unit.crew && typeof unit.crew === 'object' && !unit.crew.commander)) {
      showNotification('Cannot command units without commanders!', 2000)
      return
    }

    // Use commandable units for the rest of the function
    const unitsToCommand = commandableUnits.length > 0 ? commandableUnits : selectedUnits

    // Clear attack group feature state when issuing movement commands
    this.clearAttackGroupState(unitsToCommand)

    // Cancel retreat for all selected units when issuing movement commands
    cancelRetreatForUnits(unitsToCommand)

    if (!skipQueueClear) {
          unitsToCommand.forEach(unit => {
        unit.commandQueue = []
        unit.currentCommand = null
      })
    }

    const count = unitsToCommand.length

    let anyMoved = false
    let outOfGasCount = 0
    unitsToCommand.forEach((unit, index) => {
      unit.guardTarget = null
      unit.guardMode = false
      let formationOffset = { x: 0, y: 0 }

      const colsCount = Math.ceil(Math.sqrt(count))
      const col = index % colsCount
      const row = Math.floor(index / colsCount)

      // Apply formation offsets based on whether formation mode is active
      if (unit.formationActive && unit.formationOffset) {
        // Use stored formation offsets for this unit
        formationOffset = {
          x: unit.formationOffset.x,
          y: unit.formationOffset.y
        }
      } else {
        // Default grid formation if formation mode is not active
        const formationSpacing = TILE_SIZE * 1.2 // 1.2 tiles spacing to prevent overlap
        formationOffset = {
          x: col * formationSpacing - ((colsCount - 1) * formationSpacing) / 2,
          y: row * formationSpacing - ((colsCount - 1) * formationSpacing) / 2
        }
      }

      const destX = Math.floor(targetX) + formationOffset.x
      const destY = Math.floor(targetY) + formationOffset.y
      const originalDestTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) }

      // Check if this tile is already targeted by previously processed units
      const alreadyTargeted = unitsToCommand.slice(0, index).some(u =>
        u.moveTarget && u.moveTarget.x === originalDestTile.x && u.moveTarget.y === originalDestTile.y
      )

      // If already targeted, find an adjacent free tile instead
      let destTile = originalDestTile
      if (alreadyTargeted) {
        const directions = [
          { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
          { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ]

        for (const dir of directions) {
          const newTile = {
            x: originalDestTile.x + dir.dx,
            y: originalDestTile.y + dir.dy
          }

          // Check if this new tile is valid and not targeted
          if (newTile.x >= 0 && newTile.y >= 0 &&
              newTile.x < mapGrid[0].length && newTile.y < mapGrid.length &&
              mapGrid[newTile.y][newTile.x].type !== 'water' &&
              mapGrid[newTile.y][newTile.x].type !== 'rock' &&
              !mapGrid[newTile.y][newTile.x].building &&
              !selectedUnits.slice(0, index).some(u =>
                u.moveTarget && u.moveTarget.x === newTile.x && u.moveTarget.y === newTile.y
              )) {
            destTile = newTile
            break
          }
        }
      }

      // Fixed: correctly pass unit.tileX and unit.tileY as source coordinates
      const path =
        unit.gas <= 0 && typeof unit.maxGas === 'number'
          ? null
          : findPath(
              { x: unit.tileX, y: unit.tileY },
              destTile,
              mapGrid,
              gameState.occupancyMap
            )

      if (path && path.length > 0) {
        unit.path = path.length > 1 ? path.slice(1) : path
        // Clear any existing target when issuing a move command - but preserve turret direction
        unit.target = null
        unit.moveTarget = destTile // Store the final destination
        // Clear any previous target when moving
        unit.originalTarget = null

        // Flag that turret should rotate to movement direction for tanks
        if (unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank') {
          unit.turretShouldFollowMovement = true
        }
        unit.originalPath = null
        // Clear force attack flag when issuing a move command
        unit.forcedAttack = false
        anyMoved = true
      } else if (typeof unit.maxGas === 'number' && unit.gas <= 0) {
        outOfGasCount++
      }

    })
    if (outOfGasCount > 0) {
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('outOfGas', avgX, avgY, 0.5)
    } else if (anyMoved) {
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('movement', avgX, avgY, 0.5)
    }
  }

  handleAttackCommand(selectedUnits, target, mapGrid, isForceAttack = false, skipQueueClear = false) {
    // Clear attack group feature state when issuing single target attack commands
    // Only clear if this is not part of an attack group operation (when isForceAttack is not from AGF)
    if (!this.isAttackGroupOperation) {
      this.clearAttackGroupState(selectedUnits)
    }

    // Cancel retreat for all selected units when issuing attack commands
    cancelRetreatForUnits(selectedUnits)
    selectedUnits.forEach(u => { u.guardTarget = null; u.guardMode = false })

    if (!skipQueueClear) {
      selectedUnits.forEach(unit => {
        unit.commandQueue = []
        unit.currentCommand = null
      })
    }

    // Semicircle formation logic for attack
    // Calculate safe attack distance with explosion buffer
    const explosionSafetyBuffer = TILE_SIZE * 0.5
    const safeAttackDistance = Math.max(
      TANK_FIRE_RANGE * TILE_SIZE,
      TILE_SIZE * 2 + explosionSafetyBuffer
    ) - TILE_SIZE

    // Get semicircle formation positions
    const formationPositions = this.calculateSemicircleFormation(selectedUnits, target, safeAttackDistance)

    selectedUnits.forEach((unit, index) => {
      // Reset firing capability when issuing attack commands (in case it was disabled during retreat)
      unit.canFire = true

      const position = formationPositions[index]

      // Ensure position is within safe distance
      const unitCenter = { x: unit.x + TILE_SIZE / 2, y: unit.y + TILE_SIZE / 2 }
      const targetCenter = this.getTargetPoint(target, unitCenter)
      const finalDx = targetCenter.x - position.x
      const finalDy = targetCenter.y - position.y
      const finalDist = Math.hypot(finalDx, finalDy)

      let destX = position.x
      let destY = position.y

      if (finalDist < safeAttackDistance) {
        const scale = safeAttackDistance / finalDist
        destX = targetCenter.x - finalDx * scale
        destY = targetCenter.y - finalDy * scale
      }

      const desiredTile = {
        x: Math.floor(destX / TILE_SIZE),
        y: Math.floor(destY / TILE_SIZE)
      }

      // Find path to the target position, always respect occupancy map (including in attack mode)
      const occupancyMap = gameState.occupancyMap
      const path = findPath({ x: unit.tileX, y: unit.tileY }, desiredTile, mapGrid, occupancyMap)

      if (path && path.length > 0 && (unit.tileX !== desiredTile.x || unit.tileY !== desiredTile.y)) {
        unit.path = path.slice(1)
        unit.target = target
        unit.moveTarget = desiredTile // Store movement target for green indicator
        unit.forcedAttack = isForceAttack
      } else {
        // If already at position, just set the target
        unit.path = []
        unit.target = target
        unit.moveTarget = null // No movement needed
        unit.forcedAttack = isForceAttack
      }
    })

    // Play attacking sound for user-initiated attack commands
    playSound('attacking', 1.0)
  }

  handleRefineryUnloadCommand(selectedUnits, refinery, mapGrid) {
    selectedUnits.forEach(u => { u.commandQueue = []; u.currentCommand = null })
    // Clear attack group feature state when issuing refinery unload commands
    this.clearAttackGroupState(selectedUnits)

    let harvestersCommanded = 0

    selectedUnits.forEach(unit => {
      if (unit.type === 'harvester') {
        unit.guardTarget = null
        unit.guardMode = false
        // Force this harvester to be assigned to the clicked refinery (regardless of current ore status)
        // This will be used when the harvester next needs to unload
        unit.assignedRefinery = refinery // Store the actual refinery object

        // If harvester has ore, immediately force priority unload
        if (unit.oreCarried > 0) {
          forceHarvesterUnloadPriority(unit, refinery, units)

          // Path the harvester to the refinery immediately
          const path = findPath(
            { x: unit.tileX, y: unit.tileY },
            {
              x: refinery.x + Math.floor(refinery.width / 2),
              y: refinery.y + Math.floor(refinery.height / 2)
            },
            mapGrid,
            gameState.occupancyMap
          )

          if (path && path.length > 0) {
            unit.path = path.length > 1 ? path.slice(1) : path
            unit.target = null // Clear any combat target
            unit.moveTarget = { x: refinery.x + Math.floor(refinery.width / 2),
              y: refinery.y + Math.floor(refinery.height / 2) }
            unit.forcedAttack = false
          }
        }

        harvestersCommanded++
      }
    })

    // Play confirmed sound if at least one harvester was commanded
    if (harvestersCommanded > 0) {
      playSound('confirmed', 0.8)
    }
  }

  handleHarvesterCommand(selectedUnits, oreTarget, mapGrid) {
    selectedUnits.forEach(u => { u.commandQueue = []; u.currentCommand = null })
    // Clear attack group feature state when issuing harvester commands
    this.clearAttackGroupState(selectedUnits)

    let anyAssigned = false
    selectedUnits.forEach(unit => {
      if (unit.type === 'harvester') {
        unit.guardTarget = null
        unit.guardMode = false
        const path = findPath(
          { x: unit.tileX, y: unit.tileY },
          oreTarget,
          mapGrid,
          gameState.occupancyMap
        )

        if (path && path.length > 0) {
          unit.path = path.length > 1 ? path.slice(1) : path
          // Set the harvester's manual ore target
          unit.manualOreTarget = oreTarget
          unit.oreField = null // Clear any automatic ore field assignment
          unit.target = null // Clear any combat target
          unit.moveTarget = oreTarget
          unit.forcedAttack = false
          anyAssigned = true
        }
      }
    })

    if (anyAssigned) {
      const avgX = selectedUnits.reduce((sum, u) => sum + u.x, 0) / selectedUnits.length
      const avgY = selectedUnits.reduce((sum, u) => sum + u.y, 0) / selectedUnits.length
      playPositionalSound('movement', avgX, avgY, 0.5)
    }
  }

  handleRepairWorkshopCommand(selectedUnits, workshop, mapGrid) {
    selectedUnits.forEach(u => { u.commandQueue = []; u.currentCommand = null })
    this.clearAttackGroupState(selectedUnits)

    selectedUnits.forEach((unit, index) => {
      unit.guardTarget = null
      unit.guardMode = false
      if (!workshop.repairQueue) workshop.repairQueue = []
      if (!workshop.repairQueue.includes(unit)) {
        workshop.repairQueue.push(unit)
        unit.targetWorkshop = workshop
      }
      
      // Assign waiting positions in a line near the workshop
      // Position units in a line 2 tiles below the workshop for better queuing
      const waitingY = workshop.y + workshop.height + 1
      const waitingX = workshop.x + (index % workshop.width)
      const targetTile = { x: waitingX, y: waitingY }
      
      const path = findPath({ x: unit.tileX, y: unit.tileY }, targetTile, mapGrid, gameState.occupancyMap)
      if (path && path.length > 0) {
        unit.path = path.length > 1 ? path.slice(1) : path
        unit.moveTarget = targetTile
      } else {
        unit.x = targetTile.x * TILE_SIZE
        unit.y = targetTile.y * TILE_SIZE
        unit.tileX = targetTile.x
        unit.tileY = targetTile.y
        unit.moveTarget = null
      }
    })
    playSound('movement', 0.5)
  }

  handleAmbulanceHealCommand(selectedUnits, targetUnit, mapGrid) {
    // Filter for ambulances that can heal
    const ambulances = selectedUnits.filter(unit => 
      unit.type === 'ambulance' && unit.crew > 0
    )

    if (ambulances.length === 0) {
      showNotification('No ambulances with crew selected!', 2000)
      return
    }

    // Check if target can be healed
    if (!targetUnit.crew || typeof targetUnit.crew !== 'object') {
      showNotification('Target unit cannot be healed!', 2000)
      return
    }

    const missingCrew = Object.entries(targetUnit.crew).filter(([_, alive]) => !alive)
    if (missingCrew.length === 0) {
      showNotification('Target unit is already fully crewed!', 2000)
      return
    }

    // Assign ambulances to heal the target
    ambulances.forEach(ambulance => {
      ambulance.healingTarget = targetUnit
      ambulance.healingTimer = 0
      
      // Set path to target (within 1 tile range)
      const targetTileX = Math.floor((targetUnit.x + TILE_SIZE / 2) / TILE_SIZE)
      const targetTileY = Math.floor((targetUnit.y + TILE_SIZE / 2) / TILE_SIZE)
      
      // Find a position within 1 tile of the target
      const directions = [
        { x: 0, y: 0 },   // Same tile if possible
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
        { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
      ]
      
      let destinationFound = false
      for (const dir of directions) {
        const destX = targetTileX + dir.x
        const destY = targetTileY + dir.y
        
        if (destX >= 0 && destY >= 0 && destX < mapGrid[0].length && destY < mapGrid.length) {
          const path = findPath(
            { x: Math.floor((ambulance.x + TILE_SIZE / 2) / TILE_SIZE), 
              y: Math.floor((ambulance.y + TILE_SIZE / 2) / TILE_SIZE) },
            { x: destX, y: destY },
            mapGrid,
            null
          )
          
          if (path && path.length > 0) {
            ambulance.path = path.slice(1)
            ambulance.moveTarget = { x: destX, y: destY }
            destinationFound = true
            break
          }
        }
      }
      
      if (!destinationFound) {
        showNotification('Cannot path to target for healing!', 2000)
      }
    })
    
    playSound('movement', 0.5)
  }

  handleAmbulanceRefillCommand(selectedUnits, hospital, mapGrid) {
    // Filter for ambulances that need refilling
    const ambulances = selectedUnits.filter(unit => 
      unit.type === 'ambulance' && unit.crew < 4
    )

    if (ambulances.length === 0) {
      showNotification('No ambulances need refilling!', 2000)
      return
    }

    // Assign ambulances to refill at the hospital
    ambulances.forEach(ambulance => {
      ambulance.refillingTarget = hospital
      
      // Set path to hospital refill area (3 tiles below hospital)
      const hospitalCenterX = hospital.x + Math.floor(hospital.width / 2)
      const refillY = hospital.y + hospital.height + 1 // 1 tile below hospital
      
      // Find available position in refill area
      const refillPositions = [
        { x: hospitalCenterX - 1, y: refillY },
        { x: hospitalCenterX, y: refillY },
        { x: hospitalCenterX + 1, y: refillY },
        { x: hospitalCenterX - 1, y: refillY + 1 },
        { x: hospitalCenterX, y: refillY + 1 },
        { x: hospitalCenterX + 1, y: refillY + 1 },
        { x: hospitalCenterX - 1, y: refillY + 2 },
        { x: hospitalCenterX, y: refillY + 2 },
        { x: hospitalCenterX + 1, y: refillY + 2 }
      ]
      
      let destinationFound = false
      for (const pos of refillPositions) {
        if (pos.x >= 0 && pos.y >= 0 && pos.x < mapGrid[0].length && pos.y < mapGrid.length) {
          const path = this.findPath(ambulance, pos.x, pos.y, mapGrid)
          if (path && path.length > 0) {
            ambulance.path = path
            ambulance.moveTarget = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE }
            ambulance.target = null // Clear any attack target
            destinationFound = true
            break
          }
        }
      }
      
      if (!destinationFound) {
        showNotification('Cannot reach hospital refill area!', 2000)
        ambulance.refillingTarget = null
      }
    })
    
    playSound('movement', 0.5)
  }

  handleGasStationRefillCommand(selectedUnits, station, mapGrid) {
    const unitsNeedingGas = selectedUnits.filter(
      u => typeof u.maxGas === 'number' && u.gas < u.maxGas * 0.75
    )

    if (unitsNeedingGas.length === 0) {
      showNotification('No units need refilling!', 2000)
      return
    }

    const positions = []
    for (let x = station.x - 1; x <= station.x + station.width; x++) {
      for (let y = station.y - 1; y <= station.y + station.height; y++) {
        if (
          x >= 0 &&
          y >= 0 &&
          x < mapGrid[0].length &&
          y < mapGrid.length &&
          !(x >= station.x && x < station.x + station.width && y >= station.y && y < station.y + station.height)
        ) {
          positions.push({ x, y })
        }
      }
    }

    unitsNeedingGas.forEach((unit, index) => {
      const pos = positions[index % positions.length]
      const path = this.findPath(unit, pos.x, pos.y, mapGrid)
      if (path && path.length > 0) {
        unit.path = path
        unit.moveTarget = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE }
      }
    })

    playSound('movement', 0.5)
  }

  /**
   * Calculate semicircle attack formation positions around a target
   */
  calculateSemicircleFormation(units, target, safeAttackDistance) {
    const positions = []
    const unitCount = units.length

    // Get target center point
    const targetCenter = this.getTargetPoint(target, { x: 0, y: 0 })

    if (unitCount === 1) {
      // Single unit - position directly in front
      const angle = 0 // Face the target directly
      const x = targetCenter.x - Math.cos(angle) * safeAttackDistance
      const y = targetCenter.y - Math.sin(angle) * safeAttackDistance
      positions.push({ x, y })
    } else {
      // Multiple units - arrange in semicircle
      const arcSpan = Math.PI // 180 degrees
      const angleStep = arcSpan / Math.max(1, unitCount - 1)
      const startAngle = -arcSpan / 2 // Start from left side

      for (let i = 0; i < unitCount; i++) {
        const angle = startAngle + (i * angleStep)
        const x = targetCenter.x - Math.cos(angle) * safeAttackDistance
        const y = targetCenter.y - Math.sin(angle) * safeAttackDistance
        positions.push({ x, y })
      }
    }

    return positions
  }

  // Helper: For a given target and unit center, return the appropriate aiming point.
  // For factories, this returns the closest point on the factory rectangle.
  getTargetPoint(target, unitCenter) {
    if (target.tileX !== undefined) {
      return { x: target.x + TILE_SIZE / 2, y: target.y + TILE_SIZE / 2 }
    } else {
      const rect = {
        x: target.x * TILE_SIZE,
        y: target.y * TILE_SIZE,
        width: target.width * TILE_SIZE,
        height: target.height * TILE_SIZE
      }
      return {
        x: Math.max(rect.x, Math.min(unitCenter.x, rect.x + rect.width)),
        y: Math.max(rect.y, Math.min(unitCenter.y, rect.y + rect.height))
      }
    }
  }
}
