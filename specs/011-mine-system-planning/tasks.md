# Tasks: Land Mine System (Mine Layer + Mine Sweeper)

**Input**: Design documents from `/specs/011-mine-system-planning/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Manual playtesting per quickstart scenarios (no automated test suite requested)

**Organization**: Tasks are grouped by user story to keep each story independently deliverable and testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure feature documentation artifacts exist so downstream contributors share the same context.

- [ ] T001 Author quickstart scenarios for single-tile and area mining flows in `specs/011-mine-system-planning/quickstart.md`
- [ ] T002 Capture Mine Layer, Mine Sweeper, and Mine entity schemas in `specs/011-mine-system-planning/data-model.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that every user story depends on.

- [ ] T003 Add mine-specific constants (damage, arm delay, capacity, speed modifiers) and unit placeholders to `src/config.js`
- [ ] T004 Persist mine state, Mine Layer payload, and sweeper flags across saves by updating `src/gameState.js`, `src/saveGame.js`, and `src/savePlayerBuildPatterns.js`
- [ ] T005 Implement `src/game/mineSystem.js` with creation, storage, arming timer, and serialization helpers for mines
- [ ] T006 Extend occupancy/pathfinding logic in `src/units.js` and `src/game/pathfinding.js` so friendly units treat owned mines as blocked tiles while enemies do not
- [ ] T007 Wire global update loop (`src/updateGame.js`) to tick the mine system and upcoming Mine Layer/Sweeper behavior modules

---

## Phase 3: User Story 1 – Directed Mine Deployment (Priority: P0) 🎯 MVP

**Goal**: Enable Ctrl + Click single-tile deployments that chain via PPF and respect deployment timing.

**Independent Test**: With a Mine Layer selected, Ctrl + Click multiple tiles. Observe queue numbers, 4-second stop per tile, and arming delay once the truck moves away.

### Implementation

- [ ] T008 [US1] Extend `src/game/commandQueue.js` to support `deployMine` actions, enqueueing coordinates and advancing after completion
- [ ] T009 [US1] Create Mine Layer behavior module in `src/game/mineLayerBehavior.js` that handles 4s deployment pauses, tile centering, and arming hand-off to `mineSystem`
- [ ] T010 [US1] Add Ctrl + Left Click handling plus Shift-queue support in `src/input/mouseHandler.js` delegating to a new `src/input/mineInputHandler.js`
- [ ] T011 [US1] Update `src/rendering/pathPlanningRenderer.js` so PPF triangles/indices render for `deployMine` actions

---

## Phase 4: User Story 2 – Area Minefields (Priority: P0)

**Goal**: Drag rectangles for checkerboard plans, auto-refill when empty, and slow Mine Layer during deployments.

**Independent Test**: Drag a rectangle with Mine Layer selected; verify checkerboard preview, queued deployments, speed reduction, auto-refill + resume when payload hits zero.

### Implementation

- [ ] T012 [US2] Implement checkerboard tile generation + preview builders in `src/input/mineInputHandler.js` and expose area metadata via `gameState`
- [ ] T013 [US2] Enhance `src/input/mouseHandler.js` drag logic to capture rectangles, differentiate Ctrl vs normal drags, and push area deploy commands
- [ ] T014 [US2] Add movement speed modulation and deploy-mode enforcement to `src/game/mineLayerBehavior.js`
- [ ] T015 [US2] Implement auto-refill routing (ammo truck/factory search) and resume logic inside `src/game/mineLayerBehavior.js` and `src/game/ammunitionSystem.js`
- [ ] T016 [US2] Render checkerboard previews in `src/rendering/mineRenderer.js` using data from `gameState.mineDeploymentPreview`

---

## Phase 5: User Story 3 – Mine Mechanics & Indicators (Priority: P0)

**Goal**: Fully functional mines with HP, chain reactions, skull overlays, friendly blocking, and payload explosions on truck death.

**Independent Test**: Deploy mines, drive friendly units over them (should avoid), force detonation via enemy units, observe skull overlays, chain reactions, and payload blasts when Mine Layer dies.

### Implementation

- [ ] T017 [US3] Finalize detonation + damage logic (90/50 pattern, ownership) in `src/game/mineSystem.js`
- [ ] T018 [US3] Hook mine avoidance into movement/formation code inside `src/game/unitMovement.js` and `src/game/unitCombat.js`
- [ ] T019 [US3] Render skull overlays and active mine indicators via `src/rendering/mineRenderer.js` and call from `src/rendering/renderer.js`
- [ ] T020 [US3] Apply remaining payload explosion on Mine Layer destruction in `src/game/gameStateManager.js` (cleanupDestroyedUnits) using helper from `mineSystem`
- [ ] T021 [US3] Ensure save/load captures mine HP and state transitions in `src/saveGame.js` and `src/loadGame.js`

---

## Phase 6: User Story 4 – Mine Sweeper Tank Operations (Priority: P0)

**Goal**: Sweeper tank executes zig-zag or freeform sweeps with dust animation and mine immunity while sweeping.

**Independent Test**: Build a Mine Sweeper, drag rectangle (and Ctrl-paint) to command sweeps; observe serpentine PPF, dust particles, reduced speed while sweeping, and no damage when detonating mines.

### Implementation

- [ ] T022 [US4] Define Mine Sweeper behavior module in `src/game/mineSweeperBehavior.js` with speed toggles, sweep state, and dust emission hooks
- [ ] T023 [US4] Add zig-zag path and freeform path generators plus previews inside `src/input/mineInputHandler.js`
- [ ] T024 [US4] Extend `src/input/mouseHandler.js` to differentiate rectangle vs Ctrl-paint sweeps and push `sweepArea` commands via command queue
- [ ] T025 [US4] Update `src/game/commandQueue.js` and `src/game/mineSystem.js` so `sweepArea` commands pop tiles, detonate mines safely, and ignore damage when `unit.sweeping` is true
- [ ] T026 [US4] Render sweep previews and dust particles via `src/rendering/mineRenderer.js` and `src/rendering/effectsRenderer.js`

---

## Phase 7: User Story 5 – Production, Resources, and HUD (Priority: P1)

**Goal**: Make both units buildable with correct unlocks, costs, HUD indicators, and ammo/fuel integration.

**Independent Test**: After constructing Workshop + Ammunition Factory + Vehicle Factory, confirm Mine Layer/Mine Sweeper buttons unlock, display correct costs, spawn from Vehicle Factory, show HUD bars, and resupply via ammo trucks/factories.

### Implementation

- [ ] T027 [US5] Finish Mine Layer/Mine Sweeper unit definitions (stats, costs, prerequisites, assets) within `src/config.js` and `src/buildings.js`
- [ ] T028 [US5] Add production buttons, unlock gating, and sidebar art wiring in `src/ui/productionMenu.js` and `src/ui/sidebar.js`
- [ ] T029 [US5] Update `src/productionQueue.js` and `src/factories.js` so both units spawn from Vehicle Factory and respect prerequisite checks
- [ ] T030 [US5] Integrate Mine Layer payload bar into HUD inside `src/rendering/uiRenderer.js` and `src/ui/unitHud.js`
- [ ] T031 [US5] Teach `src/game/ammunitionSystem.js` and `src/game/ammunitionTruckLogic.js` how to refill Mine Layer payloads in 7s cycles

---

## Phase 8: User Story 6 – AI Integration (Priority: P1)

**Goal**: Enemy AI produces and uses Mine Layers/Sweepers based on battlefield conditions.

**Independent Test**: Watch AI matches—after prerequisites, AI should mine ore fields/approach roads and build sweepers after suffering mine casualties.

### Implementation

- [ ] T032 [US6] Extend `src/ai/enemyAIPlayer.js` build logic to queue Mine Layers once Workshop + Ammunition Factory + ammo truck exist and power is stable
- [ ] T033 [US6] Implement AI mining strategy (target selection, checkerboard commands) in `src/ai/enemyStrategies.js`
- [ ] T034 [US6] Track mine-related casualties and trigger Mine Sweeper production/dispatch via `src/ai/enemyUnitBehavior.js`
- [ ] T035 [US6] Add AI command helpers for deploying and sweeping mines in `src/ai/enemyCommands.js`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, docs, and performance hardening.

- [ ] T036 Update `Documentation.md` and `PHASE5_IMPLEMENTATION.md` with final mine system behavior notes
- [ ] T037 Validate save/load compatibility and occupancy perf using scenarios from `specs/011-mine-system-planning/quickstart.md`
- [ ] T038 Run manual regression of existing PPF, AGF, and unit selection flows to ensure new input modes don't interfere (`npm run dev` + checklist)

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Phase 1 (Setup)** → 2. **Phase 2 (Foundational)** → Stories (Phases 3-8) can start
2. **User Stories** should follow priority order (US1→US2→US3→US4→US5→US6) though later stories can begin once their prerequisites are satisfied
3. **Phase 9 (Polish)** runs after desired user stories ship

### User Story Dependencies

- **US1** depends on Foundational work only (MVP scope)
- **US2** builds on US1 (area deploy extends command/input work)
- **US3** depends on Foundational (mine system) but can run parallel with US1/US2 once detonation plumbing ready
- **US4** depends on Foundational + US3 (needs mine mechanics) but not on US2 area logic
- **US5** depends on Foundational (unit definitions) yet can progress alongside US3 if config ready
- **US6** depends on all gameplay stories being available for AI to use

### Parallel Opportunities

- Tasks touching disjoint files (marked implicitly by different paths) can run concurrently, e.g., T008 vs T010 vs T011 after command queue scaffolding lands
- Once Foundational is complete, US3 rendering (T019) can progress parallel to US1 input (T010)
- AI tasks T032–T035 can run partially in parallel once production + mechanics stabilize

## Implementation Strategy

- **MVP**: Deliver Phase 3 (US1) after Phases 1-2 to showcase single-tile deployments
- **Incremental**: Add US2 & US3 next for area coverage + mechanics; then US4 for counterplay; follow with production polish (US5) and AI (US6)

```
