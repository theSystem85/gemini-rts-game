// inputHandler.js
import { gameState } from './gameState.js'
import { TILE_SIZE, TANK_FIRE_RANGE } from './config.js'
import { findPath } from './units.js'
import { playSound } from './sound.js'

const gameCanvas = document.getElementById('gameCanvas')
const minimapCanvas = document.getElementById('minimap')

export const selectedUnits = []
export let selectionActive = false
export let selectionStartExport = { x: 0, y: 0 }
export let selectionEndExport = { x: 0, y: 0 }

let isSelecting = false
let selectionStart = { x: 0, y: 0 }
let selectionEnd = { x: 0, y: 0 }
let wasDragging = false

// Add variables to track right-click dragging.
let rightDragStart = { x: 0, y: 0 }
let rightWasDragging = false

// Helper: For a given target and unit center, return the appropriate aiming point.
// For factories, this returns the closest point on the factory rectangle.
function getTargetPoint(target, unitCenter) {
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

export function setupInputHandlers(units, factories, mapGrid) {
  // Disable right-click context menu.
  gameCanvas.addEventListener('contextmenu', e => e.preventDefault())

  gameCanvas.addEventListener('mousedown', e => {
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y
    if (e.button === 2) {
      // Right-click: start scrolling.
      gameState.isRightDragging = true
      rightDragStart = { x: e.clientX, y: e.clientY }
      rightWasDragging = false
      gameState.lastDragPos = { x: e.clientX, y: e.clientY }
      gameCanvas.style.cursor = 'grabbing'
    } else if (e.button === 0) {
      // Left-click: start selection.
      isSelecting = true
      selectionActive = true
      wasDragging = false
      selectionStart = { x: worldX, y: worldY }
      selectionEnd = { x: worldX, y: worldY }
      selectionStartExport = { ...selectionStart }
      selectionEndExport = { ...selectionEnd }
    }
  })

  gameCanvas.addEventListener('mousemove', e => {
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y

    // --- Enemy Hover Cursor ---
    if (selectedUnits.length > 0) {
      let enemyHover = false
      // Check enemy factories.
      for (const factory of factories) {
        if (factory.id !== 'player') {
          const factoryPixelX = factory.x * TILE_SIZE
          const factoryPixelY = factory.y * TILE_SIZE
          if (worldX >= factoryPixelX &&
              worldX < factoryPixelX + factory.width * TILE_SIZE &&
              worldY >= factoryPixelY &&
              worldY < factoryPixelY + factory.height * TILE_SIZE) {
            enemyHover = true
            break
          }
        }
      }
      // Check enemy units.
      if (!enemyHover) {
        for (const unit of units) {
          if (unit.owner !== 'player') {
            const centerX = unit.x + TILE_SIZE / 2
            const centerY = unit.y + TILE_SIZE / 2
            if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
              enemyHover = true
              break
            }
          }
        }
      }
      if (enemyHover) {
        gameCanvas.style.cursor = 'crosshair'
        return
      }
    }

    // --- Right-Drag Scrolling ---
    if (gameState.isRightDragging) {
      const dx = e.clientX - gameState.lastDragPos.x
      const dy = e.clientY - gameState.lastDragPos.y
      gameState.scrollOffset.x = Math.max(
        0,
        Math.min(gameState.scrollOffset.x - dx, mapGrid[0].length * TILE_SIZE - gameCanvas.width)
      )
      gameState.scrollOffset.y = Math.max(
        0,
        Math.min(gameState.scrollOffset.y - dy, mapGrid.length * TILE_SIZE - gameCanvas.height)
      )
      gameState.dragVelocity = { x: dx, y: dy }
      gameState.lastDragPos = { x: e.clientX, y: e.clientY }
      gameCanvas.style.cursor = 'grabbing'
      // Check if right-drag exceeds threshold.
      if (!rightWasDragging && Math.hypot(e.clientX - rightDragStart.x, e.clientY - rightDragStart.y) > 5) {
        rightWasDragging = true
      }
      return
    } else if (!isSelecting) {
      gameCanvas.style.cursor = selectedUnits.length > 0 ? 'grab' : 'default'
    }

    // --- Update Selection Rectangle ---
    if (isSelecting) {
      selectionEnd = { x: worldX, y: worldY }
      selectionEndExport = { ...selectionEnd }
      if (!wasDragging && (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5)) {
        wasDragging = true
      }
    }
  })

  gameCanvas.addEventListener('mouseup', e => {
    const rect = gameCanvas.getBoundingClientRect()
    if (e.button === 2) {
      // End right-click drag.
      gameState.isRightDragging = false
      gameCanvas.style.cursor = 'grab'
      // If the right click was NOT a drag, deselect all units.
      if (!rightWasDragging) {
        units.forEach(u => { if (u.owner === 'player') u.selected = false })
        selectedUnits.length = 0
      }
      rightWasDragging = false
    } else if (e.button === 0 && isSelecting) {
      if (wasDragging) {
        handleBoundingBoxSelection(units)
      } else {
        // Single unit selection.
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y
        let clickedUnit = null
        for (const unit of units) {
          if (unit.owner === 'player') {
            const centerX = unit.x + TILE_SIZE / 2
            const centerY = unit.y + TILE_SIZE / 2
            const dx = worldX - centerX
            const dy = worldY - centerY
            if (Math.hypot(dx, dy) < TILE_SIZE / 2) {
              clickedUnit = unit
              break
            }
          }
        }
        if (clickedUnit) {
          units.forEach(u => { if (u.owner === 'player') u.selected = false })
          selectedUnits.length = 0
          clickedUnit.selected = true
          selectedUnits.push(clickedUnit)
          playSound('unitSelection')
          playSound('yesSir01') // play sound on unit selection
        }
      }
      // --- Command Issuing ---
      if (selectedUnits.length > 0 && !wasDragging) {
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y
        let target = null
        // Check enemy factories.
        for (const factory of factories) {
          if (factory.id !== 'player' &&
              worldX >= factory.x * TILE_SIZE &&
              worldX < (factory.x + factory.width) * TILE_SIZE &&
              worldY >= factory.y * TILE_SIZE &&
              worldY < (factory.y + factory.height) * TILE_SIZE) {
            target = factory
            break
          }
        }
        // Check enemy units.
        if (!target) {
          for (const unit of units) {
            if (unit.owner !== 'player') {
              const centerX = unit.x + TILE_SIZE / 2
              const centerY = unit.y + TILE_SIZE / 2
              if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
                target = unit
                break
              }
            }
          }
        }
        // Formation logic for movement/attack.
        const count = selectedUnits.length
        const cols = Math.ceil(Math.sqrt(count))
        const rows = Math.ceil(count / cols)
        selectedUnits.forEach((unit, index) => {
          let formationOffset = { x: 0, y: 0 }
          if (target) {
            const unitCenter = { x: unit.x + TILE_SIZE / 2, y: unit.y + TILE_SIZE / 2 }
            // Use helper to get target point (for factories, this is the closest point on its boundary)
            let targetCenter = getTargetPoint(target, unitCenter)
            const dx = targetCenter.x - unitCenter.x
            const dy = targetCenter.y - unitCenter.y
            const dist = Math.hypot(dx, dy)
            const explosionSafetyBuffer = TILE_SIZE * 0.5
            const safeAttackDistance = Math.max(
              TANK_FIRE_RANGE * TILE_SIZE,
              TILE_SIZE * 2 + explosionSafetyBuffer
            ) - TILE_SIZE
            
            const baseX = targetCenter.x - (dx / dist) * safeAttackDistance
            const baseY = targetCenter.y - (dy / dist) * safeAttackDistance
            const col = index % cols
            const row = Math.floor(index / cols)
            formationOffset.x = col * 10 - ((cols - 1) * 10) / 2
            formationOffset.y = row * 10 - ((rows - 1) * 10) / 2
            let destX = baseX + formationOffset.x
            let destY = baseY + formationOffset.y
            // Ensure the final destination maintains safe distance
            const finalDx = targetCenter.x - destX
            const finalDy = targetCenter.y - destY
            let finalDist = Math.hypot(finalDx, finalDy)
            if (finalDist < safeAttackDistance) {
              const scale = safeAttackDistance / finalDist
              destX = targetCenter.x - finalDx * scale
              destY = targetCenter.y - finalDy * scale
            }
            const desiredTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) }
            const path = findPath({ x: unit.tileX, y: unit.tileY }, desiredTile, mapGrid, null)
            if (path.length > 0 && (unit.tileX !== desiredTile.x || unit.tileY !== desiredTile.y)) {
              unit.path = path.slice(1)
              unit.target = target
              playSound('movement')
            } else {
              unit.path = []
              unit.target = target
            }
          } else {
            // No target: move to clicked location with a basic grid formation.
            const colsCount = Math.ceil(Math.sqrt(count))
            const rowsCount = Math.ceil(count / colsCount)
            const col = index % colsCount
            const row = Math.floor(index / colsCount)
            formationOffset = {
              x: col * 10 - ((colsCount - 1) * 10) / 2,
              y: row * 10 - ((rowsCount - 1) * 10) / 2
            }
            const destX = Math.floor(worldX) + formationOffset.x
            const destY = Math.floor(worldY) + formationOffset.y
            const destTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) }
            const path = findPath({ x: unit.tileX, y: unit.tileY }, destTile, mapGrid, null)
            if (path.length > 0 && (unit.tileX !== destTile.x || unit.tileY !== destTile.y)) {
              unit.path = path.slice(1)
              unit.target = null
              playSound('movement')
            }
          }
        })
      }
      isSelecting = false
      selectionActive = false
    }
  })

  // --- Minimap Click: Recenters View and Commands Selected Units ---
  minimapCanvas.addEventListener('click', e => {
    const rect = minimapCanvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const scaleX = (mapGrid[0].length * TILE_SIZE) / minimapCanvas.width
    const scaleY = (mapGrid.length * TILE_SIZE) / minimapCanvas.height
    gameState.scrollOffset.x = Math.max(0, Math.min(clickX * scaleX - gameCanvas.width / 2, mapGrid[0].length * TILE_SIZE - gameCanvas.width))
    gameState.scrollOffset.y = Math.max(0, Math.min(clickY * scaleY - gameCanvas.height / 2, mapGrid.length * TILE_SIZE - gameCanvas.height))
    
    // If selected units exist, issue move command to the clicked minimap position.
    if (selectedUnits.length > 0) {
      const worldX = clickX * scaleX
      const worldY = clickY * scaleY
      const count = selectedUnits.length
      const colsCount = Math.ceil(Math.sqrt(count))
      const rowsCount = Math.ceil(count / colsCount)
      selectedUnits.forEach((unit, index) => {
        const col = index % colsCount
        const row = Math.floor(index / colsCount)
        const formationOffset = {
          x: col * 10 - ((colsCount - 1) * 10) / 2,
          y: row * 10 - ((rowsCount - 1) * 10) / 2
        }
        const destX = Math.floor(worldX) + formationOffset.x
        const destY = Math.floor(worldY) + formationOffset.y
        const destTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) }
        const path = findPath({ x: unit.tileX, y: unit.tileY }, destTile, mapGrid, null)
        if (path.length > 0 && (unit.tileX !== destTile.x || unit.tileY !== destTile.y)) {
          unit.path = path.slice(1)
          unit.target = null
          playSound('movement')
        }
      })
    }
  })

  // Add keydown event listener to toggle alert mode.
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'a') {
      // Toggle alert mode on all selected player units.
      selectedUnits.forEach(unit => {
        // Only tank-v2 units can use alert mode
        if (unit.type === 'tank-v2') {
          unit.alertMode = !unit.alertMode;
        }
      });
    }
  });
}

function handleBoundingBoxSelection(units) {
  try {
    const x1 = Math.min(selectionStart.x, selectionEnd.x)
    const y1 = Math.min(selectionStart.y, selectionEnd.y)
    const x2 = Math.max(selectionStart.x, selectionEnd.x)
    const y2 = Math.max(selectionStart.y, selectionEnd.y)
    
    // Clear current selection first
    selectedUnits.length = 0
    
    // Find units within selection rectangle
    for (const unit of units) {
      if (unit.owner === 'player' && unit.health > 0) {  // Ensure unit is alive
        const centerX = unit.x + TILE_SIZE / 2
        const centerY = unit.y + TILE_SIZE / 2
        
        if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
          unit.selected = true
          selectedUnits.push(unit)
          playSound('unitSelection')
        } else {
          unit.selected = false
        }
      }
    }
  } catch (error) {
    console.error("Error in handleBoundingBoxSelection:", error)
    // Reset selection state in case of error
    selectedUnits.length = 0
  }
}

// Safety function: Call this at the beginning of each frame update
// to remove any destroyed units from selection
export function cleanupDestroyedSelectedUnits() {
  try {
    // Filter out any invalid or destroyed units
    const validSelectedUnits = selectedUnits.filter(unit => 
      unit && typeof unit === 'object' && unit.health > 0);
      
    // If we found units to remove, update the array
    if (validSelectedUnits.length !== selectedUnits.length) {
      selectedUnits.length = 0;
      selectedUnits.push(...validSelectedUnits);
    }
  } catch (error) {
    console.error("Error in cleanupDestroyedSelectedUnits:", error);
    selectedUnits.length = 0; // Safety reset
  }
}
