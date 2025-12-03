# SOT Tile Loading Fix for Save Games and Missions

**UTC Timestamp:** 2025-12-03T11:45:00Z  
**LLM:** Claude Opus 4.5 (GitHub Copilot)

## User Request

When loading a mission the SOT (Smoothening Overlay Texture) tiles look like they are still from the previous map. Same when loading a new save game. Ensure the SOT tiles are updated when save games are loaded.

## Problem Analysis

The `MapRenderer` class maintains a precomputed `sotMask` for performance optimization. This mask caches which tiles need smoothening overlays (corner transitions between land and street/water tiles). 

When a save game or mission is loaded, the map grid is completely replaced with new data, but the `sotMask` was not being invalidated. This caused the renderer to display SOT overlays based on the old map's tile configuration.

## Solution

Added a call to `mapRenderer.invalidateAllChunks()` in the `loadGame()` function in `src/saveGame.js`. This method:
1. Clears the chunk cache
2. Sets `sotMask` to `null`, forcing a recomputation on the next render

The fix is applied after the map grid is fully restored and buildings are placed, ensuring the SOT mask will be recomputed with the correct tile types from the loaded save.

## Changes Made

### `src/saveGame.js`

1. Updated import to include `getMapRenderer`:
   ```javascript
   import { getTextureManager, getMapRenderer } from './rendering.js'
   ```

2. Added SOT mask invalidation after map restoration:
   ```javascript
   // Invalidate SOT (Smoothening Overlay Texture) mask to force recomputation
   // This ensures the map renders correctly after loading a new map
   const mapRenderer = getMapRenderer()
   if (mapRenderer) {
     mapRenderer.invalidateAllChunks()
   }
   ```

### `TODO.md`

Updated the SOT performance improvement section to document this bug fix.

## Testing

To verify the fix:
1. Load a mission or save game
2. Observe that street/water corner transitions render correctly
3. Load a different mission/save game with different terrain layout
4. Confirm SOT overlays update to match the new map
