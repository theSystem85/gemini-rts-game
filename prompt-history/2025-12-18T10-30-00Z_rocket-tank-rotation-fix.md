# Prompt History

**Timestamp:** 2025-12-18T10:30:00Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## User Prompt

the rocket tank is still not always rotating to face its target which causes it not to fire at the target at all. Fix this!

## Problem Analysis

The rocket tank combat system was checking if the unit was aimed at the target (`isTurretAimedAtTarget`) before allowing it to fire, but there was **no code actively rotating the unit's body towards the target** in normal combat mode. 

The issue was in `updateRocketTankCombat` function:
- ❌ Called `handleTankMovement` (only handles pathfinding and stopping movement, not rotation)
- ❌ Checked `isTurretAimedAtTarget` to verify aim (but never aimed!)
- ❌ Rocket tank would stand still, not rotate, and never fire because it wasn't facing the target

This was different from:
- **Turreted units**: Have `aimTurretAtTarget` which rotates the turret independently
- **Remote control**: Already had rotation logic implemented (10x speed in previous fix)
- **Normal combat**: Completely missing rotation logic

## Implementation Summary

Added active body rotation towards target in normal combat mode for rocket tanks.

### Changes Made

**[src/game/unitCombat.js](src/game/unitCombat.js#L1100-L1147)** - `updateRocketTankCombat` function:

1. **Calculate angle to target:**
   ```javascript
   const angleToTarget = Math.atan2(targetCenterY - unitCenterY, targetCenterX - unitCenterX)
   ```

2. **Fast rotation towards target:**
   ```javascript
   const rotationSpeed = (unit.rotationSpeed || 0.1) * 5  // 5x faster rotation
   const newDirection = smoothRotateTowardsAngle(currentDirection, angleToTarget, rotationSpeed)
   ```

3. **Update all direction properties:**
   ```javascript
   unit.direction = newDirection
   if (unit.movement) {
     unit.movement.rotation = newDirection
   }
   ```

### Technical Details

**Rotation Speed:**
- Base: 0.1 radians/frame
- Combat: 0.5 radians/frame (5x multiplier)
- This provides responsive targeting without instant snapping

**Why 5x instead of 10x?**
- Remote control uses 10x for instant player response
- Normal combat uses 5x for more realistic combat feel
- Still fast enough to track moving targets effectively

**Direction Properties Updated:**
- `unit.direction` - Primary direction field
- `unit.movement.rotation` - Movement system rotation
- Both must be synchronized for proper rendering and combat

**Execution Order:**
1. Calculate distance and handle movement (chase/stop logic)
2. **Rotate body towards target** ← NEW
3. Check if in range and can attack
4. Verify alignment with `isTurretAimedAtTarget`
5. Fire burst if all conditions met

### Before vs After

**Before:**
```javascript
// handleTankMovement - no rotation
// Check isTurretAimedAtTarget - always false
// Never fires
```

**After:**
```javascript
// handleTankMovement - no rotation
// Actively rotate body towards target - 5x speed
// Check isTurretAimedAtTarget - true when aligned
// Fires burst when ready
```

### Testing Notes

- Test: Attack moving target - tank should smoothly track and fire
- Test: Switch targets - should rotate to new target quickly
- Test: Target at different angles - rotation should work in all directions
- Verify: Rotation is smooth (not instant snap) but responsive
- Verify: Remote control still works with 10x rotation speed
- Verify: Normal combat uses 5x rotation speed
