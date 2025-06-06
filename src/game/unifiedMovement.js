// unifiedMovement.js - Unified movement system for all ground units
import { TILE_SIZE } from '../config.js'

/**
 * Unified movement configuration
 */
const MOVEMENT_CONFIG = {
  ACCELERATION: 0.08,      // How quickly units accelerate (slower for more visible effect)
  DECELERATION: 0.12,      // How quickly units decelerate (faster than acceleration)
  ROTATION_SPEED: 0.12,    // How fast units rotate (radians per frame)
  MAX_SPEED: 1.8,          // Maximum movement speed (slightly slower)
  MIN_SPEED: 0.05,         // Minimum speed before stopping
  COLLISION_BUFFER: 8      // Buffer distance for collision avoidance
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
  
  // Apply acceleration/deceleration
  const accelRate = (movement.isMoving && canMove) ? MOVEMENT_CONFIG.ACCELERATION : MOVEMENT_CONFIG.DECELERATION;
  
  movement.velocity.x += (movement.targetVelocity.x - movement.velocity.x) * accelRate;
  movement.velocity.y += (movement.targetVelocity.y - movement.velocity.y) * accelRate;
  
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
  
  // Check for other units using proper distance-based collision detection
  if (units) {
    const unitRadius = TILE_SIZE * 0.4; // Units have a smaller collision radius than tiles
    const unitCenterX = unit.x + TILE_SIZE / 2;
    const unitCenterY = unit.y + TILE_SIZE / 2;
    
    for (const otherUnit of units) {
      if (otherUnit.id === unit.id || otherUnit.health <= 0) continue;
      
      const otherCenterX = otherUnit.x + TILE_SIZE / 2;
      const otherCenterY = otherUnit.y + TILE_SIZE / 2;
      const distance = Math.hypot(unitCenterX - otherCenterX, unitCenterY - otherCenterY);
      
      // Check if units are too close (collision)
      if (distance < unitRadius * 2) {
        // Allow movement if the other unit is moving away or unit is backing off
        const otherMoving = otherUnit.movement && otherUnit.movement.currentSpeed > 0.1;
        const unitMoving = unit.movement && unit.movement.currentSpeed > 0.1;
        
        if (otherMoving || !unitMoving) {
          return false; // Allow movement to avoid deadlocks
        }
        return true; // Block movement
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
      isRotating: false
    };
  }
  
  const now = performance.now();
  const stuck = unit.movement.stuckDetection;
  
  // Check if unit has moved significantly in the last 2 seconds
  if (now - stuck.lastMovementCheck > 2000) {
    const distanceMoved = Math.hypot(unit.x - stuck.lastPosition.x, unit.y - stuck.lastPosition.y);
    
    if (distanceMoved < TILE_SIZE / 4 && unit.path && unit.path.length > 0) {
      // Unit hasn't moved much but has a path - likely stuck
      stuck.stuckTime += now - stuck.lastMovementCheck;
      
      if (stuck.stuckTime > 3000 && !stuck.isRotating) {
        // Been stuck for 3+ seconds, try rotation
        stuck.isRotating = true;
        stuck.rotationAttempts++;
        
        // Try different strategies based on attempt number
        if (stuck.rotationAttempts <= 3) {
          // Try random rotation
          rotateUnitInPlace(unit);
        } else if (stuck.rotationAttempts <= 6) {
          // Try rotating towards the target destination
          if (unit.path.length > 0) {
            const target = unit.path[0];
            const targetX = target.x * TILE_SIZE;
            const targetY = target.y * TILE_SIZE;
            const targetDirection = Math.atan2(targetY - unit.y, targetX - unit.x);
            rotateUnitInPlace(unit, targetDirection);
          }
        } else {
          // Clear path and force new pathfinding
          unit.path = [];
          stuck.stuckTime = 0;
          stuck.rotationAttempts = 0;
          stuck.isRotating = false;
        }
      }
    } else {
      // Unit is moving normally, reset stuck detection
      stuck.stuckTime = 0;
      stuck.rotationAttempts = 0;
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
