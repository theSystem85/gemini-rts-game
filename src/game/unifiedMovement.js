// unifiedMovement.js - Unified movement system for all ground units
import { TILE_SIZE } from '../config.js'
import { clearStuckHarvesterOreField } from './harvesterLogic.js'

/**
 * Unified movement configuration
 */
const MOVEMENT_CONFIG = {
  ACCELERATION: 0.08,      // How quickly units accelerate (slower for more visible effect)
  DECELERATION: 0.12,      // How quickly units decelerate (faster than acceleration)
  ROTATION_SPEED: 0.12,    // How fast units rotate (radians per frame)
  MAX_SPEED: 1.8,          // Maximum movement speed (slightly slower)
  MIN_SPEED: 0.05,         // Minimum speed before stopping
  COLLISION_BUFFER: 8,     // Buffer distance for collision avoidance
  MIN_UNIT_DISTANCE: 24,   // Minimum distance between unit centers (increased from implicit 16)
  AVOIDANCE_FORCE: 0.3,    // Strength of collision avoidance force
  BACKWARD_MOVE_THRESHOLD: 0.5  // When to allow backward movement when stuck
};

/**
 * Initialize movement properties for a unit
 */
export function initializeUnitMovement(unit) {
  if (!unit.movement) {
    unit.movement = {
      velocity: { x: 0, y: 0 },
      targetVelocity: { x: 0, y: 0 },
      rotation: unit.rotation || 0,
      targetRotation: unit.rotation || 0,
      isMoving: false,
      currentSpeed: 0
    };
  }
}

/**
 * Update unit position using natural movement physics
 */
export function updateUnitPosition(unit, mapGrid, occupancyMap, now, units = []) {
  initializeUnitMovement(unit);
  
  const movement = unit.movement;
  const speedModifier = unit.speedModifier || 1;
  const effectiveMaxSpeed = MOVEMENT_CONFIG.MAX_SPEED * speedModifier;
  
  // Handle path following
  if (unit.path && unit.path.length > 0) {
    const nextTile = unit.path[0];
    const targetX = nextTile.x * TILE_SIZE;
    const targetY = nextTile.y * TILE_SIZE;
    
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const distance = Math.hypot(dx, dy);
    
    // Check if we've reached the current waypoint
    if (distance < TILE_SIZE / 3) {
      unit.path.shift(); // Remove reached waypoint
      
      // Update tile position
      unit.tileX = nextTile.x;
      unit.tileY = nextTile.y;
      
      // If no more waypoints, start deceleration
      if (unit.path.length === 0) {
        movement.targetVelocity.x = 0;
        movement.targetVelocity.y = 0;
        movement.isMoving = false;
      }
    } else {
      // Calculate desired direction and speed
      const dirX = dx / distance;
      const dirY = dy / distance;
      
      // Set target velocity
      movement.targetVelocity.x = dirX * effectiveMaxSpeed;
      movement.targetVelocity.y = dirY * effectiveMaxSpeed;
      movement.isMoving = true;
      
      // Calculate target rotation based on movement direction
      movement.targetRotation = Math.atan2(dy, dx);
    }
  } else {
    // No path - decelerate to stop
    movement.targetVelocity.x = 0;
    movement.targetVelocity.y = 0;
    movement.isMoving = false;
  }
  
  // Handle rotation before movement (tanks should rotate towards target before moving)
  updateUnitRotation(unit);
  
  // Only apply movement if rotation is close to target (realistic tank movement)
  const rotationDiff = Math.abs(normalizeAngle(movement.targetRotation - movement.rotation));
  const canMove = rotationDiff < Math.PI / 4; // Allow movement if within 45 degrees
  
  // Apply acceleration/deceleration with collision avoidance
  let avoidanceForce = { x: 0, y: 0 };
  if (movement.isMoving && canMove) {
    avoidanceForce = calculateCollisionAvoidance(unit, units);
  }
  
  const accelRate = (movement.isMoving && canMove) ? MOVEMENT_CONFIG.ACCELERATION : MOVEMENT_CONFIG.DECELERATION;
  
  // Apply target velocity with avoidance force
  const targetVelX = movement.targetVelocity.x + avoidanceForce.x;
  const targetVelY = movement.targetVelocity.y + avoidanceForce.y;
  
  movement.velocity.x += (targetVelX - movement.velocity.x) * accelRate;
  movement.velocity.y += (targetVelY - movement.velocity.y) * accelRate;
  
  // Apply minimum speed threshold
  const currentSpeed = Math.hypot(movement.velocity.x, movement.velocity.y);
  if (currentSpeed < MOVEMENT_CONFIG.MIN_SPEED && !movement.isMoving) {
    movement.velocity.x = 0;
    movement.velocity.y = 0;
    movement.currentSpeed = 0;
  } else {
    movement.currentSpeed = currentSpeed;
  }
  
  // Store previous position for collision detection
  const prevX = unit.x;
  const prevY = unit.y;
  
  // Update position (only if allowed to move)
  if (canMove || !movement.isMoving) {
    unit.x += movement.velocity.x;
    unit.y += movement.velocity.y;
  }
  
  // Handle collisions
  if (checkUnitCollision(unit, mapGrid, occupancyMap, units)) {
    // Revert position if collision detected
    unit.x = prevX;
    unit.y = prevY;
    
    // Try alternative movement (slide along obstacles)
    trySlideMovement(unit, movement, mapGrid, occupancyMap, units);
  }
  
  // Update tile position based on actual position
  unit.tileX = Math.floor(unit.x / TILE_SIZE);
  unit.tileY = Math.floor(unit.y / TILE_SIZE);
  
  // Clamp to map bounds
  unit.tileX = Math.max(0, Math.min(unit.tileX, mapGrid[0].length - 1));
  unit.tileY = Math.max(0, Math.min(unit.tileY, mapGrid.length - 1));
  unit.x = Math.max(0, Math.min(unit.x, (mapGrid[0].length - 1) * TILE_SIZE));
  unit.y = Math.max(0, Math.min(unit.y, (mapGrid.length - 1) * TILE_SIZE));
  
  // Handle stuck unit detection and recovery for harvesters
  if (unit.type === 'harvester') {
    handleStuckUnit(unit, mapGrid, occupancyMap, units);
  }
}

/**
 * Update unit rotation with smooth turning
 */
function updateUnitRotation(unit) {
  const movement = unit.movement;
  
  // Only rotate if moving or if there's a significant rotation difference
  const rotationDiff = normalizeAngle(movement.targetRotation - movement.rotation);
  
  if (Math.abs(rotationDiff) > 0.1) {
    const rotationStep = MOVEMENT_CONFIG.ROTATION_SPEED;
    
    if (rotationDiff > 0) {
      movement.rotation += Math.min(rotationStep, rotationDiff);
    } else {
      movement.rotation -= Math.min(rotationStep, Math.abs(rotationDiff));
    }
    
    movement.rotation = normalizeAngle(movement.rotation);
  }
  
  // Update unit's rotation property
  unit.rotation = movement.rotation;
}

/**
 * Normalize angle to [-π, π] range
 */
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Check for unit collisions with map obstacles and other units
 */
function checkUnitCollision(unit, mapGrid, occupancyMap, units) {
  const tileX = Math.floor(unit.x / TILE_SIZE);
  const tileY = Math.floor(unit.y / TILE_SIZE);
  
  // Check map bounds
  if (tileX < 0 || tileX >= mapGrid[0].length || tileY < 0 || tileY >= mapGrid.length) {
    return true;
  }
  
  // Check map obstacles
  if (mapGrid[tileY][tileX] === 1) {
    return true;
  }
  
  // Check for other units using improved distance-based collision detection
  if (units) {
    const unitCenterX = unit.x + TILE_SIZE / 2;
    const unitCenterY = unit.y + TILE_SIZE / 2;
    
    for (const otherUnit of units) {
      if (otherUnit.id === unit.id || otherUnit.health <= 0) continue;
      
      const otherCenterX = otherUnit.x + TILE_SIZE / 2;
      const otherCenterY = otherUnit.y + TILE_SIZE / 2;
      const distance = Math.hypot(unitCenterX - otherCenterX, unitCenterY - otherCenterY);
      
      // Use improved minimum distance to prevent getting stuck
      if (distance < MOVEMENT_CONFIG.MIN_UNIT_DISTANCE) {
        // Allow movement if units are moving away from each other
        const dx = unitCenterX - otherCenterX;
        const dy = unitCenterY - otherCenterY;
        const unitVelX = unit.movement?.velocity?.x || 0;
        const unitVelY = unit.movement?.velocity?.y || 0;
        
        // Check if this unit's movement increases distance (moving away)
        const dotProduct = dx * unitVelX + dy * unitVelY;
        if (dotProduct > 0) {
          return false; // Allow movement away from other unit
        }
        
        return true; // Block movement toward other unit
      }
    }
  }
  
  return false;
}

/**
 * Try to slide along obstacles when blocked
 */
function trySlideMovement(unit, movement, mapGrid, occupancyMap, units = []) {
  const originalX = unit.x;
  const originalY = unit.y;
  
  // Try horizontal movement only
  unit.x = originalX + movement.velocity.x;
  unit.y = originalY;
  
  if (!checkUnitCollision(unit, mapGrid, occupancyMap, units)) {
    movement.velocity.y = 0; // Cancel vertical movement
    return;
  }
  
  // Try vertical movement only
  unit.x = originalX;
  unit.y = originalY + movement.velocity.y;
  
  if (!checkUnitCollision(unit, mapGrid, occupancyMap, units)) {
    movement.velocity.x = 0; // Cancel horizontal movement
    return;
  }
  
  // If both fail, stop movement
  unit.x = originalX;
  unit.y = originalY;
  movement.velocity.x = 0;
  movement.velocity.y = 0;
}

/**
 * Force stop a unit's movement
 */
export function stopUnitMovement(unit) {
  initializeUnitMovement(unit);
  
  unit.movement.velocity.x = 0;
  unit.movement.velocity.y = 0;
  unit.movement.targetVelocity.x = 0;
  unit.movement.targetVelocity.y = 0;
  unit.movement.isMoving = false;
  unit.movement.currentSpeed = 0;
  
  if (unit.path) {
    unit.path = [];
  }
}

/**
 * Check if a unit is currently moving
 */
export function isUnitMoving(unit) {
  initializeUnitMovement(unit);
  return unit.movement.currentSpeed > MOVEMENT_CONFIG.MIN_SPEED;
}

/**
 * Force rotate a unit to try different directions when stuck
 */
export function rotateUnitInPlace(unit, targetDirection = null) {
  initializeUnitMovement(unit);
  
  const movement = unit.movement;
  
  if (targetDirection !== null) {
    // Rotate towards a specific direction
    movement.targetRotation = targetDirection;
  } else {
    // Random rotation to try different directions when stuck
    movement.targetRotation = Math.random() * Math.PI * 2;
  }
  
  // Force rotation even if not moving
  const rotationDiff = normalizeAngle(movement.targetRotation - movement.rotation);
  
  if (Math.abs(rotationDiff) > 0.1) {
    const rotationStep = MOVEMENT_CONFIG.ROTATION_SPEED * 2; // Faster rotation when stuck
    
    if (rotationDiff > 0) {
      movement.rotation += Math.min(rotationStep, rotationDiff);
    } else {
      movement.rotation -= Math.min(rotationStep, Math.abs(rotationDiff));
    }
    
    movement.rotation = normalizeAngle(movement.rotation);
    unit.rotation = movement.rotation;
    return true; // Still rotating
  }
  
  return false; // Rotation complete
}

/**
 * Check if a unit appears to be stuck and try to help it
 */
export function handleStuckUnit(unit, mapGrid, occupancyMap, units) {
  initializeUnitMovement(unit);
  
  // Initialize stuck detection if not present
  if (!unit.movement.stuckDetection) {
    unit.movement.stuckDetection = {
      lastPosition: { x: unit.x, y: unit.y },
      stuckTime: 0,
      lastMovementCheck: performance.now(),
      rotationAttempts: 0,
      isRotating: false,
      dodgeAttempts: 0,
      lastDodgeTime: 0
    };
  }
  
  const now = performance.now();
  const stuck = unit.movement.stuckDetection;
  
  // Enhanced stuck detection for harvesters - check more frequently
  const checkInterval = unit.type === 'harvester' ? 1500 : 2000; // Check harvesters every 1.5 seconds
  const stuckThreshold = unit.type === 'harvester' ? 2000 : 3000; // Consider harvesters stuck after 2 seconds
  
  // Check if unit has moved significantly
  if (now - stuck.lastMovementCheck > checkInterval) {
    const distanceMoved = Math.hypot(unit.x - stuck.lastPosition.x, unit.y - stuck.lastPosition.y);
    
    if (distanceMoved < TILE_SIZE / 4 && unit.path && unit.path.length > 0) {
      // Unit hasn't moved much but has a path - likely stuck
      stuck.stuckTime += now - stuck.lastMovementCheck;
      
      if (stuck.stuckTime > stuckThreshold && !stuck.isRotating) {
        // Enhanced recovery strategies for harvesters
        if (unit.type === 'harvester') {
          // Clear ore field assignment if harvester is stuck trying to reach it
          if (unit.oreField && stuck.stuckTime > stuckThreshold) {
            clearStuckHarvesterOreField(unit)
            unit.path = [] // Clear path to force new ore finding
            stuck.stuckTime = 0 // Reset stuck time after clearing ore field
          }
          
          // Try dodge movement first for harvesters
          if (stuck.dodgeAttempts < 3 && now - stuck.lastDodgeTime > 2000) {
            if (tryDodgeMovement(unit, mapGrid, occupancyMap, units)) {
              stuck.dodgeAttempts++;
              stuck.lastDodgeTime = now;
              stuck.stuckTime = 0; // Reset stuck time after successful dodge
              return;
            }
          }
          
          // If dodge failed, try rotation
          if (stuck.rotationAttempts < 4) {
            stuck.isRotating = true;
            stuck.rotationAttempts++;
            
            // For harvesters, try rotating towards a nearby free space
            const freeDirection = findFreeDirection(unit, mapGrid, occupancyMap, units);
            if (freeDirection !== null) {
              rotateUnitInPlace(unit, freeDirection);
            } else {
              rotateUnitInPlace(unit);
            }
          } else {
            // Last resort: clear path and force new pathfinding
            unit.path = [];
            stuck.stuckTime = 0;
            stuck.rotationAttempts = 0;
            stuck.dodgeAttempts = 0;
            stuck.isRotating = false;
          }
        } else {
          // Original logic for non-harvester units
          stuck.isRotating = true;
          stuck.rotationAttempts++;
          
          if (stuck.rotationAttempts <= 3) {
            rotateUnitInPlace(unit);
          } else if (stuck.rotationAttempts <= 6) {
            if (unit.path.length > 0) {
              const target = unit.path[0];
              const targetX = target.x * TILE_SIZE;
              const targetY = target.y * TILE_SIZE;
              const targetDirection = Math.atan2(targetY - unit.y, targetX - unit.x);
              rotateUnitInPlace(unit, targetDirection);
            }
          } else {
            unit.path = [];
            stuck.stuckTime = 0;
            stuck.rotationAttempts = 0;
            stuck.isRotating = false;
          }
        }
      }
    } else {
      // Unit is moving normally, reset stuck detection
      stuck.stuckTime = 0;
      stuck.rotationAttempts = 0;
      stuck.dodgeAttempts = 0;
      stuck.isRotating = false;
    }
    
    // Update position tracking
    stuck.lastPosition.x = unit.x;
    stuck.lastPosition.y = unit.y;
    stuck.lastMovementCheck = now;
  }
  
  // Handle ongoing rotation
  if (stuck.isRotating) {
    const stillRotating = rotateUnitInPlace(unit);
    if (!stillRotating) {
      // Rotation complete, allow movement again
      stuck.isRotating = false;
      stuck.stuckTime = 0;
    }
  }
}

/**
 * Try to perform a dodge movement around obstacles for stuck harvesters
 */
async function tryDodgeMovement(unit, mapGrid, occupancyMap, units) {
  const currentTileX = Math.floor(unit.x / TILE_SIZE);
  const currentTileY = Math.floor(unit.y / TILE_SIZE);
  
  // Look for free tiles in a wider pattern around the harvester
  const dodgePositions = [];
  
  // Check in expanding circles for better dodge positions
  for (let radius = 1; radius <= 3; radius++) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const dodgeX = Math.round(currentTileX + Math.cos(angle) * radius);
      const dodgeY = Math.round(currentTileY + Math.sin(angle) * radius);
      
      if (isValidDodgePosition(dodgeX, dodgeY, mapGrid, units)) {
        dodgePositions.push({ x: dodgeX, y: dodgeY, radius });
      }
    }
    
    // Prefer closer positions first
    if (dodgePositions.length > 0) break;
  }
  
  if (dodgePositions.length > 0) {
    // Choose a random dodge position from available options
    const dodgePos = dodgePositions[Math.floor(Math.random() * dodgePositions.length)];
    
    // Store original path for restoration after dodge
    if (!unit.originalPath && unit.path) {
      unit.originalPath = [...unit.path];
      unit.originalTarget = unit.target;
    }
    
    // Set dodge state
    unit.isDodging = true;
    unit.dodgeEndTime = performance.now() + 3000; // 3 second dodge timeout
    
    // Create path to dodge position using pathfinding
    const { findPath } = await import('../units.js');
    const dodgePath = findPath(
      { x: currentTileX, y: currentTileY },
      dodgePos,
      mapGrid,
      null // Don't use occupancy map for dodge movement to avoid other stuck units
    );
    
    if (dodgePath.length > 1) {
      unit.path = dodgePath.slice(1);
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a position is valid for dodge movement
 */
function isValidDodgePosition(x, y, mapGrid, units) {
  // Check bounds
  if (x < 0 || y < 0 || x >= mapGrid[0].length || y >= mapGrid.length) {
    return false;
  }
  
  // Check terrain
  const tile = mapGrid[y][x];
  if (tile.type === 'water' || tile.type === 'rock' || tile.building) {
    return false;
  }
  
  // Check for other units (allow some overlap for dodge movements)
  const tileCenter = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
  const unitRadius = TILE_SIZE * 0.4;
  
  for (const otherUnit of units) {
    if (otherUnit.health <= 0) continue;
    
    const otherCenter = { x: otherUnit.x + TILE_SIZE / 2, y: otherUnit.y + TILE_SIZE / 2 };
    const distance = Math.hypot(tileCenter.x - otherCenter.x, tileCenter.y - otherCenter.y);
    
    // Allow closer spacing during dodge movements
    if (distance < unitRadius * 1.5) {
      return false;
    }
  }
  
  return true;
}

/**
 * Find a free direction around the unit for rotation-based unsticking
 */
function findFreeDirection(unit, mapGrid, occupancyMap, units) {
  const currentTileX = Math.floor(unit.x / TILE_SIZE);
  const currentTileY = Math.floor(unit.y / TILE_SIZE);
  
  // Check 8 directions around the unit
  const directions = [
    { x: 0, y: -1, angle: -Math.PI / 2 },     // North
    { x: 1, y: -1, angle: -Math.PI / 4 },     // Northeast  
    { x: 1, y: 0, angle: 0 },                 // East
    { x: 1, y: 1, angle: Math.PI / 4 },       // Southeast
    { x: 0, y: 1, angle: Math.PI / 2 },       // South
    { x: -1, y: 1, angle: 3 * Math.PI / 4 },  // Southwest
    { x: -1, y: 0, angle: Math.PI },          // West
    { x: -1, y: -1, angle: -3 * Math.PI / 4 } // Northwest
  ];
  
  for (const dir of directions) {
    const checkX = currentTileX + dir.x;
    const checkY = currentTileY + dir.y;
    
    if (isValidDodgePosition(checkX, checkY, mapGrid, units)) {
      return dir.angle;
    }
  }
  
  return null; // No free direction found
}

/**
 * Calculate collision avoidance force to prevent units from getting too close
 */
function calculateCollisionAvoidance(unit, units) {
  if (!units) return { x: 0, y: 0 };
  
  const unitCenterX = unit.x + TILE_SIZE / 2;
  const unitCenterY = unit.y + TILE_SIZE / 2;
  let avoidanceX = 0;
  let avoidanceY = 0;
  
  for (const otherUnit of units) {
    if (otherUnit.id === unit.id || otherUnit.health <= 0) continue;
    
    const otherCenterX = otherUnit.x + TILE_SIZE / 2;
    const otherCenterY = otherUnit.y + TILE_SIZE / 2;
    const dx = unitCenterX - otherCenterX;
    const dy = unitCenterY - otherCenterY;
    const distance = Math.hypot(dx, dy);
    
    // Apply avoidance force if too close
    if (distance < MOVEMENT_CONFIG.MIN_UNIT_DISTANCE && distance > 0) {
      const avoidanceStrength = (MOVEMENT_CONFIG.MIN_UNIT_DISTANCE - distance) / MOVEMENT_CONFIG.MIN_UNIT_DISTANCE;
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      
      avoidanceX += normalizedDx * avoidanceStrength * MOVEMENT_CONFIG.AVOIDANCE_FORCE;
      avoidanceY += normalizedDy * avoidanceStrength * MOVEMENT_CONFIG.AVOIDANCE_FORCE;
    }
  }
  
  return { x: avoidanceX, y: avoidanceY };
}

/**
 * Try to move unit backward when stuck
 */
function tryBackwardMovement(unit, units) {
  if (!unit.movement) return false;
  
  // Calculate backward direction (opposite to current facing)
  const backwardAngle = unit.rotation + Math.PI;
  const backwardDistance = TILE_SIZE * 0.8; // Move back less than a full tile
  
  const backwardX = unit.x + Math.cos(backwardAngle) * backwardDistance;
  const backwardY = unit.y + Math.sin(backwardAngle) * backwardDistance;
  
  // Check if backward position is valid
  const backwardTileX = Math.floor(backwardX / TILE_SIZE);
  const backwardTileY = Math.floor(backwardY / TILE_SIZE);
  
  // Temporarily move to check collision
  const originalX = unit.x;
  const originalY = unit.y;
  unit.x = backwardX;
  unit.y = backwardY;
  
  // Use a minimal collision check (no need for full map grid access)
  const hasCollision = units && units.some(otherUnit => {
    if (otherUnit.id === unit.id || otherUnit.health <= 0) return false;
    const otherCenterX = otherUnit.x + TILE_SIZE / 2;
    const otherCenterY = otherUnit.y + TILE_SIZE / 2;
    const unitCenterX = unit.x + TILE_SIZE / 2;
    const unitCenterY = unit.y + TILE_SIZE / 2;
    const distance = Math.hypot(unitCenterX - otherCenterX, unitCenterY - otherCenterY);
    return distance < MOVEMENT_CONFIG.MIN_UNIT_DISTANCE;
  });
  
  // Restore original position
  unit.x = originalX;
  unit.y = originalY;
  
  if (!hasCollision && backwardTileX >= 0 && backwardTileY >= 0) {
    // Set backward movement
    unit.movement.targetVelocity.x = Math.cos(backwardAngle) * MOVEMENT_CONFIG.MAX_SPEED * MOVEMENT_CONFIG.BACKWARD_MOVE_THRESHOLD;
    unit.movement.targetVelocity.y = Math.sin(backwardAngle) * MOVEMENT_CONFIG.MAX_SPEED * MOVEMENT_CONFIG.BACKWARD_MOVE_THRESHOLD;
    unit.movement.isMoving = true;
    return true;
  }
  
  return false;
}
