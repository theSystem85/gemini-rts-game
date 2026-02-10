# 2025-02-09T12:00:00Z
## LLM: Copilot (Claude Opus 4.6)

## Prompt Summary
Ensure the LLM enemy AI can build the refinery by falling back to algorithmic placement when a position is blocked. Enforce that the LLM command queue cannot overrule the game engine's unlock mechanics for buildings and units. Ensure LLM-queued buildings are built one after another (sequentially) with construction timers, not all at once.

## Changes Made

### Problem 1: Refinery placement fails with no fallback
- When the LLM picks coordinates that are blocked (e.g., 1-tile border rule for refineries), the building action was simply rejected
- **Fix**: Added fallback to `findBuildingPosition()` from `enemyBuilding.js` when the LLM's requested position fails `canPlaceBuilding()` validation

### Problem 2: LLM bypasses unlock mechanics
- Tech tree was checked at queue acceptance time, but all buildings in a single tick were placed instantly, so a building could enable its dependents within the same tick
- **Fix**: Tech tree is now checked both at queue time AND at construction start time. Since buildings are queued sequentially, a dependent building cannot start construction until its prerequisite is actually built

### Problem 3: Buildings placed simultaneously (unfair)
- All `build_place` actions were executed instantly — no construction timer
- **Fix**: `build_place` actions now queue buildings into `state.llmStrategic.buildQueuesByPlayer[owner]`. The queue is processed one item at a time in the AI update loop, using the same timer formula as the local AI: `750 * (cost / 500)` ms, modified by power and game speed

### Unit production also queued
- `build_queue` (unit production) actions now queue into `state.llmStrategic.unitQueuesByPlayer[owner]`
- Units are produced one at a time with 10,000 ms base duration, matching the local AI

### Files Modified
- `src/ai-api/applier.js` — Queuing logic, exported tech tree functions, queue processor functions
- `src/ai/enemyAIPlayer.js` — Import and call LLM queue processors in AI update loop
- `tests/unit/aiApi.test.js` — Updated test expectations for queued behavior
- `specs/032-llm-strategic-ai.md` — Updated spec with sequential construction details
- `TODO/Bugs.md` — Added and marked resolved bugs
