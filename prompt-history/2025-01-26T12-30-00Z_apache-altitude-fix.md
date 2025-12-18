# Prompt History Entry

**UTC Timestamp:** 2025-01-26T12:30:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## User Request

Fix rocket tank targeting issues:
1. Rocket tank rockets are not chasing targets anymore - restore homing behavior
2. Rockets aimed at Apache helicopters target the center between the Apache image and its shadow instead of the actual Apache visual position

## Changes Made

### src/game/unitCombat.js

1. **handleTankMovement function (lines ~165-195)**: Added Apache altitude visual offset compensation when calculating `targetCenterY` for both retreating and normal movement cases:
   ```javascript
   if (target.type === 'apache' && target.altitude) {
     targetCenterY -= target.altitude * 0.4
   }
   ```

2. **handleRocketBurstFire function (lines ~490-510)**: Added Apache altitude compensation when dynamically calculating the current target center for burst rockets:
   ```javascript
   if (burstTarget.type === 'apache' && burstTarget.altitude) {
     currentTargetCenterY -= burstTarget.altitude * 0.4
   }
   ```

### src/game/bulletSystem.js

1. **fireBullet function (lines ~906-920)**: Added Apache altitude compensation when calculating initial target center:
   ```javascript
   if (target.type === 'apache' && target.altitude) {
     targetCenterY -= target.altitude * 0.4
   }
   ```

### Summary

The Apache helicopter has a visual altitude offset where it's rendered at `y - (altitude * 0.4)` pixels above its ground position. Rocket targeting needed to account for this in multiple places:
- Initial target calculation when movement/firing begins
- Dynamic target tracking during burst fire
- Homing logic (already fixed in previous session)
- Collision detection (already fixed in previous session)

All four locations now properly apply the `altitude * 0.4` offset to target the visual position of the Apache rather than its shadow.
