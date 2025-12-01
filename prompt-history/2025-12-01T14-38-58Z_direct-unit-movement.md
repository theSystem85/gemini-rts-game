# Direct Unit Movement Fix

**UTC Timestamp:** 2025-12-01T14:38:58Z
**LLM:** Claude Opus 4.5 (copilot)

## User Prompt

User reported that units are "going into the opposite direction then turn around and go to target then stop, turn, realign, go again to target" instead of going directly to the target position. This was a continuation of the collision avoidance optimization work.

## Analysis

Found three issues causing the indirect movement behavior:

### Issue 1: Stale `canAccelerate` Flag (1-Frame Delay)
In `src/game/unitMovement.js`, the order of operations was:
1. `updateUnitPosition()` called (uses `unit.canAccelerate` to decide if tank should move)
2. `updateUnitRotation()` called (sets `unit.canAccelerate` based on current rotation state)

This meant `canAccelerate` was always one frame behind the actual rotation state, allowing tanks to start moving before they finished rotating.

**Fix:** Moved `updateUnitRotation()` call BEFORE `updateUnitPosition()` call.

### Issue 2: Loose Rotation Threshold for Non-Tank Units
Non-tank units used a 45-degree (π/4) threshold for `canAccelerate`. This was too loose - units could start moving when still facing 44 degrees away from target.

**Fix:** Changed threshold from 45 degrees (π/4) to 15 degrees (π/12).

### Issue 3: Residual Velocity on New Movement Commands
When a unit received a new movement command, the velocity was not reset. This caused units to continue coasting in their previous direction while the rotation system tried to turn them toward the new target.

**Fix:** Added `resetUnitVelocityForNewPath()` function and called it when a new path is assigned in `handleMovementCommand()`.

## Changes Made

### `src/game/unitMovement.js`
- Moved `updateUnitRotation(unit, now)` call to execute BEFORE `updateUnitPosition()` so `canAccelerate` flag is current when position update runs

### `src/game/unifiedMovement.js`
- Changed non-tank rotation threshold from `Math.PI / 4` (45°) to `Math.PI / 12` (15°) for stricter facing requirement
- Added new exported function `resetUnitVelocityForNewPath(unit)` to reset velocity when a new path is assigned
- Cleaned up unused collision constant imports

### `src/input/unitCommands.js`
- Imported `resetUnitVelocityForNewPath` from unifiedMovement.js
- Call `resetUnitVelocityForNewPath(unit)` before setting new path in `handleMovementCommand()`

## Result

Units should now:
1. Rotate to face the target first (tanks wait until aligned, non-tanks wait until within 15 degrees)
2. Start moving only after properly oriented
3. Not coast in wrong direction when receiving new movement commands
