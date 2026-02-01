# Path Planning Range Mismatch Fix

**UTC Timestamp:** 2026-01-31T20:30:00Z
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt Summary
User reported path planning issue persists after previous fix. Asked to check if other movement policies (dodging, retreat) are interfering.

## Root Cause Found
**Range mismatch** between two systems:

1. `updateUnitMovement()` in [unitMovement.js](../src/game/unitMovement.js):
   - Used hardcoded `ATTACK_RANGE = 9 * TILE_SIZE` = 288 pixels for tanks
   
2. `handleTankMovement()` in [combatHelpers.js](../src/game/unitCombat/combatHelpers.js):
   - Uses `getEffectiveFireRange(unit)` which applies level bonuses (1.2x for level >= 1)
   - Result: `9 * TILE_SIZE * 1.2` = 345.6 pixels

**The Bug:**
For a unit with level >= 1 at distance 300 pixels:
1. `updateUnitMovement()`: 300 > 288 → "out of range, calculate path to move closer"
2. `handleTankMovement()`: 300 < 345.6 → "in range, clear path and stop"
3. Next frame: repeat step 1

This created an **infinite loop** every frame, causing constant path recalculation and erratic movement.

## Fix Applied

### [unitMovement.js](../src/game/unitMovement.js)

**Added import:**
```javascript
import { getEffectiveFireRange } from './unitCombat/combatHelpers.js'
```

**Changed range calculation:**
```javascript
// Before (hardcoded):
const ATTACK_RANGE = (unit.type && unit.type.startsWith('tank')) ? 9 * TILE_SIZE : 6 * TILE_SIZE

// After (using same function as combat system):
const ATTACK_RANGE = getEffectiveFireRange(unit)
```

## Verification
- Lint: ✅ Passed
- Tests: ✅ 3528 tests passed (113 test files)

## Key Lesson
When multiple systems control the same behavior (movement/pathfinding), they must use the **same calculations** for thresholds and ranges. Using different hardcoded values vs computed values will cause conflicts.
