# 2025-02-10T14:00:00Z
**LLM**: Copilot (Claude Opus 4.6)

## Prompt

Make a deep analysis of how the current pathfinding and unit movement + dodging (based on dynamic and static obstacles) algorithm works (including the collision physics) with the goal to figure out why the units often do not get directly to their targets. Give a detailed documentation that also includes mermaid diagrams that can directly be viewed in VSCode when the .md file gets opened. After conducting the deep analysis and creating the docs files with the (flow) diagrams. Attempt to also fix the issue that units often after setting an initial shortest path set intermediate short path movement targets before they redo the remote path finding which yields to inefficient movement in regards of reaching the target coords quickly.

## Changes Made

1. **Created `AI_Docs/PATHFINDING_MOVEMENT_DEEP_ANALYSIS.md`** — Comprehensive documentation covering:
   - Full architecture overview with game loop call order diagram
   - A* pathfinding algorithm flow (findPath) with path smoothing
   - Global pathfinding scheduler logic and caching
   - Unit movement pipeline (updateUnitMovement)
   - Physics-based position updates (updateUnitPosition)
   - Collision detection & response (terrain, units, wrecks, buildings)
   - Pre-emptive collision avoidance forces
   - Stuck detection & dodge recovery
   - Steering behaviours and flow fields
   - All key configuration constants
   - 6 identified root causes for inefficient movement
   - All with Mermaid diagrams viewable in VSCode

2. **Fixed `src/game/pathfinding.js`** — Added `pathComputedWithOccupancy` flag tracking. When a unit enters the close-range zone (≤ PATHFINDING_THRESHOLD tiles) with a path that was computed without occupancy awareness, it now triggers an immediate recalculation with the occupancy map, preventing the unit from blindly following stale waypoints into dynamic obstacles.

3. **Fixed `src/game/unitMovement.js`** — Improved dodge path restoration:
   - When restoring originalPath after a dodge, waypoints behind the unit are pruned to prevent backtracking
   - Attack-chase paths now set the `pathComputedWithOccupancy` flag
   - Restored dodge paths are marked for occupancy-aware recalculation
