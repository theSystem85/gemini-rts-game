# GPU Smoke Optimization

**Timestamp**: 2025-12-03T12:00:00Z  
**LLM**: Claude Opus 4.5 (GitHub Copilot)

---

## User Prompt

> analyse the code for the top 3 biggest performance bottlenecks. currently it happens that at some point sometimes the frame rate drops from 60FPS to about 30 FPS and I am not sure why. maybe some smoke animations or pathfinding might cause it but not sure. maybe something else. Make proposals to get more load from CPU to GPU.

> now implement the optimizations for step 1 and 2 in one go.

---

## Analysis Summary

Three major performance bottlenecks were identified:

1. **Smoke Particle Rendering** (Rendering-bound)
   - 600 particles × 2 gradients × 4 color stops = ~4,800 `createRadialGradient()` operations per frame
   - Each gradient creation is expensive CPU work that blocks the main thread
   - No view frustum culling - particles rendered even when off-screen

2. **A* Pathfinding Recalculation** (CPU-bound)
   - Path recalc every 2000ms for all units
   - Two passes over all units per recalculation
   - Cache TTL matches recalc interval, causing cache misses

3. **AI Player Update Loop** (CPU-bound)
   - AI runs every frame with no throttling
   - O(n²) unit iteration for target selection
   - Multiple strategic managers iterate all units

---

## Changes Implemented

### 1. Pre-cached Gradient Sprites (`src/rendering/effectsRenderer.js`)

- Added `SMOKE_SPRITE_CACHE` object to store pre-rendered gradient sprites
- Created `initializeSmokeSprites()` function that runs once at startup
- Pre-renders smoke gradients for sizes [4, 6, 8, 10, 12, 16, 20, 24, 32] pixels
- Each size has both main gradient and dark core gradient cached
- `getClosestSmokeSprite()` finds best matching cached sprite for any particle size

### 2. Optimized Smoke Rendering

- Replaced `createRadialGradient()` calls with `drawImage()` from cached sprites
- Added view frustum culling - skips particles outside viewport + 64px padding
- Changed from `.forEach()` to `for` loops for better performance
- Removed per-particle `ctx.save()`/`ctx.restore()` calls
- Screen position calculated first for early rejection

### 3. Explosion Sprite Caching

- Added on-demand explosion gradient caching with `getExplosionSprite()`
- Cache key rounded to 4px increments for efficient reuse
- LRU eviction when cache exceeds 50 entries
- View frustum culling with 128px padding

### 4. Reduced Particle Budget (`src/config.js`)

- `MAX_SMOKE_PARTICLES` reduced from 600 to 300
- Soft cap remains at 60% = 180 particles for unit fumes

---

## Performance Impact

| Metric | Before | After |
|--------|--------|-------|
| Gradient operations/frame | ~4,800 | 0 |
| drawImage calls/frame | 0 | ~300 |
| Max smoke particles | 600 | 300 |
| View frustum culling | No | Yes |

Expected improvement: 3-5x faster smoke/explosion rendering by moving gradient computation from per-frame CPU work to one-time startup cost + GPU texture sampling.

---

## Files Modified

- `src/rendering/effectsRenderer.js` - Added sprite caching, frustum culling, optimized rendering
- `src/config.js` - Reduced `MAX_SMOKE_PARTICLES` from 600 to 300
- `specs/011-unit-smoke-optimization/spec.md` - Updated spec with Phase 2 requirements
