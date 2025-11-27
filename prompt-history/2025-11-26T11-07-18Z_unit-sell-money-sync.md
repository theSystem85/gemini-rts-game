# 2025-11-26T11:07:18Z - Unit Visibility, Sell Sync, Money Sync Fixes

**LLM:** GitHub Copilot (Claude Opus 4.5 Preview)

## Prompt Summary
User reported 3 remaining multiplayer sync issues after previous round of fixes:
1. Units not visible on the map from other parties after being built (neither host→client nor client→host)
2. Selling buildings is not synced (buildings reappear after sell animation)
3. Money cheat from host does not apply to client

## Root Cause Analysis

### Issue 1: Units Not Visible
The game has TWO separate arrays for units:
- `units` exported from `main.js` - used by GameLoop, rendering, and production systems
- `gameState.units` in gameState.js - a separate empty array

The snapshot sync was updating `gameState.units` but the rendering used `units` from main.js. These are different arrays that were never linked.

### Issue 2: Building Sell Not Synced
The `BUILDING_SELL` command type existed but was never implemented. No `broadcastBuildingSell()` function existed and `buildingSellHandler.js` didn't call any sync function.

### Issue 3: Money Cheat
Each player has their own money:
- Human player: `gameState.money`
- AI players: `factory.budget`

In multiplayer, each player manages their own money independently. The snapshot was incorrectly overwriting the client's money with the host's money.

## Changes Made

### `src/network/gameCommandSync.js`
1. Added import: `import { units as mainUnits, bullets as mainBullets } from '../main.js'`
2. `createGameStateSnapshot()`: Now reads from `mainUnits` and `mainBullets` instead of `gameState.units`/`gameState.bullets`
3. `applyGameStateSnapshot()`:
   - Units now sync to `mainUnits` array in-place (clear + push) to preserve GameLoop reference
   - Bullets now sync to `mainBullets` array in-place
   - Removed money sync from snapshot (each player manages own money)
4. `createClientStateUpdate()`: Now reads from `mainUnits` instead of `gameState.units`
5. Added `broadcastBuildingSell(buildingId, sellValue, sellStartTime)` function
6. Added handling for `BUILDING_SELL` command in `applyCommand()` - sets `isBeingSold` and `sellStartTime`
7. Added `sellStartTime` to building snapshot properties

### `src/updateGame.js`
1. Added import: `import { units as mainUnits } from './main.js'`
2. `CLIENT_STATE_UPDATE` handler now uses `mainUnits.find()` instead of `gameState.units.find()`

### `src/buildingSellHandler.js`
1. Added import: `import { broadcastBuildingSell } from './network/gameCommandSync.js'`
2. After marking building as sold, calls `broadcastBuildingSell(building.id, sellValue, building.sellStartTime)`

## Technical Notes

### Unit Array Sync Pattern
```javascript
// Replace contents of mainUnits array in-place (so GameLoop reference stays valid)
mainUnits.length = 0
mainUnits.push(...updatedUnits)

// Also keep gameState.units in sync
gameState.units = mainUnits
```

### Money Per-Player Design
- Each human player uses `gameState.money` locally
- AI players use `factory.budget`
- Money is NOT synced between players - intentional design for multiplayer
- If "give all players money" cheat is desired, it would need separate implementation

## Files Modified
- `src/network/gameCommandSync.js`
- `src/updateGame.js`
- `src/buildingSellHandler.js`
- `TODO.md` (added T025)
