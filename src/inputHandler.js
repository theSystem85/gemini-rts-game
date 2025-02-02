import { gameState } from './gameState.js'
import { TILE_SIZE } from './config.js'
import { findPath } from './units.js'
import { playSound } from './sound.js'

const gameCanvas = document.getElementById('gameCanvas')
const minimapCanvas = document.getElementById('minimap')

export const selectedUnits = []

let isSelecting = false
let selectionStart = { x: 0, y: 0 }
let selectionEnd = { x: 0, y: 0 }
let wasDragging = false

export function setupInputHandlers(units, factories, mapGrid) {
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
      // Begrenze scrollOffset innerhalb der Map
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
    }
    if (isSelecting) {
      selectionEnd = { x: worldX, y: worldY }
      if (!wasDragging && (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5)) {
        wasDragging = true
      }
    }
  })

  gameCanvas.addEventListener('mouseup', e => {
    if (e.button === 2) {
      gameState.isRightDragging = false
    } else if (e.button === 0 && isSelecting) {
      if (wasDragging) {
        handleBoundingBoxSelection(units)
      } else {
        handleSingleSelection(units, e)
      }
      // Bei jedem Mausklick (ohne Selektions-Box) auch eventuelle Zielbefehle abhandeln:
      // Wenn bereits eine Einheit selektiert ist und keine neue angeklickt wurde,
      // interpretiere den Klick als Zielbefehl.
      if (selectedUnits.length > 0 && !wasDragging) {
        const rect = gameCanvas.getBoundingClientRect()
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y
        const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) }
        let target = null
        for (const factory of factories) {
          if (
            factory.id === 'enemy' &&
            targetTile.x >= factory.x &&
            targetTile.x < factory.x + factory.width &&
            targetTile.y >= factory.y &&
            targetTile.y < factory.y + factory.height
          ) {
            target = factory
            break
          }
        }
        if (!target) {
          for (const unit of units) {
            if (
              unit.owner !== 'player' &&
              Math.floor(unit.x / TILE_SIZE) === targetTile.x &&
              Math.floor(unit.y / TILE_SIZE) === targetTile.y
            ) {
              target = unit
              break
            }
          }
        }
        for (const unit of selectedUnits) {
          const start = { x: unit.tileX, y: unit.tileY }
          const end = target ? { x: target.x || target.tileX, y: target.y || target.tileY } : targetTile
          const path = findPath(start, end, mapGrid)
          if (path.length > 0) {
            unit.path = path.slice(1)
            unit.target = target
            playSound('movement')
          } else {
            // Kein gültiger Pfad gefunden; Cursor auf "not-allowed" setzen
            gameCanvas.style.cursor = 'not-allowed'
          }
        }
      }
      isSelecting = false
    }
  })

  // Minimap-Klick: Zentriere die Ansicht neu
  minimapCanvas.addEventListener('click', e => {
    const rect = minimapCanvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const scaleX = (mapGrid[0].length * TILE_SIZE) / minimapCanvas.width
    const scaleY = (mapGrid.length * TILE_SIZE) / minimapCanvas.height
    gameState.scrollOffset.x = Math.max(0, Math.min(clickX * scaleX - gameCanvas.width / 2, mapGrid[0].length * TILE_SIZE - gameCanvas.width))
    gameState.scrollOffset.y = Math.max(0, Math.min(clickY * scaleY - gameCanvas.height / 2, mapGrid.length * TILE_SIZE - gameCanvas.height))
  })
}

function handleBoundingBoxSelection(units) {
  const x1 = Math.min(selectionStart.x, selectionEnd.x)
  const y1 = Math.min(selectionStart.y, selectionEnd.y)
  const x2 = Math.max(selectionStart.x, selectionEnd.x)
  const y2 = Math.max(selectionStart.y, selectionEnd.y)
  // Vorherige Selektion löschen
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
}

function handleSingleSelection(units, event) {
  const rect = gameCanvas.getBoundingClientRect()
  const worldX = event.clientX - rect.left + gameState.scrollOffset.x
  const worldY = event.clientY - rect.top + gameState.scrollOffset.y
  // Vorherige Selektion löschen
  for (const unit of units) {
    unit.selected = false
  }
  selectedUnits.length = 0
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
    clickedUnit.selected = true
    selectedUnits.push(clickedUnit)
    playSound('unitSelection')
  }
}
