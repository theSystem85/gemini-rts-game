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
    
    // Use A* to find a path
    const path = findPath(unit.position, targetPosition, grid);
    
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

// A* pathfinding implementation
function findPath(start, end, grid) {
  try {
    // Check for invalid inputs
    if (!start || !end || !grid || grid.length === 0) {
      return [];
    }
    
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
    
    // Implementation of A* algorithm
    // ...existing code...
    
    // If no path found, return empty array
    return [];
  } catch (error) {
    console.error("Error in findPath:", error);
    return []; // Return empty path in case of error
  }
}
