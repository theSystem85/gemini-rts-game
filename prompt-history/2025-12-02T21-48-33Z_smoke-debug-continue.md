# Prompt History Entry
**UTC Timestamp:** 2025-12-02T21:48:33Z
**LLM:** Claude Opus 4.5 (Copilot)

## User Request
Continue fixing the unit smoke issue - user reported still no smoke visible on any unit after previous fixes.

## Context
Previous session attempted to fix unit smoke emission by:
1. Adding array initialization check for `gameState.smokeParticles`
2. Changing unit type check from case-sensitive `includes('tank')` to explicit whitelist
3. Adding `(unit.direction || 0)` to handle undefined direction

## Investigation & Changes Made

### Analysis
1. Compared current code with git history at commit `e9e792f` (smoke particle performance)
2. Found original code used `unit.type.includes('tank') || unit.type === 'harvester'`
3. Verified unit types in `UNIT_PROPERTIES`: `tank_v1`, `tank-v2`, `tank-v3`, `rocketTank`, `harvester`, `howitzer`, `recoveryTank`

### Debug Code Added
1. **Force smoke emission for testing** - Added code to emit smoke on first unit every 10 frames regardless of damage:
   ```javascript
   if (units.length > 0 && gameState.frameCount % 10 === 0) {
     const testUnit = units[0]
     emitSmokeParticles(gameState, testUnit.x + TILE_SIZE / 2, testUnit.y + TILE_SIZE / 2, now, 3)
   }
   ```

2. **Debug logging in emitSmokeParticles** - Added validation for NaN coordinates:
   ```javascript
   if (!Number.isFinite(x) || !Number.isFinite(y)) {
     console.warn('[emitSmokeParticles] Invalid coordinates:', x, y)
     return
   }
   ```

3. **Debug logging in renderSmoke** - Added particle count logging every 100 frames

4. **Reverted unit check to original logic** - Using `unit.type.includes('tank')` instead of whitelist

### Files Modified
- `src/updateGame.js` - Added forced smoke emission and debug logging
- `src/utils/smokeUtils.js` - Added coordinate validation
- `src/rendering/effectsRenderer.js` - Added render debug logging
- `TODO.md` - Added debugging task

## Expected Results
When user reloads the game, they should see:
1. Console logs every 100 frames showing particle emission and counts
2. If particles appear - smoke is working, issue was with damage threshold
3. If no particles - rendering issue, need to investigate `renderSmoke()` further

## Next Steps
- Check console output to determine if particles are being emitted vs rendered
- If emitted but not rendered, check visibility map filtering in `renderSmoke()`
- Remove debug code once issue is resolved
