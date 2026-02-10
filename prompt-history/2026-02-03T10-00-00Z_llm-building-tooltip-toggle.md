# 2026-02-03T10:00:00Z
**LLM: Copilot (Claude Opus 4.6)**

## Prompt Summary
User reported 3 issues after previous LLM AI improvements:

1. **LLM AI not building**: Enemy AI controlled by LLM was producing valid JSON with build_place actions (oreRefinery, vehicleFactory, turretGunV1) and build_queue (harvester) but nothing was being built. Root cause: `canPlaceBuilding()` proximity check (`isNearExistingBuilding`) rejects buildings placed more than 3 tiles from existing owned buildings, and the LLM had no knowledge of this rule. Also, rejected actions were silently discarded with no logging.

2. **LLM tooltip not showing on enemy CY select**: The enemy AI build queue and tactics tooltip did not appear when selecting the enemy Construction Yard. Should show on click (not hover), including when pipeline is empty. Root cause: `handleFactorySelection()` in selectionManager.js did not call `updateLlmQueueTooltipForSelection()`, while `handleBuildingSelection()` did. Since CY is a factory, it used the wrong handler.

3. **Per-party LLM toggle in sidebar**: User requested showing for each party in the multiplayer sidebar whether they are controlled by LLM, with a toggle button to switch between LLM and local AI per party.

## Changes Made

### Fix 1: LLM not building
- `src/ai/llmStrategicController.js`: Added BUILDING PLACEMENT RULE (CRITICAL) to bootstrap prompt explaining the 3-tile proximity requirement. Added tactical guideline about placement near existing structures.
- `src/ai/llmStrategicController.js`: Added `window.logger.warn('[LLM] Rejected actions:', ...)` and `window.logger.info('[LLM] Accepted actions:', ...)` after `applyGameTickOutput`.

### Fix 2: Tooltip on enemy CY select
- `src/input/selectionManager.js`: Added `updateLlmQueueTooltipForSelection()` call at end of `handleFactorySelection()`.

### Fix 3: Per-party LLM toggle
- `src/ai/llmStrategicController.js`: Updated `getAiPlayers()` to filter out parties with `partyState.llmControlled === false`.
- `src/ui/sidebarMultiplayer.js`: Added import for `getLlmSettings`. Added `createLlmToggleButton()`, `updateLlmToggleAppearance()`, and `isPartyLlmControlled()` functions. Shows toggle for AI parties in the multiplayer sidebar.
- `styles/base.css`: Added `.multiplayer-llm-toggle` and `.multiplayer-llm-toggle--active` styles.
- `specs/032-llm-strategic-ai.md`: Updated with building placement proximity rule, per-party LLM control toggle, and factory tooltip fix documentation.
- `TODO/Bugs.md`: Added bug fix entries.
- `TODO/Features.md`: Added feature entries.
