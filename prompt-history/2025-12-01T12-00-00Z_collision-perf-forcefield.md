# Collision Detection Performance & Force-Field Physics Fix

**UTC Timestamp:** 2025-12-01T12:00:00Z  
**LLM:** Claude Opus 4.5 (copilot)

## Prompt Summary

User reported two issues with the previous collision detection implementation:
1. Performance is very bad when multiple units are moving at the same time
2. Units still bump into obstacles and velocity inversion at impact causes erratic behavior

## Issues Identified

### Performance Issues
1. **Array spreading in queries**: `found.push(...children.queryCircle(...))` creates many intermediate arrays
2. **Repeated Math.hypot calls**: Expensive sqrt operations called multiple times per unit pair
3. **Set creation for excludeIds**: Creating `new Set([excludeId])` for every query
4. **For-of loops**: Slower than indexed for loops for hot paths
5. **Recalculating unit centers**: `unit.x + TILE_SIZE / 2` computed multiple times

### Collision Physics Issues
1. **Velocity inversion**: When units collide, velocities are reversed causing "bouncy" behavior
2. **Reactive not proactive**: Collision only handled after penetration, not prevented
3. **No force-field**: Units don't repel each other before actual contact

## Solutions Implemented

### Performance Optimizations

**In `spatialQuadtree.js`:**
- Replaced `queryCircle` with `queryCircleInto` that takes result array as parameter (no allocations)
- Pre-compute `radiusSq` once instead of computing `radius * radius` in every intersection check
- Use indexed for loops instead of for-of
- Cache `boundary.right` and `boundary.bottom` to avoid repeated addition
- Reuse result arrays in `SpatialQuadtree` class (`_groundResults`, `_airResults`)
- Pre-compute unit centers (`unit._cx`, `unit._cy`) during quadtree rebuild

**In `unifiedMovement.js`:**
- Use pre-computed centers from quadtree (`unit._cx ?? (unit.x + TILE_SIZE / 2)`)
- Bitwise OR for integer division (`(x / TILE_SIZE) | 0`)
- Inline distance calculations, avoid redundant sqrt
- Reduced lookahead iterations

**In `units.js`:**
- Same optimizations: indexed loops, pre-computed centers, squared distance comparisons
- Early exit if quadtree not available

### Force-Field Collision Physics

**New constants in `MOVEMENT_CONFIG`:**
```javascript
FORCE_FIELD_RADIUS: 36,    // Radius where force field starts applying
FORCE_FIELD_STRENGTH: 2.5, // Max strength of repulsion force
FORCE_FIELD_FALLOFF: 2.0   // Exponential falloff (higher = sharper)
```

**Force-field equation:**
```
F = strength × (1 - distance/radius)^falloff
```

This creates smooth, exponentially increasing repulsion as units get closer. Key behaviors:
- Units start experiencing gentle push at `FORCE_FIELD_RADIUS` (36px)
- Force increases exponentially as they get closer
- At minimum distance, force is at maximum
- No velocity inversion - units slow down gradually when penetrating

**Collision response changes:**
- Instead of bouncing (inverting velocity), apply damping factor
- `dampingFactor = max(0.3, 1 - overlap / MIN_UNIT_DISTANCE)`
- Apply gentle separation force proportional to overlap
- Both colliding units receive appropriate forces

## Files Modified

### `src/game/spatialQuadtree.js`
- Complete rewrite of `AABB` and `QuadtreeNode` classes for performance
- New `queryCircleInto` method with no allocations
- Reusable result arrays in `SpatialQuadtree`
- Pre-computation of unit centers during rebuild

### `src/game/unifiedMovement.js`
- Added force-field constants to `MOVEMENT_CONFIG`
- Rewrote `calculateCollisionAvoidance` with force-field physics
- Rewrote collision detection in `checkUnitCollision` to use damping instead of bounce
- Increased `LOCAL_LOOKAHEAD_STEPS` for better prediction

### `src/units.js`
- Optimized `resolveUnitCollisions` with indexed loops and squared distance

## Complexity Analysis

**Before:**
- Quadtree query: O(k) but with O(k) allocations per query
- Collision detection: O(n × k) with many intermediate allocations
- Total memory pressure: High, causing GC pauses

**After:**
- Quadtree query: O(k) with zero allocations (reused array)
- Collision detection: O(n × k) with minimal allocations
- Total memory pressure: Very low, smooth frame times

## Commit Message

```
perf: optimize quadtree queries and implement force-field collision physics

Quadtree Performance:
- Eliminate array spreading in recursive queries (queryCircleInto)
- Pre-compute and cache unit centers during rebuild (unit._cx, unit._cy)
- Reuse result arrays to avoid allocations (_groundResults, _airResults)
- Use indexed for loops and bitwise division for hot paths
- Cache AABB bounds (right, bottom) to avoid repeated addition

Force-Field Physics:
- Replace velocity inversion with exponential repulsion force
- F = strength × (1 - distance/radius)^falloff for smooth deceleration
- Units slow down as they penetrate obstacles instead of bouncing
- Gentle separation forces keep units from overlapping
- Increased lookahead distance for better obstacle prediction

Fixes performance issues with many moving units and eliminates
erratic bouncing behavior when units collide.
```
