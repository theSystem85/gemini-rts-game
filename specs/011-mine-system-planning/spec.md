# Feature Specification: Land Mine System (Mine Layer + Mine Sweeper)

**Feature Branch**: `011-mine-system-planning`  
**Created**: 2025-11-17  
**Status**: Draft  
**Input**: User requirements for land mine mechanics, Mine Layer truck, and Mine Sweeper tank

---

## Overview

Introduce a complete land-mine gameplay system with two new units (Mine Layer truck and Mine Sweeper tank), new HUD indicators, area-deployment tooling, AI behaviors, and visual indicators that integrate with existing ammunition and gas mechanics. The Mine Layer deploys mines that block friendly pathing, damage units/buildings on contact, trigger chain reactions, and display skull overlays. The Mine Sweeper clears mines via planned sweep patterns without taking damage while sweeping. Enemy AI must leverage both units strategically.

---

## Image Assets

- Mine Layer truck sidebar icon: `/public/images/sidebar/mine_layer_sidebar.webp`
- Mine Layer truck map sprite (faces upward): `/public/images/map/units/mine_layer_map.webp`
- Mine Sweeper tank sidebar icon: `/public/images/sidebar/mine_sweeper_sidebar.webp`
- Mine Sweeper tank map sprite: `/public/images/map/units/minesweeper_map.webp`
- Mine indicator overlay: skull icon (light gray, 70% opacity) rendered per deployed mine tile

(_Exact filenames to be confirmed by searching provided asset folders_)

---

## User Stories & Acceptance Criteria

### Story 1 – Directed Mine Deployment (Priority P0)
- **As a** player
- **I want** to command the Mine Layer truck to deploy single-target mines via Ctrl + Left Click
- **So that** I can set precise ambushes and chain commands

**Acceptance**:
1. Ctrl + Left Click queues a mine deployment order at the clicked tile, stacking if earlier deployments still resolving.
2. Path Planning Feature (PPF) visuals (yellow triangles with numbers) indicate deployment order.
3. Mine Layer halts for 4s at each deployment tile, drops mine, and mine arms only after truck vacates tile.
4. Mines consume 1 ammo slot from the truck's 20-mine capacity; HUD ammo bar shows remaining mines.

### Story 2 – Area Minefields (Priority P0)
- **As a** player
- **I want** to drag a rectangle to auto-plan checkerboard mine placements
- **So that** I can quickly mine large areas

**Acceptance**:
1. Dragging a rectangle with the Mine Layer selected enqueues deployments covering the area in a checkerboard pattern (alternating tiles).
2. Uses PPF command chaining; each target tile shows yellow numbered markers until completed.
3. If the truck exhausts mines mid-plan, it automatically pathfinds to the closest ammo truck or Ammunition Factory to reload and resumes remaining deployments.
4. Deploy mode movement speed is 50% of normal; normal speed is 80% of tanker truck speed.

### Story 3 – Mine Mechanics & Indicators (Priority P0)
- Mines have 10 HP, track ownership, and block friendly occupancy so allied units avoid them.
- Any unit entering the tile detonates the mine: 90 damage on the tile, 50 damage to orthogonal neighbors.
- Chain reaction: contiguous mines (horizontal/vertical) trigger sequentially when neighbor damage occurs.
- Skull overlay (light gray, 70% opacity) renders on deployed tile until mine destroyed or detonated.
- Destroyed Mine Layer transfers remaining mine payload damage evenly to surrounding tiles upon death.

### Story 4 – Mine Sweeper Tank Operations (Priority P0)
- **As a** player
- **I want** a Mine Sweeper tank that can clear mines safely
- **So that** my army can breach mined zones

**Acceptance**:
1. Mine Sweeper inherits tank movement/armor traits (no turret) with 2× tank armor.
2. Speed is 70% of base tank speed normally, 30% while sweeping; sweeping mode toggles automatically during sweep commands and shows dust animation in front of unit.
3. Single click commands standard movement (non-sweeping).
4. Drag rectangle (AGF-style) orders PPF zig-zag sweep covering all non-occupied tiles in the area (left-right serpentine with yellow markers).
5. Ctrl + Left Click drag paints a freeform area, previewed with orange tile overlay; releasing button locks sweep path using PPF markers only.
6. Mines detonated while sweeper is in sweeping mode deal no damage to the unit; explosions still damage other units/buildings.

### Story 5 – Production, Resources, and HUD (Priority P1)
- Mine Layer: cost 1000, 30 HP, rotationSpeed 0.04, uses ammo-truck gas stats, unlocked when Workshop + Ammunition Factory + Vehicle Factory exist.
- Mine Sweeper: cost 1000, requires Workshop + Vehicle Factory, no ammunition bar (gas only).
- Mine Layer uses ammo HUD bar to represent mine payload (20 max) and can be refilled by ammo truck/factory in 7s per reload cycle.
- Destroyed Mine Layer distributes remaining mines' damage to immediate surrounding tiles evenly.

### Story 6 – AI Integration (Priority P1)
- Enemy AI builds Mine Layer once it has Workshop, Ammunition Factory, and Ammunition Truck, prioritizing mining enemy ore fields and approach roads.
- AI monitors mine stock; uses area deployments similar to player to defend key choke points.
- Enemy AI builds Mine Sweeper units once their units are damaged or destroyed by mines and dispatches them to clear dangerous areas.

---

## Functional Requirements (FR)

| ID | Description |
|----|-------------|
| FR-011 | Mine Layer capacity 20; ammo HUD shows remaining mines; refills via ammo truck/factory; consumes 1 ammo per deployment.
| FR-012 | Mine Layer normal speed = tanker_speed × 0.8; deploy-mode speed = tanker_speed × 0.4; must stop 4s per deployment.
| FR-013 | Mine indicator overlay renders skull icon with 70% opacity; persists until mine removed.
| FR-014 | Mines block friendly occupancy map entries but remain passable to enemies; explosion triggers 90/50 damage pattern; chain reaction for adjacent mines.
| FR-015 | Mine Layer destruction deals remaining payload damage evenly to surrounding tiles (including units/buildings).
| FR-016 | Area mining uses checkerboard coverage and PPF chain markers; auto-refill/resume behavior when mines depleted mid-plan.
| FR-017 | Mine Sweeper inherits tank chassis stats (except turret) with 2× armor; speed modifiers 0.7/0.3 vs baseline tank.
| FR-018 | Sweeper dust animation plays in front when sweeping; sweeping over mine causes detonation without sweeper damage.
| FR-019 | Sweeper rectangle sweep uses PPF-generated zig-zag paths covering all tiles; ctrl-draw sweep paints orange overlay before committing.
| FR-020 | AI builds/uses Mine Layers and Mine Sweepers following specified triggers and priorities.

---

## Non-Functional Requirements

- Maintain 60 FPS by reusing existing PPF and occupancy map utilities; no per-frame heavy scans beyond existing systems.
- Keep new constants in `config.js`; no magic numbers embedded elsewhere.
- Respect modular boundaries: input handling for control schemes, rendering for overlays/animations, logic/AI for behaviors.
- Ensure save/load includes mine state, Mine Layer payload, Mine Sweeper sweep queues, and AI tasks.

---

## Dependencies & Integration Notes

- Reuse existing ammo HUD component for Mine Layer payload; ensure ammo trucks interact through shared ammo refuel logic.
- Extend occupancy map to flag mines for friendly-only avoidance; enemy units may path through but risk triggering.
- Hook into chain-of-commands (PPF) for both Mine Layer and Mine Sweeper operations to maintain consistent UX cues.
- Rendering overlays (skull indicators, orange selection overlay, dust FX) must live in rendering/UI modules, not core logic.
- AI modules (`src/ai/*`) require new strategies for mine deployment and sweep response.

---

## Open Questions

1. Confirm actual asset filenames for Mine Layer/Sweeper; update spec when verified.
2. Determine exact tanker truck speed constant to compute 80%/40% multipliers; document in config.
3. Define precise dust animation asset or reuse existing particle system.

(_Treat unanswered items as NEEDS CLARIFICATION during planning_)
