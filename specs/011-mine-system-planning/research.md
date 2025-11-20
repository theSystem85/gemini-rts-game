# Research – Spec 011 (Land Mine System)

## Asset Mapping
- **Decision:** Use existing sprites `public/images/map/units/mine_layer_map.webp`, `public/images/map/units/minesweeper_map.webp`, and sidebar icons `public/images/sidebar/mine_layer_sidebar.webp`, `public/images/sidebar/mine_sweeper_sidebar.webp`; skull overlay can reuse `public/images/map/icons/skull_light_gray.webp` placeholder or a new canvas-drawn glyph if missing.
- **Rationale:** Directory listings confirm the Mine Layer unit sprite is named `mine_layer_map.webp` and the sweeper is `minesweeper_map.webp` (no underscore). Sidebar assets mirror those names. Reusing pre-existing assets avoids new art work, keeps cache keys consistent, and satisfies Rule 5/6 from `AGENTS.md`.
- **Alternatives considered:** Procedural recolors or temporary rectangles were dismissed because assets already exist and spec demands them.

## Movement & Resource Constants
- **Decision:** Derive Mine Layer speed from tanker truck constants (`UNIT_PROPERTIES.tankerTruck.speed = 0.66` in `src/config.js`), yielding normal speed `0.528` (0.66 × 0.8) and deploy-mode speed `0.264`. Copy Ammunition Truck gas profile (`UNIT_GAS_PROPERTIES.tankerTruck`) for both Mine Layer movement and Mine Sweeper’s "tank-like" consumption (reuse tank_v1 entry). Sweeper base speed = `UNIT_PROPERTIES.tank_v1.speed × 0.7 = 0.231`; sweeping speed = `0.099` (30% of tank speed).
- **Rationale:** Config centralizes unit tuning. Reusing existing constants keeps adjustments runtime-configurable and ensures boosters like street multipliers remain compatible.
- **Alternatives considered:** Hardcoding raw numbers or adding duplicated constants would violate Constitution Principle V (configuration-driven design) and complicate balancing.

## Mine Data & Occupancy Integration
- **Decision:** Represent mines as dedicated entities under `gameState.mines` with `{id, owner, tileX, tileY, health, armedAt, active}`. Extend `gameState.occupancyMap` logic to treat mines as blockers only when querying for friendly pathfinding: store ownership metadata alongside counts (`occupancyMapFriendly[y][x][playerId]`). Friendly units consult both arrays; enemy units consult regular occupancy only.
- **Rationale:** Current occupancy map in `src/units.js` stores aggregate counts only; modifying the structure risks breaking numerous consumers. A parallel friendly-block map preserves backward compatibility while enabling spec rule (“fills occupancy map but only for friendly parties”). Mines need persistent tracking for save/load, damage, chain reactions, and indicator rendering.
- **Alternatives considered:** Embedding mines directly into occupancy counts was rejected because the map cannot encode ownership, and subtracting for enemy traversal would introduce race conditions and degrade readability.

## Command & Path Planning Hooks
- **Decision:** Extend `commandQueue` (`src/game/commandQueue.js`) with new action types: `deployMine`, `deployMineArea`, `sweepArea`, `sweepFreeform`. Reuse Path Planning Feature (PPF) visuals through `PathPlanningRenderer` by serializing commands into the existing `unit.commandQueue` entries so they inherit yellow triangle numbering and routing lines. Input handling will leverage `attackGroupHandler`-style drag detection plus `gameState.altKeyDown` / ctrl modifiers to stack commands.
- **Rationale:** The queue/renderer stack already supplies UI feedback, numbering, and multi-command chaining. Hooking into the same pipeline guarantees consistency, avoids duplicating selection overlays, and ensures `Shift`-queue semantics (“chain-of-commands mode”) remain intact.
- **Alternatives considered:** A bespoke overlay or per-unit queue would have required new rendering layers and risked desynchronizing animations from `PathPlanningRenderer`. Repurposing AGF’s red drag box wasn’t suitable because mining/sweeping must not conflict with combat drag logic.

## Visual Indicators & Particles
- **Decision:** Render skull overlays and orange sweep previews inside `src/rendering/effectsRenderer.js` / `pathPlanningRenderer.js` adjunct modules to keep separation of concerns. Mines will push entries into a `gameState.mineIndicators` array consumed by a new `renderMineIndicators` helper. Mine Sweeper dust uses the existing smoke particle infrastructure (`gameState.smokeParticles`, `emitSmokeParticles` from `src/utils/smokeUtils.js`) but with tan/gray palette offsets and forward offset (unit.direction) to appear in front.
- **Rationale:** `effectsRenderer` already batches overlays like bullets, smoke, and Tesla arcs, making it ideal for additional particle effects without cluttering `unitRenderer`. Reusing `emitSmokeParticles` ensures pooling and performance considerations (object reuse) stay intact.
- **Alternatives considered:** Creating a brand-new particle system for dust would duplicate emitter logic and require new cleanup paths; painting skulls in `mapRenderer` would force z-index juggling beneath HUD layers.

## Ammo & Refuel Integration
- **Decision:** Reuse ammunition HUD bar for Mine Layer payload by storing `unit.mineCapacity` / `unit.remainingMines` fields and teaching `uiRenderer` to map them onto the left ammo bar whenever `unit.mineCapacity` exists (even if `maxAmmunition` is undefined). Tapping into `updateAmmunitionSystem` allows ammo trucks/factories to refill the Mine Layer by treating mines as ammo rounds (20 capacity) but skipping `maxAmmunition` so other units stay unaffected.
- **Rationale:** `uiRenderer` already shows ammo/fuel bars for units flagged with ammo properties. Introducing special-case logic keeps the UI consistent and leverages existing timers/resupply durations from `AMMO_RESUPPLY_TIME`. Ammunition factories/trucks are the canonical refuel path per spec.
- **Alternatives considered:** Adding a fourth HUD bar or separate reload mechanic was rejected to avoid UI clutter and redundant logic.

## AI Deployment & Countermeasures
- **Decision:** Integrate Mine Layer production logic inside `src/ai/enemyAIPlayer.js` after prerequisites (workshop + ammunitionFactory + ammo truck) by extending the existing build pipeline that already checks `UNIT_COSTS`. Use `enemyStrategies` routes to choose deployment targets (ore fields via `enemyBuilding.js` ore locators, roads from `map_analyse`). For Mine Sweeper response, hook into casualty tracking (enemy AI already monitors destroyed units) to enqueue sweeper builds when mines cause losses, then use a new behavior module to sweep flagged tiles.
- **Rationale:** Enemy AI uses centralized production gating and specialized behavior functions. Leveraging those keeps AI parity with player systems and ensures prerequisites/power checks are reused.
- **Alternatives considered:** Hardcoding mine placement in mission scripts or forcing sweeper spawns outside the build queue would violate AI parity and break save/load symmetry.

## Chain Reaction Damage Handling
- **Decision:** Process mine explosions through the existing explosion update pipeline (`gameState.explosions`, `effectsRenderer.renderExplosions`) for visuals while applying damage via a dedicated `applyMineExplosion` utility that reuses `game/unitCombat.js` damage helpers. Neighbor damage uses axial offsets `[{x:0,y:0},{x:1,y:0},...]` with friendly-fire neutrality. Chain reactions check contiguous mines in `gameState.mines` and recursively trigger when neighbor damage ≥ mine health.
- **Rationale:** Keeping explosion visuals and damage dispatch within established combat modules ensures consistent knockback, XP gain, and notification hooks. Recursion limited to orthogonal neighbors prevents infinite loops yet satisfies spec for line-based chain reactions.
- **Alternatives considered:** Simulating explosions as buildings or bullets introduces unnecessary pathfinding collisions and would complicate damage credit.
