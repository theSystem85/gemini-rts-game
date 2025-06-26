// Path Finding Module - Handles unit pathfinding and formation management
import { PATH_CALC_INTERVAL, PATHFINDING_THRESHOLD, TILE_SIZE, ATTACK_PATH_CALC_INTERVAL } from '../config.js'
import { findPath } from '../units.js'

/**
 * Updates unit pathfinding with formation support and throttling
 * @param {Array} units - Array of unit objects
 * @param {Array} mapGrid - 2D array representing the map
 * @param {Object} occupancyMap - Map of occupied tiles
 * @param {Object} gameState - Game state object
 */
export function updateGlobalPathfinding(units, mapGrid, occupancyMap, gameState) {
  const now = performance.now()
  
  if (!gameState.lastGlobalPathCalc || now - gameState.lastGlobalPathCalc > PATH_CALC_INTERVAL) {
    gameState.lastGlobalPathCalc = now

    // Group units by formation to calculate centers before path recalculations
    const formationGroups = {}

    // First pass: identify all formation groups and calculate centers
    units.forEach(unit => {
      if (unit.formationActive && unit.groupNumber) {
        if (!formationGroups[unit.groupNumber]) {
          formationGroups[unit.groupNumber] = {
            units: [],
            centerX: 0,
            centerY: 0
          }
        }
        formationGroups[unit.groupNumber].units.push(unit)
      }
    })

    // Calculate the center position of each formation group
    Object.values(formationGroups).forEach(group => {
      if (group.units.length > 0) {
        group.centerX = group.units.reduce((sum, unit) => sum + unit.x, 0) / group.units.length
        group.centerY = group.units.reduce((sum, unit) => sum + unit.y, 0) / group.units.length
      }
    })

    // Second pass: recalculate paths for all units
    units.forEach(unit => {
      // Only recalculate if unit has no path or is near the end of its current path
      if (!unit.path || unit.path.length === 0 || unit.path.length < 3) {
        // Check if this is an attacking/chasing unit
        const isAttackMode = (unit.target && unit.target.health !== undefined) || (unit.attackQueue && unit.attackQueue.length > 0)
        
        // For AI units, respect target change timer
        if (unit.owner !== gameState.humanPlayer && unit.lastTargetChangeTime &&
          now - unit.lastTargetChangeTime < 2000) {
          return // Skip recalculation if target was changed recently
        }

        // For attack/chase units, use attack-specific throttling (3 seconds)
        if (isAttackMode) {
          const attackPathRecalcNeeded = !unit.lastAttackPathCalcTime || (now - unit.lastAttackPathCalcTime > ATTACK_PATH_CALC_INTERVAL)
          if (!attackPathRecalcNeeded) {
            return // Skip recalculation if attack path throttling is active
          }
        }

        // Preserve movement command even when path is empty
        let targetPos = null
        if (unit.moveTarget) {
          // Use stored move target if it exists
          targetPos = unit.moveTarget
        } else if (unit.target) {
          // Handle combat targets
          targetPos = unit.target.tileX !== undefined
            ? { x: unit.target.tileX, y: unit.target.tileY }
            : { x: unit.target.x, y: unit.target.y }
        }

        if (targetPos) {
          // Store move target for future recalculations
          unit.moveTarget = targetPos

          // Apply formation offset if unit is in formation mode
          let adjustedTarget = { ...targetPos }

          // If unit is in formation mode and has formation offset, adjust the target
          if (unit.formationActive && unit.formationOffset && unit.groupNumber) {
            const formationGroup = formationGroups[unit.groupNumber]

            // If this unit is part of a known formation group
            if (formationGroup && formationGroup.units.some(u => u.moveTarget)) {
              // Use the first unit with a moveTarget as the formation reference point
              const referenceUnit = formationGroup.units.find(u => u.moveTarget)
              if (referenceUnit && referenceUnit !== unit) {
                // Apply formation offset to target position
                adjustedTarget = {
                  x: Math.floor((targetPos.x * TILE_SIZE + unit.formationOffset.x) / TILE_SIZE),
                  y: Math.floor((targetPos.y * TILE_SIZE + unit.formationOffset.y) / TILE_SIZE)
                }
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
            // Update path calculation time - use attack-specific timer for attacking units
            if (isAttackMode) {
              unit.lastAttackPathCalcTime = now
            } else {
              unit.lastPathCalcTime = now
            }
          } else if (Math.hypot(unit.tileX - targetPos.x, unit.tileY - targetPos.y) < 1) {
            // Clear moveTarget if we've reached destination
            unit.moveTarget = null
          }
        }
      }
    })
  }
}

/**
 * Creates formation offsets for a group of units
 * @param {Array} units - Array of units to arrange in formation
 * @param {number} groupNumber - Formation group identifier
 */
export function createFormationOffsets(units, groupNumber) {
  const unitsPerRow = Math.ceil(Math.sqrt(units.length))
  const spacing = 48 // 1.5 tiles spacing between units

  units.forEach((unit, index) => {
    const row = Math.floor(index / unitsPerRow)
    const col = index % unitsPerRow
    
    // Center the formation
    const offsetX = (col - (unitsPerRow - 1) / 2) * spacing
    const offsetY = row * spacing

    unit.formationOffset = { x: offsetX, y: offsetY }
    unit.formationActive = true
    unit.groupNumber = groupNumber
  })
}

/**
 * Clears formation data from units
 * @param {Array} units - Array of units to clear formation from
 */
export function clearFormation(units) {
  units.forEach(unit => {
    unit.formationOffset = null
    unit.formationActive = false
    unit.groupNumber = null
  })
}
