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
  // Disable right-click context menu.
  gameCanvas.addEventListener('contextmenu', e => e.preventDefault());

  gameCanvas.addEventListener('mousedown', e => {
    const rect = gameCanvas.getBoundingClientRect();
    const worldX = e.clientX - rect.left + gameState.scrollOffset.x;
    const worldY = e.clientY - rect.top + gameState.scrollOffset.y;
    if (e.button === 2) {
      // Right-click: start scrolling.
      gameState.isRightDragging = true;
      gameState.lastDragPos = { x: e.clientX, y: e.clientY };
      gameCanvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
      // Left-click: start selection.
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

    // --- Enemy Hover Cursor ---
    if (selectedUnits.length > 0) {
      let enemyHover = false;
      // Check enemy factories.
      for (const factory of factories) {
        if (factory.id !== 'player') {
          const factoryPixelX = factory.x * TILE_SIZE;
          const factoryPixelY = factory.y * TILE_SIZE;
          if (worldX >= factoryPixelX &&
              worldX < factoryPixelX + factory.width * TILE_SIZE &&
              worldY >= factoryPixelY &&
              worldY < factoryPixelY + factory.height * TILE_SIZE) {
            enemyHover = true;
            break;
          }
        }
      }
      // Check enemy units.
      if (!enemyHover) {
        for (const unit of units) {
          if (unit.owner !== 'player') {
            const centerX = unit.x + TILE_SIZE / 2;
            const centerY = unit.y + TILE_SIZE / 2;
            if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
              enemyHover = true;
              break;
            }
          }
        }
      }
      if (enemyHover) {
        gameCanvas.style.cursor = 'crosshair';
        return; // Skip further cursor logic.
      }
    }

    // --- Right-Drag Scrolling ---
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
      gameCanvas.style.cursor = selectedUnits.length > 0 ? 'grab' : 'default';
    }

    // --- Update Selection Rectangle ---
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
    if (e.button === 2) {
      gameState.isRightDragging = false;
      gameCanvas.style.cursor = 'grab';
    } else if (e.button === 0 && isSelecting) {
      if (wasDragging) {
        handleBoundingBoxSelection(units);
      } else {
        // Single unit selection.
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x;
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y;
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
          units.forEach(u => { if (u.owner === 'player') u.selected = false; });
          selectedUnits.length = 0;
          clickedUnit.selected = true;
          selectedUnits.push(clickedUnit);
          playSound('unitSelection');
        }
      }
      // --- Command Issuing ---
      if (selectedUnits.length > 0 && !wasDragging) {
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x;
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y;
        let target = null;
        // Check enemy factories.
        for (const factory of factories) {
          if (factory.id !== 'player' &&
              worldX >= factory.x * TILE_SIZE &&
              worldX < (factory.x + factory.width) * TILE_SIZE &&
              worldY >= factory.y * TILE_SIZE &&
              worldY < (factory.y + factory.height) * TILE_SIZE) {
            target = factory;
            break;
          }
        }
        // Check enemy units.
        if (!target) {
          for (const unit of units) {
            if (unit.owner !== 'player') {
              const centerX = unit.x + TILE_SIZE / 2;
              const centerY = unit.y + TILE_SIZE / 2;
              if (Math.hypot(worldX - centerX, worldY - centerY) < TILE_SIZE / 2) {
                target = unit;
                break;
              }
            }
          }
        }
        // Formation logic: distribute selected units in a grid formation.
        const count = selectedUnits.length;
        const cols = Math.ceil(Math.sqrt(count));
        selectedUnits.forEach((unit, index) => {
          let formationOffset = { x: 0, y: 0 };
          if (target) {
            const unitCenterX = unit.x + TILE_SIZE / 2;
            const unitCenterY = unit.y + TILE_SIZE / 2;
            let targetCenterX, targetCenterY;
            if (target.tileX !== undefined) {
              targetCenterX = target.x + TILE_SIZE / 2;
              targetCenterY = target.y + TILE_SIZE / 2;
            } else {
              targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2;
              targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2;
            }
            const dx = targetCenterX - unitCenterX;
            const dy = targetCenterY - unitCenterY;
            const dist = Math.hypot(dx, dy);
            if (dist <= TANK_FIRE_RANGE * TILE_SIZE) {
              unit.path = [];
              unit.target = target;
              return;
            }
            // Compute desired point at firing range.
            const desiredX = targetCenterX - (dx / dist) * (TANK_FIRE_RANGE * TILE_SIZE);
            const desiredY = targetCenterY - (dy / dist) * (TANK_FIRE_RANGE * TILE_SIZE);
            const row = Math.floor(index / cols);
            const col = index % cols;
            formationOffset = { x: col, y: row };
            const destX = desiredX + formationOffset.x * TILE_SIZE;
            const destY = desiredY + formationOffset.y * TILE_SIZE;
            const desiredTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) };
            const path = findPath({ x: unit.tileX, y: unit.tileY }, desiredTile, mapGrid, null);
            if (path.length > 0 && (unit.tileX !== desiredTile.x || unit.tileY !== desiredTile.y)) {
              unit.path = path.slice(1);
              unit.target = target;
              playSound('movement');
            } else {
              unit.path = [];
              unit.target = target;
            }
          } else {
            // No enemy target: move to clicked location with formation.
            const row = Math.floor(index / cols);
            const col = index % cols;
            formationOffset = { x: col, y: row };
            const destTile = { x: Math.floor(worldX / TILE_SIZE) + formationOffset.x, y: Math.floor(worldY / TILE_SIZE) + formationOffset.y };
            const path = findPath({ x: unit.tileX, y: unit.tileY }, destTile, mapGrid, null);
            if (path.length > 0 && (unit.tileX !== destTile.x || unit.tileY !== destTile.y)) {
              unit.path = path.slice(1);
              unit.target = null;
              playSound('movement');
            }
          }
        });
      }
      isSelecting = false;
      selectionActive = false;
    }
  });

  // --- Minimap Click: Recenters View ---
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
