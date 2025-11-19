# Data Model – Land Mine System

This file captures the additional entities and fields required to support mines, Mine Layers, and Mine Sweepers. Values marked **(persisted)** must be saved via `saveGame.js`/`loadGame.js` so mid-mission progress survives reloads.

## Mine Entity (`gameState.mines[]`)

| Field | Type | Description |
| --- | --- | --- |
| `id` **(persisted)** | string | Unique identifier from `getUniqueId()` used for serialization and debugging. |
| `tileX`, `tileY` **(persisted)** | integer | Map tile coordinates of the mine. Tiles are exclusive: only one mine per tile. |
| `owner` **(persisted)** | string | Player/party that deployed the mine. Determines who avoids it. |
| `health`, `maxHealth` **(persisted)** | number | Remaining HP (10 baseline). Mines destroyed by splash damage trigger chain reactions. |
| `deployTime` **(persisted)** | number | `performance.now()` timestamp recorded at creation; used to recompute arm timers after reload. |
| `armedAt` **(persisted)** | number | Timestamp when the mine becomes active (`deployTime + MINE_ARM_DELAY`). |
| `active` **(persisted)** | boolean | `false` until `performance.now() >= armedAt`. Blocks friendly pathing only while active. |

**Derived data**: Rendering uses `gameState.mines` directly (skull overlays); occupancy/pathfinding treat tiles as blocked for the owning player once the mine is active.

**Explosion radius**: Mine detonations now examine every tile within a 2-tile radius (`MINE_EXPLOSION_RADIUS`) and apply damage that fades linearly from 100% on the origin tile down to 0% on the boundary. Units, buildings, and adjacent mines all receive scaled damage depending on their distance to the blast center, so overlapping mines or clustered units feel the same explosive field irrespective of whether they are orthogonal or diagonal neighbors.

**Friendly avoidance lookup**: `mineSystem` maintains a tile-keyed lookup map rebuilt after loads so helpers such as `isFriendlyMineBlocking(tileX, tileY, owner)` can run in O(1). Pathfinding, movement, and collision checks call this helper to block only the owning party while keeping enemy routes passable (so they can intentionally drive through and trigger detonations).

- All modules that call `findPath` / `getCachedPath` must pass `{ unitOwner: <ownerId> }` (or set `start.owner`) so the helper knows whose mines to consider. This includes AI strategies, logistic scripts (harvesters, tankers, ammo trucks), and ambulance/hospital flows. Tracking this requirement here keeps the implementation work visible while propagation is still in progress.
  - Movement/collision/retreat systems must also trigger mine detonation whenever a tile with an armed mine is entered by a non-owner so enemies provoke explosions, while friendly units skip damage and respect the kinetic safe path checks.

## Mine Layer Unit Extensions

Existing unit objects gain the following fields when `unit.type === 'mineLayer'`:

| Field | Type | Description |
| --- | --- | --- |
| `mineCapacity` | number | Max payload (default 20). Drives HUD bar scale. |
| `remainingMines` **(persisted)** | number | Current payload. Decrement on every successful deployment; refill resets to `mineCapacity`. |
| `deployingMine` **(persisted)** | boolean | `true` while the unit is in its 4s deployment stop. Prevents command queue from advancing. |
| `deployStartTime` **(persisted)** | number or `null` | Timestamp when the current deployment began. Needed to resume the 4s timer if the game reloads mid-action. |
| `deployTargetX`, `deployTargetY` **(persisted)** | integer | Tile coordinates currently being mined. |
| `deploymentCompleted` | boolean | One-shot flag raised after a deployment so the command queue knows to pop the action. Can be recomputed on load, so no persistence needed. |
| `refillTarget` **(persisted)** | object or `null` | Description of the ammo source the unit is pathing toward (`{ type: 'building'&#124;'unit', id }`). |

## Mine Sweeper Unit Extensions

For `unit.type === 'mineSweeper'`:

| Field | Type | Description |
| --- | --- | --- |
| `sweeping` **(persisted)** | boolean | Indicates the unit is executing a sweep command and should be immune to mine damage. |
| `normalSpeed`, `sweepingSpeed` | number | Cached values from config; not persisted. |
| `sweepPathId` **(persisted)** | string or `null` | Identifier for the current sweep command, allowing the command queue to resume after reloads. |
| `lastDustTime` | number | Tracks dust spawn cadence; derived, no persistence. |

## Command Queue Actions

Two new action payloads live in each unit’s `commandQueue`/`currentCommand`:

### `deployMine`

```json
{
  "type": "deployMine",
  "x": <tileX>,
  "y": <tileY>
}
```

- Processed by Mine Layers only.
- Commands stay in the queue until `deploymentCompleted` flips true.

### `sweepArea`

```json
{
  "type": "sweepArea",
  "path": [ { "x": <tileX>, "y": <tileY> }, ... ],
  "cursor": 0
}
```

- `path` stores the ordered list of tiles generated by either the rectangle zig-zag builder or the Ctrl-paint freeform pass.
- `cursor` **(persisted)** tracks the next tile index to visit so we can resume mid-path after saving.

## Preview + Painting State (`gameState` additions)

| Field | Type | Description |
| --- | --- | --- |
| `mineDeploymentPreview` | `{ startX, startY, endX, endY }` | Active drag rectangle for checkerboard planning. Ephemeral. |
| `sweepAreaPreview` | `{ startX, startY, endX, endY }` | Active rectangle sweep preview. Ephemeral. |
| `mineFreeformPaint` **(persisted)** | `Set<string>` or serialized array | Holds painted tiles while Ctrl-dragging for freeform sweeps. Persisted if a paint session is in progress during save. |

## Save/Load Responsibilities

1. **`gameState`**: Already owns `mines`, `mineDeploymentPreview`, `sweepAreaPreview`, and dust particles. Update the default state so new fields initialize predictably.
2. **`saveGame.js` / `loadGame.js`**:
   - Serialize `gameState.mines` with all persisted fields listed above.
   - Persist `mineFreeformPaint`, Unit `remainingMines`, deployment/timer fields, Sweeper `sweeping` state, `sweepArea` command cursors, and any queued commands referencing mines.
3. **`savePlayerBuildPatterns.js` / `savePlayerBuildPatterns` consumer**: Only needs awareness of new building/unit unlock side effects; no schema change required, but document that mine-related unlocks should append to the same history array so analytics remain intact.

With this data model solidified, subsequent tasks (persistence wiring, owner-aware avoidance, PPF rendering) have an explicit contract to target.

## Cheat Command Support

- Add a `mine [party]` cheat command to the existing `/cheatSystem.js` console. The command should deploy an armed mine at the current cursor tile, defaulting to the human player's party if no argument is provided, and enforce the same tile validity rules as regular deployments so it is useful for testing owner-aware mine behavior without breaking the data model.
- Introduce a companion `mines [WxH][gG] [party]` (or direct `WxHgG`) command that drops a rectangular pattern of mines relative to the cursor. The `g` suffix defines the spacing between mines, so `mines 2x3g1` creates a 2×3 grid with one empty tile gap, while `mines 3x1` (shorthand for `3x1g0`) spawns three contiguous mines. This command should reuse the same validations, notify success/skipped tiles, and allow an optional party alias so the field can be placed for any owner during testing.
