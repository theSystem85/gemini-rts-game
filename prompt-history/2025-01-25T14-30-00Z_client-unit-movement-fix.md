# Client Unit Movement Fix

**UTC Timestamp:** 2025-01-25T14:30:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

(Continuation from previous session debugging client unit movement)

The root cause was identified: `updateUnitPathfinding()` in `src/game/unitMovement.js` only processed units in the `selectedUnits` array (the local player's selection), not ALL units with `moveTarget` set.

When the host receives a UNIT_MOVE command from a client, it correctly sets `unit.moveTarget = { x: targetX, y: targetY }`, but since the host player hasn't selected those units, they were never processed by pathfinding.

## Changes Made

### 1. `src/game/unitMovement.js`

Fixed `updateUnitPathfinding()` to iterate over ALL units with a `moveTarget` set, not just `selectedUnits`:

**Before (broken):**
```javascript
if (selectedUnits && selectedUnits.length > 0) {
  selectedUnits.forEach(unit => {
    if (unit.sweepingOverrideMovement) return
    if (unit.moveTarget && (!unit.lastPathCalcTime || ...)) {
```

**After (fixed):**
```javascript
// Update pathfinding for ALL units with movement targets (not just selected ones)
// This ensures remote player units also get paths calculated
const unitsWithMoveTarget = units.filter(unit => 
  unit.moveTarget && 
  !unit.sweepingOverrideMovement &&
  (!unit.lastPathCalcTime || now - unit.lastPathCalcTime > PATH_CALC_INTERVAL)
)

unitsWithMoveTarget.forEach(unit => {
```

### 2. `src/game/pathfinding.js`

Added IMMEDIATE path calculation for units with `moveTarget` but no path, outside the 2-second throttle interval. Previously, units could wait up to 2 seconds before getting a path assigned.

**Added:**
```javascript
// IMMEDIATE path calculation for units with moveTarget but no path
// This ensures remote player units get paths right away without waiting for the interval
const unitsNeedingImmediatePath = units.filter(u => 
  u.moveTarget && 
  (!u.path || u.path.length === 0) &&
  !u.lastPathCalcTime // Only units that haven't had paths calculated yet
)

unitsNeedingImmediatePath.forEach(unit => {
  // ... calculate path immediately
})
```

## Impact

- Client player 2 units can now be commanded and will move correctly
- Host-authoritative movement works for all players' units
- Paths are calculated immediately when moveTarget is set, not after 2-second delay
- No changes needed to command sync or network layer
