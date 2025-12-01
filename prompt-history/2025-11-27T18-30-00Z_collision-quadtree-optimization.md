# Collision Detection Quadtree Optimization

**UTC Timestamp:** 2025-11-27T18:30:00Z  
**LLM:** Claude Opus 4.5 (copilot)

## Prompt Summary

User requested a performance analysis of the current collision detection algorithm for ground units and asked for an efficient collision avoidance algorithm so units "flow like swarms from A to B even when there are narrow passes to overcome."

## Analysis Findings

The existing collision system had several performance issues:

1. **O(n²) Complexity**: Multiple functions iterated over all units for each unit:
   - `resolveUnitCollisions()` in `units.js` - nested loops checking all unit pairs
   - `calculateCollisionAvoidance()` in `unifiedMovement.js` - iterating all units for avoidance
   - `checkUnitCollision()` in `unifiedMovement.js` - iterating all units for collision detection

2. **Multiple Passes Per Frame**: The collision system ran 3+ times per frame:
   - `resolveUnitCollisions` for idle unit separation
   - `calculateCollisionAvoidance` for moving unit steering
   - `checkUnitCollision` for position validation

3. **No Spatial Partitioning**: Every collision check compared against all N units

## Implementation Plan (Approved by User)

1. **Spatial Partitioning**: Quadtree (chosen over uniform grid for future sea unit support)
2. **Formation Style**: Option C - treat formation center as cohesion target, blend with flocking
3. **Flow Fields**: Option A - on-demand for detected chokepoints

## Files Created

### `src/game/spatialQuadtree.js`
- `SpatialQuadtree` class with AABB-based spatial partitioning
- Separate trees for ground and air units
- Methods: `rebuild()`, `queryNearbyGround()`, `queryNearbyAir()`, `queryNearbyForUnit()`
- Exports: `initSpatialQuadtree()`, `getSpatialQuadtree()`, `rebuildSpatialQuadtree()`

### `src/game/flowField.js`
- `FlowFieldManager` for on-demand flow field generation at chokepoints
- Chokepoint detection based on narrow passages in terrain
- Methods: `detectChokepoint()`, `generateFlowField()`, `getFlowDirectionForUnit()`
- Exports: `getFlowFieldManager()`, `clearFlowFields()`

### `src/game/steeringBehaviors.js`
- Boids-style steering behaviors using quadtree for neighbor queries
- Methods: `calculateSeparation()`, `calculateAlignment()`, `calculateCohesion()`, `calculateFormationCohesion()`, `calculateSteeringForces()`
- Configurable weights via `STEERING_CONFIG`
- Exports: `calculateSteeringForces()`, `applySteeringForces()`

## Files Modified

### `src/main.js`
- Added import for `initSpatialQuadtree`
- Added `initSpatialQuadtree()` call in `setupGameWorld()`

### `src/updateGame.js`
- Added import for `rebuildSpatialQuadtree`
- Added `rebuildSpatialQuadtree(units)` at start of host game logic

### `src/game/unifiedMovement.js`
- Added import for `getSpatialQuadtree`
- Modified `calculateCollisionAvoidance()` to use quadtree for neighbor queries
- Modified `checkUnitCollision()` to use quadtree for nearby unit detection

### `src/units.js`
- Added import for `getSpatialQuadtree`
- Modified `resolveUnitCollisions()` to use quadtree instead of nested loops

## Performance Improvement

- **Before**: O(n²) complexity for collision detection (3 passes per frame)
- **After**: O(n × k) where k is the average number of nearby units (typically 5-15)

For 100 units:
- Before: ~30,000 comparisons per frame (100 × 100 × 3)
- After: ~1,000-1,500 comparisons per frame (100 × 10-15)

## Future Work

The steering behaviors module (`steeringBehaviors.js`) and flow field module (`flowField.js`) are created and ready but not yet integrated into the actual unit movement pipeline. The next step would be to:

1. Call `calculateSteeringForces()` during unit movement updates
2. Apply steering forces via `applySteeringForces()`
3. Use flow fields at detected chokepoints for smooth navigation

## Commit Message

```
perf: implement quadtree spatial partitioning for O(n×k) collision detection

- Add spatialQuadtree.js with separate ground/air unit trees
- Add flowField.js for on-demand chokepoint flow fields (ready for integration)
- Add steeringBehaviors.js with Boids-style separation/alignment/cohesion (ready for integration)
- Integrate quadtree into unifiedMovement.js collision functions
- Integrate quadtree into units.js resolveUnitCollisions
- Rebuild quadtree once per frame in game loop
- Reduces collision detection from O(n²) to O(n×k) where k << n
```
