# 2026-02-02T17:20:00Z
## LLM: Copilot (Claude Opus 4.6)

## Prompt Summary
Three bug fixes for the LLM enemy AI system:
1. Enemy AI build queue tooltip disappears on mouse move
2. Tooltip should show latest items on top (reverse order)
3. Enemy units aim at player units/buildings but never actually fire

## Changes Made

### Fix 1: Tooltip disappearing on mouse move
- **File**: `src/input/mouseEventSetup.js`
- **Root cause**: Canvas `mouseleave` event handler unconditionally called `hideLlmQueueTooltip()`. When the tooltip overlay (a sibling of the canvas in the DOM) appeared and the mouse entered it, `mouseleave` fired on the canvas, hiding the tooltip immediately.
- **Fix**: Made the `mouseleave` handler conditional — only hide the tooltip when no enemy building is currently selected. This allows the pointer to freely move between the canvas and the tooltip overlay without dismissal.

### Fix 2: Reverse tooltip queue order
- **File**: `src/ui/llmQueueTooltip.js`
- **Root cause**: Queue items were rendered in insertion order (oldest first).
- **Fix**: Added `.reverse()` to `queueItems` array in `renderQueueContent()` so the latest/newest strategic decisions appear at the top of the tooltip.

### Fix 3: Enemy units not firing
- **Files**: `src/ai/enemySpawner.js`, `src/ai/enemyStrategies.js`
- **Root cause (two-part)**:
  1. `spawnEnemyUnit()` in `enemySpawner.js` never set `allowedToAttack` on spawned units. The property remained `undefined`, which failed the `=== true` strict check in all combat functions (`tankCombat.js`, `apacheCombat.js`, `howitzerCombat.js`).
  2. `applyEnemyStrategies()` called `shouldConductGroupAttack(unit, units, gameState, unit.target)` which returns `false` when `unit.target` is `null`. This reset `allowedToAttack = false` every AI decision tick, even when no combat decision was actually being made. When the unit later acquired a target in the same frame, `allowedToAttack` was already `false`.
- **Fix**:
  - In `enemySpawner.js`: Set `allowedToAttack = true` for all combat unit types (tanks, rocket tanks, howitzers, apaches). Non-combat support units (harvesters, ambulances, tanker trucks, etc.) are excluded.
  - In `enemyStrategies.js`: Only evaluate and override `allowedToAttack` when `unit.target` is not null. When there's no target, preserve the existing `allowedToAttack` state (which defaults to `true` from spawn).

### Spec/Doc Updates
- Updated `specs/032-llm-strategic-ai.md` with AI combat firing permission section and tooltip behavior details
- Updated `TODO/Bugs.md` with three new resolved bug entries
