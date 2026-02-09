# 2026-02-02T16:30:00Z — LLM Queue Completion Tracking

**LLM**: Copilot (Claude Opus 4.6)

## Prompt Summary

The user reported three issues after the previous LLM queue fairness fix:

1. **LLM builds things twice** — The production queue items were removed (`.shift()`) when construction started, losing all tracking. The LLM couldn't see what was already queued/built, so it re-sent the same commands on subsequent ticks. This caused the refinery and power plant to be built twice, exhausting the budget before a harvester could be produced.

2. **No completion indicators in tooltip** — The LLM queue tooltip showed raw plan actions without any status, so there was no way to see which items were completed, in progress, or failed.

3. **First LLM tick delayed** — The LLM API call only fired after the tick interval elapsed (~30 seconds from page load), wasting early game time.

## Changes Made

### `src/ai-api/applier.js`
- Added `status` field to all queue items (`'queued'`, `'building'`, `'completed'`, `'failed'`)
- Changed `processLlmBuildQueue` and `processLlmUnitQueue` from `.shift()` to status-based iteration
- Added `markLlmBuildComplete()` and `markLlmUnitComplete()` exports — called from enemyAIPlayer when construction/production finishes
- Added `getLlmQueueState()` export — returns queue items with statuses for the exporter and tooltip
- Added `ALREADY_QUEUED` rejection: `build_place` actions are rejected if the same building type is already `queued` or `building`
- Failed items get a `failReason` field (`'tech_tree_locked'`, `'no_position'`, `'no_spawn_factory'`)

### `src/ai/enemyAIPlayer.js`
- Imported `markLlmBuildComplete` and `markLlmUnitComplete`
- Added calls to mark completion after building placement and unit spawn when LLM is active

### `src/ai-api/exporter.js`
- Imported `getLlmQueueState` from applier
- Added `snapshot.llmQueue` to exported state — contains building and unit queue items with status, so the LLM sees what's already queued/built

### `src/ai/llmStrategicController.js`
- Fixed first tick timing: added `strategicState.lastTickAt === 0` check so the first tick fires immediately
- Updated bootstrap prompt to document `snapshot.llmQueue` and instruct LLM to check it before issuing build commands

### `src/ui/llmQueueTooltip.js`
- Imported `getLlmQueueState`
- Added `getStatusIcon()` and `getStatusLabel()` helper functions
- Updated `getQueueItems()` to read from live queue state with status tracking
- Updated `renderQueueContent()` to show status indicators (✓ completed, ⏳ building, ✗ failed)

### `styles/sidebar.css`
- Added CSS for queue row status variants: `--completed` (green, strikethrough), `--building` (yellow highlight), `--failed` (red, dimmed)

### `specs/032-llm-strategic-ai.md`
- Added "Queue Completion Tracking & Duplicate Prevention" section
- Added "Immediate First Tick" section
- Updated "UI Hooks" section with status indicator details

### `TODO/Bugs.md`
- Added 3 new closed bugs for the queue tracking, first tick timing, and tooltip status issues
