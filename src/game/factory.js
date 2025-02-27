import { moveUnitToPosition, findNearbyFreePosition } from './movement';

export function produceUnit(factory, unitType, gameState) {
  // Create new unit
  const newUnit = {
    id: generateId(),
    type: unitType,
    faction: factory.faction,
    position: {...factory.position},
    health: getUnitStats(unitType).health,
    // ... other unit properties
  };
  
  // Find closest free tile
  const exitPosition = findClosestFreeTile(factory.position, gameState);
  
  if (exitPosition) {
    moveUnitToPosition(newUnit, exitPosition, gameState);
    gameState.units.push(newUnit);
    return newUnit;
  }
  
  return null;
}

function findClosestFreeTile(position, gameState) {
  // BFS to find closest free tile
  const queue = [];
  const visited = new Set();
  const directions = [
    {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0},
    {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1}
  ];
  
  queue.push({x: position.x, y: position.y, distance: 0});
  visited.add(`${position.x},${position.y}`);
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    // Skip the factory position itself
    if (current.distance > 0) {
      if (!isPositionOccupied(current, gameState) && 
          isValidPosition(current, gameState)) {
        return current;
      }
    }
    
    // Add neighbors
    for (const dir of directions) {
      const next = {
        x: current.x + dir.x,
        y: current.y + dir.y,
        distance: current.distance + 1
      };
      
      const key = `${next.x},${next.y}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  
  return null;
}
