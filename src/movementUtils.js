// movementUtils.js - Centralized utilities for unit movement
import { TILE_SIZE } from './config.js'

// Helper function to check if a tile is impassable
export function isImpassableTile(tileType) {
  return ['water', 'rock', 'building'].includes(tileType);
}

// Calculate the distance between two points
export function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Calculate the direction (angle in radians) between two points
export function getDirection(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

// Move unit along a path with proper rotation
export function moveUnitAlongPath(unit, nextTileX, nextTileY, delta, speed) {
  // Calculate target world position (center of the next tile)
  const targetX = nextTileX * TILE_SIZE + TILE_SIZE / 2;
  const targetY = nextTileY * TILE_SIZE + TILE_SIZE / 2;
  
  // Calculate unit's center position
  const unitCenterX = unit.x + TILE_SIZE / 2;
  const unitCenterY = unit.y + TILE_SIZE / 2;
  
  // Calculate direction and distance
  const dx = targetX - unitCenterX;
  const dy = targetY - unitCenterY;
  const distance = Math.hypot(dx, dy);
  
  // Set unit's target direction
  unit.targetDirection = Math.atan2(dy, dx);
  
  // Calculate effective speed (adjusted by delta time)
  const effectiveSpeed = speed * (delta / 16.67); // normalized for 60fps
  
  // If we're close enough to the next tile, snap to it
  if (distance <= effectiveSpeed) {
    unit.x = nextTileX * TILE_SIZE;
    unit.y = nextTileY * TILE_SIZE;
    unit.tileX = nextTileX;
    unit.tileY = nextTileY;
    return true; // Reached next tile
  } else {
    // Otherwise move towards it - ensure equal speed in all directions
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    unit.x += normalizedDx * effectiveSpeed;
    unit.y += normalizedDy * effectiveSpeed;
    return false; // Still moving
  }
}

// Check if unit can make dodging movement
export function canDodge(unit, mapGrid, units) {
  // If unit is already dodging or has no path, it can't dodge
  if (unit.isDodging || !unit.path.length) return false;
  
  // Check if unit has moved recently (to avoid dodging when stuck)
  const now = performance.now();
  if (now - unit.lastMovedTime > 2000) return false;
  
  // Check surrounding tiles for a valid dodge position
  const tileX = Math.floor(unit.x / TILE_SIZE);
  const tileY = Math.floor(unit.y / TILE_SIZE);
  
  // Get possible directions to dodge
  const directions = [
    { dx: 0, dy: -1 }, // North
    { dx: 1, dy: 0 },  // East
    { dx: 0, dy: 1 },  // South
    { dx: -1, dy: 0 }, // West
    { dx: 1, dy: -1 }, // Northeast
    { dx: 1, dy: 1 },  // Southeast
    { dx: -1, dy: 1 }, // Southwest
    { dx: -1, dy: -1 } // Northwest
  ];
  
  // Shuffle directions for randomness
  directions.sort(() => Math.random() - 0.5);
  
  for (const dir of directions) {
    const newX = tileX + dir.dx;
    const newY = tileY + dir.dy;
    
    // Check if position is valid
    if (isValidDodgePosition(newX, newY, mapGrid, units)) {
      return { x: newX, y: newY };
    }
  }
  
  return null;
}

// Helper to check if a position is valid for dodging
function isValidDodgePosition(x, y, mapGrid, units) {
  // Check bounds
  if (y < 0 || y >= mapGrid.length || x < 0 || x >= mapGrid[0].length) {
    return false;
  }
  
  // Check tile type
  const tileType = mapGrid[y][x].type;
  if (isImpassableTile(tileType)) {
    return false;
  }
  
  // Check if tile is occupied
  for (const unit of units) {
    const unitTileX = Math.floor(unit.x / TILE_SIZE);
    const unitTileY = Math.floor(unit.y / TILE_SIZE);
    
    if (unitTileX === x && unitTileY === y) {
      return false;
    }
  }
  
  return true;
}

// Get target point for attack movement (handles factories and units)
export function getTargetPoint(target, unitCenter) {
  if (target.width) {
    // For factories, find the closest point on the perimeter
    return getClosestPointOnRectPerimeter(
      unitCenter.x, unitCenter.y,
      target.x * TILE_SIZE, 
      target.y * TILE_SIZE,
      target.width * TILE_SIZE,
      target.height * TILE_SIZE
    );
  } else {
    // For units, use the center
    return {
      x: target.x + TILE_SIZE / 2,
      y: target.y + TILE_SIZE / 2
    };
  }
}

// Helper to find closest point on rectangle perimeter
function getClosestPointOnRectPerimeter(px, py, rx, ry, rw, rh) {
  // Find closest point on rectangle sides
  // Left side
  let closestX = rx;
  let closestY = Math.max(ry, Math.min(ry + rh, py));
  let minDist = getDistance(px, py, closestX, closestY);
  let result = { x: closestX, y: closestY };
  
  // Right side
  closestX = rx + rw;
  closestY = Math.max(ry, Math.min(ry + rh, py));
  let dist = getDistance(px, py, closestX, closestY);
  if (dist < minDist) {
    minDist = dist;
    result = { x: closestX, y: closestY };
  }
  
  // Top side
  closestX = Math.max(rx, Math.min(rx + rw, px));
  closestY = ry;
  dist = getDistance(px, py, closestX, closestY);
  if (dist < minDist) {
    minDist = dist;
    result = { x: closestX, y: closestY };
  }
  
  // Bottom side
  closestX = Math.max(rx, Math.min(rx + rw, px));
  closestY = ry + rh;
  dist = getDistance(px, py, closestX, closestY);
  if (dist < minDist) {
    minDist = dist;
    result = { x: closestX, y: closestY };
  }
  
  return result;
}
