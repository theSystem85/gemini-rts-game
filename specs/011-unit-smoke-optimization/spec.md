# Feature Specification: Unit Fume Smoke Optimization

**Feature Branch**: `011-unit-smoke-optimization`
**Created**: 2025-11-17
**Updated**: 2025-12-03
**Status**: Complete

**Input**: "I noticed that the performance is drastically reduced when units show the fume animation when damaged heavily like tanks that have less than 25% HP. I guess there are just way too many particles drawn simultaneously. Make sure to make this specific particle animation more efficient and/or just reduce the number of sprites being drawn to simulate the fume."

---

## Overview

Heavily damaged ground vehicles currently flood the scene with smoke particles, causing performance drops when many units emit fumes at once. This update throttles unit-specific smoke so the visual cue remains readable while sharply reducing the number of simultaneous particles.

---

## Phase 1 Requirements (Emission Throttling) - Complete

1. **Slower Unit Emission Cadence**  
   - Increase the unit fume emission interval so each damaged tank/harvester emits smoke no more frequently than roughly every 320 ms.
2. **Global Soft Cap for Unit Fumes**  
   - Stop emitting additional unit smoke whenever the shared smoke pool exceeds 60% of the configured maximum particle budget; resume automatically when counts fall below the threshold.
3. **Single-Particle Puffs**  
   - Limit each emission tick for damaged units to a single particle to minimize draw calls while keeping the smoke cue visible.
4. **Scoped Change**  
   - Ensure building smoke emission intervals and visuals remain unchanged; only damaged unit fumes are throttled.
5. **Pooling Compliance**  
   - Continue using the existing smoke particle pooling to avoid extra allocations while enforcing the new limits.

---

## Phase 2 Requirements (GPU Rendering Optimization) - Complete

6. **Pre-cached Gradient Sprites**  
   - At renderer initialization, pre-render smoke gradient patterns to offscreen canvases for sizes [4, 6, 8, 10, 12, 16, 20, 24, 32] pixels.
   - Store both main smoke gradients and dark core gradients as separate sprite caches.
   - Replace per-frame `createRadialGradient()` calls with `drawImage()` from cached sprites.
   - This moves gradient computation from CPU→GPU every frame to one-time CPU cost at startup.

7. **View Frustum Culling**  
   - Skip rendering particles outside the visible viewport + 64px padding.
   - Calculate screen coordinates FIRST to enable early rejection before shadow-of-war checks.
   - Apply same culling to explosion effects with 128px padding.

8. **Explosion Sprite Caching**  
   - Cache explosion gradient sprites on-demand (rounded to 4px increments).
   - Limit explosion sprite cache to 50 entries with LRU eviction.
   - Replace per-explosion `createRadialGradient()` with cached `drawImage()`.

9. **Reduced Particle Budget**  
   - Lower `MAX_SMOKE_PARTICLES` from 600 to 300 for better performance.
   - Soft cap remains at 60% (180 particles for unit fumes).

10. **Loop Optimization**  
    - Replace `.forEach()` with `for` loops for particle iteration.
    - Avoid `ctx.save()`/`ctx.restore()` per particle - use direct `globalAlpha` assignment.
    - Batch alpha resets at end of render pass.

---

## Implementation Details

### Sprite Cache Structure
```javascript
const SMOKE_SPRITE_CACHE = {
  initialized: false,
  sprites: [],        // { canvas, size } for smoke gradients
  coreSprites: [],    // { canvas, size, originalSize } for dark cores
  explosionSprites: new Map()  // size -> canvas for explosions
}
```

### Performance Impact
- **Before**: ~4,800 gradient operations per frame (600 particles × 2 gradients × 4 color stops)
- **After**: ~300 `drawImage()` calls per frame (texture sampling is GPU-accelerated)
- **Expected improvement**: 3-5x faster smoke/explosion rendering
