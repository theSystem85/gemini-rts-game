# 2025-01-31T12:00:00Z
## LLM: Copilot (Claude Opus 4.6)

## Prompt Summary
8-part improvement request for enemy LLM AI system:

1. Ensure the LLM is aware of the money supply mechanics and that it requires a stable economy with at least 1 harvester and 1 refinery to get money flow.
2. Ensure the LLM can sell and repair buildings when needed.
3. Ensure the LLM tries to avoid running into the opponents base defense and keep a distance until its forces are strong enough.
4. Show a tooltip on the enemy base that shows the strategic commands of the LLM to the enemy AI, beside the build queue.
5. The enemy AI when controlled by LLM still does not really attack when trying to rush the player base. Ensure the enemy AI will fire at foreign targets.
6. Ensure the LLM cannot overcome the tech tree availability. It should have the same wait/construction times.
7. Refine the styling of the Settings dialog — vertical margins missing, make it look more professional.
8. If there is no API key provided for a model provider the game engine should not try to use that model. Remove the api key input for Ollama since it doesn't need one.

## Changes Made

### 1. Economy awareness (llmStrategicController.js)
- Added "ECONOMY & MONEY SUPPLY (CRITICAL!)" section to bootstrap prompt explaining harvester+refinery income loop

### 2. Sell & repair building actions (llmStrategicController.js, applier.js)
- Added sell_building and repair_building to JSON schema (SIMPLE_GAME_TICK_SCHEMA)
- Added sell_building case to applier (70% refund, PROTECTED_BUILDING for CY)
- Added repair_building case to applier (calls repairBuilding from buildings.js)
- Updated bootstrap prompt OUTPUT FORMAT with sell/repair examples

### 3. Base defense avoidance (llmStrategicController.js)
- Added "AVOID ENEMY BASE DEFENSES" tactical guidelines to bootstrap prompt
- Guidance to stage outside turret range, scout weakest side, need 2-3x firepower

### 4. LLM strategic commands tooltip (llmQueueTooltip.js, sidebar.css)
- Tooltip now shows on any selected enemy building (not just constructionYard)
- Added strategic intent/notes section with brain emoji header
- Added production plan section with factory emoji header
- Added commands section showing unit_command, sell_building, repair_building actions
- Added CSS for notes panel and command icons

### 5. Enemy AI fire at targets fix (enemyUnitBehavior.js, applier.js)
- Root cause: AI units need `allowedToAttack = true` to fire, but neither the applier nor LLM lock set it
- Set `unit.allowedToAttack = true` in applier for all attack commands (direct, queued, position-based)
- Set `unit.allowedToAttack = true` in LLM lock section of enemyUnitBehavior.js
- Extended LLM lock auto-targeting to also scan enemy buildings in fire range (not just units)

### 6. Tech tree enforcement (applier.js)
- Added `computeAvailableBuildingTypes()` mirroring syncTechTreeWithBuildings logic
- Added `computeAvailableUnitTypes()` for unit prerequisites
- build_place and build_queue reject with TECH_TREE_LOCKED when type isn't available
- Construction time already enforced via createBuilding() setting constructionFinished: false

### 7. Settings dialog styling (overlays.css)
- Increased body padding from 16px to 20px
- Increased content gap from 12px to 16px
- Added margin-bottom: 4px to fields
- Increased section margin-top from 16px to 20px and padding-top from 12px to 16px
- Added color and letter-spacing to section titles
- Improved subsection padding and added inner title styling with border-bottom
- Enhanced note styling with background, border-left accent, and padding
- Increased actions margin-top from 4px to 8px

### 8. API key + Ollama cleanup (index.html, llmSettingsPanel.js, llmStrategicController.js)
- Removed API key input for Ollama from index.html
- Added `PROVIDERS_REQUIRING_KEY` set to llmSettingsPanel.js
- refreshProviderModels skips providers without API key (shows "Enter API key first" placeholder)
- Init-time model refresh is silent (no error notifications); manual refresh shows errors
- Strategic and commentary ticks skip API calls when provider needs key and none is set
