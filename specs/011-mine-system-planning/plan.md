# Implementation Plan: Land Mine System (Mine Layer + Mine Sweeper)

**Branch**: `011-mine-system-planning` | **Date**: 2025-11-17 | **Spec**: `/specs/011-mine-system-planning/spec.md`
**Input**: Feature specification capturing land mine mechanics, Mine Layer truck, and Mine Sweeper tank requirements

## Summary

Add two interconnected units (Mine Layer and Mine Sweeper), mine entities, HUD indicators, and AI behaviors. The Mine Layer consumes an ammunition-style payload (20 mines) to deploy single-tile or area minefields with PPF chaining, skull overlays, and occupancy integration. Mines detonate with center/orthogonal splash damage, chain react when aligned, and transfer remaining payload on truck death. The Mine Sweeper inherits tank chassis values, toggles sweeping mode with dust effects, and executes serpentine or freeform sweep paths that safely detonate mines. Enemy AI must unlock, deploy, and counter mines based on economic state and battlefield losses.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2023) via ES modules  
**Primary Dependencies**: Vite toolchain, HTML5 Canvas API, Web Audio API (existing infrastructure)  
**Storage**: In-memory `gameState` plus LocalStorage save slots (existing)  
**Testing**: Manual playtesting via `npm run dev`; no automated test suite  
**Target Platform**: Desktop and mobile browsers (Canvas-based RTS)  
**Project Type**: Single-page web game (client-only)  
**Performance Goals**: Maintain 60 FPS with hundreds of units, limited pathfinding recomputation  
**Constraints**: Vanilla JS only, modular files (<1000 LOC), shared constants in `config.js`, separation of logic/render/input/AI  
**Scale/Scope**: 100x100 tile maps, dozens of units/buildings per party, up to four parties

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Vanilla JS & ES6 Modules** – PASS: Plan extends existing modules with named exports only.  
2. **Modular Architecture & Separation of Concerns** – PASS with coordination: Work spans logic (`src/game`, `src/ai`), rendering overlays (`src/rendering`), and input handling (`src/inputHandler`). Each deliverable will stay within role-specific files, sharing data via `gameState`/config only.  
3. **Agent Specialization** – PASS: Identify boundaries (GAME_LOGIC_AGENT for mine mechanics & AI, RENDERING_AGENT for overlays/dust, INPUT_CONTROL_AGENT for new gestures, SYSTEMS_AGENT for config constants).  
4. **Performance & Canvas Optimization** – PASS: Reuse existing path planning, occupancy, and particle systems to avoid per-frame heavy computations; batch updates around deployments.  
5. **Configuration-Driven Design** – PASS: All speeds, damage values, capacities will live in `config.js` or dedicated maps.  
6. **Backward Compatibility** – PASS: Mines integrate with save/load schema via optional fields; new HUDs fall back gracefully when unit type lacks payload.

## Project Structure

### Documentation (this feature)

```text
specs/011-mine-system-planning/
├── plan.md        # This file
├── spec.md        # User-sourced requirements summary
├── research.md    # Phase 0 deliverable
├── data-model.md  # Phase 1 deliverable
├── quickstart.md  # Phase 1 deliverable
└── contracts/     # Phase 1 API/interaction contracts
```

### Source Code (repository root)

```text
src/
├── config.js                 # Constants for unit stats, damage, speeds
├── gameState.js              # Stores units, mines, occupancy flags
├── logic.js                  # High-level update loop glue
├── game/
│   ├── movement/
│   ├── combat/
│   ├── pathfinding/
│   └── mines/                # (new or extended) mine placement + chain logic
├── ai/
│   ├── enemyAIPlayer.js
│   ├── enemyStrategies.js    # Extend for mine usage
│   └── enemyUnitBehavior.js  # Sweeper deployment reactions
├── input/
│   └── selection.js / inputHandler.js # Drag/click gestures (checkerboard mining, sweep modes)
├── rendering/
│   ├── overlays.js           # Skull indicators, orange sweep preview, dust FX
│   └── hud/
├── ui/
└── utils/

public/images/
├── map/units/                # Mine Layer & Mine Sweeper sprites
└── sidebar/                  # Build button assets
```

**Structure Decision**: Single web-client project with specialized subdirectories for logic, AI, rendering, and input. Feature touches existing directories without adding new top-level apps. Documentation for this spec lives entirely under `specs/011-mine-system-planning/`.

## Complexity Tracking

No constitution violations anticipated; table not required.

## 2025-11-19 Status & Next Steps

- **Phase 1 docs outstanding**: `quickstart.md` (T001) and `data-model.md` (T002) still missing; draft both before expanding implementation.
- **Persistence gap**: Mines/payload/sweeper state are absent from `saveGame.js`, `loadGame.js`, and `savePlayerBuildPatterns.js` (T004/T021); design serialization schema that preserves owner, arming timers, `remainingMines`, and sweeper commands.
- **Movement/safety rules**: Friendly avoidance currently relies on occupancy counts, blocking everyone; update `units.js` + `game/pathfinding.js` so only owner/allies treat own mines as blocked while enemies remain willing to path through (T006/T018).
- **Mine Layer behavior polish**: Auto-refill sets `refillTarget` but never hands off to ammo system or resumes queued deployments; integrate with `ammunitionSystem` (T015/T031) and ensure HUD updates on refill completion.
- **Mine Sweeper workflows**: Freeform painting states are never collected, `sweepArea` PPF visuals only show the first waypoint, and clearing mines simply deletes them without detonations; flesh out `mouseHandler` painting, `pathPlanningRenderer` polyline/indices, and `mineSystem` helpers that trigger explosions but grant sweepers immunity (T022–T026).
- **Rendering/UI chores**: Render orange overlays for Ctrl-painted sweeps, persist preview data in `gameState`, and remove stray console logging to keep production clean.
