# Spec 017: Startup Map Initialization Bugfix

## Problem
On fresh load, the game can immediately show **DEFEAT** and the map appears ungenerated.

## Root Cause
`gameState.mapGrid` and `gameState.factories` are assigned to the exported module-level arrays in `src/main.js`:

- `gameState.mapGrid = mapGrid`
- `gameState.factories = factories`

Later, startup/reset code attempted to "sync" state by doing:

- `gameState.mapGrid.length = 0; gameState.mapGrid.push(...mapGrid)`
- `gameState.factories.length = 0; gameState.factories.push(...factories)`

Because these are the **same references**, clearing `gameState.mapGrid` clears `mapGrid` (and similarly for factories), wiping out the just-generated map and factories.

This leads to:
- empty `mapGrid` => map render has nothing to draw
- empty `factories` and no player buildings => `checkGameEndConditions()` marks the player defeated

## Fix
When `gameState.mapGrid` and `gameState.factories` already reference the module arrays, do **not** clear/push to sync.

Implementation:
- Remove the destructive sync blocks in `src/main.js` in:
  - `setupGameWorld()`
  - `resetGameWithNewMap()`
  - `resetGame()`
  - `regenerateMapForClient()`

## Acceptance Criteria
- On initial load, the random map is present (non-empty grid).
- The player starts with at least one factory/building.
- No immediate DEFEAT screen appears on startup.
- Multiplayer client map regeneration still produces a non-empty map.
