# Spec 019: Stale SOT Overlays After Game Over

## Problem
After reaching **Victory/Defeat** and starting a new game (or reloading into a fresh session), the SOT (Smoothening Overlay Texture) tiles can appear to be from the previous map.

## Root Cause
`MapRenderer` caches terrain chunks and a computed SOT mask. When a new game is started via `resetGame()`, the map is regenerated but the renderer cache was not always invalidated.

If map dimensions and texture mode remain unchanged, cache validity checks do not auto-invalidate, so old chunks (including their SOT overlays) can be reused.

## Fix
In `resetGame()` (in `src/main.js`):
- Call `getMapRenderer()?.invalidateAllChunks()` before regenerating the map.
- This clears chunk cache and resets the SOT mask.

## Acceptance Criteria
- Starting a new game after victory/defeat renders correct SOT overlays for the current map.
- No visible SOT artifacts from the previous map remain.
