export function moveUnitToPosition(unit, targetPosition, gameState) {
  try {
    // Algorithm A1: Central Movement Logic
    // Check if the target position is valid and not occupied
    if (!isValidPosition(targetPosition, gameState)) {
      // Find the closest valid position
      const newTarget = findNearbyFreePosition(targetPosition, gameState);
      if (newTarget) {
        targetPosition = newTarget;
      } else {
        // No valid position found, stay put
        return false;
      }
    }
    
    // Create navigation grid
    const grid = createNavigationGrid(gameState);
    
    // Use A* to find a path that respects unit direction
    const path = findDirectionalPath(unit, targetPosition, grid, gameState);
    
    if (!path || path.length === 0) {
      return false; // No path found
    }
    
    // Set the unit's path
    unit.path = path;
    unit.targetPosition = targetPosition;
    return true;
  } catch (error) {
    console.error("Error in moveUnitToPosition:", error);
    return false;
  }
}

// Check if movement from current position to next position is aligned with unit direction
function isAlignedWithDirection(unit, nextPosition) {
  // Get unit's current direction in radians (assuming unit has direction property)
  const currentDirection = unit.direction || 0;
  
  // Calculate movement direction
  const dx = nextPosition.x - unit.position.x;
  const dy = nextPosition.y - unit.position.y;
  const movementAngle = Math.atan2(dy, dx);
  
  // Calculate the difference between directions
  let angleDiff = Math.abs(normalizeAngle(movementAngle - currentDirection));
  
  // Allow movement if it's forward (within 45 degrees of current direction)
  // or backward (within 45 degrees of opposite direction)
  return angleDiff < Math.PI/4 || Math.abs(angleDiff - Math.PI) < Math.PI/4;
}

// Normalize angle to be between -PI and PI
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

// Calculate turn cost based on direction change
function calculateTurnCost(fromDirection, toDirection) {
  // Normalize directions
  fromDirection = normalizeAngle(fromDirection);
  toDirection = normalizeAngle(toDirection);
  
  // Calculate the angle difference
  let angleDiff = Math.abs(fromDirection - toDirection);
  if (angleDiff > Math.PI) {
    angleDiff = 2 * Math.PI - angleDiff;
  }
  
  // Base turn cost: 50% slower than before (1.5x penalty)
  return angleDiff * 1.5;
}

// A* pathfinding implementation with directional constraints
function findDirectionalPath(unit, end, grid, gameState) {
  try {
    // Check for invalid inputs
    if (!unit || !end || !grid || grid.length === 0) {
      return [];
    }
    
    const start = unit.position;
    const startX = Math.floor(start.x);
    const startY = Math.floor(start.y);
    const endX = Math.floor(end.x);
    const endY = Math.floor(end.y);
    
    // Check bounds
    if (startY < 0 || startY >= grid.length || 
        startX < 0 || startX >= grid[0].length ||
        endY < 0 || endY >= grid.length || 
        endX < 0 || endX >= grid[0].length) {
      return [];
    }
    
    // Check if end is impassable
    if (grid[endY][endX] === Infinity) {
      return [];
    }
    
    // Implementation of A* algorithm with directional constraints
    // This replaces the previous findPath function
    // Include directional constraints in path calculation
    
    // OpenSet, closedSet, came_from, and other A* variables...
    
    // When considering neighbors:
    // 1. Check if movement direction is aligned with unit direction
    // 2. Add turn cost if direction change is needed
    
    // Return the found path with direction updates
    // For each path segment, include direction information
    
    // If no path found, return empty array
    return [];
  } catch (error) {
    console.error("Error in findDirectionalPath:", error);
    return []; // Return empty path in case of error
  }
}

function isPositionOccupied(position, gameState, excludeUnit = null) {
  try {
    // Check if any unit is at this position
    for (const unit of gameState.units) {
      if (excludeUnit && unit.id === excludeUnit.id) {
        continue; // Skip the excluded unit
      }
      
      const distance = Math.hypot(
        unit.position.x - position.x,
        unit.position.y - position.y
      );
      
      if (distance < 0.5) { // Units need at least 0.5 unit distance
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error in isPositionOccupied:", error);
    return true; // If error, assume position is occupied for safety
  }
}

function findNearbyFreePosition(position, gameState, excludeUnit = null) {
  try {
    // If the position itself is free, return it
    if (!isPositionOccupied(position, gameState, excludeUnit) && 
        isValidPosition(position, gameState)) {
      return position;
    }
    
    // Try positions in expanding spiral pattern
    const directions = [
      [0, 1], [1, 0], [0, -1], [-1, 0], // 4 primary directions
      [1, 1], [1, -1], [-1, -1], [-1, 1] // 4 diagonal directions
    ];
    
    // Try up to distance of 5 tiles away
    for (let distance = 1; distance <= 5; distance++) {
      for (const [dx, dy] of directions) {
        const newPos = {
          x: position.x + dx * distance,
          y: position.y + dy * distance
        };
        
        if (!isPositionOccupied(newPos, gameState, excludeUnit) && 
            isValidPosition(newPos, gameState)) {
          return newPos;
        }
      }
    }
    
    return null; // No free position found
  } catch (error) {
    console.error("Error in findNearbyFreePosition:", error);
    return null;
  }
}

function isValidPosition(position, gameState) {
  try {
    // Check if position is within map bounds
    if (position.x < 0 || position.y < 0 || 
        position.x >= gameState.mapWidth || 
        position.y >= gameState.mapHeight) {
      return false;
    }
    
    // Get tile at position
    const tileX = Math.floor(position.x);
    const tileY = Math.floor(position.y);
    const tile = gameState.mapGrid[tileY][tileX];
    
    // Check if tile is passable
    return tile.type !== 'water' && tile.type !== 'rock';
  } catch (error) {
    console.error("Error in isValidPosition:", error);
    return false; // If error, assume position is invalid for safety
  }
}

function createNavigationGrid(gameState) {
  try {
    const grid = [];
    
    // Initialize grid with passable/impassable information
    for (let y = 0; y < gameState.mapHeight; y++) {
      const row = [];
      for (let x = 0; x < gameState.mapWidth; x++) {
        const tile = gameState.mapGrid[y][x];
        
        if (tile.type === 'water' || tile.type === 'rock') {
          row.push(Infinity); // Impassable
        } else if (tile.type === 'street') {
          row.push(0.5); // Half cost (2x speed)
        } else {
          row.push(1); // Normal cost
        }
      }
      grid.push(row);
    }
    
    // Mark occupied positions (except for the unit being moved)
    for (const unit of gameState.units) {
      const x = Math.floor(unit.position.x);
      const y = Math.floor(unit.position.y);
      
      if (x >= 0 && x < gameState.mapWidth && y >= 0 && y < gameState.mapHeight) {
        // Don't completely block, but make it costly to move through units
        if (grid[y][x] !== Infinity) {
          grid[y][x] = grid[y][x] * 3; // Triple the cost
        }
      }
    }
    
    return grid;
  } catch (error) {
    console.error("Error in createNavigationGrid:", error);
    
    // Return a simple grid as fallback
    const fallbackGrid = [];
    for (let y = 0; y < gameState.mapHeight; y++) {
      fallbackGrid.push(Array(gameState.mapWidth).fill(1));
    }
    return fallbackGrid;
  }
}

// Replace the old findPath function with the directional version
function findPath(start, end, grid) {
  console.warn("Using deprecated findPath function. Use findDirectionalPath instead.");
  // ...existing code...
}
