# Quickstart Scenarios – Land Mine System

These flows let any contributor verify the Mine Layer + Mine Sweeper feature set without reading the full spec. Work through them in order using a fresh skirmish on the default map unless noted otherwise. Reload the page between scenarios so the state is clean unless the steps explicitly chain together.

---

## Scenario QS-1: Single-Tile Mine Deployment (US1)

**Goal**: Confirm Ctrl+Click deployment, 4s stop time, arming delay, and mine HUD updates.

1. Build the required structures: `vehicleFactory`, `vehicleWorkshop`, and `ammunitionFactory`.
2. Queue one `mineLayer` in the vehicle factory; wait until it spawns and select it.
3. Hold Ctrl and left-click a grass tile ~5 tiles in front of the truck.
4. Observe that the PPF queue shows a red marker with index `1` at the clicked tile.
5. Verify the Mine Layer drives to the tile, stops for roughly 4 seconds, and the ammo bar (left HUD) drops from 20 → 19.
6. Once the truck rolls off the tile, wait ~4 seconds: the skull overlay should pulse yellow until the arming delay expires, then stay at 70% opacity.
7. Drive a friendly tank near the mine; it should path around the tile. Lure an enemy unit onto the tile to confirm the 90/50 damage pattern and chain reaction behavior.

**Expected Outcome**: Mine arms only after the truck leaves, HUD reflects new payload, friendly units avoid the tile, and explosions trigger visual effects.

---

## Scenario QS-2: Area Checkerboard Deployment with Auto-Refill (US2)

**Goal**: Validate drag-rectangle planning, checkerboard preview, auto-refill, and resume after reload.

1. Keep the previously built infrastructure; ensure at least one ammo source exists (ammo truck or ammunition factory ready to resupply).
2. Select a Mine Layer with a full payload (refill at the factory if needed).
3. Click-drag a rectangle (~6×6 tiles) without holding Ctrl. Release to enqueue the checkerboard plan.
4. Confirm the orange PPF lines show each waypoint with ordered indices and the HUD payload bar decrements per deployment.
5. When the payload drops to 0, the Mine Layer should automatically path to the nearest ammo source, pause 7s to reload to 20 mines, then resume the remaining queued deployments.
6. Toggle the mine overlay (if implemented) or move the camera to ensure skull indicators persist until mines detonate.

**Expected Outcome**: Checkerboard overlay renders during drag, the truck slows to deploy speed while working, auto-refill triggers, and the command queue resumes exactly where it left off.

---

## Scenario QS-3: Mine Sweeper Rectangle Sweep (US4)

**Goal**: Ensure serpentine path generation, dust FX, sweeping speed, and immunity while clearing mines.

1. Build and deploy a Mine Sweeper (vehicle factory + workshop).
2. Lay a small minefield (at least 6 armed mines) using Scenario QS-1 instructions.
3. Select the Mine Sweeper and drag a rectangle covering the mined area (no Ctrl).
4. Watch for yellow PPF markers tracing a zig-zag path that covers every tile inside the rectangle.
5. The Sweeper should slow to 30% speed, emit dust ahead of the unit, and detonate each mine safely (no HP loss) as it reaches the tiles.
6. After the path completes, confirm `unit.sweeping` toggles off and the speed returns to 70% of tank speed.

**Expected Outcome**: PPF shows the entire serpentine route, dust particles spawn during sweeping, mines trigger explosions but do not damage the Sweeper, and the command completes only after all tiles are processed.

---

## Scenario QS-4: Ctrl-Paint Freeform Sweep with Resume (US4 + PPF)

**Goal**: Validate Ctrl-drag painting, orange overlay previews, queue chaining, and mine immunity during overlapping paths.

1. Select a Mine Sweeper and hold Ctrl while painting a complex shape (e.g., an L-shaped corridor) across mined terrain.
2. Release the mouse to convert the painted tiles into a sweep command; PPF numbers should reflect the order of painted tiles.
3. While the first sweep runs, queue a second sweep using Shift+Ctrl+drag; ensure the new command chains after the current path.
4. Force a pause mid-sweep by issuing a manual move. Re-select the queued command to verify the Sweeper can resume at the next tile without redoing completed segments.

**Expected Outcome**: Orange overlay mirrors the painted area, the sweep command stores the tile list, chained commands respect order, and breaking/resuming does not re-trigger cleared mines.

---

## Scenario QS-5: Save/Load + AI Interplay (US3–US6)

**Goal**: Confirm serialization, AI mine deployment, and sweeper responses.

1. Deploy several mines and queue at least one sweep command.
2. Save the game, reload it, and verify mines, payload counts, command queues, and preview overlays return exactly as before.
3. Let the enemy build the required tech tree; observe AI mine-laying near ore fields and approach roads.
4. Destroy several AI units via mines; ensure the AI responds by producing Mine Sweepers that clear the dangerous area.

**Expected Outcome**: Save/load preserves all mine-related state, AI fulfills deployment logic, and sweeper responses trigger once AI units suffer mine losses.
