# AI Pathfinding Unification

**UTC Timestamp:** 2026-01-31T20:55:00Z
**LLM:** GitHub Copilot (GPT-5.2-Codex)

## Prompt Summary
Ensure the AI for human player units and enemy AI units use the same pathfinding algorithm.

## Changes
- Standardized enemy AI pathfinding in `src/ai` to use `getCachedPath()` (same as player pathfinding) instead of direct `findPath()` calls.
- Updated files:
  - `src/ai/enemyUnitBehavior.js`
  - `src/ai/attackCoordination.js`
  - `src/ai/retreatLogic.js`
  - `src/ai/crewHealing.js`
  - `src/ai/logistics.js`
  - `src/ai/enemySpawner.js`

## Outcome
Enemy AI and player unit AI now share the same cached pathfinding pipeline for consistent routing behavior.