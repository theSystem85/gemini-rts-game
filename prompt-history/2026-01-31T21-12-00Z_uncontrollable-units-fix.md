# 2026-01-31T21:12:00Z - Fix Uncontrollable Units Bug

**LLM**: GitHub Copilot (Claude Opus 4.5)

## Prompt

there is now a new bug that sometimes I cannot control my units anymore at all and they keep moving into one direction untill hitting an obstacle but still try to move along while physics engine pushes them away. They get uncontrollable. Try to find when this could happen and fix the issue. Also happens when multiple units are selected but also with a single unit. This has to do sth. with the current staged changes because before that never happened.

## Analysis

The bug was caused by a previous fix that was too aggressive. The early return added to `handleStuckUnit()` in `movementStuck.js` was intended to prevent path recalculation jitter for player units with active paths. However, it had an unintended side effect:

**The Problem:**
- The early return skipped ALL stuck detection for player units with active paths
- If a unit got genuinely stuck against an obstacle, the stuck recovery mechanism (rotation/dodge/path clearing) never ran
- The unit's velocity kept pushing towards the waypoint while the physics/collision system pushed back
- Result: unit perpetually trying to move in one direction, unable to recover

**Root Cause in Code:**
```javascript
// OLD CODE - too aggressive
const hasActivePlayerMove = isPlayerUnit && unit.moveTarget && unit.path && unit.path.length > 0 &&
  !unit.isRetreating && !unit.sweepingOverrideMovement && !unit.isDodging
if (hasActivePlayerMove) {
  return // <-- This prevented ALL stuck handling, including genuine stuck recovery
}
```

## Solution

1. **Modified the early return condition** in `handleStuckUnit()` to include a time check:
   - Only skip stuck handling for the first 2 seconds after a path is calculated
   - After 2 seconds, if the unit is still stuck, allow the stuck recovery mechanism to run
   - This balances preventing immediate re-path jitter vs allowing stuck recovery

2. **Added `isDodging` state cleanup** in `movementCommands.js`:
   - When a new move command is issued, clear `isDodging` and `dodgeEndTime`
   - This ensures a clean state for the new movement command

## Files Modified

### src/game/movementStuck.js
- Changed early return condition to only skip if path was calculated within last 2 seconds
- Uses `unit.lastPathCalcTime` to determine if path is "recent"

### src/input/unitCommands/movementCommands.js  
- Added `unit.isDodging = false` and `unit.dodgeEndTime = null` when new move command is issued

## Key Fix

```javascript
// NEW CODE - time-bounded skip
const now = performance.now()
const hasRecentPath = unit.lastPathCalcTime && (now - unit.lastPathCalcTime < 2000)
const hasActivePlayerMove = isPlayerUnit && unit.moveTarget && unit.path && unit.path.length > 0 &&
  !unit.isRetreating && !unit.sweepingOverrideMovement && !unit.isDodging
if (hasActivePlayerMove && hasRecentPath) {
  return // Only skip for first 2 seconds after path calculation
}
```

## Testing

- Lint passes (`npm run lint:fix`)
- Units should now be controllable after being stuck for more than 2 seconds
- New movement commands properly reset dodging state
