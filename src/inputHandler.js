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

// Add control groups functionality
const controlGroups = {}

// Track factory for rally points
let playerFactory = null
let rallyPoint = null

// Add global variable for formation toggle
let groupFormationMode = false

// Updated: Help overlay with modern futuristic styling
function showControlsHelp() {
  let helpOverlay = document.getElementById('helpOverlay');
  if (!helpOverlay) {
    helpOverlay = document.createElement('div');
    helpOverlay.id = 'helpOverlay';
    // Updated futuristic styling
    helpOverlay.style.position = 'absolute';
    helpOverlay.style.top = '50%';
    helpOverlay.style.left = '50%';
    helpOverlay.style.transform = 'translate(-50%, -50%)';
    helpOverlay.style.background = 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)';
    helpOverlay.style.color = '#fff';
    helpOverlay.style.padding = '20px';
    helpOverlay.style.borderRadius = '10px';
    helpOverlay.style.boxShadow = '0 4px 15px rgba(0, 255, 255, 0.2)';
    helpOverlay.style.fontFamily = 'Roboto, sans-serif';
    helpOverlay.style.zIndex = '1000';
    helpOverlay.style.maxWidth = '80%';
    helpOverlay.style.maxHeight = '80%';
    helpOverlay.style.overflow = 'auto';
    
    helpOverlay.innerHTML = `
      <h2 style="margin-top:0;">Game Controls</h2>
      <ul>
        <li><strong>Left Click:</strong> Select unit or factory</li>
        <li><strong>Left Click + Drag:</strong> Select multiple units</li>
        <li><strong>Right Click:</strong> Move units / Attack enemy</li>
        <li><strong>A Key:</strong> Toggle alert mode on selected tanks</li>
        <li><strong>D Key:</strong> Make selected units dodge</li>
        <li><strong>H Key:</strong> Focus view on your factory</li>
        <li><strong>I Key:</strong> Show this help (press again to close)</li>
        <li><strong>CTRL + 1-9:</strong> Assign selected units to control group</li>
        <li><strong>1-9 Keys:</strong> Select units in that control group</li>
        <li><strong>F Key:</strong> Toggle formation mode for selected units</li>
      </ul>
      <p>Press I again to close and resume the game</p>
    `;
    document.body.appendChild(helpOverlay);
  } else {
    helpOverlay.style.display = helpOverlay.style.display === 'none' ? 'block' : 'none';
  }
  
  // Toggle game pause state
  gameState.paused = !gameState.paused;
}

// Updated: Toggle keybindings overview overlay with modern, futuristic styling
function toggleKeyBindingsOverview() {
  let overview = document.getElementById('keyBindingsOverview');
  if (!overview) {
    overview = document.createElement('div');
    overview.id = 'keyBindingsOverview';
    // Updated futuristic styling
    overview.style.position = 'absolute';
    overview.style.top = '50%';
    overview.style.left = '50%';
    overview.style.transform = 'translate(-50%, -50%)';
    overview.style.background = 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)';
    overview.style.color = '#fff';
    overview.style.padding = '20px';
    overview.style.borderRadius = '8px';
    overview.style.boxShadow = '0 4px 15px rgba(0, 255, 255, 0.2)';
    overview.style.fontFamily = 'Roboto, sans-serif';
    overview.style.zIndex = '1000';
    overview.style.maxWidth = '80%';
    overview.style.maxHeight = '80%';
    overview.style.overflowY = 'auto';
    overview.innerHTML = `
      <h2 style="margin-top:0;">Key Bindings</h2>
      <ul>
        <li><strong>Left Click</strong>: Select unit or factory</li>
        <li><strong>Left Click + Drag</strong>: Multi-unit selection</li>
        <li><strong>Right Click</strong>: Issue move or attack command</li>
        <li><strong>A</strong>: Toggle alert mode (for supported units)</li>
        <li><strong>D</strong>: Dodge command</li>
        <li><strong>H</strong>: Toggle this keybindings overview</li>
        <li><strong>I</strong>: Show additional help (pause game)</li>
        <li><strong>CTRL + 1-9</strong>: Assign control groups</li>
        <li><strong>1-9</strong>: Recall control groups</li>
        <li><strong>F</strong>: Toggle formation mode</li>
      </ul>
    `;
    document.body.appendChild(overview);
  } else {
    // Toggle the display
    if (overview.style.display === 'none' || overview.style.display === '') {
      overview.style.display = 'block';
    } else {
      overview.style.display = 'none';
    }
  }
}

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
  // Store player factory reference for later use
  playerFactory = factories.find(factory => factory.id === 'player');

  // Store a reference to gameState for direct updates
  gameState.selectionActive = false;
  gameState.selectionStart = { x: 0, y: 0 };
  gameState.selectionEnd = { x: 0, y: 0 };

  // Disable right-click context menu.
  gameCanvas.addEventListener('contextmenu', e => e.preventDefault())

  gameCanvas.addEventListener('mousedown', e => {
    // Don't process input if game is paused
    if (gameState.paused) return;
    
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
      gameState.selectionActive = true
      wasDragging = false
      selectionStart = { x: worldX, y: worldY }
      selectionEnd = { x: worldX, y: worldY }
      selectionStartExport = { ...selectionStart }
      selectionEndExport = { ...selectionEnd }
      gameState.selectionStart = { ...selectionStart }
      gameState.selectionEnd = { ...selectionEnd }
    }
  })

  gameCanvas.addEventListener('mousemove', e => {
    // Don't process input if game is paused
    if (gameState.paused) return;
    
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
      // Check enemy buildings
      if (!enemyHover && gameState.buildings && gameState.buildings.length > 0) {
        for (const building of gameState.buildings) {
          if (building.owner !== 'player') {
            const buildingX = building.x * TILE_SIZE
            const buildingY = building.y * TILE_SIZE
            const buildingWidth = building.width * TILE_SIZE
            const buildingHeight = building.height * TILE_SIZE
            
            if (worldX >= buildingX && 
                worldX < buildingX + buildingWidth && 
                worldY >= buildingY && 
                worldY < buildingY + buildingHeight) {
              enemyHover = true
              break
            }
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
      gameState.selectionEnd = { ...selectionEnd }
      
      if (!wasDragging && (Math.abs(selectionEnd.x - selectionStart.x) > 5 || Math.abs(selectionEnd.y - selectionStart.y) > 5)) {
        wasDragging = true
      }
    }
  })

  gameCanvas.addEventListener('mouseup', e => {
    // Don't process input if game is paused
    if (gameState.paused) return;
    
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
      
      // Check if the player factory is selected
      const playerFactory = factories.find(f => f.id === 'player' && f.selected);
      if (playerFactory) {
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y
        
        // Set rally point at clicked tile
        playerFactory.rallyPoint = { 
          x: Math.floor(worldX / TILE_SIZE), 
          y: Math.floor(worldY / TILE_SIZE) 
        };
        
        // Visual feedback for rally point setting
        playSound('movement');
      }
    } else if (e.button === 0 && isSelecting) {
      if (wasDragging) {
        handleBoundingBoxSelection(units, factories)
      } else {
        // Single unit or factory selection.
        const worldX = e.clientX - rect.left + gameState.scrollOffset.x
        const worldY = e.clientY - rect.top + gameState.scrollOffset.y
        
        // Check for factory selection first - direct click only
        let selectedFactory = null;
        for (const factory of factories) {
          if (factory.id === 'player') {
            const factoryPixelX = factory.x * TILE_SIZE
            const factoryPixelY = factory.y * TILE_SIZE
            
            if (worldX >= factoryPixelX &&
                worldX < factoryPixelX + factory.width * TILE_SIZE &&
                worldY >= factoryPixelY &&
                worldY < factoryPixelY + factory.height * TILE_SIZE) {
              selectedFactory = factory;
              break;
            }
          }
        }
        
        if (selectedFactory) {
          // Clear existing selection
          units.forEach(u => { if (u.owner === 'player') u.selected = false });
          selectedUnits.length = 0;
          
          // Clear factory selections
          factories.forEach(f => f.selected = false);
          
          // Select factory
          selectedFactory.selected = true;
          selectedUnits.push(selectedFactory);
          playSound('unitSelection');
        } else {
          // Normal unit selection
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
            factories.forEach(f => f.selected = false); // Clear factory selections too
            selectedUnits.length = 0
            clickedUnit.selected = true
            selectedUnits.push(clickedUnit)
            playSound('unitSelection')
            playSound('yesSir01') // play sound on unit selection
          }
        }
      }
      // --- Command Issuing ---
      if (selectedUnits.length > 0 && !wasDragging) {
        // Skip command issuing for factory selection
        if (selectedUnits[0].type !== 'factory') {
          const worldX = e.clientX - rect.left + gameState.scrollOffset.x
          const worldY = e.clientY - rect.top + gameState.scrollOffset.y
          let target = null
          
          // Check enemy buildings first (they have priority)
          if (gameState.buildings && gameState.buildings.length > 0) {
            for (const building of gameState.buildings) {
              if (building.owner !== 'player') {
                const buildingX = building.x * TILE_SIZE
                const buildingY = building.y * TILE_SIZE
                const buildingWidth = building.width * TILE_SIZE
                const buildingHeight = building.height * TILE_SIZE
                
                if (worldX >= buildingX && 
                    worldX < buildingX + buildingWidth && 
                    worldY >= buildingY && 
                    worldY < buildingY + buildingHeight) {
                  target = building
                  break
                }
              }
            }
          }
          
          // Check enemy factories if no building was targeted
          if (!target) {
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
          }
          
          // Check enemy units if no building or factory was targeted
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
              const originalDestTile = { x: Math.floor(destX / TILE_SIZE), y: Math.floor(destY / TILE_SIZE) }
              
              // Check if this tile is already targeted by previously processed units
              const alreadyTargeted = selectedUnits.slice(0, index).some(u => 
                u.moveTarget && u.moveTarget.x === originalDestTile.x && u.moveTarget.y === originalDestTile.y
              );
              
              // If already targeted, find an adjacent free tile instead
              let destTile = originalDestTile;
              if (alreadyTargeted) {
                const directions = [
                  {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0},
                  {dx: 1, dy: -1}, {dx: 1, dy: 1}, {dx: -1, dy: 1}, {dx: -1, dy: -1}
                ];
                
                for (const dir of directions) {
                  const newTile = { 
                    x: originalDestTile.x + dir.dx, 
                    y: originalDestTile.y + dir.dy 
                  };
                  
                  // Check if this new tile is valid and not targeted
                  if (newTile.x >= 0 && newTile.y >= 0 && 
                      newTile.x < mapGrid[0].length && newTile.y < mapGrid.length &&
                      mapGrid[newTile.y][newTile.x].type !== 'water' &&
                      mapGrid[newTile.y][newTile.x].type !== 'rock' &&
                      mapGrid[newTile.y][newTile.x].type !== 'building' &&
                      !selectedUnits.slice(0, index).some(u => 
                        u.moveTarget && u.moveTarget.x === newTile.x && u.moveTarget.y === newTile.y
                      )) {
                    destTile = newTile;
                    break;
                  }
                }
              }
              
              const path = findPath({ x: unit.tileX, y: unit.tileY }, destTile, mapGrid, null);
              if (path.length > 0 && (unit.tileX !== destTile.x || unit.tileY !== destTile.y)) {
                unit.path = path.slice(1);
                unit.target = null;
                unit.moveTarget = destTile; // Store the final destination
                playSound('movement');
              }
            }
          })
        }
      }
      isSelecting = false
      selectionActive = false
      gameState.selectionActive = false
    }
  })

  // --- Minimap Click: Recenters View and Commands Selected Units ---
  minimapCanvas.addEventListener('click', e => {
    // Don't process input if game is paused
    if (gameState.paused) return;

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
          unit.moveTarget = destTile // Store the final destination
          playSound('movement')
        }
      })
    }
  })

  // Enhanced keydown event listener
  document.addEventListener('keydown', e => {
    // Some keys should work even when paused
    if (e.key.toLowerCase() === 'i') {
      showControlsHelp();
      return;
    }
    // New: Toggle keybindings overview when H is pressed
    else if (e.key.toLowerCase() === 'h') {
      toggleKeyBindingsOverview();
      return;
    }
    
    // Don't process other inputs if gameState.paused && e.key.toLowerCase() !== 'i') return;
    
    // A key for alert mode
    if (e.key.toLowerCase() === 'a') {
      // Toggle alert mode on all selected player units.
      selectedUnits.forEach(unit => {
        // Only tank-v2 units can use alert mode
        if (unit.type === 'tank-v2') {
          unit.alertMode = !unit.alertMode;
        }
      });
    } 
    // D key for dodge
    else if (e.key.toLowerCase() === 'd') {
      // Fix: Make all selected units dodge to a random nearby free tile regardless of their state.
      selectedUnits.forEach(unit => {
        // Compute current tile coordinates from unit position.
        const tileX = Math.floor(unit.x / TILE_SIZE);
        const tileY = Math.floor(unit.y / TILE_SIZE);
        const candidates = [];
        const directions = [
          { dx: -1, dy:  0 },
          { dx:  1, dy:  0 },
          { dx:  0, dy: -1 },
          { dx:  0, dy:  1 },
          { dx: -1, dy: -1 },
          { dx: -1, dy:  1 },
          { dx:  1, dy: -1 },
          { dx:  1, dy:   1 }
        ];
        directions.forEach(dir => {
          const newX = tileX + dir.dx;
          const newY = tileY + dir.dy;
          // Check boundaries.
          if (newX >= 0 && newX < mapGrid[0].length && newY >= 0 && newY < mapGrid.length) {
            const tileType = mapGrid[newY][newX].type;
            if (tileType !== 'water' && tileType !== 'rock' && tileType !== 'building') {
              // Check that no unit occupies the candidate tile.
              const occupied = units.some(u => Math.floor(u.x / TILE_SIZE) === newX && Math.floor(u.y / TILE_SIZE) === newY);
              if (!occupied) {
                candidates.push({ x: newX, y: newY });
              }
            }
          }
        });
        
        if (candidates.length > 0) {
          const candidate = candidates[Math.floor(Math.random() * candidates.length)];
          // Store current path and target regardless of state so dodge can always be triggered.
          unit.originalPath = unit.path ? [...unit.path] : [];
          unit.originalTarget = unit.target;
          unit.isDodging = true;
          unit.dodgeEndTime = performance.now() + 3000; // Dodge lasts up to 3 seconds.
          
          // Compute a new path to the dodge destination using existing pathfinding.
          const newPath = findPath({ x: tileX, y: tileY }, candidate, mapGrid, null);
          if (newPath.length > 1) {
            unit.path = newPath.slice(1);
          }
        }
      });
    }
    // H key to focus on factory
    else if (e.key.toLowerCase() === 'h') {
      if (playerFactory) {
        // Calculate factory center
        const factoryX = (playerFactory.x + playerFactory.width/2) * TILE_SIZE;
        const factoryY = (playerFactory.y + playerFactory.height/2) * TILE_SIZE;
        
        // Center the view on the factory
        gameState.scrollOffset.x = Math.max(0, Math.min(factoryX - gameCanvas.width / 2, 
                                 mapGrid[0].length * TILE_SIZE - gameCanvas.width));
        gameState.scrollOffset.y = Math.max(0, Math.min(factoryY - gameCanvas.height / 2, 
                                 mapGrid.length * TILE_SIZE - gameCanvas.height));
        playSound('unitSelection');
      }
    }
    // Control group assignment (ctrl+number)
    else if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      const groupNum = e.key;
      console.log(`Attempting to assign control group ${groupNum} with ctrl key`);
      
      if (selectedUnits.length > 0) {
        // Only store units, not factories
        const onlyUnits = selectedUnits.filter(unit => unit.type !== 'factory' && unit.owner === 'player');
        
        if (onlyUnits.length > 0) {
          // Store references to the units and assign group number to each
          controlGroups[groupNum] = [...onlyUnits];
          onlyUnits.forEach(unit => {
            unit.groupNumber = groupNum;
          });
          console.log(`Successfully assigned control group ${groupNum} with ${onlyUnits.length} units`);
          playSound('unitSelection');
          
          // Visual feedback
          const message = document.createElement('div');
          message.textContent = `Group ${groupNum} assigned`;
          message.style.position = 'absolute';
          message.style.left = '50%';
          message.style.bottom = '10%';
          message.style.transform = 'translateX(-50%)';
          message.style.backgroundColor = 'rgba(0,0,0,0.7)';
          message.style.color = 'white';
          message.style.padding = '8px 16px';
          message.style.borderRadius = '4px';
          message.style.zIndex = '1000';
          document.body.appendChild(message);
          
          // Remove the message after 2 seconds
          setTimeout(() => {
            document.body.removeChild(message);
          }, 2000);
        }
      }
    }
    // Control group selection (just number keys 1-9)
    else if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
      const groupNum = e.key;
      console.log(`Trying to select control group ${groupNum}`);
      console.log(`Available control groups: ${Object.keys(controlGroups).join(', ')}`);
      
      // Check if we have units in this control group
      if (controlGroups[groupNum] && Array.isArray(controlGroups[groupNum]) && controlGroups[groupNum].length > 0) {
        console.log(`Found control group ${groupNum} with ${controlGroups[groupNum].length} units`);
        
        // Clear current selection
        units.forEach(u => { if (u.owner === 'player') u.selected = false });
        factories.forEach(f => f.selected = false);
        selectedUnits.length = 0;
        
        // Select all units in the control group that are still alive
        const aliveUnits = controlGroups[groupNum].filter(unit => 
          unit && // unit exists
          typeof unit === 'object' && // is an object
          units.includes(unit) && // is in the game units array
          unit.health > 0 && // is alive
          unit.owner === 'player' // belongs to player (safety check)
        );
        
        console.log(`Found ${aliveUnits.length} alive units in group ${groupNum}`);
        
        // Update the control group to only include alive units
        controlGroups[groupNum] = aliveUnits;
        
        if (aliveUnits.length > 0) {
          aliveUnits.forEach(unit => {
            unit.selected = true;
            selectedUnits.push(unit);
          });
          
          // Center view on the middle unit of the group
          const middleUnit = aliveUnits[Math.floor(aliveUnits.length / 2)];
          gameState.scrollOffset.x = Math.max(0, Math.min(middleUnit.x - gameCanvas.width / 2, 
                                   mapGrid[0].length * TILE_SIZE - gameCanvas.width));
          gameState.scrollOffset.y = Math.max(0, Math.min(middleUnit.y - gameCanvas.height / 2, 
                                   mapGrid.length * TILE_SIZE - gameCanvas.height));
          
          playSound('unitSelection');
          playSound('yesSir01');
        }
      }
    }
    // F key to toggle formation mode
    else if(e.key.toLowerCase() === 'f'){
      groupFormationMode = !groupFormationMode;
      
      // Toggle formationActive for selected units with a group number
      const groupedUnits = selectedUnits.filter(unit => unit.groupNumber);
      if (groupedUnits.length > 0) {
        // Find the center of the formation
        const centerX = groupedUnits.reduce((sum, unit) => sum + unit.x, 0) / groupedUnits.length;
        const centerY = groupedUnits.reduce((sum, unit) => sum + unit.y, 0) / groupedUnits.length;
        
        // Store relative positions for each unit
        groupedUnits.forEach(unit => {
          unit.formationActive = groupFormationMode;
          if (groupFormationMode) {
            // Store the relative position from center when formation is activated
            unit.formationOffset = {
              x: unit.x - centerX,
              y: unit.y - centerY
            };
          } else {
            // Clear formation data when deactivated
            unit.formationOffset = null;
          }
        });
      }
    }
  });

  // IMPORTANT: REMOVE THIS CODE TO PREVENT DUPLICATE BUILDING QUEUE EVENTS
  // We don't need to set up production buttons here since they are now handled in main.js
  // This prevents duplicate event listeners
}

function handleBoundingBoxSelection(units, factories) {
  try {
    const x1 = Math.min(selectionStart.x, selectionEnd.x)
    const y1 = Math.min(selectionStart.y, selectionEnd.y)
    const x2 = Math.max(selectionStart.x, selectionEnd.x)
    const y2 = Math.max(selectionStart.y, selectionEnd.y)
    
    // Clear current selection first
    selectedUnits.length = 0
    
    // Clear any factory selections
    if (factories) {
      factories.forEach(factory => {
        factory.selected = false;
      });
    }
    
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
    
    // Now check for player buildings in the selection rectangle
    if (gameState.buildings && gameState.buildings.length > 0) {
      for (const building of gameState.buildings) {
        if (building.owner === 'player') {
          const buildingX = building.x * TILE_SIZE
          const buildingY = building.y * TILE_SIZE
          const buildingWidth = building.width * TILE_SIZE
          const buildingHeight = building.height * TILE_SIZE
          
          // Check if any part of the building is within the selection rectangle
          if (buildingX + buildingWidth > x1 && buildingX < x2 && 
              buildingY + buildingHeight > y1 && buildingY < y2) {
            building.selected = true
            selectedUnits.push(building)
            playSound('unitSelection')
          } else {
            building.selected = false
          }
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
