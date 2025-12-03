# Prompt History Entry
**UTC Timestamp:** 2025-12-03T14:53:27Z
**LLM:** Claude Opus 4.5 (Copilot)

## User Request
User reported:
1. When starting a new game and spawning a tank_v1, it immediately shows heavy smoke
2. When loading a game with units already on the map and damaging those units below 25%, they do NOT have smoke
3. Also requested that smoke always comes from the back part of units, not the center

## Root Cause Analysis
The issue was that when loading saved games, the `maxHealth` property could be `undefined` for units from older save formats. The smoke emission check `unit.health / unit.maxHealth < 0.25` would result in `NaN` when `maxHealth` is undefined, and `NaN < 0.25` is always `false`.

The sequence in saveGame.js was:
1. `createUnit()` sets proper `maxHealth` from UNIT_PROPERTIES
2. `Object.assign(hydrated, u)` copies ALL saved properties, including potentially `undefined` maxHealth from older saves
3. Result: `maxHealth` becomes `undefined`

## Changes Made

### 1. src/saveGame.js
- Store `defaultMaxHealth` from `createUnit()` BEFORE `Object.assign()` overwrites it
- After `Object.assign()`, validate that `maxHealth` is a valid finite number
- If not valid, restore from `defaultMaxHealth` or fall back to `health` or `100`

### 2. src/updateGame.js
- Added defensive fallback: `const maxHealth = unit.maxHealth || unit.health || 100`
- Changed smoke position offset from `0.4` to `0.35` TILE_SIZE (still from back of unit)
- Removed debug logging code from previous session
- Smoke emits from back of unit using `-Math.cos(direction)` and `-Math.sin(direction)` offsets

### 3. src/rendering/effectsRenderer.js
- Removed debug logging from `renderSmoke()`

### 4. src/utils/smokeUtils.js
- Kept coordinate validation but removed console.warn output

## Files Modified
- `src/saveGame.js` - Fixed maxHealth preservation during unit hydration
- `src/updateGame.js` - Fixed smoke emission with maxHealth fallback, positioned at unit back
- `src/rendering/effectsRenderer.js` - Removed debug logging
- `src/utils/smokeUtils.js` - Removed debug console.warn
- `TODO.md` - Updated task status

## Technical Details

### Smoke Position Calculation
```javascript
// direction = 0 means facing right (east)
// -cos(0) = -1 (offset to the left/west = back of unit)
// -sin(0) = 0 (no vertical offset)
const offsetX = -Math.cos(direction) * TILE_SIZE * 0.35
const offsetY = -Math.sin(direction) * TILE_SIZE * 0.35
```

This positions smoke at 35% of a tile behind the unit's center, based on its facing direction.

### maxHealth Fix in saveGame.js
```javascript
const defaultMaxHealth = hydrated.maxHealth  // Save before Object.assign
Object.assign(hydrated, u)                     // May overwrite with undefined
if (!Number.isFinite(hydrated.maxHealth) || hydrated.maxHealth <= 0) {
  hydrated.maxHealth = defaultMaxHealth || hydrated.health || 100
}
```
