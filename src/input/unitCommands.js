// unitCommands.js
import { TILE_SIZE, TANK_FIRE_RANGE } from '../config.js'
import { findPath } from '../units.js'
import { playSound, playPositionalSound } from '../sound.js'
import { gameState } from '../gameState.js'
import { cancelRetreatForUnits } from '../behaviours/retreat.js'
import { forceHarvesterUnloadPriority } from '../game/harvesterLogic.js'
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
    // Clear attack group feature state when issuing movement commands
    this.clearAttackGroupState(selectedUnits)

    // Cancel retreat for all selected units when issuing movement commands
    cancelRetreatForUnits(selectedUnits)

    if (!skipQueueClear) {
          selectedUnits.forEach(unit => {
        unit.commandQueue = []
        unit.currentCommand = null
      })
    }

    const count = selectedUnits.length

    let anyMoved = false
    selectedUnits.forEach((unit, index) => {
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
      const alreadyTargeted = selectedUnits.slice(0, index).some(u =>
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
      const path = findPath(
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
      }

    })
    if (anyMoved) {
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
