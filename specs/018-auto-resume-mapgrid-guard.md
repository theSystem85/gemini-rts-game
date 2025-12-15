# Spec 018: Auto-resume MapGrid Guard

## Problem
After a reload that auto-restores the last paused session, the game can crash in the host-only update loop with:

- `TypeError: Cannot read properties of undefined (reading 'length')`

Observed stack:
- `attemptPlacementWithSpacing()` -> `findBuildingPosition()` (AI building placement)

## Root Cause
During `loadGame()` in `src/saveGame.js`, the code attempted to "sync" `gameState.mapGrid` by clearing and re-pushing rows:

- `gameState.mapGrid.length = 0`
- `gameState.mapGrid.push(...mapGrid)`

But `gameState.mapGrid` is normally assigned to the same exported array as `mapGrid` (`src/main.js`), so clearing `gameState.mapGrid` also cleared the canonical `mapGrid`. This left the map empty during the first post-restore frames.

AI building placement assumes a non-empty 2D `mapGrid` and accessed `mapGrid[0].length`, causing the crash.

## Fix
1. In `src/saveGame.js`:
   - Avoid destructive syncing. Ensure `gameState.mapGrid` references the canonical `mapGrid` instead of clearing/pushing.
   - Avoid double-adding factories when `gameState.factories` and `factories` share the same array reference.

2. In `src/ai/enemyBuilding.js`:
   - Add a defensive guard that returns `null` when `mapGrid` is missing/empty/not 2D.

## Acceptance Criteria
- Reloading with auto-resume enabled no longer crashes.
- AI does not attempt building placement unless `mapGrid` is a non-empty 2D array.
- Map remains rendered after restore.
