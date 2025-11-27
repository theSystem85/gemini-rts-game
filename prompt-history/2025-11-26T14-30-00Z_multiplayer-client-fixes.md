# Multiplayer Client Fixes

**UTC Timestamp:** 2025-11-26T14:30:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

Fix three multiplayer client issues:

1. The gun barrel of a tank disappears on client when it attacks
2. The promotion stars are not shown on client (only on host). Ensure they do.
3. Ensure the client units stop firing at target when stop command (s key) is pressed or the unit is commanded to move somewhere else (currently they keep firing until target is destroyed. Issue only happens with client units not with host units)

## Analysis

### Issue 1: Tank Barrel Disappearing
**Root Cause:** The `recoilStartTime` and `muzzleFlashStartTime` properties use absolute `performance.now()` timestamps from the host. When synced to the client, the client uses its own `performance.now()` which has a completely different base value. This caused the animation timing calculations to fail.

**Fix:** Convert animation timestamps to elapsed times when creating snapshots, and convert back to absolute times on the client using the client's `performance.now()`.

### Issue 2: Promotion Stars Not Showing
**Root Cause:** The unit snapshot did not include `level`, `bountyCounter`, and `baseCost` properties needed for the promotion star rendering.

**Fix:** Added these properties to the unit snapshot in `createGameStateSnapshot()`.

### Issue 3: Client Units Keep Firing After Stop
**Root Cause:** Two problems:
1. The `handleStopAttacking()` function in keyboardHandler.js was not broadcasting the stop command to the host
2. The host's UNIT_STOP handler was clearing `attackTarget` but not the `target` property, which is the actual combat target that controls firing

**Fix:** 
- Added `broadcastUnitStop()` function in gameCommandSync.js
- Updated `handleStopAttacking()` to broadcast stop commands for owned units
- Updated UNIT_STOP handler on host to clear `target`, `forcedAttack`, `attackQueue`, and `attackGroupTargets`

## Changes Made

### src/network/gameCommandSync.js
- Added `level`, `bountyCounter`, `baseCost` to unit snapshot
- Added `broadcastUnitStop()` export function
- Changed `muzzleFlashStartTime` → `muzzleFlashElapsed` (relative time)
- Changed `recoilStartTime` → `recoilElapsed` (relative time)
- Updated snapshot application to convert elapsed times back to absolute start times
- Added building animation elapsed time sync

### src/input/keyboardHandler.js
- Added import for `broadcastUnitStop`
- Updated `handleStopAttacking()` to collect owned units and broadcast stop command

### src/updateGame.js
- Updated UNIT_STOP command handler to also clear:
  - `unit.target` (combat target)
  - `unit.forcedAttack`
  - `unit.attackQueue`
  - `unit.attackGroupTargets`

## Testing Notes
- Test tank firing on client - barrel should now remain visible during recoil animation
- Test unit leveling - promotion stars should appear on client as units gain experience
- Test stop command (S key) on client units - they should stop firing immediately
- Test move command on attacking client units - they should stop firing when moved
