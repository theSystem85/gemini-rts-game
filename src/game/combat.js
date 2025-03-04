import { moveUnitToPosition, findNearbyFreePosition } from './movement';

export function fireProjectile(unit, target, gameState) {
  // Check for friendly fire - don't fire if friendly units are in the path
  if (hasFriendlyUnitsInPath(unit, target, gameState)) {
    return null; // Prevent firing if friendly units are in the way
  }
  
  // Create projectile
  const projectile = {
    id: generateId(),
    position: {...unit.position},
    target: {...target.position},
    speed: 8, // Increased from 3 to 8
    damage: unit.damage,
    ownerId: unit.id,
    ownerFaction: unit.faction
  };
  
  gameState.projectiles.push(projectile);
  
  // Make enemy units dodge if they're in the path
  const unitsInPath = findUnitsInProjectilePath(projectile, gameState);
  
  unitsInPath.forEach(targetUnit => {
    if (targetUnit.faction !== unit.faction) {
      const dodgePosition = findNearbyFreePosition(targetUnit.position, gameState, targetUnit);
      if (dodgePosition) {
        targetUnit.position = dodgePosition;
        targetUnit.needsPathRecalculation = true;
      }
    }
  });
  
  return projectile;
}

// Check if there are friendly units in the line of fire
function hasFriendlyUnitsInPath(shooter, target, gameState) {
  try {
    const shooterPos = shooter.position;
    const targetPos = target.position;
    const dx = targetPos.x - shooterPos.x;
    const dy = targetPos.y - shooterPos.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance < 0.001) return false; // Avoid division by zero
    
    // Normalize direction vector
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Check points along the trajectory
    const checkPoints = 10; // Number of points to check
    const checkDistance = distance * 0.9; // Check up to 90% of the distance
    
    for (let i = 1; i <= checkPoints; i++) {
      const checkRatio = (i / checkPoints) * checkDistance;
      const checkX = shooterPos.x + dirX * checkRatio;
      const checkY = shooterPos.y + dirY * checkRatio;
      
      // Find any unit at this position
      const unitAtPosition = findUnitAtPosition({x: checkX, y: checkY}, gameState);
      
      // If we find a friendly unit that's not the shooter itself
      if (unitAtPosition && 
          unitAtPosition.id !== shooter.id && 
          unitAtPosition.faction === shooter.faction) {
        return true; // Friendly unit found in path
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error in hasFriendlyUnitsInPath:", error);
    return true; // Safety - don't shoot if there's an error
  }
}

function findUnitsInProjectilePath(projectile, gameState) {
  const units = [];
  const startPos = projectile.position;
  const targetPos = projectile.target;
  
  // Calculate direction vector
  const dx = targetPos.x - startPos.x;
  const dy = targetPos.y - startPos.y;
  const distance = Math.hypot(dx, dy);
  
  if (distance < 0.001) return units; // Avoid division by zero
  
  const dirX = dx / distance;
  const dirY = dy / distance;
  
  // Check several points along the trajectory
  const checkPoints = Math.ceil(distance / 0.5); // Check every half unit
  
  for (let i = 1; i < checkPoints; i++) {
    const checkRatio = i / checkPoints;
    const checkX = startPos.x + dirX * distance * checkRatio;
    const checkY = startPos.y + dirY * distance * checkRatio;
    
    const unitAtPosition = findUnitAtPosition({x: checkX, y: checkY}, gameState);
    
    if (unitAtPosition && !units.includes(unitAtPosition)) {
      units.push(unitAtPosition);
    }
  }
  
  return units;
}

export function updateProjectiles(gameState, deltaTime) {
  try {
    for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
      const projectile = gameState.projectiles[i];
      
      // Update position
      const direction = {
        x: projectile.target.x - projectile.position.x,
        y: projectile.target.y - projectile.position.y
      };
      
      const distance = Math.hypot(direction.x, direction.y);
      
      if (distance < 0.001) {
        // Target reached, apply damage and remove projectile
        const hitUnit = findUnitAtPosition(projectile.target, gameState);
        if (hitUnit && hitUnit.faction !== projectile.ownerFaction) {
          // Apply randomized damage (0.8x to 1.2x base damage)
          const damageMultiplier = 0.8 + Math.random() * 0.4;
          const actualDamage = Math.round(projectile.damage * damageMultiplier);
          hitUnit.health -= actualDamage;
        }
        
        gameState.projectiles.splice(i, 1);
        continue;
      }
      
      // Normalize direction
      direction.x /= distance;
      direction.y /= distance;
      
      // Move projectile
      const moveDistance = projectile.speed * deltaTime;
      projectile.position.x += direction.x * moveDistance;
      projectile.position.y += direction.y * moveDistance;
      
      // Check if we should hit something
      const distanceToTarget = Math.hypot(
        projectile.target.x - projectile.position.x,
        projectile.target.y - projectile.position.y
      );
      
      if (distanceToTarget <= moveDistance) {
        // We're going to hit within this frame
        const hitUnit = findUnitAtPosition(projectile.target, gameState);
        if (hitUnit && hitUnit.faction !== projectile.ownerFaction) {
          // Apply randomized damage (0.8x to 1.2x base damage)
          const damageMultiplier = 0.8 + Math.random() * 0.4;
          const actualDamage = Math.round(projectile.damage * damageMultiplier);
          hitUnit.health -= actualDamage;
        }
        
        gameState.projectiles.splice(i, 1);
      }
    }
  } catch (error) {
    console.error("Error in updateProjectiles:", error);
  }
}

function findUnitAtPosition(position, gameState) {
  const threshold = 0.5; // Collision radius in game units
  
  for (const unit of gameState.units) {
    const distance = Math.hypot(
      unit.position.x - position.x,
      unit.position.y - position.y
    );
    
    if (distance < threshold) {
      return unit;
    }
  }
  
  return null;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
