# 2025-11-27T14:30:00Z - Wreck UnitType Sync Fix

**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt Summary
User reported that in multiplayer on the clients, wrecks are not displayed with the individual units image but with always the same default wreck image.

## Problem Analysis
The wreck rendering system in `wreckRenderer.js` uses `wreck.unitType` property to determine which sprite to render for each wreck. However, when serializing wrecks in `createGameStateSnapshot()` in `gameCommandSync.js`, the code was incorrectly using:

```javascript
type: wreck.type  // WRONG - this property doesn't exist
```

Instead of:

```javascript
unitType: wreck.unitType  // CORRECT - this is the actual property
```

When wrecks are created in `unitWreckManager.js`, they are initialized with:
```javascript
unitType: unit.type,  // The correct property name
```

So clients were receiving `type: undefined` from the snapshot, causing the wreck renderer to fall back to the default wreck image.

## Solution
Fixed the wreck serialization in `src/network/gameCommandSync.js`:

1. Changed `type: wreck.type` to `unitType: wreck.unitType`
2. Also added `spriteCacheKey: wreck.spriteCacheKey` for proper sprite cache lookup on client

## Files Modified
- `src/network/gameCommandSync.js` - Fixed wreck unitType serialization in createGameStateSnapshot()
- `TODO.md` - Added T036 task documenting the fix

## Testing
After this fix, wrecks on multiplayer clients should display the correct unit-specific wreck image matching the destroyed unit type (tank, harvester, etc.) instead of a generic default wreck.
