# SOT Mask Precomputation for Rendering Performance

**UTC Timestamp:** 2025-12-02T10:30:00Z
**LLM:** Claude Opus 4.5 (Preview) via GitHub Copilot

## Prompt Summary

Refactor the code to improve the rendering performance by expanding the use of GPU for:

**Smoothening overlay (SOT) logic.**
- Current state: Land tiles examine four neighbors each frame to decide overlay textures, multiplying per-frame work by map size.
- Improvement: Precompute SOT masks when the map mutates, or let a shader derive edge smoothing procedurally.

## Implementation

### Problem Analysis
The existing `drawBaseLayer()` method in `MapRenderer` was performing neighbor checks (4 lookups: top, left, bottom, right) for every land tile during every frame render. For a 100x100 map, this meant potentially 10,000 tiles × 4 neighbor checks = 40,000 operations per frame just for SOT determination.

### Solution: Precomputed SOT Mask
Instead of computing SOT requirements each frame, we now:

1. **Compute once on map load** - A 2D `sotMask` array stores `{ orientation, type }` for each tile that needs smoothening, or `null` for tiles that don't.

2. **Update incrementally on mutations** - When tile types change (e.g., building destruction restoring tiles), only the affected tile and its immediate neighbors (9 tiles max) are recomputed.

3. **O(1) lookup during render** - The render loop now does a simple array lookup instead of neighbor comparisons.

### Files Changed

1. **`src/rendering/mapRenderer.js`**
   - Added `sotMask` and `sotMaskVersion` properties
   - Added `computeSOTMask(mapGrid)` - computes full mask for entire map
   - Added `computeSOTForTile(mapGrid, x, y, mapWidth, mapHeight)` - computes SOT for single tile
   - Added `updateSOTMaskForTile(mapGrid, tileX, tileY)` - incremental update for tile mutations
   - Modified `drawBaseLayer()` to use precomputed mask lookup
   - Modified `invalidateAllChunks()` to also reset SOT mask

2. **`src/rendering.js`**
   - Added `getMapRenderer()` export for external access to MapRenderer
   - Added `notifyTileMutation(mapGrid, tileX, tileY)` for external mutation notifications
   - Added `recomputeSOTMask(mapGrid)` for bulk map changes

3. **`src/buildings.js`**
   - Added import for `getMapRenderer`
   - Modified `clearBuildingFromMapGrid()` to track changed tiles and update SOT mask

### Performance Impact

**Before:**
- Per frame: O(n) neighbor checks where n = number of visible land tiles
- Each land tile: 4 array lookups + 8 conditional checks per frame
- For 100x100 map showing ~40x30 tiles: ~1,200 land tiles × 4 = 4,800 neighbor lookups per frame

**After:**
- Per frame: O(n) single array lookups
- Each land tile: 1 array lookup, 1 null check per frame
- SOT computation: Only on map load (one-time) and on tile mutations (rare, ~9 tiles max per mutation)

### API Usage

For external code that mutates tile types:
```javascript
import { notifyTileMutation, recomputeSOTMask } from './rendering.js'

// For single tile changes
notifyTileMutation(mapGrid, tileX, tileY)

// For bulk map regeneration
recomputeSOTMask(mapGrid)
```

## Testing Notes

- The SOT mask is lazily initialized on first render, so no changes needed to map generation code
- Building destruction/placement now properly updates SOT for restored tiles
- Chunk caching system remains compatible since `markTileDirty()` is called by `updateSOTMaskForTile()`

## Bug Fix (Follow-up)

### Issue
SOT tiles were not rendering after the initial precomputation implementation. The chunk caching system was not aware of the SOT mask version, causing cached chunks to be reused even when the SOT mask was computed or updated.

### Root Cause
1. Chunk objects stored `signature`, `lastUseTexture`, `lastWaterFrameIndex` but not `lastSotMaskVersion`
2. `updateChunkCache()` checked these values but didn't check if the SOT mask had changed
3. Result: chunks cached before SOT mask computation would never re-render with SOT overlays

### Fix
1. Added `lastSotMaskVersion: null` to chunk object in `getOrCreateChunk()`
2. Added `chunk.lastSotMaskVersion !== this.sotMaskVersion` to the `needsRedraw` check in `updateChunkCache()`
3. Added `chunk.lastSotMaskVersion = this.sotMaskVersion` when chunk is updated
4. Moved SOT mask computation to `renderTiles()` before chunk processing (ensures mask exists before chunks are cached)

## Bug Fix #2 (GPU Rendering Path)

### Issue
SOT tiles still not rendering when WebGL GPU renderer is active.

### Root Cause
When the WebGL renderer successfully renders tiles (`gpuRendered = true`), the 2D canvas rendering is skipped via `skipBaseLayer: true`. This means:
1. `renderTiles()` is never called when GPU rendering is active
2. `drawBaseLayer()` which contains SOT rendering is never executed
3. SOT overlays only existed in the 2D canvas path, not in the GPU path

### Fix
1. Added new method `renderSOTOverlays()` that renders ONLY the SOT overlays without base tiles
2. Modified `render()` to call `renderSOTOverlays()` when `skipBaseLayer` is true
3. This ensures SOT overlays are rendered via 2D canvas even when GPU handles base tile rendering
