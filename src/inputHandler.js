// inputHandler.js
import { gameState } from './gameState.js';
import { TILE_SIZE, TANK_FIRE_RANGE } from './config.js';
import { findPath } from './units.js';
import { playSound } from './sound.js';

const gameCanvas = document.getElementById('gameCanvas');
const minimapCanvas = document.getElementById('minimap');

export const selectedUnits = [];
export let selectionActive = false;
export let selectionStartExport = { x: 0, y: 0 };
export let selectionEndExport = { x: 0, y: 0 };

let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionEnd = { x: 0, y: 0 };
let wasDragging = false;

export function setupInputHandlers(units, factories, mapGrid) {
  // Disable the context menu on right-click
  gameCanvas.addEventListener('contextmenu', e => e.preventDefault());

  gameCanvas.addEventListener('mousedown', e => {
    const rect = gameCanvas.getBoundingClientRect();
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x;
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y;
    if (e.button === 2) { // Right mouse button for dragging (scrolling)
      gameState.isRightDragging = true;
      gameState.lastDragPos = { x: e.clientX, y: e.clientY };
      gameCanvas.style.cursor = 'grabbing';
    } else if (e.button === 0) { // Left mouse button for selection
      isSelecting = true;
      selectionActive = true;
      wasDragging = false;
      selectionStart = { x: worldX, y: worldY };
      selectionEnd = { x: worldX, y: worldY };
      selectionStartExport = { ...selectionStart };
      selectionEndExport = { ...selectionEnd };
    }
  });

  gameCanvas.addEventListener('mousemove', e => {
    const rect = gameCanvas.getBoundingClientRect();
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x;
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y;

    // Handle right-click dragging for map scrolling
    if (gameState.isRightDragging) {
      const dx = e.clientX - gameState.lastDragPos.x;
      const dy = e.clientY - gameState.lastDragPos.y;
      gameState.scrollOffset.x = Math.max(
        0,
        Math.min(gameState.scrollOffset.x - dx, mapGrid[0].length * TILE_SIZE - gameCanvas.width)
      );
      gameState.scrollOffset.y = Math.max(
        0,
        Math.min(gameState.scrollOffset.y - dy, mapGrid.length * TILE_SIZE - gameCanvas.height)
      );
      gameState.dragVelocity = { x: dx, y: dy };
      gameState.lastDragPos = { x: e.clientX, y: e.clientY };
      gameCanvas.style.cursor = 'grabbing';
    } else if (!isSelecting) {
      // Hover logic: if at least one unit is selected, show appropriate cursor.
      if (selectedUnits.length > 0) {
        const unit = selectedUnits[0];
        const unitCenterX = unit.x + TILE_SIZE / 2;
        const unitCenterY = unit.y + TILE_SIZE / 2;
        // Determine the tile under the mouse
        const targetTile = { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
        const targetCenterX = targetTile.x * TILE_SIZE + TILE_SIZE / 2;
        const targetCenterY = targetTile.y * TILE_SIZE + TILE_SIZE / 2;
        const dist = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
        // If within fire range (4 cells), show pointer; otherwise, show grab icon.
        if (dist <= TANK_FIRE_RANGE * TILE_SIZE) {
          gameCanvas.style.cursor = 'pointer';
        } else {
          gameCanvas.style.cursor = 'grab';
        }
      } else {
        gameCanvas.style.cursor = 'default';
      }
    }
    // Update selection rectangle if we are dragging for selection.
    if (isSelecting) {
      selectionEnd = { x: worldX, y: worldY };
      selectionEndExport = { ...selectionEnd };
      if (!wasDragging && (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5)) {
        wasDragging = true;
      }
    }
  });

  gameCanvas.addEventListener('mouseup', e => {
    const rect = gameCanvas.getBoundingClientRect();
    if (e.button === 2) { // End right-drag
      gameState.isRightDragging = false;
      gameCanvas.style.cursor = 'grab';
    } else if (e.button === 0 && isSelecting) {
      // Determine whether this was a click or a drag selection.
      if (wasDragging) {
        handleBoundingBoxSelection(units);
      } else {
        // Check if a friendly unit was clicked.
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x;
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y;
        let friendlyUnitClicked = false;
        for (const unit of units) {
          if (unit.owner === 'player') {
            const centerX = unit.x + TILE_SIZE / 2;
            const centerY = unit.y + TILE_SIZE / 2;
            const dx = worldX - centerX;
            const dy = worldY - centerY;
            if (Math.hypot(dx, dy) < TILE_SIZE / 2) {
              friendlyUnitClicked = true;
              break;
            }
          }
        }
        // If a friendly unit was clicked, only perform selection.
        if (friendlyUnitClicked) {
          handleSingleSelection(units, e);
        } else if (selectedUnits.length > 0) {
          // Otherwise, interpret the click as a move/attack order.
          const targetTile = { x: Math.floor((e.clientX - rect.left + gameState.scrollOffset.x) / TILE_SIZE),
                               y: Math.floor((e.clientY - rect.top + gameState.scrollOffset.y) / TILE_SIZE) };
          let target = null;
          // First, check if the click is on an enemy factory.
          for (const factory of factories) {
            if (
              factory.id === 'enemy' &&
              targetTile.x >= factory.x &&
              targetTile.x < factory.x + factory.width &&
              targetTile.y >= factory.y &&
              targetTile.y < factory.y + factory.height
            ) {
              target = factory;
              break;
            }
          }
          // Next, check if an enemy unit occupies that tile.
          if (!target) {
            for (const unit of units) {
              if (
                unit.owner !== 'player' &&
                unit.tileX === targetTile.x &&
                unit.tileY === targetTile.y
              ) {
                target = unit;
                break;
              }
            }
          }
          // For each selected unit, compute a formation offset and assign a path.
          selectedUnits.forEach((unit, index) => {
            // Formation offset: arrange units in a 3xN grid.
            const formationOffset = { x: index % 3, y: Math.floor(index / 3) };
            // Determine the destination in tile coordinates.
            const end = target
              ? (target.tileX !== undefined
                   ? { x: target.tileX, y: target.tileY } // enemy unit (tile-based)
                   : { x: target.x, y: target.y })         // enemy factory (tile-based)
              : { x: targetTile.x + formationOffset.x, y: targetTile.y + formationOffset.y };
            // Compute path from the unit's current tile to the destination.
            const path = findPath({ x: unit.tileX, y: unit.tileY }, end, mapGrid, null);
            if (path.length > 0 && (unit.tileX !== end.x || unit.tileY !== end.y)) {
              // Skip the first tile (current position) and assign the rest as the path.
              unit.path = path.slice(1);
              unit.target = target;
              playSound('movement');
            }
          });
        }
      }
      // Reset selection flags.
      isSelecting = false;
      selectionActive = false;
    }
  });

  // Handle clicks on the minimap to recenter the main view.
  minimapCanvas.addEventListener('click', e => {
    const rect = minimapCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const scaleX = (mapGrid[0].length * TILE_SIZE) / minimapCanvas.width;
    const scaleY = (mapGrid.length * TILE_SIZE) / minimapCanvas.height;
    gameState.scrollOffset.x = Math.max(0, Math.min(clickX * scaleX - gameCanvas.width / 2, mapGrid[0].length * TILE_SIZE - gameCanvas.width));
    gameState.scrollOffset.y = Math.max(0, Math.min(clickY * scaleY - gameCanvas.height / 2, mapGrid.length * TILE_SIZE - gameCanvas.height));
  });
}

// Handles multi-unit (bounding box) selection.
function handleBoundingBoxSelection(units) {
  const x1 = Math.min(selectionStart.x, selectionEnd.x);
  const y1 = Math.min(selectionStart.y, selectionEnd.y);
  const x2 = Math.max(selectionStart.x, selectionEnd.x);
  const y2 = Math.max(selectionStart.y, selectionEnd.y);
  selectedUnits.length = 0;
  for (const unit of units) {
    if (unit.owner === 'player') {
      const centerX = unit.x + TILE_SIZE / 2;
      const centerY = unit.y + TILE_SIZE / 2;
      if (centerX >= x1 && centerX <= x2 && centerY >= y1 && centerY <= y2) {
        unit.selected = true;
        selectedUnits.push(unit);
        playSound('unitSelection');
      } else {
        unit.selected = false;
      }
    }
  }
}

// Handles single unit selection by clicking.
function handleSingleSelection(units, event) {
  const rect = gameCanvas.getBoundingClientRect();
  const worldX = event.clientX - rect.left + gameState.scrollOffset.x;
  const worldY = event.clientY - rect.top + gameState.scrollOffset.y;
  let clickedUnit = null;
  for (const unit of units) {
    if (unit.owner === 'player') {
      const centerX = unit.x + TILE_SIZE / 2;
      const centerY = unit.y + TILE_SIZE / 2;
      const dx = worldX - centerX;
      const dy = worldY - centerY;
      if (Math.hypot(dx, dy) < TILE_SIZE / 2) {
        clickedUnit = unit;
        break;
      }
    }
  }
  if (clickedUnit) {
    // Replace any existing selection with the clicked unit.
    units.forEach(unit => {
      if (unit.owner === 'player' && unit !== clickedUnit) {
        unit.selected = false;
      }
    });
    selectedUnits.length = 0;
    clickedUnit.selected = true;
    selectedUnits.push(clickedUnit);
    playSound('unitSelection');
  }
}
