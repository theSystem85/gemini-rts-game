# GPU Smoke Optimization

**Timestamp**: 2025-12-03T12:00:00Z  
**LLM**: Claude Opus 4.5 (GitHub Copilot)

---

## User Prompt

> analyse the code for the top 3 biggest performance bottlenecks. currently it happens that at some point sometimes the frame rate drops from 60FPS to about 30 FPS and I am not sure why. maybe some smoke animations or pathfinding might cause it but not sure. maybe something else. Make proposals to get more load from CPU to GPU.

> now implement the optimizations for step 1 and 2 in one go.

> now implement step 3 and 4 of your performance improvement proposals

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

## Phase 1 & 2: Smoke/Explosion Rendering Optimizations

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

---

## Phase 3 & 4: Pathfinding and AI Throttling

### 5. Pathfinding Batching and Throttling (`src/game/pathfinding.js`, `src/config.js`)

- **Extended PATH_CACHE_TTL** from 2000ms to 4000ms (2x the calc interval)
  - Cache now lives longer than recalc interval, maximizing cache hits
  
- **Added MAX_PATHS_PER_CYCLE** limit (default: 5)
  - Instead of calculating ALL paths in one frame, limits to 5 paths per update
  - Spreads pathfinding CPU work across multiple frames
  - Prevents CPU spikes when many units need paths simultaneously

- **Priority-based path processing**
  - Units sorted by distance to target (ascending)
  - Closer units get pathfinding priority
  - Ensures units about to reach destination get recalculated first

### 6. AI Frame Skip Throttling (`src/enemy.js`, `src/config.js`)

- **Added AI_UPDATE_FRAME_SKIP** config (default: 3)
  - AI logic runs every 3rd frame instead of every frame
  - At 60 FPS game, AI runs at ~20 FPS
  - Reduces AI CPU overhead by ~66%

- **Frame counter implementation**
  - `aiFrameCounter` cycles 0, 1, 2, 0, 1, 2...
  - AI update only executes when counter === 0
  - Early return on non-AI frames for minimal overhead

---

## New Config Constants

| Constant | Default | Description |
|----------|---------|-------------|
| `PATH_CACHE_TTL` | 4000ms | Path cache lifetime (2x calc interval) |
| `MAX_PATHS_PER_CYCLE` | 5 | Max concurrent path calculations per update |
| `AI_UPDATE_FRAME_SKIP` | 3 | Run AI every N frames |

---

## Performance Impact Summary

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Gradient ops/frame | ~4,800 | 0 | 100% reduction |
| drawImage calls/frame | 0 | ~300 | GPU-accelerated |
| Max smoke particles | 600 | 300 | 50% reduction |
| View frustum culling | No | Yes | Skip off-screen |
| Path calcs/cycle | Unbounded | Max 5 | CPU spike prevention |
| Path cache TTL | 2000ms | 4000ms | 2x cache hits |
| AI update frequency | Every frame | Every 3rd | 66% reduction |

---

## Files Modified

- `src/rendering/effectsRenderer.js` - Sprite caching, frustum culling, optimized rendering
- `src/config.js` - New constants: `PATH_CACHE_TTL`, `MAX_PATHS_PER_CYCLE`, `AI_UPDATE_FRAME_SKIP`
- `src/game/pathfinding.js` - Batched path processing with priority sorting
- `src/enemy.js` - AI frame skip throttling
- `specs/011-unit-smoke-optimization/spec.md` - Updated spec with Phase 2 requirements
- `TODO.md` - Added completed performance items
