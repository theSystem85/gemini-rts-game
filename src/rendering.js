// rendering.js
import { TILE_SIZE, TILE_COLORS } from './config.js';
import { tileToPixel } from './utils.js';

export function renderGame(gameCtx, gameCanvas, mapGrid, factories, units, bullets, scrollOffset, selectionActive, selectionStart, selectionEnd) {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
  const startTileX = Math.floor(scrollOffset.x / TILE_SIZE);
  const startTileY = Math.floor(scrollOffset.y / TILE_SIZE);
  const endTileX = Math.min(mapGrid[0].length, Math.ceil((scrollOffset.x + gameCanvas.width) / TILE_SIZE));
  const endTileY = Math.min(mapGrid.length, Math.ceil((scrollOffset.y + gameCanvas.height) / TILE_SIZE));
  
  // Draw the map tiles.
  for (let y = startTileY; y < endTileY; y++) {
    for (let x = startTileX; x < endTileX; x++) {
      const tile = mapGrid[y][x];
      gameCtx.fillStyle = TILE_COLORS[tile.type];
      gameCtx.fillRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE);
      gameCtx.strokeStyle = 'rgba(0,0,0,0.1)';
      gameCtx.strokeRect(x * TILE_SIZE - scrollOffset.x, y * TILE_SIZE - scrollOffset.y, TILE_SIZE, TILE_SIZE);
    }
  }
  
  // Draw the factories.
  factories.forEach(factory => {
    const pos = tileToPixel(factory.x, factory.y);
    // Player factory is green; enemy factory is red.
    gameCtx.fillStyle = factory.id === 'player' ? '#0A0' : '#A00';
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - scrollOffset.y, factory.width * TILE_SIZE, factory.height * TILE_SIZE);
    // Draw health bar above the factory.
    const barWidth = factory.width * TILE_SIZE;
    const healthRatio = factory.health / factory.maxHealth;
    gameCtx.fillStyle = '#0F0';
    gameCtx.fillRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth * healthRatio, 5);
    gameCtx.strokeStyle = '#000';
    gameCtx.strokeRect(pos.x - scrollOffset.x, pos.y - 10 - scrollOffset.y, barWidth, 5);
    // If enemy factory, display its budget.
    if (factory.id === 'enemy' && factory.budget !== undefined) {
      gameCtx.fillStyle = '#FFF';
      gameCtx.font = '12px Arial';
      gameCtx.fillText(`Budget: ${factory.budget}`, pos.x - scrollOffset.x, pos.y - 20 - scrollOffset.y);
    }
  });
  
  // Draw the units.
  units.forEach(unit => {
    // Choose color based on owner and unit type.
    if (unit.owner === 'player') {
      gameCtx.fillStyle = unit.type === 'tank' ? '#00F' : '#9400D3';
    } else {
      gameCtx.fillStyle = unit.type === 'tank' ? '#F00' : '#FF00FF';
    }
    // Draw the unit as a circle.
    gameCtx.beginPath();
    gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3, 0, 2 * Math.PI);
    gameCtx.fill();
    // If the unit is selected, draw a highlight circle.
    if (unit.selected) {
      gameCtx.strokeStyle = '#FF0';
      gameCtx.lineWidth = 2;
      gameCtx.beginPath();
      gameCtx.arc(unit.x + TILE_SIZE / 2 - scrollOffset.x, unit.y + TILE_SIZE / 2 - scrollOffset.y, TILE_SIZE / 3 + 3, 0, 2 * Math.PI);
      gameCtx.stroke();
    }
    
    // Always draw the turret line showing the aiming direction.
    let turretDirX = 0, turretDirY = -1; // Default points up.
    if (unit.path && unit.path.length > 0) {
      const nextTile = unit.path[0];
      const nextCenterX = nextTile.x * TILE_SIZE + TILE_SIZE / 2;
      const nextCenterY = nextTile.y * TILE_SIZE + TILE_SIZE / 2;
      turretDirX = nextCenterX - (unit.x + TILE_SIZE / 2);
      turretDirY = nextCenterY - (unit.y + TILE_SIZE / 2);
    } else if (unit.target) {
      if (unit.target.tileX !== undefined) {
        turretDirX = (unit.target.x + TILE_SIZE / 2) - (unit.x + TILE_SIZE / 2);
        turretDirY = (unit.target.y + TILE_SIZE / 2) - (unit.y + TILE_SIZE / 2);
      } else {
        turretDirX = (unit.target.x + (unit.target.width * TILE_SIZE) / 2) - (unit.x + TILE_SIZE / 2);
        turretDirY = (unit.target.y + (unit.target.height * TILE_SIZE) / 2) - (unit.y + TILE_SIZE / 2);
      }
    }
    const angle = Math.atan2(turretDirY, turretDirX);
    const turretLength = 10;
    const centerX = unit.x + TILE_SIZE / 2 - scrollOffset.x;
    const centerY = unit.y + TILE_SIZE / 2 - scrollOffset.y;
    const turretEndX = centerX + Math.cos(angle) * turretLength;
    const turretEndY = centerY + Math.sin(angle) * turretLength;
    gameCtx.strokeStyle = '#000';
    gameCtx.lineWidth = 2;
    gameCtx.beginPath();
    gameCtx.moveTo(centerX, centerY);
    gameCtx.lineTo(turretEndX, turretEndY);
    gameCtx.stroke();
    
    // Draw a health bar above the unit.
    // rendering.js (modified excerpt inside units.forEach loop)
    // Draw a health bar above the unit.
    const unitHealthRatio = unit.health / unit.maxHealth;
    const healthBarWidth = TILE_SIZE * 0.8;
    const healthBarHeight = 4;
    const healthBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - healthBarWidth / 2;
    const healthBarY = unit.y - 10 - scrollOffset.y;
    gameCtx.fillStyle = '#F00';
    gameCtx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
    gameCtx.fillStyle = '#0F0';
    gameCtx.fillRect(healthBarX, healthBarY, healthBarWidth * unitHealthRatio, healthBarHeight);
    gameCtx.strokeStyle = '#000';
    gameCtx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

    // [New] Draw harvester progress bar if mining.
    // After drawing the health bar for a unit:
    if (unit.type === 'harvester') {
      let progress = 0;
      // If currently mining, show mining progress.
      if (unit.harvesting) {
        progress = Math.min((performance.now() - unit.harvestTimer) / 10000, 1);
      }
      // If fully loaded (oreCarried >= 5), force progress to 100%.
      if (unit.oreCarried >= 5) {
        progress = 1;
      }
      // Draw the progress bar if there is any progress.
      if (progress > 0) {
        const progressBarWidth = TILE_SIZE * 0.8;
        const progressBarHeight = 3;
        const progressBarX = unit.x + TILE_SIZE / 2 - scrollOffset.x - progressBarWidth / 2;
        const progressBarY = unit.y - 5 - scrollOffset.y;
        gameCtx.fillStyle = '#FFD700'; // Gold color.
        gameCtx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight);
        gameCtx.strokeStyle = '#000';
        gameCtx.strokeRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
      }
    }
  });
  
  // Draw bullets.
  bullets.forEach(bullet => {
    gameCtx.fillStyle = '#FFF';
    gameCtx.beginPath();
    gameCtx.arc(bullet.x - scrollOffset.x, bullet.y - scrollOffset.y, 3, 0, 2 * Math.PI);
    gameCtx.fill();
  });
  
  // Draw the selection rectangle if active.
  if (selectionActive && selectionStart && selectionEnd) {
    const rectX = selectionStart.x - scrollOffset.x;
    const rectY = selectionStart.y - scrollOffset.y;
    const rectWidth = selectionEnd.x - selectionStart.x;
    const rectHeight = selectionEnd.y - selectionStart.y;
    gameCtx.strokeStyle = '#FF0';
    gameCtx.lineWidth = 2;
    gameCtx.strokeRect(rectX, rectY, rectWidth, rectHeight);
  }
}

export function renderMinimap(minimapCtx, minimapCanvas, mapGrid, scrollOffset, gameCanvas, units) {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  const scaleX = minimapCanvas.width / (mapGrid[0].length * TILE_SIZE);
  const scaleY = minimapCanvas.height / (mapGrid.length * TILE_SIZE);
  // Draw each tile on the minimap.
  for (let y = 0; y < mapGrid.length; y++) {
    for (let x = 0; x < mapGrid[0].length; x++) {
      minimapCtx.fillStyle = TILE_COLORS[mapGrid[y][x].type];
      minimapCtx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, TILE_SIZE * scaleX, TILE_SIZE * scaleY);
    }
  }
  // Draw units on the minimap.
  units.forEach(unit => {
    minimapCtx.fillStyle = unit.owner === 'player' ? '#00F' : '#F00';
    const unitX = (unit.x + TILE_SIZE / 2) * scaleX;
    const unitY = (unit.y + TILE_SIZE / 2) * scaleY;
    minimapCtx.beginPath();
    minimapCtx.arc(unitX, unitY, 3, 0, 2 * Math.PI);
    minimapCtx.fill();
  });
  // Draw a rectangle indicating the current viewport.
  minimapCtx.strokeStyle = '#FF0';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(scrollOffset.x * scaleX, scrollOffset.y * scaleY, gameCanvas.width * scaleX, gameCanvas.height * scaleY);
}
