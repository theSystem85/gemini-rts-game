// unitMovement.js - Handles all unit movement logic
import { TILE_SIZE, PATH_CALC_INTERVAL, PATHFINDING_THRESHOLD, ATTACK_PATH_CALC_INTERVAL, MOVE_TARGET_REACHED_THRESHOLD } from '../config.js'
import { gameState } from '../gameState.js'
import { findPath, updateUnitOccupancy, removeUnitOccupancy } from '../units.js'
import { getCachedPath } from './pathfinding.js'
import { selectedUnits, cleanupDestroyedSelectedUnits } from '../inputHandler.js'
import { angleDiff, smoothRotateTowardsAngle, findAdjacentTile } from '../logic.js'
import { updateUnitPosition, initializeUnitMovement, stopUnitMovement } from './unifiedMovement.js'
import { updateRetreatBehavior, shouldExitRetreat, cancelRetreat } from '../behaviours/retreat.js'
import { logPerformance } from '../performanceUtils.js'

/**
 * Updates unit movement, pathfinding, and formation handling
 */
export const updateUnitMovement = logPerformance(function _updateUnitMovement(units, mapGrid, occupancyMap, gameState, now, factories = null) {
  // Clean up unit selection - prevent null references
  cleanupDestroyedSelectedUnits()

  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i]

    // Skip destroyed units and remove them
    if (unit.health <= 0) {
      // Remove unit from selected units if it was selected
      if (unit.selected) {
        const idx = selectedUnits.findIndex(u => u === unit)
        if (idx !== -1) {
          selectedUnits.splice(idx, 1)
        }
      }
      
      // Remove unit from cheat system tracking if it exists
      if (window.cheatSystem) {
        window.cheatSystem.removeUnitFromTracking(unit.id)
      }
      
      if (!unit.occupancyRemoved) {
        removeUnitOccupancy(unit, occupancyMap)
      }
      units.splice(i, 1)
      continue
    }

    // Initialize movement system for all units
    initializeUnitMovement(unit)

    // Store previous position for collision detection
    const prevX = unit.x, prevY = unit.y

    // Handle dodge completion
    if (unit.isDodging && unit.path.length === 0 && unit.originalPath) {
      unit.path = unit.originalPath
      unit.target = unit.originalTarget
      unit.originalPath = null
      unit.originalTarget = null
      unit.isDodging = false
      unit.dodgeEndTime = null
    }

    // Handle retreat behavior
    if (shouldExitRetreat(unit, now)) {
      cancelRetreat(unit)
    }

    // Update retreat behavior
    updateRetreatBehavior(unit, now, mapGrid, units)

    // Clear targets that are destroyed
    if (unit.target && unit.target.health !== undefined && unit.target.health <= 0) {
      unit.target = null
    }

    // --- ATTACK-MOVE FIX: If not retreating, and has a target, and is out of range, set moveTarget/path to target ---
    if (!unit.isRetreating && unit.target && unit.target.health > 0) {
      // Calculate distance to target center
      let targetCenterX, targetCenterY
      if (unit.target.tileX !== undefined) {
        targetCenterX = unit.target.x + TILE_SIZE / 2
        targetCenterY = unit.target.y + TILE_SIZE / 2
      } else {
        targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
        targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      }
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      const distToTarget = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY)
      // Use tank range if tank, otherwise default to 6 tiles
      const ATTACK_RANGE = (unit.type && unit.type.startsWith('tank')) ? 9 * TILE_SIZE : 6 * TILE_SIZE
      if (distToTarget > ATTACK_RANGE) {
        // Only update if not already moving to target and throttle attack pathfinding to 3 seconds
        const targetTileX = unit.target.tileX !== undefined ? Math.floor(unit.target.x / TILE_SIZE) : unit.target.x
        const targetTileY = unit.target.tileY !== undefined ? Math.floor(unit.target.y / TILE_SIZE) : unit.target.y
        const shouldRecalculatePath = !unit.moveTarget || 
          Math.abs(unit.moveTarget.x - targetCenterX) > TILE_SIZE || 
          Math.abs(unit.moveTarget.y - targetCenterY) > TILE_SIZE
        const pathRecalcNeeded = !unit.lastAttackPathCalcTime || (now - unit.lastAttackPathCalcTime > ATTACK_PATH_CALC_INTERVAL)
        
        if (shouldRecalculatePath && pathRecalcNeeded) {
          unit.moveTarget = { x: targetCenterX, y: targetCenterY }
          unit.lastAttackPathCalcTime = now
          // Use proper pathfinding with occupancy map for attack movement
          const path = getCachedPath(
            { x: unit.tileX, y: unit.tileY },
            { x: targetTileX, y: targetTileY },
            mapGrid,
            occupancyMap
          )
          if (path.length > 1) {
            unit.path = path.slice(1)
          } else {
            unit.path = [{ x: targetTileX, y: targetTileY }]
          }
        }
      } else {
        // In range, stop moving
        unit.moveTarget = null
        unit.path = []
      }
    }

    // Apply speed modifiers
    const speedMod = (typeof unit.speedModifier === 'number') ? unit.speedModifier : 1
    unit.speedModifier = speedMod

    // Use unified movement system for natural movement
    updateUnitPosition(unit, mapGrid, occupancyMap, now, units, gameState, factories)

    // Update last moved time
    if (unit.x !== prevX || unit.y !== prevY) {
      unit.lastMovedTime = now
    }

    // Clamp tile indices again after repositioning
    unit.tileX = Math.max(0, Math.min(unit.tileX || 0, mapGrid[0].length - 1))
    unit.tileY = Math.max(0, Math.min(unit.tileY || 0, mapGrid.length - 1))

    // Update rotation for units with turrets
    updateUnitRotation(unit, now)

    // Clear moveTarget when close enough and no further path exists
    if (unit.moveTarget && (!unit.path || unit.path.length === 0)) {
      const distToTarget = Math.hypot(
        unit.x / TILE_SIZE - unit.moveTarget.x,
        unit.y / TILE_SIZE - unit.moveTarget.y
      )
      if (distToTarget < MOVE_TARGET_REACHED_THRESHOLD) {
        unit.moveTarget = null
      }
    }
  }
}, false)

/**
 * Updates unit pathfinding based on movement targets
 */
export function updateUnitPathfinding(units, mapGrid, gameState) {
  const now = performance.now()
  const occupancyMap = gameState.occupancyMap

  // Update pathfinding for units with movement targets
  if (selectedUnits && selectedUnits.length > 0) {
    selectedUnits.forEach(unit => {
      if (unit.moveTarget && (!unit.lastPathCalcTime || now - unit.lastPathCalcTime > PATH_CALC_INTERVAL)) {
        const targetPos = unit.moveTarget
        let adjustedTarget = targetPos

        // Handle formation offsets
        if (unit.formationOffset) {
          const distance = Math.hypot(targetPos.x - unit.tileX, targetPos.y - unit.tileY)
          if (distance > 3) {
            adjustedTarget = {
              x: Math.floor((targetPos.x * TILE_SIZE + unit.formationOffset.x) / TILE_SIZE),
              y: Math.floor((targetPos.y * TILE_SIZE + unit.formationOffset.y) / TILE_SIZE)
            }
          }
        }

        // Compute distance to decide pathfinding strategy
        const distance = Math.hypot(adjustedTarget.x - unit.tileX, adjustedTarget.y - unit.tileY)

        // Always use occupancy map for units with targets (attack mode) or attack queues (AGF mode) to prevent moving over occupied tiles
        // For regular movement commands, use occupancy map for close range, ignore for long distance
        const isAttackMode = (unit.target && unit.target.health !== undefined) || (unit.attackQueue && unit.attackQueue.length > 0)
        const useOccupancyMap = isAttackMode || distance <= PATHFINDING_THRESHOLD
        const newPath = useOccupancyMap
          ? findPath({ x: unit.tileX, y: unit.tileY }, adjustedTarget, mapGrid, occupancyMap)
          : findPath({ x: unit.tileX, y: unit.tileY }, adjustedTarget, mapGrid, null)

        if (newPath.length > 1) {
          unit.path = newPath.slice(1)
          unit.lastPathCalcTime = now
        } else if (Math.hypot(unit.tileX - targetPos.x, unit.tileY - targetPos.y) < MOVE_TARGET_REACHED_THRESHOLD) {
          // Clear moveTarget if we've reached destination
          unit.moveTarget = null
        }
      }
    })
  }
}

/**
 * Handles spawn exit logic for newly created units
 */
export function updateSpawnExit(units, factories, mapGrid, occupancyMap) {
  const now = performance.now()

  units.forEach(unit => {
    if (unit.spawnedInFactory) {
      // Check if the unit should still be held in the factory (for AI units)
      if (unit.holdInFactory && unit.owner !== gameState.humanPlayer) {
        if (now < unit.factoryBuildEndTime) {
          // Don't allow the unit to leave the factory yet
          return
        } else {
          // Unit can now leave the factory
          unit.holdInFactory = false
        }
      }

      // Find the appropriate factory for this unit
      const factory = unit.owner === gameState.humanPlayer
        ? factories.find(f => f.id === gameState.humanPlayer || f.id === 'player')
        : factories.find(f => f.owner === unit.owner)
      
      if (factory && unit.tileX >= factory.x && unit.tileX < factory.x + factory.width &&
        unit.tileY >= factory.y && unit.tileY < factory.y + factory.height) {
        const exitTile = findAdjacentTile(factory, mapGrid)
        if (exitTile) {
          const exitPath = findPath({ x: unit.tileX, y: unit.tileY }, exitTile, mapGrid, occupancyMap)
          if (exitPath && exitPath.length > 1) {
            unit.path = exitPath.slice(1)
          }
        }
      } else {
        unit.spawnedInFactory = false
      }
    }
  })
}

/**
 * Updates unit rotation (body and turret)
 */
function updateUnitRotation(unit, now) {
  // Initialize rotation properties if missing
  if (unit.direction === undefined) unit.direction = 0
  if (unit.turretDirection === undefined) unit.turretDirection = 0
  if (unit.rotationSpeed === undefined) unit.rotationSpeed = 0.1
  if (unit.turretRotationSpeed === undefined) unit.turretRotationSpeed = unit.rotationSpeed

  let bodyNeedsRotation = false
  let bodyTargetDirection = unit.direction

  // Determine body's target direction
  if (unit.isRetreating && unit.targetDirection !== undefined) {
    // For retreat, the target direction is explicitly set by the retreat behavior.
    bodyTargetDirection = unit.targetDirection
  } else if (unit.path && unit.path.length > 0) {
    // For normal movement, face the next tile in the path.
    const nextTile = unit.path[0]
    if (nextTile && !(nextTile.x < 0 || nextTile.x >= 100 || nextTile.y < 0 || nextTile.y >= 100)) {
      const targetPos = { x: nextTile.x * TILE_SIZE, y: nextTile.y * TILE_SIZE }
      const dx = targetPos.x - unit.x
      const dy = targetPos.y - unit.y
      bodyTargetDirection = Math.atan2(dy, dx)
    }
  }

  // Rotate the body if needed
  const angleDifference = angleDiff(unit.direction, bodyTargetDirection)
  if (Math.abs(angleDifference) > 0.05) { // Small threshold to avoid jitter
    bodyNeedsRotation = true
    unit.direction = smoothRotateTowardsAngle(unit.direction, bodyTargetDirection, unit.rotationSpeed)
  } else {
    bodyNeedsRotation = false
  }
  unit.isRotating = bodyNeedsRotation

  // Update turret direction for tanks (after body direction is updated)
  if (unit.type === 'tank' || unit.type === 'tank_v1' || unit.type === 'tank-v2' || unit.type === 'tank-v3' || unit.type === 'rocketTank') {
    if (unit.target) {
      // Tank has a target - rotate turret to track target
      let targetCenterX, targetCenterY
      
      if (unit.target.tileX !== undefined) {
        // Target is a unit
        targetCenterX = unit.target.x + TILE_SIZE / 2
        targetCenterY = unit.target.y + TILE_SIZE / 2
      } else {
        // Target is a building
        targetCenterX = unit.target.x * TILE_SIZE + (unit.target.width * TILE_SIZE) / 2
        targetCenterY = unit.target.y * TILE_SIZE + (unit.target.height * TILE_SIZE) / 2
      }

      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2

      // Calculate target turret angle
      const turretAngle = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)

      // Smoothly rotate the turret using separate turret rotation speed
      unit.turretDirection = smoothRotateTowardsAngle(unit.turretDirection, turretAngle, unit.turretRotationSpeed)
      
      // Clear movement turret flag when actively targeting
      unit.turretShouldFollowMovement = false
    } else if (unit.turretShouldFollowMovement && unit.path && unit.path.length > 0) {
      // Tank is moving and turret should follow movement direction
      // Calculate direction to final destination (not just next tile)
      const finalDestination = unit.moveTarget || unit.path[unit.path.length - 1]
      const destX = finalDestination.x * TILE_SIZE + TILE_SIZE / 2
      const destY = finalDestination.y * TILE_SIZE + TILE_SIZE / 2
      const unitCenterX = unit.x + TILE_SIZE / 2
      const unitCenterY = unit.y + TILE_SIZE / 2
      
      const movementDirection = Math.atan2(destY - unitCenterY, destX - unitCenterX)
      
      // Rotate turret towards movement direction using turret rotation speed
      unit.turretDirection = smoothRotateTowardsAngle(unit.turretDirection, movementDirection, unit.turretRotationSpeed)
    }
    // If no target AND turretShouldFollowMovement is false, leave turret direction unchanged (idle state)
    
    // Clear the movement flag when path is complete
    if (!unit.path || unit.path.length === 0) {
      unit.turretShouldFollowMovement = false
    }
  }

  // Set movement restriction flag
  if (unit.isRetreating) {
    // For retreating units, `unit.canAccelerate` is managed exclusively by `updateRetreatBehavior`.
    // We don't touch it here, allowing the retreat logic to control movement.
  } else {
    // For normal movement, only accelerate if facing the right way.
    unit.canAccelerate = !bodyNeedsRotation
  }
}
