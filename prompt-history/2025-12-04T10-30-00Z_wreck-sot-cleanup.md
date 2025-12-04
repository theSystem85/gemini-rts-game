# Wreck and SOT Cleanup on Client Join and Shuffle Map

**UTC:** 2025-12-04T10:30:00Z
**LLM:** Claude Opus 4.5 (copilot)

## Prompt

> when a client joins a muliplayer game ensure that all wrecks and SOT tiles are cleaned up. Also ensure the same happens when shuffle map button is pressed.

## Changes Made

### `src/main.js`

1. **Updated import to include `getMapRenderer`:**
   ```javascript
   import { getTextureManager, preloadTileTextures, getMapRenderer } from './rendering.js'
   ```

2. **Added cleanup in `resetGameWithNewMap()` (shuffle map button):**
   - Added `gameState.unitWrecks = []` to clear all unit wrecks from previous game
   - Added `mapRenderer.invalidateAllChunks()` call to force SOT mask recomputation

3. **Added cleanup in `regenerateMapForClient()` (client joining multiplayer):**
   - Added `gameState.unitWrecks = []` to clear all unit wrecks when joining multiplayer
   - Added `mapRenderer.invalidateAllChunks()` call at the end of the function to invalidate SOT mask after map regeneration

### `TODO.md`

Added task T046:
```markdown
- [x] ✅ T046 Clear wrecks and SOT on client join and shuffle map
  - done: Added gameState.unitWrecks cleanup and mapRenderer.invalidateAllChunks() in both resetGameWithNewMap() (shuffle map button) and regenerateMapForClient() (client joining multiplayer); Ensures stale wrecks from previous games don't persist and SOT (Smoothening Overlay Texture) mask is recomputed for the new map
```

## Technical Details

- **SOT (Smoothening Overlay Texture):** The map renderer uses a precomputed mask for corner smoothening on streets/water. When the map changes, this mask needs to be invalidated so it gets recomputed on the next render.
- **`invalidateAllChunks()`:** This method clears the chunk cache AND sets `sotMask = null`, ensuring fresh computation.
- **Unit Wrecks:** Stored in `gameState.unitWrecks` array. Wrecks from destroyed units could persist across games if not cleared.

## Commit Message

```
fix: clear wrecks and SOT mask on client join and shuffle map

- Add unitWrecks cleanup in resetGameWithNewMap() and regenerateMapForClient()
- Invalidate SOT mask chunks when shuffling map or joining multiplayer
- Import getMapRenderer in main.js for SOT invalidation access
```
