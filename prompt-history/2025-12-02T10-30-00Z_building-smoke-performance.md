# Building Smoke Emission Performance Optimization

**UTC Timestamp:** 2025-12-02T10:30:00Z  
**LLM:** Claude Opus 4.5 (Preview) via GitHub Copilot

## Prompt Summary

Implement performance improvements to the current rendering system by using more GPU for building smoke emission scaling. The current system looks up images, computes scale factors, and possibly emits particles every frame for each building with smoke spots. The improvement should cache scale factors on construction completion, defer image lookups, and throttle emissions via shared timers.

## Changes Made

### 1. `src/buildings.js`
- Added import for `TILE_SIZE` from config.js
- Added import for `getBuildingImage` from buildingImageMap.js
- Added new exported function `cacheBuildingSmokeScales(building, buildingConfig)`:
  - Precomputes and caches smoke emission scale factors when a building is created
  - Handles async image loading via callback if image isn't cached yet
  - Stores `smokeScaleX`, `smokeScaleY`, `cachedSmokeSpots`, and `smokeScalesCached` on the building object
- Added internal helper `computeAndStoreSmokeScales(building, buildingConfig, buildingImage)`
- Modified `createBuilding()` to:
  - Initialize smoke emission trackers for buildings with smoke spots
  - Call `cacheBuildingSmokeScales()` to precompute scale factors at construction time

### 2. `src/updateGame.js`
- Removed import for `getBuildingImage` (no longer needed per-frame)
- Added import for `cacheBuildingSmokeScales` from buildings.js
- Updated building smoke emission loop to:
  - Use cached smoke scale factors instead of computing per-frame
  - Call `cacheBuildingSmokeScales()` for legacy buildings without cached values
  - Use pre-calculated `cachedSmokeSpots` array for emission coordinates
  - Skip frame if scales aren't cached yet (async image loading)

## Performance Impact

**Before:**
- Every frame, for each building with smoke spots:
  - Call `getBuildingImage()` to look up cached image
  - Calculate `renderedWidth`, `renderedHeight` from building dimensions
  - Get `naturalWidth`, `naturalHeight` from image
  - Compute `scaleX` and `scaleY` ratios
  - For each smoke spot, multiply by scale factors

**After:**
- At building construction time (once):
  - Cache scale factors and pre-scaled smoke spot positions
- Every frame:
  - Check if `smokeScalesCached` flag is true (O(1))
  - Use pre-calculated `cachedSmokeSpots` array directly
  - No image lookups or scale calculations

This eliminates redundant per-frame calculations for smoke emission, reducing CPU overhead especially when many buildings with smoke spots exist on the map.

## Files Modified

1. `/src/buildings.js` - Added smoke scale caching functions
2. `/src/updateGame.js` - Updated to use cached smoke values
3. `/TODO.md` - Added documentation of the performance improvement

## Follow-up Fix (2025-12-02T10:45:00Z)

Fixed issues after initial implementation:

1. **Unit smoke not appearing:** Added array initialization check before accessing `gameState.smokeParticles.length` to prevent undefined errors
2. **Building smoke too faint:** 
   - Increased particles per puff from 2 to 3
   - Reduced `BUILDING_SMOKE_EMIT_INTERVAL` from 1000ms to 800ms

## Follow-up Fix #2 (2025-12-02T11:00:00Z)

Root cause found for damaged unit smoke not appearing:

**Issue:** The condition `unit.type.includes('tank')` was case-sensitive and didn't match `rocketTank` (capital T). Also missed other combat vehicles like `howitzer` and `recoveryTank`.

**Fix:** Replaced the string `includes()` check with an explicit whitelist of smoke-emitting unit types:
```javascript
const smokeEmittingTypes = ['tank', 'tank_v1', 'tank-v2', 'tank-v3', 'rocketTank', 'harvester', 'howitzer', 'recoveryTank']
```
