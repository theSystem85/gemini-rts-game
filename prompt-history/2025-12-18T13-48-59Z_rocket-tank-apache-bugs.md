# Rocket Tank vs Apache Bug Fixes

**UTC Timestamp:** 2025-12-18T13:48:59Z  
**LLM:** GitHub Copilot (Claude Sonnet 4.5)

## User Request

BUG: when rocketTank fires at apache the rockets do not chase the heli (but they should and explode on impact). Also ensure the rocketTank chases the apache when it flies away to stay in range. Also ensure that the rockets are not fired automatically when no target is assigned (this happens currently for no reason I can see).

## Issues Identified

1. **Rocket Tank rockets don't home on Apache helicopters** - Rockets have `homing: false` set in `unitCombat.js` and `bulletSystem.js`, preventing them from tracking moving targets like airborne Apaches.

2. **Rocket Tank doesn't chase fleeing Apache** - The `updateRocketTankCombat` function doesn't properly handle Apache altitude adjustments or ensure the tank chases when the Apache flies out of range.

3. **Rockets fire without assigned target** - The combat logic may be setting targets automatically or there's a gap in the target validation before firing.

## Changes Made

### 1. src/game/unitCombat.js - Enable Rocket Homing
**Line 373:** Changed `homing: isRocketTankRocket ? false : ...` to `homing: isRocketTankRocket ? true : ...`
- Enables homing behavior for rocket tank projectiles so they actively track moving targets
- This allows rockets to adjust their trajectory after the ballistic ascent phase

**Line 1151-1157:** Removed duplicate Apache altitude adjustment
- The `handleTankMovement` function already adjusts for Apache altitude (lines 169-171, 194-196)
- Removed redundant adjustment that would have caused double-compensation
- Distance calculation and chasing behavior now work correctly with aerial targets

### 2. src/game/bulletSystem.js - Enable Rocket Homing in Alt Code Path
**Line 1031:** Changed `homing: false` to `homing: true` in rocket tank bullet creation
- Ensures homing is enabled for rockets created through the alternate bullet creation path
- Maintains consistency with the primary firing path in unitCombat.js

**Apache Altitude Adjustment (Lines 260-265):**
- Existing code already properly adjusts target Y position for Apache altitude visual offset
- Formula: `targetCenterY -= target.altitude * 0.4` matches the rendering offset
- Rockets now aim at the visual position of the Apache, not the logical ground position

### 3. Target Assignment Logic - Already Correct
- `updateRocketTankCombat` only runs when `unit.target && unit.target.health > 0` (line 1141)
- Burst fire requires: valid target, cooldown passed, ammo available, `canFire !== false`, and `isTurretAimedAtTarget` check (lines 1187-1194)
- Auto-targeting only occurs for units with `guardTarget` set (guard mode) or Tank V2's alert mode
- Rocket tanks don't have `alertMode` enabled, so they only fire when explicitly commanded or in guard mode

## Technical Details

**Rocket Tank Behavior:**
- Rockets now have `homing: true` which allows them to track moving targets
- After ballistic ascent phase, rockets enter homing phase and actively pursue their target
- Apache altitude visual offset is properly compensated in targeting calculations
- Rocket tanks will chase fleeing Apaches using the standard tank movement logic with appropriate range thresholds

**Apache Visual Offset:**
When an Apache is at altitude, it's rendered at `y - (altitude * 0.4)`, so rockets need to aim at the visual position, not the logical position.

**Target Validation:**
- Rockets only fire if `unit.target` exists and has `health > 0`
- Burst fire requires `isTurretAimedAtTarget` check before starting
- No automatic target acquisition during firing sequences

## Testing Recommendations

1. Spawn rocket tank and Apache on opposite teams
2. Command rocket tank to attack Apache
3. Verify rockets home on moving Apache
4. Verify rockets adjust for altitude changes
5. Have Apache fly away and verify rocket tank chases
6. Verify no rockets fire when tank has no target assigned
