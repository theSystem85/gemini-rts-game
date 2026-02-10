# Deep Analysis: Pathfinding, Unit Movement, Dodging & Collision Physics

> **Date**: 2025-02-10  
> **Purpose**: Root-cause analysis of why units often fail to reach targets directly, including full system documentation with flow diagrams.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [A* Pathfinding (`findPath`)](#2-a-pathfinding-findpath)
3. [Global Pathfinding Scheduler (`updateGlobalPathfinding`)](#3-global-pathfinding-scheduler-updateglobalpathfinding)
4. [Unit Movement Pipeline (`updateUnitMovement`)](#4-unit-movement-pipeline-updatunitmovementunitmovementjs)
5. [Position Update & Physics (`updateUnitPosition`)](#5-position-update--physics-updateunitposition)
6. [Collision Detection & Response](#6-collision-detection--response)
7. [Collision Avoidance (Pre-emptive)](#7-collision-avoidance-pre-emptive)
8. [Stuck Detection & Dodging](#8-stuck-detection--dodging)
9. [Steering Behaviours (Boids)](#9-steering-behaviours-boids)
10. [Flow Fields](#10-flow-fields)
11. [Key Configuration Constants](#11-key-configuration-constants)
12. [**ROOT CAUSE: Why Units Don't Reach Targets Directly**](#12-root-cause-why-units-dont-reach-targets-directly)
13. [**Fix Applied**](#13-fix-applied)

---

## 1. Architecture Overview

The movement system is split across multiple files with distinct responsibilities:

| File | Role |
|---|---|
| `src/units.js` | A* pathfinding algorithm, occupancy map, path smoothing |
| `src/game/pathfinding.js` | Global pathfinding scheduler with caching & throttling |
| `src/game/unitMovement.js` | Per-unit movement orchestration (attack chase, rotation, position update dispatch) |
| `src/game/movementCore.js` (`unifiedMovement.js`) | Physics-based position updates, velocity/acceleration |
| `src/game/movementCollision.js` | Collision detection against terrain/units/wrecks/buildings, collision response |
| `src/game/movementStuck.js` | Stuck detection, dodge manoeuvres, rotation recovery |
| `src/game/movementConstants.js` | Shared physics constants |
| `src/game/movementHelpers.js` | Utility functions (angle math, gas, air/ground checks) |
| `src/game/steeringBehaviors.js` | Boids-style separation/alignment/cohesion |
| `src/game/flowField.js` | On-demand flow fields for chokepoints |
| `src/game/spatialQuadtree.js` | Spatial indexing for efficient neighbour queries |

### Game Loop Call Order (per frame)

```mermaid
flowchart TD
    A["updateGame() — main frame tick"] --> B["updateUnitMovement()"]
    B --> B1["Per-unit: rotation, attack-chase logic"]
    B --> B2["Per-unit: updateUnitPosition() — physics"]
    A --> C["updateGlobalPathfinding()"]
    C --> C1["Batch A* recalculations for units needing paths"]
    A --> D["updateUnitCollisions() — post-move separation"]

    style A fill:#2d2d2d,stroke:#888,color:#fff
    style B fill:#1a3a1a,stroke:#4a4,color:#fff
    style C fill:#1a1a3a,stroke:#44a,color:#fff
    style D fill:#3a1a1a,stroke:#a44,color:#fff
```

**Critical ordering**: `updateUnitMovement()` runs **before** `updateGlobalPathfinding()`. This means units consume path steps first, then the global scheduler checks if new paths are needed.

---

## 2. A* Pathfinding (`findPath`)

Located in `src/units.js:276`.

### Algorithm Summary

```mermaid
flowchart TD
    START["findPath(start, end, mapGrid, occupancyMap)"] --> VALIDATE["Validate coords & mapGrid"]
    VALIDATE --> DEST_CHECK{"Is destination\nblocked/occupied?"}
    DEST_CHECK -- Yes --> FIND_ALT["findNearestFreeTile()\nSearch radius 5 tiles"]
    DEST_CHECK -- No --> ASTAR
    FIND_ALT --> ALT_FOUND{"Found\nalternative?"}
    ALT_FOUND -- No --> RETURN_EMPTY["Return []"]
    ALT_FOUND -- Yes --> ASTAR["Run A* search\nWith MinHeap priority queue"]

    ASTAR --> LOOP{"Nodes explored\n< PATHFINDING_LIMIT\n(1000)?"}
    LOOP -- Yes, goal reached --> RECONSTRUCT["Reconstruct path from parent chain"]
    LOOP -- Limit exceeded --> BEST_PARTIAL["Return partial path\nto best node so far"]
    LOOP -- Heap empty --> RETURN_EMPTY2["Return []"]

    RECONSTRUCT --> DIRECT_CHECK{"Is direct line-of-sight\nclear to destination?"}
    DIRECT_CHECK -- Yes, cheaper --> USE_DIRECT["Use direct path\n(getLineTiles)"]
    DIRECT_CHECK -- No --> SMOOTH["smoothPath()\nRemove redundant waypoints"]
    USE_DIRECT --> RETURN["Return final path"]
    SMOOTH --> RETURN

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style RETURN fill:#1a4a1a,stroke:#4a4,color:#fff
```

### Key Behaviours

- **Occupancy-aware**: When `occupancyMap` is passed, tiles with other units are treated as blocked (except the start tile).
- **Diagonal movement**: Uses 8-directional neighbours with diagonal corner-cutting checks.
- **Street cost bonus**: Street tiles have reduced path cost (`STREET_PATH_COST`), making roads preferred.
- **Partial paths**: When the search exceeds `PATHFINDING_LIMIT = 1000` nodes, returns the best partial path found so far. This is a **significant** cause of not-reaching-target behaviour.
- **Path smoothing**: After A*, `smoothPath()` tries to skip intermediate waypoints if there's a clear line-of-sight between non-adjacent nodes.

---

## 3. Global Pathfinding Scheduler (`updateGlobalPathfinding`)

Located in `src/game/pathfinding.js`.

### Scheduling Logic

```mermaid
flowchart TD
    START["updateGlobalPathfinding()"] --> IMMEDIATE{"Any units with\nmoveTarget but\nno path AND no\nlastPathCalcTime?"}
    IMMEDIATE -- Yes --> CALC_IMMEDIATE["Calculate paths immediately\n(for remote/new units)"]
    IMMEDIATE -- No --> TIMER

    CALC_IMMEDIATE --> TIMER{"PATH_CALC_INTERVAL\n(2000ms) elapsed?"}
    TIMER -- No --> END["Return — skip this cycle"]
    TIMER -- Yes --> FILTER["Filter units needing recalc:\n• Has moveTarget\n• No path (empty/null)\n• NOT attack-target units\n• NOT recently calculated (<100ms)\n• NOT at destination"]

    FILTER --> SORT["Sort by distance\n(closest first)"]
    SORT --> LIMIT["Limit to MAX_PATHS_PER_CYCLE = 5"]
    LIMIT --> FOREACH["For each selected unit"]

    FOREACH --> DISTANCE{"distance to target\n≤ PATHFINDING_THRESHOLD\n(10 tiles)?"}
    DISTANCE -- Yes --> WITH_OCC["getCachedPath WITH occupancyMap\n→ avoids other units"]
    DISTANCE -- No --> WITHOUT_OCC["getCachedPath WITHOUT occupancyMap\n→ ignores other units"]

    WITH_OCC --> SET_PATH["unit.path = newPath.slice(1)\nunit.lastPathCalcTime = now"]
    WITHOUT_OCC --> SET_PATH

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style TIMER fill:#4a3a1a,stroke:#a84,color:#fff
    style END fill:#3a1a1a,stroke:#a44,color:#fff
```

### Path Cache (`getCachedPath`)

- Caches paths by destination key: `"{x},{y}-{hasOccupancy}-{owner}-{minePolicy}"`
- TTL: `PATH_CACHE_TTL = 4000ms`
- Reuses cached paths: if another unit's cached path passes through the querying unit's current tile, it slices from that point.

### **Critical Observation — The Dual Pathfinding Threshold Problem**

When a unit is **far away** (> 10 tiles), the path is computed **without** the occupancy map. This creates a "rough" path that doesn't account for other units. When the unit gets closer (≤ 10 tiles), it switches to occupancy-aware pathfinding.

**However**: the scheduler only recalculates when `unit.path` is **empty** (`path.length === 0`). The unit must first **consume the entire old path** before getting a new one. If the old long-distance path ends up blocked by units close to the destination, the unit has already committed to intermediate waypoints.

---

## 4. Unit Movement Pipeline (`updateUnitMovement` — unitMovement.js)

Called once per frame per unit. This is the main orchestration function.

```mermaid
flowchart TD
    START["updateUnitMovement(unit)"] --> DEAD{"unit.health ≤ 0?"}
    DEAD -- Yes --> REMOVE["Remove unit, cleanup"]
    DEAD -- No --> INIT["initializeUnitMovement(unit)"]

    INIT --> DODGE_CHECK{"isDodging &&\npath empty &&\noriginalPath?"}
    DODGE_CHECK -- Yes --> RESTORE_PATH["Restore original path\n& target"]
    DODGE_CHECK -- No --> CONTINUE

    RESTORE_PATH --> CONTINUE["Check/clear dead targets"]

    CONTINUE --> ATTACK{"Has live attack target\nout of range?"}
    ATTACK -- Yes --> ATTACK_MOVE["Calculate attack-move:\n• Compare distance vs fire range\n• Check if target moved\n• Recalculate path if needed\n(ATTACK_PATH_CALC_INTERVAL = 3000ms)"]
    ATTACK -- In range --> STOP_MOVING["Clear moveTarget,\nempty path"]
    ATTACK -- No target --> SKIP_ATTACK["Skip attack-move"]

    ATTACK_MOVE --> ROTATION
    STOP_MOVING --> ROTATION
    SKIP_ATTACK --> ROTATION

    ROTATION["updateUnitRotation()\n• Body rotates towards path[0]\n• Turret tracks target\n• Sets canAccelerate flag"]

    ROTATION --> PHYSICS["updateUnitPosition()\n[See Section 5]"]

    PHYSICS --> CLEAR{"moveTarget set\nAND path empty?"}
    CLEAR -- Yes, close enough --> CLEAR_TARGET["unit.moveTarget = null"]
    CLEAR -- No --> DONE["Done for this unit"]

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style ATTACK_MOVE fill:#4a3a1a,stroke:#a84,color:#fff
    style PHYSICS fill:#1a4a1a,stroke:#4a4,color:#fff
```

### Rotation-Before-Movement Pattern

Before moving, the unit body must rotate to face the next waypoint. While rotating, `canAccelerate = false`, so the unit decelerates. Only when facing the correct direction does movement resume. This causes **pausing at every path bend**.

---

## 5. Position Update & Physics (`updateUnitPosition`)

Located in `src/game/movementCore.js` (exported from `unifiedMovement.js`).

```mermaid
flowchart TD
    START["updateUnitPosition(unit)"] --> HALTED{"Gas=0? Harvesting?\nNo driver? Repairing?"}
    HALTED -- Yes --> STOP["Zero all velocity, return"]
    HALTED -- No --> TERRAIN["Calculate terrain multiplier\n• Street: 1.5× speed\n• Ore: 0.7× speed (non-harvester)\n• Ambulance on street: 6×"]

    TERRAIN --> PATH_FOLLOW{"Has path\nwaypoints?"}
    PATH_FOLLOW -- Yes --> WAYPOINT["Get next waypoint path[0]\nCalculate direction & distance"]
    PATH_FOLLOW -- No --> IDLE["Set targetVelocity = 0"]

    WAYPOINT --> REACHED{"distance < waypointReachDistance\n(TILE_SIZE/3 ≈ 10.7px)?"}
    REACHED -- Yes --> SHIFT["path.shift()\nAdvance to next waypoint\nCheck for mines"]
    REACHED -- No --> SET_VEL["Set targetVelocity toward waypoint\nat effectiveMaxSpeed"]
    SHIFT --> MORE{"More waypoints?"}
    MORE -- No --> IDLE
    MORE -- Yes --> SET_VEL

    SET_VEL --> ACCEL{"canAccelerate\nAND not rotating?"}
    ACCEL -- Yes --> AVOIDANCE["calculateCollisionAvoidance()\n→ Pre-emptive obstacle forces"]
    ACCEL -- No --> DECEL["Apply DECELERATION"]

    AVOIDANCE --> APPLY_PHYSICS["velocity += (targetVel + avoidance - velocity) × accelRate\n(Lerp-based smoothing)"]
    DECEL --> APPLY_PHYSICS

    APPLY_PHYSICS --> MOVE["unit.x += velocity.x\nunit.y += velocity.y"]
    MOVE --> COLLISION["checkUnitCollision()\n→ terrain, building, unit, wreck"]

    COLLISION --> HIT{"Collision\ndetected?"}
    HIT -- Yes --> REVERT["Revert position to prev\nApply collision response\n(type-specific)"]
    HIT -- No --> UPDATE_TILE["Update tileX/tileY\nUpdate occupancy map"]

    REVERT --> UPDATE_TILE
    UPDATE_TILE --> STUCK["handleStuckUnit()\n[See Section 8]"]

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style COLLISION fill:#4a1a1a,stroke:#a44,color:#fff
    style AVOIDANCE fill:#1a4a3a,stroke:#4a8,color:#fff
```

### Key Physics Parameters

| Parameter | Value | Effect |
|---|---|---|
| `ACCELERATION` | 0.15 | Lerp rate toward target velocity |
| `DECELERATION` | 0.20 | Lerp rate toward zero when braking |
| `MAX_SPEED` | 0.9 px/frame | Base movement speed |
| `MIN_SPEED` | 0.05 px/frame | Below this → considered stopped |
| `ROTATION_SPEED` | 0.12 rad/frame | Body rotation rate |
| `MIN_UNIT_DISTANCE` | 24 px | Minimum separation between units |
| `FORCE_FIELD_RADIUS` | 36 px | Avoidance force detection range |
| `FORCE_FIELD_STRENGTH` | 2.5 | Avoidance push magnitude |

---

## 6. Collision Detection & Response

Located in `src/game/movementCollision.js`.

### Detection Flow

```mermaid
flowchart TD
    START["checkUnitCollision(unit)"] --> TERRAIN{"Current tile is\nwater/rock/building?"}
    TERRAIN -- Yes --> TERRAIN_COL["Return: terrain/building collision"]
    TERRAIN -- No --> UNITS["Query spatialQuadtree\nfor nearby units within\nFORCE_FIELD_RADIUS (36px)"]

    UNITS --> FOREACH["For each nearby unit"]
    FOREACH --> SAME_LAYER{"Same layer?\n(both ground or both air)"}
    SAME_LAYER -- No --> SKIP["Skip"]
    SAME_LAYER -- Yes --> DIST{"distance <\nMIN_UNIT_DISTANCE (24px)?"}
    DIST -- No --> SKIP
    DIST -- Yes --> DOT{"Moving toward\neach other?\n(dot product < 0)"}
    DOT -- No --> SKIP
    DOT -- Yes --> UNIT_COL["Apply separation forces\nReturn: unit collision"]

    UNIT_COL --> WRECKS
    SKIP --> WRECKS["Check wrecks\n(similar logic)"]
    WRECKS --> NONE["Return: no collision"]

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style TERRAIN_COL fill:#4a1a1a,stroke:#a44,color:#fff
    style UNIT_COL fill:#4a3a1a,stroke:#a84,color:#fff
```

### Response Types

| Collision Type | Response |
|---|---|
| **Terrain/Bounds** | Revert position, apply bounce impulse, try slide movement |
| **Building** | Revert position, tanker trucks may detonate, otherwise slide |
| **Unit** | Revert position, push both units apart (safe separation), velocity damping |
| **Wreck** | Push wreck away with impulse, unit gets recoil |

### Slide Movement (`trySlideMovement`)

When direct movement is blocked, the system tries:
1. Move only on X-axis (zero Y velocity)
2. Move only on Y-axis (zero X velocity)
3. If both fail, zero all velocity

---

## 7. Collision Avoidance (Pre-emptive)

Located in `src/game/movementCollision.js:calculateCollisionAvoidance`.

This runs **before** the position update, adding avoidance forces to steer away from obstacles.

```mermaid
flowchart TD
    START["calculateCollisionAvoidance(unit)"] --> NEARBY["Query spatialQuadtree\nfor ground units within\nFORCE_FIELD_RADIUS (36px)"]

    NEARBY --> FOREACH["For each nearby unit"]
    FOREACH --> FORCE["Calculate repulsion force:\nstrength = FORCE_FIELD_STRENGTH ×\n(1 - dist/radius)^FALLOFF\nDirection: away from other unit"]

    FORCE --> LOOKAHEAD["Lookahead probes:\nCheck 3 points ahead\nat 0.5, 1.0, 1.5 × TILE_SIZE"]
    LOOKAHEAD --> BLOCKED{"Probe hits blocked\ntile or occupied?"}
    BLOCKED -- Yes --> PUSH_AWAY["Add force pushing away\nfrom blocked tile center\nWeighted by distance"]
    BLOCKED -- No --> COMBINE

    PUSH_AWAY --> COMBINE["Sum all avoidance forces\nReturn {x, y}"]

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style FORCE fill:#1a4a3a,stroke:#4a8,color:#fff
```

### How Avoidance Causes Deviation

The avoidance forces push units laterally, which can:
1. Deflect units off their intended straight-line path between waypoints
2. Cause units to orbit around obstacles instead of finding a clean path through
3. When combined with the waypoint-reaching check (`TILE_SIZE/3 ≈ 10.7px`), the unit may "wobble" around a waypoint as avoidance forces repeatedly push it away then back

---

## 8. Stuck Detection & Dodging

Located in `src/game/movementStuck.js`.

```mermaid
flowchart TD
    START["handleStuckUnit(unit)"] --> SKIP{"Player unit with\nrecent path (<2s)?"}
    SKIP -- Yes --> DONE["Return — don't interfere"]
    SKIP -- No --> INTERVAL{"STUCK_CHECK_INTERVAL\n(500ms) elapsed?"}

    INTERVAL -- No --> ROTATING{"Currently\nrotating?"}
    ROTATING -- Yes --> DO_ROTATE["Continue rotation\nin place"]
    ROTATING -- No --> DONE

    INTERVAL -- Yes --> MOVED{"Moved < TILE_SIZE/4\nwith active path?"}
    MOVED -- No --> RESET["Reset stuck counters"]
    MOVED -- Yes --> ACCUMULATE["stuckTime += timeDelta"]

    ACCUMULATE --> THRESHOLD{"stuckTime >\nSTUCK_THRESHOLD (500ms)?"}
    THRESHOLD -- No --> DONE
    THRESHOLD -- Yes --> COOLDOWN{"STUCK_HANDLING_COOLDOWN\n(1250ms) elapsed?"}
    COOLDOWN -- No --> DONE
    COOLDOWN -- Yes --> RANDOM["tryRandomStuckMovement()\n90° turn, 1-2 tiles"]

    RANDOM --> WORKED{"Found valid\ndodge position?"}
    WORKED -- Yes --> DODGE["Set isDodging = true\nSave originalPath\nSet new short path"]
    WORKED -- No --> ROTATE_TRY["rotateUnitInPlace()\nTry up to 3 rotations"]

    ROTATE_TRY --> ROT_FAIL{"rotationAttempts ≥ 3?"}
    ROT_FAIL -- Yes --> CLEAR_PATH["Clear path entirely\nReset all counters"]
    ROT_FAIL -- No --> DONE

    style START fill:#2a2a4a,stroke:#66a,color:#fff
    style DODGE fill:#4a3a1a,stroke:#a84,color:#fff
    style CLEAR_PATH fill:#4a1a1a,stroke:#a44,color:#fff
```

### Dodge Recovery

When dodging completes (dodge path consumed), the system restores `originalPath`. However:
- The original path was computed from a **previous position**, not the new post-dodge position
- The unit may now be further from the path it's being restored to
- The path waypoints may now be behind the unit

---

## 9. Steering Behaviours (Boids)

Located in `src/game/steeringBehaviors.js`. These are defined but **not actively integrated** into the main movement loop in `updateUnitPosition()`. The `calculateSteeringForces()` function exists but is not called from the core movement pipeline. The collision avoidance in `movementCollision.js` handles the practical separation.

---

## 10. Flow Fields

Located in `src/game/flowField.js`. Generated on-demand for chokepoints. The `calculateFlowFieldSteering()` is part of the steering behaviours module, which as noted above is not actively called in the movement pipeline.

---

## 11. Key Configuration Constants

| Constant | Value | File | Impact |
|---|---|---|---|
| `PATH_CALC_INTERVAL` | 2000 ms | config.js | How often global pathfinding batch runs |
| `ATTACK_PATH_CALC_INTERVAL` | 3000 ms | config.js | How often attack-chase paths recalculate |
| `MAX_PATHS_PER_CYCLE` | 5 | config.js | Max paths calculated per global batch |
| `PATHFINDING_THRESHOLD` | 10 tiles | config.js | Distance threshold for occupancy-aware pathfinding |
| `PATHFINDING_LIMIT` | 1000 nodes | config.js | A* search node budget before returning partial path |
| `MOVE_TARGET_REACHED_THRESHOLD` | 1.5 tiles | config.js | Distance to consider target "reached" |
| `PATH_CACHE_TTL` | 4000 ms | config.js | Path cache expiry |
| `STUCK_CHECK_INTERVAL` | 500 ms | config.js | How often stuck detection checks |
| `STUCK_THRESHOLD` | 500 ms | config.js | Time before considering unit stuck |
| `STUCK_HANDLING_COOLDOWN` | 1250 ms | config.js | Cooldown between stuck recovery attempts |
| `TILE_SIZE` | 32 px | config.js | Base tile size |

---

## 12. ROOT CAUSE: Why Units Don't Reach Targets Directly

### Issue Summary

Units frequently take indirect routes, pausing, wobbling, or stalling before eventually reaching their targets. There are **multiple contributing factors**:

### Factor 1: Path Draining Before Recalculation (THE MAIN BUG)

```mermaid
sequenceDiagram
    participant User as Player Click
    participant GPath as updateGlobalPathfinding
    participant Unit as Unit Movement
    participant Physics as Position Update

    User->>GPath: Set moveTarget (far away, e.g. 30 tiles)
    GPath->>Unit: Compute path WITHOUT occupancy (distance > 10)
    Note over Unit: Path = [wp1, wp2, ..., wp15] (long path)
    
    loop Every frame
        Unit->>Physics: Follow path[0] waypoint
        Physics->>Unit: Advance position, shift consumed waypoints
    end
    
    Note over Unit: Path shrinks: [wp12, wp13, wp14, wp15]
    Note over Unit: Distance now ≤ 10 tiles BUT path NOT empty
    
    GPath-->>GPath: Check: path.length === 0? NO → SKIP recalc
    
    Note over Unit: ⚠️ Unit follows old non-occupancy path
    Note over Unit: Encounters occupied tiles near destination
    Note over Unit: Collision avoidance pushes unit sideways
    Note over Unit: Unit wobbles around obstacles
    
    Note over Unit: Eventually path empties
    GPath->>Unit: NOW recalculate WITH occupancy
    Note over Unit: But unit may be in a bad position
```

**The core problem**: `updateGlobalPathfinding` only recalculates when `path.length === 0`. A unit with a stale long-distance path (computed without occupancy awareness) continues to follow it even after entering the "close range" zone (< 10 tiles). The old waypoints don't account for other units, buildings, or dynamic obstacles near the destination.

### Factor 2: Partial Paths from A* Budget Limit

When `PATHFINDING_LIMIT = 1000` is exceeded, A* returns the path to the best node found so far — which may be **nowhere near the destination**. The unit follows this partial path to its end, then waits for the next recalculation cycle (up to 2000ms later) to get a new partial or full path.

### Factor 3: Avoidance Force Deflection

The pre-emptive `calculateCollisionAvoidance()` adds lateral forces that push units away from nearby units and obstacles. These forces are applied every frame and can:
- Push a unit off its waypoint approach vector
- Create oscillation as the unit is simultaneously attracted to the waypoint and repelled by nearby units
- Cause the unit to take a wider arc than necessary

### Factor 4: Rotation-Before-Movement Gating

Units must rotate to face each waypoint before accelerating. On a path with many short segments (common in non-smoothed paths), the unit spends significant time rotating → accelerating → decelerating → rotating for the next segment.

### Factor 5: Dodge/Stuck Recovery Path Staleness

When stuck detection triggers a dodge, the unit saves its current path as `originalPath`. After dodging, it restores this saved path — but the saved waypoints may now be behind the unit or in the wrong direction relative to the post-dodge position.

### Factor 6: Attack-Chase Path Oscillation

For units chasing a target, `ATTACK_PATH_CALC_INTERVAL = 3000ms` means the path to a moving target can be 3 seconds stale. Combined with the distance-increasing check, this can lead to the unit running past the target, realizing distance is increasing, then getting a new path in the opposite direction.

---

## 13. Fix Applied

### Fix: Proactive Path Recalculation When Entering Close Range

The primary fix targets **Factor 1** — the main bug where units continue following stale long-distance paths after entering the occupancy-aware zone. Instead of only recalculating when the path is empty, we now also recalculate when:

1. The unit is within `PATHFINDING_THRESHOLD` (10 tiles) of its destination
2. The current path was computed **without** occupancy awareness (long-distance mode)
3. There are still significant waypoints remaining

This ensures that when a unit transitions from "far away" to "close range", it immediately gets a fresh occupancy-aware path that properly accounts for dynamic obstacles near the destination.

Additionally, we trim stale waypoints from restored dodge paths — when a path is restored after dodging, we drop any waypoints that are behind the unit's current position, preventing the unit from backtracking.

### Changes Made

**`src/game/pathfinding.js`**: Added logic to detect when a unit's existing path was computed without occupancy awareness but the unit is now within the close-range threshold. Such units are included in the recalculation batch even if their path is not yet empty. A `pathComputedWithOccupancy` flag is tracked on each unit.

**`src/game/unitMovement.js`**: After restoring a saved path from a dodge, prune waypoints that are behind the unit's current position to avoid backtracking.
