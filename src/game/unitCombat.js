// unitCombat.js - Handles all unit combat and targeting logic
import { TILE_SIZE, TANK_FIRE_RANGE, TANK_BULLET_SPEED } from '../config.js'
import { playSound } from '../sound.js'
import { hasClearShot } from '../logic.js'
import { findPath, buildOccupancyMap } from '../units.js'
import { stopUnitMovement } from './unifiedMovement.js'

/**
 * Enhanced targeting spread with controlled randomness for better accuracy
 */
function applyTargetingSpread(targetX, targetY, projectileType) {
    // Skip spread for rockets to maintain precision
    if (projectileType === 'rocket') {
        return { x: targetX, y: targetY };
    }
    
    // Reduced spread for better accuracy (30% less than before)
    const spreadRadius = 20; // Reduced from 32 to 20 pixels
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * spreadRadius;
    return {
        x: targetX + Math.cos(angle) * distance,
        y: targetY + Math.sin(angle) * distance
    };
}

/**
 * Common combat logic helper - handles movement and pathfinding
 */
function handleTankMovement(unit, target, now, occupancyMap, chaseThreshold, mapGrid) {
    const unitCenterX = unit.x + TILE_SIZE / 2;
    const unitCenterY = unit.y + TILE_SIZE / 2;
    
    let targetCenterX, targetCenterY, targetTileX, targetTileY;
    
    if (target.tileX !== undefined) {
        // Target is a unit
        targetCenterX = target.x + TILE_SIZE / 2;
        targetCenterY = target.y + TILE_SIZE / 2;
        targetTileX = target.tileX;
        targetTileY = target.tileY;
    } else {
        // Target is a building
        targetCenterX = target.x * TILE_SIZE + (target.width * TILE_SIZE) / 2;
        targetCenterY = target.y * TILE_SIZE + (target.height * TILE_SIZE) / 2;
        targetTileX = target.x + Math.floor(target.width / 2);
        targetTileY = target.y + Math.floor(target.height / 2);
    }
    
    const distance = Math.hypot(targetCenterX - unitCenterX, targetCenterY - unitCenterY);
    
    // Combat movement logic - stop and attack if in range
    if (distance <= TANK_FIRE_RANGE * TILE_SIZE) {
        // In firing range - stop all movement and clear path
        if (unit.path && unit.path.length > 0) {
            unit.path = []; // Clear path to stop movement when in range
        }
        // Force stop using unified movement system
        stopUnitMovement(unit);
        
    } else if (distance > chaseThreshold) {
        // Only create new path if cooldown has passed
        if (!unit.lastPathTime || now - unit.lastPathTime > 1000) {
            if (!unit.path || unit.path.length === 0) {
                const path = findPath(
                    { x: unit.tileX, y: unit.tileY },
                    { x: targetTileX, y: targetTileY },
                    mapGrid,
                    occupancyMap
                );
                if (path.length > 1) {
                    unit.path = path.slice(1);
                    unit.lastPathTime = now;
                }
            }
        }
    }
    
    return { distance, targetCenterX, targetCenterY };
}

// Combat configuration constants
const COMBAT_CONFIG = {
    CHASE_MULTIPLIER: {
        STANDARD: 1.5,
        ROCKET: 1.8
    },
    FIRE_RATES: {
        STANDARD: 2000,
        ROCKET: 6000
    },
    DAMAGE: {
        STANDARD: 25,
        TANK_V3: 30,
        ROCKET: 10
    },
    RANGE_MULTIPLIER: {
        ROCKET: 1.5
    },
    ROCKET_BURST: {
        COUNT: 3,
        DELAY: 200
    }
};

/**
 * Common firing logic helper - handles bullet creation
 */
function handleTankFiring(unit, target, bullets, now, fireRate, targetCenterX, targetCenterY, projectileType = 'bullet', units, mapGrid, usePredictiveAiming = false) {
    const unitCenterX = unit.x + TILE_SIZE / 2;
    const unitCenterY = unit.y + TILE_SIZE / 2;
    
    if (!unit.lastShotTime || now - unit.lastShotTime >= fireRate) {
        if (unit.canFire !== false && hasClearShot(unit, target, units)) {
            // Calculate aim position (with predictive aiming if enabled)
            let aimX = targetCenterX;
            let aimY = targetCenterY;

            if (usePredictiveAiming && target.lastKnownX !== undefined && target.lastKnownY !== undefined) {
                const targetVelX = targetCenterX - target.lastKnownX;
                const targetVelY = targetCenterY - target.lastKnownY;
                const bulletSpeed = projectileType === 'rocket' ? 3 : TANK_BULLET_SPEED;
                const distance = Math.sqrt((targetCenterX - unitCenterX) ** 2 + (targetCenterY - unitCenterY) ** 2);
                const timeToTarget = distance / (bulletSpeed * TILE_SIZE);
                aimX = targetCenterX + targetVelX * timeToTarget * 8; // Reduced multiplier for better accuracy
                aimY = targetCenterY + targetVelY * timeToTarget * 8;
            }

            // Store current position for next frame's velocity calculation (for predictive aiming)
            if (usePredictiveAiming) {
                target.lastKnownX = targetCenterX;
                target.lastKnownY = targetCenterY;
            }
            
            // Apply targeting spread
            const spreadTarget = applyTargetingSpread(aimX, aimY, projectileType);
            
            const bullet = {
                id: Date.now() + Math.random(),
                x: unitCenterX,
                y: unitCenterY,
                speed: projectileType === 'rocket' ? 3 : TANK_BULLET_SPEED,
                baseDamage: getDamageForUnitType(unit.type),
                active: true,
                shooter: unit,
                homing: projectileType === 'rocket',
                target: projectileType === 'rocket' ? target : null,
                targetPosition: { x: spreadTarget.x, y: spreadTarget.y },
                startTime: now
            };

            if (!bullet.homing) {
                const angle = Math.atan2(spreadTarget.y - unitCenterY, spreadTarget.x - unitCenterX);
                bullet.vx = bullet.speed * Math.cos(angle);
                bullet.vy = bullet.speed * Math.sin(angle);
            }

            bullets.push(bullet);
            playSound(projectileType === 'rocket' ? 'shoot_rocket' : 'shoot', projectileType === 'rocket' ? 0.3 : 0.5);
            unit.lastShotTime = now;
            return true;
        }
    }
    return false;
}

/**
 * Get damage value based on unit type
 */
function getDamageForUnitType(unitType) {
    switch (unitType) {
        case 'tank-v3': return COMBAT_CONFIG.DAMAGE.TANK_V3;
        case 'rocketTank': return COMBAT_CONFIG.DAMAGE.ROCKET;
        default: return COMBAT_CONFIG.DAMAGE.STANDARD;
    }
}

/**
 * Handle burst fire for rocket tanks (replaces setTimeout)
 */
function handleRocketBurstFire(unit, target, bullets, now, targetCenterX, targetCenterY, units, mapGrid) {
    if (!unit.burstState) {
        unit.burstState = {
            rocketsToFire: COMBAT_CONFIG.ROCKET_BURST.COUNT,
            lastRocketTime: 0
        };
    }
    
    // Fire rockets with proper timing in the game loop
    if (unit.burstState.rocketsToFire > 0 && 
        now - unit.burstState.lastRocketTime >= COMBAT_CONFIG.ROCKET_BURST.DELAY) {
        
        const fired = handleTankFiring(unit, target, bullets, now, 0, targetCenterX, targetCenterY, 'rocket', units, mapGrid);
        
        if (fired) {
            unit.burstState.rocketsToFire--;
            unit.burstState.lastRocketTime = now;
            
            if (unit.burstState.rocketsToFire <= 0) {
                unit.burstState = null; // Reset burst state
                unit.lastShotTime = now; // Set cooldown for next burst
                return true; // Burst complete
            }
        }
    }
    
    return false; // Burst still in progress or failed
}

/**
 * Handle Tesla Coil status effects
 */
function handleTeslaEffects(unit, now) {
    if (unit.teslaDisabledUntil && now < unit.teslaDisabledUntil) {
        unit.canFire = false;
        unit.speedModifier = 0.2; // 70% slow
    } else if (unit.teslaDisabledUntil && now >= unit.teslaDisabledUntil) {
        unit.canFire = true;
        unit.speedModifier = 1;
        unit.teslaDisabledUntil = null;
        unit.teslaSlowUntil = null;
        unit.teslaSlowed = false;
    }
}

/**
 * Updates unit combat behavior including targeting and shooting
 */
export function updateUnitCombat(units, bullets, mapGrid, gameState, now) {
  const occupancyMap = buildOccupancyMap(units, mapGrid)

  units.forEach(unit => {
    // Skip if unit has no combat capabilities
    if (unit.type === 'harvester') return

    // Handle status effects
    handleTeslaEffects(unit, now);

    // Combat logic for different unit types
    if (unit.type === 'tank' || unit.type === 'tank_v1') {
      updateTankCombat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'tank-v2') {
      updateTankV2Combat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'tank-v3') {
      updateTankV3Combat(unit, units, bullets, mapGrid, now, occupancyMap)
    } else if (unit.type === 'rocketTank') {
      updateRocketTankCombat(unit, units, bullets, mapGrid, now, occupancyMap)
    }
  })
}

/**
 * Updates standard tank combat
 */
function updateTankCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.STANDARD;
    
    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    );
    
    // Fire if in range and allowed to attack (for enemy AI strategy)
    if (distance <= TANK_FIRE_RANGE * TILE_SIZE && (unit.owner !== 'enemy' || unit.allowedToAttack !== false)) {
      handleTankFiring(unit, unit.target, bullets, now, COMBAT_CONFIG.FIRE_RATES.STANDARD, targetCenterX, targetCenterY, 'bullet', units, mapGrid);
    }
  }
}

/**
 * Updates tank-v2 combat with improved targeting
 */
function updateTankV2Combat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.STANDARD;
    
    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    );
    
    // Fire if in range and allowed to attack (for enemy AI strategy)
    if (distance <= TANK_FIRE_RANGE * TILE_SIZE && (unit.owner !== 'enemy' || unit.allowedToAttack !== false)) {
      handleTankFiring(unit, unit.target, bullets, now, COMBAT_CONFIG.FIRE_RATES.STANDARD, targetCenterX, targetCenterY, 'bullet', units, mapGrid);
    }
  }
}

/**
 * Updates tank-v3 combat with aim-ahead feature
 */
function updateTankV3Combat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.STANDARD;
    
    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    );
    
    // Fire if in range and allowed to attack (for enemy AI strategy)
    if (distance <= TANK_FIRE_RANGE * TILE_SIZE && (unit.owner !== 'enemy' || unit.allowedToAttack !== false)) {
      handleTankFiring(
        unit, 
        unit.target, 
        bullets, 
        now, 
        COMBAT_CONFIG.FIRE_RATES.STANDARD, 
        targetCenterX, 
        targetCenterY, 
        'bullet', 
        units, 
        mapGrid, 
        true // Enable predictive aiming for tank-v3
      );
    }
  }
}

/**
 * Updates rocket tank combat
 */
function updateRocketTankCombat(unit, units, bullets, mapGrid, now, occupancyMap) {
  if (unit.target && unit.target.health > 0) {
    const CHASE_THRESHOLD = TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.CHASE_MULTIPLIER.ROCKET;
    
    // Handle movement using common logic
    const { distance, targetCenterX, targetCenterY } = handleTankMovement(
      unit, unit.target, now, occupancyMap, CHASE_THRESHOLD, mapGrid
    );
    
    // Fire rockets if in range and allowed to attack (for enemy AI strategy)
    if (distance <= TANK_FIRE_RANGE * TILE_SIZE * COMBAT_CONFIG.RANGE_MULTIPLIER.ROCKET && 
        (unit.owner !== 'enemy' || unit.allowedToAttack !== false)) {
      // Check if we need to start a new burst or continue existing one
      if (!unit.burstState) {
        // Start new burst if cooldown has passed
        if (!unit.lastShotTime || now - unit.lastShotTime >= COMBAT_CONFIG.FIRE_RATES.ROCKET) {
          if (unit.canFire !== false && hasClearShot(unit, unit.target, units)) {
            unit.burstState = {
              rocketsToFire: COMBAT_CONFIG.ROCKET_BURST.COUNT,
              lastRocketTime: 0
            };
          }
        }
      } else {
        // Continue existing burst
        handleRocketBurstFire(unit, unit.target, bullets, now, targetCenterX, targetCenterY, units, mapGrid);
      }
    }
  }
}
