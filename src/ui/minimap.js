// minimap.js
// Handle minimap interaction and navigation

import { gameState } from '../gameState.js';
import { MAP_TILES_X, MAP_TILES_Y, TILE_SIZE } from '../config.js';

export function setupMinimapHandlers(gameCanvas) {
  const minimapElement = document.getElementById('minimap');
  if (!minimapElement) {
    return;
  }

  // Handle minimap dragging state
  let isMinimapDragging = false;

  minimapElement.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) {
      e.preventDefault();
      isMinimapDragging = true;
      handleMinimapClick(e, gameCanvas);
    }
  });

  minimapElement.addEventListener('mousemove', (e) => {
    if (isMinimapDragging) {
      handleMinimapClick(e, gameCanvas);
    }
  });

  // Use mouseup on the document to ensure we catch the event even if released outside the minimap
  document.addEventListener('mouseup', (e) => {
    if (isMinimapDragging) {
      // This is important - process one last time with the final cursor position
      // when it's still in drag mode before ending the drag
      if (e.target === minimapElement) {
        handleMinimapClick(e, gameCanvas);
      }
      isMinimapDragging = false;
    }
  });

  // Prevent context menu on minimap
  minimapElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
}

export function handleMinimapClick(e, gameCanvas) {
  // Get minimap dimensions
  const minimap = e.target;
  const minimapRect = minimap.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Calculate click position relative to minimap
  // Use CSS dimensions (display size) for calculating click position
  const clickX = (e.clientX - minimapRect.left) / minimapRect.width;
  const clickY = (e.clientY - minimapRect.top) / minimapRect.height;
  
  // Use logical (CSS) dimensions for scroll calculation, not the scaled canvas dimensions
  // The actual game coordinate space should use CSS dimensions
  const logicalCanvasWidth = parseInt(gameCanvas.style.width, 10) || (window.innerWidth - 250);
  const logicalCanvasHeight = parseInt(gameCanvas.style.height, 10) || window.innerHeight;
  
  // Calculate new scroll position
  const newX = clickX * (MAP_TILES_X * TILE_SIZE - logicalCanvasWidth);
  const newY = clickY * (MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight);
  
  // Update gameState.scrollOffset
  gameState.scrollOffset.x = Math.max(0, Math.min(newX, MAP_TILES_X * TILE_SIZE - logicalCanvasWidth));
  gameState.scrollOffset.y = Math.max(0, Math.min(newY, MAP_TILES_Y * TILE_SIZE - logicalCanvasHeight));
}