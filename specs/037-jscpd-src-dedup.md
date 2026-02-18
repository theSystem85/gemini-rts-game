# Spec 037: JSCPD-driven `src` Deduplication

## Goal
Reduce structural duplication in `src` using `jscpd` as the source of truth, prioritizing high-impact, low-risk refactors that preserve gameplay behavior.

## Source of truth
- Report: `report/html/index.html`
- Data: `report/html/jscpd-report.json`
- Baseline snapshot (current):
  - Clone pairs: `152`
  - Duplicated lines: `1775`
  - Duplicated tokens: `19967`

## Constraints
- Preserve existing behavior (no forced semantic unification when behavior intentionally differs).
- Prioritize low-risk gameplay areas before high-risk multiplayer/lockstep internals.
- Run `npm run lint:fix:changed` after each implementation batch.
- Run focused unit tests after each larger batch.

## Batch plan
1. Remove cross-file duplicate placement/repair flows.
2. Consolidate duplicated support-command flows in `src/input/unitCommands`.
3. Address largest remaining in-file duplicates in safe modules (e.g., support, movement helpers, UI utility blocks).
4. Re-run jscpd and track deltas after each batch.

## Progress
- ✅ Batch A:
  - `src/buildingRepairHandler.js`: refactored to repair-only responsibility; removed duplicated building placement branch.
  - `src/ui/eventHandlers.js`: updated callsite for simplified repair handler.
  - `src/input/unitCommands/supportCommands.js`: merged duplicated tow/recycle recovery logic into a shared helper.
  - Validation: `npm run lint:fix:changed` + focused unit tests passed.
- ✅ Batch B:
  - `src/game/remoteControl.js`: extracted shared `computeRemoteAim` helper to remove Apache/Rocket duplicated targeting calculations.
  - Validation: `npm run lint:fix:changed` + focused unit tests passed.
- ✅ Follow-up regression fix:
  - `src/ui/eventHandlers.js`: fixed multiplayer auto-building placement by using one `placementMapGrid` reference for both placement validation and tile mutation.
  - Root cause: after dedup, placement validation used `gameState.mapGrid` while mutation used `this.mapGrid`, which can diverge in multiplayer/reset flows.
  - Validation: `npm run lint:fix:changed` passed.

## Current metrics
- Baseline: `152` clones, `1775` duplicated lines
- Current: `146` clones, `1627` duplicated lines
- Delta: `-6` clones, `-148` duplicated lines

## Next targets
- Remaining high-value clone clusters in:
  - `src/game/movementStuck.js`
  - `src/input/unitCommands/supportCommands.js` (other repeated queue wrappers)
  - `src/ai/enemyBuilding.js`
  - `src/game/remoteControl.js`
