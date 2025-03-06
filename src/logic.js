// logic.js
import {
  TILE_SIZE,
} from './config.js'
import { buildOccupancyMap } from './units.js'
import { playSound } from './sound.js'

export let explosions = [] // Global explosion effects for rocket impacts

// --- Helper Functions ---
export function checkBulletCollision(bullet, units, factories, gameState) {
  try {
    // Check collisions with units
    const hitUnit = findBulletUnitCollision(bullet, units);
    if (hitUnit) return hitUnit;
    
    // Check collisions with factories
    const hitFactory = findBulletFactoryCollision(bullet, factories, gameState);
    if (hitFactory) return hitFactory;
    
    return null;
  } catch (error) {
    console.error("Error in checkBulletCollision:", error);
    return null;
  }
}

// Helper to find bullet-unit collisions
function findBulletUnitCollision(bullet, units) {
  for (const unit of units) {
    // Skip friendly units to prevent friendly fire
    if (unit.owner === bullet.shooter?.owner) continue;
    
    const distance = getDistance(
      bullet.x,
      bullet.y,
      unit.x + TILE_SIZE / 2,
      unit.y + TILE_SIZE / 2
    );
    
    if (distance < 10) { // 10-pixel threshold for collision
      return unit;
    }
  }
  return null;
}

// Helper to find bullet-factory collisions
function findBulletFactoryCollision(bullet, factories, gameState) {
  for (const factory of factories) {
    // Skip friendly factories
    if (factory.id === bullet.shooter?.owner) continue;
    if (factory.destroyed) continue;
    
    const factoryX = factory.x * TILE_SIZE;
    const factoryY = factory.y * TILE_SIZE;
    const factoryWidth = factory.width * TILE_SIZE;
    const factoryHeight = factory.height * TILE_SIZE;
    
    if (isPointInRectangle(bullet.x, bullet.y, 
                           factoryX - 5, factoryY - 5, 
                           factoryWidth + 10, factoryHeight + 10)) {
      return factory;
    }
  }
  return null;
}

// Helper to check if a point is inside a rectangle
function isPointInRectangle(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Trigger explosion effect and apply area damage
export function triggerExplosion(x, y, baseDamage, units, factories, shooter, now, mapGrid) {
  const explosionRadius = TILE_SIZE * 2;
  
  // Add explosion visual effect
  explosions.push({
    x,
    y,
    startTime: now,
    duration: 500,
    maxRadius: explosionRadius
  });
  
  playSound('explosion'); // play explosion sound when a destruction occurs
  
  // Apply damage to nearby units and factories
  applyExplosionDamage(x, y, explosionRadius, baseDamage, units, shooter);
  applyExplosionDamage(x, y, explosionRadius, baseDamage, factories, shooter);
}

// Helper to apply damage from explosion to entities
function applyExplosionDamage(explosionX, explosionY, radius, baseDamage, entities, shooter) {
  entities.forEach(entity => {
    // Calculate entity center point
    const entityCenterX = entity.x + (entity.width ? entity.width * TILE_SIZE / 2 : TILE_SIZE / 2);
    const entityCenterY = entity.y + (entity.height ? entity.height * TILE_SIZE / 2 : TILE_SIZE / 2);
    
    const distance = getDistance(explosionX, explosionY, entityCenterX, entityCenterY);
    
    // Skip the shooter if this was their own explosion
    if (distance < radius) {
      if (shooter && entity.id === shooter.id) return;
      
      const falloff = 1 - (distance / radius);
      const damage = Math.floor(baseDamage * falloff * (0.8 + Math.random() * 0.4));
      
      if (entity.health) {
        entity.health = Math.max(0, entity.health - damage);
      }
    }
  });
}

export function isAdjacentToFactory(unit, factory) {
  const unitTileX = Math.floor(unit.x / TILE_SIZE);
  const unitTileY = Math.floor(unit.y / TILE_SIZE);
  
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (unitTileX === x && unitTileY === y) {
        return true;
      }
    }
  }
  return false;
}

export function findClosestOre(unit, mapGrid) {
  const startX = Math.floor(unit.x / TILE_SIZE);
  const startY = Math.floor(unit.y / TILE_SIZE);
  const searchRadius = 20;
  
  let closest = null;
  let closestDist = Infinity;
  
  // Search in expanding square around the unit
  for (let r = 1; r <= searchRadius; r++) {
    // Check the perimeter of the square with radius r
    for (let dx = -r; dx <= r; dx++) {
      // Top and bottom edges
      checkOreAtTile(startX + dx, startY - r);
      checkOreAtTile(startX + dx, startY + r);
    }
    
    for (let dy = -r + 1; dy < r; dy++) {
      // Left and right edges
      checkOreAtTile(startX - r, startY + dy);
      checkOreAtTile(startX + r, startY + dy);
    }
    
    // If we found ore in this radius, return the closest one
    if (closest) return closest;
  }
  
  return null;
  
  function checkOreAtTile(x, y) {
    // Check bounds
    if (y < 0 || y >= mapGrid.length || x < 0 || x >= mapGrid[0].length) return;
    
    if (mapGrid[y][x].type === 'ore') {
      const dist = Math.hypot(x - startX, y - startY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = { x, y };
      }
    }
  }
}

export function findAdjacentTile(factory, mapGrid) {
  for (let y = factory.y - 1; y <= factory.y + factory.height; y++) {
    for (let x = factory.x - 1; x <= factory.x + factory.width; x++) {
      if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) continue;
      if (mapGrid[y][x].type !== 'building') {
        return { x, y };
      }
    }
  }
  return null;
}

// Prevent friendly fire by ensuring clear line-of-sight.
// Returns true if no friendly unit (other than shooter and target) is in the bullet's path.
export function hasClearShot(shooter, target, units) {
  // Calculate shooter and target center points
  const shooterCenterX = shooter.x + TILE_SIZE / 2;
  const shooterCenterY = shooter.y + TILE_SIZE / 2;
  
  const targetCenterX = target.x + (target.width ? target.width * TILE_SIZE / 2 : TILE_SIZE / 2);
  const targetCenterY = target.y + (target.height ? target.height * TILE_SIZE / 2 : TILE_SIZE / 2);
  
  // Check each friendly unit to see if it's in the way
  for (const unit of units) {
    // Skip the shooter and target
    if (unit.id === shooter.id || unit.id === target.id) continue;
    
    // Skip enemy units (we only care about friendly fire)
    if (unit.owner !== shooter.owner) continue;
    
    // Check if the unit is in the way using point-to-line-segment distance
    if (isUnitInLineOfFire(unit, shooterCenterX, shooterCenterY, targetCenterX, targetCenterY)) {
      return false;
    }
  }
  
  return true;
}

// Check if a unit is in the line of fire between shooter and target
function isUnitInLineOfFire(unit, x1, y1, x2, y2) {
  const unitCenterX = unit.x + TILE_SIZE / 2;
  const unitCenterY = unit.y + TILE_SIZE / 2;
  
  // Calculate the distance from the unit to the line of fire
  const distToSegment = pointToLineSegmentDistance(
    unitCenterX, unitCenterY, 
    x1, y1, x2, y2
  );
  
  // Safety threshold is half the unit size
  const threshold = TILE_SIZE * 0.4;
  return distToSegment < threshold;
}

// Add this new function to find a position with a clear line of sight
export function findPositionWithClearShot(unit, target, units, mapGrid) {
  // Get the unit's current tile position
  const startTileX = Math.floor(unit.x / TILE_SIZE);
  const startTileY = Math.floor(unit.y / TILE_SIZE);
  
  // Compute target center
  const targetCenterX = target.x + (target.width ? target.width * TILE_SIZE / 2 : TILE_SIZE / 2);
  const targetCenterY = target.y + (target.height ? target.height * TILE_SIZE / 2 : TILE_SIZE / 2);
  
  // Try finding positions with clear shots in increasing radius
  const maxRadius = 3;
  let bestPosition = null;
  let bestDistanceScore = Infinity;
  
  // Search in expanding squares
  for (let radius = 1; radius <= maxRadius; radius++) {
    // Test positions around the unit in a square pattern
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check positions on the perimeter of the square at this radius
        if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue;
        
        const testX = startTileX + dx;
        const testY = startTileY + dy;
        
        // Skip invalid tiles
        if (testX < 0 || testY < 0 || testX >= mapGrid[0].length || testY >= mapGrid.length) continue;
        if (isImpassableTile(mapGrid[testY][testX].type)) continue;
        
        // Skip tiles that are already occupied
        if (isTileOccupied(testX, testY, units, unit)) continue;
        
        // Calculate world position of test tile center
        const testWorldX = testX * TILE_SIZE + TILE_SIZE / 2;
        const testWorldY = testY * TILE_SIZE + TILE_SIZE / 2;
        
        // Check if there's a clear shot from this position
        const mockUnit = { 
          ...unit, 
          x: testX * TILE_SIZE, 
          y: testY * TILE_SIZE 
        };
        
        if (hasClearShot(mockUnit, target, units)) {
          // Calculate distance score (prefer closer positions)
          const distToTarget = getDistance(testWorldX, testWorldY, targetCenterX, targetCenterY);
          const distFromStart = getDistance(testWorldX, testWorldY, unit.x + TILE_SIZE/2, unit.y + TILE_SIZE/2);
          
          // Combined score: weight distance to target more than distance from start
          const combinedScore = distToTarget * 0.7 + distFromStart * 0.3;
          
          if (combinedScore < bestDistanceScore) {
            bestDistanceScore = combinedScore;
            bestPosition = { x: testX, y: testY };
          }
        }
      }
    }
    
    // If we found a position at this radius, stop searching
    if (bestPosition) break;
  }
  
  if (bestPosition) {
    unit.path = [bestPosition];
    unit.findingClearShot = false;
    return true;
  }
  
  // If no clear shot position found nearby, reset the flag
  unit.findingClearShot = false;
  return false;
}

// Helper function to check if a tile is impassable
function isImpassableTile(tileType) {
  return ['water', 'rock', 'building'].includes(tileType);
}

// Helper function to check if a tile is occupied by another unit
function isTileOccupied(tileX, tileY, units, excludeUnit) {
  return units.some(unit => {
    if (unit === excludeUnit) return false;
    const unitTileX = Math.floor(unit.x / TILE_SIZE);
    const unitTileY = Math.floor(unit.y / TILE_SIZE);
    return unitTileX === tileX && unitTileY === tileY;
  });
}

// Helper function to calculate the smallest difference between two angles
export function angleDiff(angle1, angle2) {
  const diff = Math.abs((angle1 - angle2 + Math.PI) % (2 * Math.PI) - Math.PI);
  return diff;
}

// Helper function to smoothly rotate from current angle to target angle
export function smoothRotateTowardsAngle(currentAngle, targetAngle, rotationSpeed) {
  // Normalize angles to be between -PI and PI
  currentAngle = normalizeAngle(currentAngle);
  targetAngle = normalizeAngle(targetAngle);
  
  // Find the shortest rotation direction
  let angleDiff = targetAngle - currentAngle;
  
  // Ensure we rotate in the shortest direction
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Apply rotation speed
  if (Math.abs(angleDiff) < rotationSpeed) {
    return targetAngle; // If very close, snap to target angle
  } else if (angleDiff > 0) {
    return currentAngle + rotationSpeed;
  } else {
    return currentAngle - rotationSpeed;
  }
}

// Helper function to normalize angle between -PI and PI
export function normalizeAngle(angle) {
  return ((angle + Math.PI) % (2 * Math.PI)) - Math.PI;
}

// Helper function to calculate distance between two points
function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Helper function to calculate point to line segment distance
function pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) // in case of 0 length line
    param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  return getDistance(px, py, xx, yy);
}
