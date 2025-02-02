import { gameState } from './gameState.js'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TANK_FIRE_RANGE } from './config.js'
import { findPath } from './units.js'
import { playSound } from './sound.js'

// Get DOM elements
const gameCanvas = document.getElementById('gameCanvas')
const minimapCanvas = document.getElementById('minimap')

// We'll export selectedUnits so that other modules (like rendering) can use it.
export const selectedUnits = []

let isSelecting = false
let selectionStart = { x: 0, y: 0 }
let selectionEnd = { x: 0, y: 0 }
let wasDragging = false

// Setup event listeners; factories and units are passed so that we can check for enemy objects
export function setupInputHandlers(units, factories) {
  // Prevent default right-click context menu
  gameCanvas.addEventListener('contextmenu', e => e.preventDefault())

  gameCanvas.addEventListener('mousedown', e => {
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y
    if (e.button === 2) {
      gameState.isRightDragging = true
      gameState.lastDragPos = { x: e.clientX, y: e.clientY }
    } else if (e.button === 0) {
      isSelecting = true
      wasDragging = false
      selectionStart = { x: worldX, y: worldY }
      selectionEnd = { x: worldX, y: worldY }
    }
  })

  gameCanvas.addEventListener('mousemove', e => {
    const rect = gameCanvas.getBoundingClientRect()
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y

    if (gameState.isRightDragging) {
      const dx = e.clientX - gameState.lastDragPos.x
      const dy = e.clientY - gameState.lastDragPos.y
      gameState.scrollOffset.x = Math.max(0, Math.min(gameState.scrollOffset.x - dx, MAP_WIDTH - gameCanvas.width))
      gameState.scrollOffset.y = Math.max(0, Math.min(gameState.scrollOffset.y - dy, MAP_HEIGHT - gameCanvas.height))
      gameState.dragVelocity = { x: dx, y: dy }
      gameState.lastDragPos = { x: e.clientX, y: e.clientY }
    }
    if (isSelecting) {
      selectionEnd = { x: worldX, y: worldY }
      if (!wasDragging &&
          (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5)) {
        wasDragging = true
      }
    }
    // --- Hover-cursor logic (Requirements 3.1.5.1–3) ---
    if (!gameState.isRightDragging && !isSelecting && e.buttons === 0 && selectedUnits.length > 0) {
      const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
      let targetObject = null
      // Check enemy factory
      for (const factory of factories) {
        if (factory.id === 'enemy' &&
            targetTile.x >= factory.x && targetTile.x < factory.x + factory.width &&
            targetTile.y >= factory.y && targetTile.y < factory.y + factory.height) {
          targetObject = factory
          break
        }
      }
      // Check enemy units
      if (!targetObject) {
        for (const unit of units) {
          if (unit.owner !== 'player' &&
              Math.floor(unit.x / TILE_SIZE) === targetTile.x &&
              Math.floor(unit.y / TILE_SIZE) === targetTile.y) {
            targetObject = unit
            break
          }
        }
      }
      const selUnit = selectedUnits[0]
      const path = findPath({ x: selUnit.tileX, y: selUnit.tileY }, targetTile, window.mapGrid) // assume mapGrid is set in main.js
      if (path.length === 0) {
        gameCanvas.style.cursor = 'not-allowed'
      } else if (targetObject) {
        let targetCenter = null
        if (targetObject.tileX !== undefined) { // enemy unit
          targetCenter = { x: targetObject.x + TILE_SIZE / 2, y: targetObject.y + TILE_SIZE / 2 }
        } else { // enemy factory
          targetCenter = { x: targetObject.x + (targetObject.width * TILE_SIZE) / 2, y: targetObject.y + (targetObject.height * TILE_SIZE) / 2 }
        }
        const selCenter = { x: selUnit.x + TILE_SIZE / 2, y: selUnit.y + TILE_SIZE / 2 }
        const dx = targetCenter.x - selCenter.x
        const dy = targetCenter.y - selCenter.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= TANK_FIRE_RANGE) {
          // Target in fire range → show pointer (attack)
          gameCanvas.style.cursor = 'pointer'
        } else {
          // Enemy present but not in immediate range → show crosshair
          gameCanvas.style.cursor = 'crosshair'
        }
      } else {
        gameCanvas.style.cursor = 'move'
      }
    } else if (!isSelecting && !gameState.isRightDragging) {
      gameCanvas.style.cursor = 'default'
    }
  })

  gameCanvas.addEventListener('mouseup', e => {
    if (e.button === 2) {
      gameState.isRightDragging = false
    } else if (e.button === 0 && isSelecting) {
      const rect = gameCanvas.getBoundingClientRect()
      const worldX = e.clientX - rect.left + gameState.scrollOffset.x
      const worldY = e.clientY - rect.top + gameState.scrollOffset.y
      if (wasDragging) {
        // Multi-unit selection via bounding box
        const x1 = Math.min(selectionStart.x, selectionEnd.x)
        const y1 = Math.min(selectionStart.y, selectionEnd.y)
        const x2 = Math.max(selectionStart.x, selectionEnd.x)
        const y2 = Math.max(selectionStart.y, selectionEnd.y)
        selectedUnits.length = 0
        for (const unit of units) {
          if (unit.owner === 'player') {
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
        gameCanvas.style.cursor = selectedUnits.length > 0 ? 'move' : 'default'
      } else {
        // Single-unit selection (or issue move/attack order if a player unit is already selected)
        let clickedUnit = null
        for (const unit of units) {
          if (unit.owner === 'player') {
            const centerX = unit.x + TILE_SIZE / 2
            const centerY = unit.y + TILE_SIZE / 2
            const dx = worldX - centerX
            const dy = worldY - centerY
            if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE / 2) {
              clickedUnit = unit
              break
            }
          }
        }
        if (clickedUnit) {
          selectedUnits.length = 0
          selectedUnits.push(clickedUnit)
          clickedUnit.selected = true
          playSound('unitSelection')
          gameCanvas.style.cursor = 'move'
        } else if (selectedUnits.length > 0) {
          // No player unit was clicked – issue move/attack orders to all selected units.
          const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
          let target = null
          for (const factory of factories) {
            if (factory.id === 'enemy' &&
                targetTile.x >= factory.x && targetTile.x < factory.x + factory.width &&
                targetTile.y >= factory.y && targetTile.y < factory.y + factory.height) {
              target = factory
              break
            }
          }
          if (!target) {
            for (const unit of units) {
              if (unit.owner !== 'player' &&
                  Math.floor(unit.x / TILE_SIZE) === targetTile.x &&
                  Math.floor(unit.y / TILE_SIZE) === targetTile.y) {
                target = unit
                break
              }
            }
          }
          for (const unit of selectedUnits) {
            const start = { x: unit.tileX, y: unit.tileY }
            const end = target ? { x: target.x || target.tileX, y: target.y || target.tileY } : targetTile
            const path = findPath(start, end, window.mapGrid)
            if (path.length > 0) {
              unit.path = path.slice(1)
              unit.target = target
              playSound('movement')
              gameCanvas.style.cursor = target ? 'crosshair' : 'move'
            } else {
              gameCanvas.style.cursor = 'not-allowed'
            }
          }
        } else {
          for (const unit of units) {
            unit.selected = false
          }
          selectedUnits.length = 0
          gameCanvas.style.cursor = 'default'
        }
      }
      isSelecting = false
    }
  })

  // --- Minimap click: recenter view
  minimapCanvas.addEventListener('click', e => {
    const rect = minimapCanvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const scaleX = MAP_WIDTH / minimapCanvas.width
    const scaleY = MAP_HEIGHT / minimapCanvas.height
    gameState.scrollOffset.x = Math.max(0, Math.min(clickX * scaleX - gameCanvas.width / 2, MAP_WIDTH - gameCanvas.width))
    gameState.scrollOffset.y = Math.max(0, Math.min(clickY * scaleY - gameCanvas.height / 2, MAP_HEIGHT - gameCanvas.height))
  })
}
