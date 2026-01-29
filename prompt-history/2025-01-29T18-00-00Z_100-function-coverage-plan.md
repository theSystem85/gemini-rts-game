# Prompt: 100% Function Coverage Plan

**UTC Timestamp**: 2025-01-29T18:00:00Z  
**LLM**: GitHub Copilot (Claude Opus 4.5)

## Prompt

update UNIT_TEST_PARALLEL_PLAN.md so that there is a plan on how to at least get the functional test coverage gets up to 100%. Create new Tasks for that after priority 8.

## Changes Made

Updated `/TODO/UNIT_TEST_PARALLEL_PLAN.md` with new priority tasks (P9-P17) to achieve 100% function coverage:

### New Priorities Added:

- **Priority 9**: Zero Coverage Core Files (7 tasks) - rendering.js, saveGame.js, updateGame.js, main.js, index.js, worldPatterns.js, unitConfigUtil.js
- **Priority 10**: Game Folder Zero Function Coverage (11 tasks) - actionSystem.js, ammoBuildingTruckLogic.js, buildingNotifications.js, joystickController.js, pathfinding.js, spatialQuadtree.js, supplyTruckLogic.js, supplyTruckUtils.js, coordBasedMovement.js, wreckManager.js, waypointSounds.js
- **Priority 11**: Input Folder Zero Function Coverage (4 tasks) - controlGroupHandler.js, cursorStyles.js, keybindings.js, multiUnitInputHandler.js
- **Priority 12**: Network Folder Low Function Coverage (4 tasks) - gameNotifications.js, invites.js, missionEvents.js, signalling.js
- **Priority 13**: Missions Folder (1 task) - index.js
- **Priority 14**: Utils Zero Function Coverage (1 task) - oreDiscovery.js
- **Priority 15**: Improve Low Function Coverage <50% (7 tasks)
- **Priority 16**: Improve Medium Function Coverage 50-80% (17 tasks)
- **Priority 17**: Improve High Function Coverage 80-99% (20 tasks)

### Summary:
- 72 new tasks added
- Estimated 1735-2495 additional tests needed
- Total tasks now: 134 (61 completed, 72 remaining)
- Estimated total tests: 4063-4823

### Recommended Execution Order:
1. Quick Wins (P17) - files at 80-99%
2. Small Files (P9, P13, P14) - zero-coverage smaller files
3. Critical Systems (P10) - game folder
4. Input System (P11, P15.5, P15.6)
5. Network (P12)
6. Large Files (P15, P16)
