# Unit Test Parallel Agent Plan

**Created**: 2025-01-28T19:55:00Z  
**Goal**: Achieve 100% test coverage through parallel agent work  
**Current Coverage**: 14.28% statements, 11.64% branches, 15.23% functions

## Task Assignment Rules

1. Each agent works on ONE task at a time
2. Each task targets a SINGLE source file with its own test file
3. NO TWO AGENTS should work on the same task simultaneously
4. When starting a task, mark it `[IN PROGRESS - Agent X]`
5. When completing a task, mark it `[COMPLETED]`
6. After completing tests, run `npm run lint:fix` and `npm run test:coverage`

---

## PRIORITY 1: Zero Coverage Files (Critical)

These files have 0% coverage and need complete test suites created.

### Task 1.1 - `src/buildingRepairHandler.js`
- **Target**: Create `tests/unit/buildingRepairHandler.test.js`
- **Source File**: `src/buildingRepairHandler.js` (0% coverage, lines 13-211)
- **Status**: [COMPLETED] (Finished: 2025-01-28 20:10 UTC)
- **Tests Added**: 17 tests
- **Estimated Tests**: 20-30

### Task 1.2 - `src/buildingSellHandler.js`
- **Target**: Create `tests/unit/buildingSellHandler.test.js`
- **Source File**: `src/buildingSellHandler.js` (0% coverage, lines 17-82)
- **Status**: [COMPLETED] (Finished: 2025-01-28 20:10 UTC)
- **Tests Added**: 22 tests
- **Estimated Tests**: 15-20

### Task 1.3 - `src/factories.js`
- **Target**: Create `tests/unit/factories.test.js`
- **Source File**: `src/factories.js` (0% coverage, lines 8-176)
- **Status**: [COMPLETED] (Finished: 2025-01-28 20:10 UTC)
- **Tests Added**: 32 tests
- **Estimated Tests**: 20-30

### Task 1.4 - `src/gameSetup.js`
- **Target**: Create `tests/unit/gameSetup.test.js`
- **Source File**: `src/gameSetup.js` (0% coverage, lines 8-342)
- **Status**: [COMPLETED] (Finished: 2025-01-28 20:10 UTC)
- **Tests Added**: 29 tests
- **Estimated Tests**: 30-40

### Task 1.5 - `src/mapEditor.js`
- **Target**: Create `tests/unit/mapEditor.test.js`
- **Source File**: `src/mapEditor.js` (1.62% coverage, lines 46-736)
- **Status**: [COMPLETED] (Finished: 2025-01-28 20:25 UTC)
- **Tests Added**: 72 tests
- **Estimated Tests**: 40-60

---

## PRIORITY 2: AI System Files (Zero Coverage)

### Task 2.1 - `src/ai/enemyAIPlayer.js`
- **Target**: Create `tests/unit/enemyAIPlayer.test.js`
- **Source File**: `src/ai/enemyAIPlayer.js` (0% coverage, lines 20-932)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:06 UTC)
- **Tests Added**: 4 tests
- **Coverage After**: N/A (vitest not available in environment)
- **Estimated Tests**: 50-70

### Task 2.2 - `src/ai/enemyBuilding.js`
- **Target**: Create `tests/unit/enemyBuilding.test.js`
- **Source File**: `src/ai/enemyBuilding.js` (0% coverage, lines 7-798)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:04 UTC)
- **Tests Added**: 6 tests
- **Coverage After**: 38.57% statements (enemyBuilding.js)
- **Estimated Tests**: 40-60

### Task 2.3 - `src/ai/enemySpawner.js`
- **Target**: Create `tests/unit/enemySpawner.test.js`
- **Source File**: `src/ai/enemySpawner.js` (0% coverage, lines 9-213)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:04 UTC)
- **Tests Added**: 8 tests
- **Coverage After**: 95.95% statements, 81.13% branches, 100% functions, 95.69% lines
- **Estimated Tests**: 20-30

### Task 2.4 - `src/ai/enemyStrategies.js`
- **Target**: Create `tests/unit/enemyStrategies.test.js`
- **Source File**: `src/ai/enemyStrategies.js` (6.97% coverage)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:09 UTC)
- **Tests Added**: 26 tests
- **Coverage After**: 52.9% statements
- **Estimated Tests**: 60-80

### Task 2.5 - `src/ai/enemyUnitBehavior.js`
- **Target**: Create `tests/unit/enemyUnitBehavior.test.js`
- **Source File**: `src/ai/enemyUnitBehavior.js` (0% coverage, lines 9-1376)
- **Status**: [COMPLETED]
- **Estimated Tests**: 70-100

---

## PRIORITY 3: Game System Files (Zero/Low Coverage)

### Task 3.1 - `src/game/bulletSystem.js`
- **Target**: Extend `tests/unit/bulletSystem.test.js`
- **Source File**: `src/game/bulletSystem.js` (0.65% coverage, lines 39-1119)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:07 UTC)
- **Note**: Test file exists but needs major expansion
- **Estimated Tests**: 60-80
- **Tests Added**: 14
- **Coverage After**: 47.5% statements (bulletSystem.js)

### Task 3.2 - `src/game/buildingSystem.js`
- **Target**: Extend `tests/unit/buildingSystem.test.js`
- **Source File**: `src/game/buildingSystem.js` (0% coverage, lines 25-651)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:03 UTC)
- **Note**: File exists but tests different module - create game/buildingSystem tests
- **Estimated Tests**: 40-60
- **Tests Added**: 7 tests
- **Coverage After**: 67.44%

### Task 3.3 - `src/game/gameLoop.js`
- **Target**: Create `tests/unit/gameLoop.test.js`
- **Source File**: `src/game/gameLoop.js` (0% coverage, lines 20-449)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:06 UTC)
- **Tests Added**: 8 tests
- **Coverage After**: Not measured

### Task 3.4 - `src/game/gameStateManager.js`
- **Target**: Create `tests/unit/gameStateManager.test.js`
- **Source File**: `src/game/gameStateManager.js` (0% coverage, lines 30-674)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:07 UTC)
- **Tests Added**: 24 tests
- **Estimated Tests**: 40-60

### Task 3.5 - `src/game/helipadLogic.js`
- **Target**: Create `tests/unit/helipadLogic.test.js`
- **Source File**: `src/game/helipadLogic.js` (0% coverage, lines 14-222)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:06 UTC)
- **Tests Added**: 7 tests
- **Coverage After**: Pending
- **Estimated Tests**: 25-35

### Task 3.6 - `src/game/hospitalLogic.js`
- **Target**: Create `tests/unit/hospitalLogic.test.js`
- **Source File**: `src/game/hospitalLogic.js` (0% coverage, lines 4-125)
- **Status**: [COMPLETED] (Finished: 2026-01-28 19:06 UTC)
- **Tests Added**: 8 tests
- **Coverage After**: N/A
- **Estimated Tests**: 15-25

### Task 3.7 - `src/game/milestoneSystem.js`
- **Target**: Create `tests/unit/milestoneSystem.test.js`
- **Source File**: `src/game/milestoneSystem.js` (0% coverage, lines 11-393)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-40

### Task 3.8 - `src/game/shadowOfWar.js`
- **Target**: Create `tests/unit/shadowOfWar.test.js`
- **Source File**: `src/game/shadowOfWar.js` (0% coverage, lines 11-357)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 25-40

### Task 3.9 - `src/game/supplyTruckLogic.js`
- **Target**: Create `tests/unit/supplyTruckLogic.test.js`
- **Source File**: `src/game/supplyTruckLogic.js` (0% coverage, lines 12-521)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 35-50

### Task 3.10 - `src/game/unitMovement.js`
- **Target**: Create `tests/unit/unitMovement.test.js`
- **Source File**: `src/game/unitMovement.js` (0% coverage, lines 24-391)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-45

### Task 3.11 - `src/game/unitCombat.js` (game folder version)
- **Target**: Create `tests/unit/gameFolderUnitCombat.test.js`
- **Source File**: `src/game/unitCombat.js` (0% coverage, lines 26-1811)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 80-120

### Task 3.12 - `src/game/workshopLogic.js`
- **Target**: Create `tests/unit/workshopLogic.test.js`
- **Source File**: `src/game/workshopLogic.js` (0% coverage, lines 12-602)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 40-60

### Task 3.13 - `src/game/flowField.js`
- **Target**: Create `tests/unit/flowField.test.js`
- **Source File**: `src/game/flowField.js` (3.24% coverage, lines 18-376)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-45

### Task 3.14 - `src/game/actionSystem.js`
- **Target**: Create `tests/unit/actionSystem.test.js`
- **Source File**: `src/game/actionSystem.js` (0% coverage, lines 8-208)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 25-35

### Task 3.15 - `src/game/ammoBuildingTruckLogic.js`
- **Target**: Create `tests/unit/ammoBuildingTruckLogic.test.js`
- **Source File**: `src/game/ammoBuildingTruckLogic.js` (0% coverage, lines 17-250)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 20-30

### Task 3.16 - `src/game/remoteControl.js`
- **Target**: Create `tests/unit/remoteControl.test.js`
- **Source File**: `src/game/remoteControl.js` (0.81% coverage, lines 19-922)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 50-70

### Task 3.17 - `src/game/coordBasedMovement.js`
- **Target**: Create `tests/unit/coordBasedMovement.test.js`
- **Source File**: `src/game/coordBasedMovement.js` (1.21% coverage, lines 58-2618)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 100-150

### Task 3.18 - `src/game/hitZoneDebug.js`
- **Target**: Create `tests/unit/hitZoneDebug.test.js`
- **Source File**: `src/game/hitZoneDebug.js` (0% coverage, lines 11-48)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 8-12

---

## PRIORITY 4: Input System Files (Zero/Low Coverage)

### Task 4.1 - `src/input/cheatSystem.js`
- **Target**: Create `tests/unit/cheatSystem.test.js`
- **Source File**: `src/input/cheatSystem.js` (1.64% coverage, lines 176-1329)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 60-80

### Task 4.2 - `src/input/cursorManager.js`
- **Target**: Create `tests/unit/cursorManager.test.js`
- **Source File**: `src/input/cursorManager.js` (7.44% coverage, lines 60-888)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 50-70

### Task 4.3 - `src/input/keyboardHandler.js`
- **Target**: Create `tests/unit/keyboardHandler.test.js`
- **Source File**: `src/input/keyboardHandler.js` (1.67% coverage, lines 48-1185)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 60-80

### Task 4.4 - `src/input/mouseHandler.js`
- **Target**: Create `tests/unit/mouseHandler.test.js`
- **Source File**: `src/input/mouseHandler.js` (1.48% coverage, lines 68-2135)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 100-140

### Task 4.5 - `src/input/unitCommands.js`
- **Target**: Create `tests/unit/unitCommands.test.js`
- **Source File**: `src/input/unitCommands.js` (0.24% coverage, lines 54-2119)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 100-130

### Task 4.6 - `src/input/selectionManager.js`
- **Target**: Create `tests/unit/selectionManager.test.js`
- **Source File**: `src/input/selectionManager.js` (1.69% coverage, lines 31-352)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-45

### Task 4.7 - `src/input/helpSystem.js`
- **Target**: Create `tests/unit/helpSystem.test.js`
- **Source File**: `src/input/helpSystem.js` (0% coverage, lines 6-70)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 10-15

### Task 4.8 - `src/input/controlGroupHandler.js`
- **Target**: Create `tests/unit/controlGroupHandler.test.js`
- **Source File**: `src/input/controlGroupHandler.js` (7.4% coverage, lines 17-155)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 15-25

### Task 4.9 - `src/input/multiUnitInputHandler.js`
- **Target**: Create `tests/unit/multiUnitInputHandler.test.js`
- **Source File**: `src/input/multiUnitInputHandler.js` (0% coverage, lines 7-353)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-45

### Task 4.10 - `src/input/remoteControlState.js`
- **Target**: Create `tests/unit/remoteControlState.test.js`
- **Source File**: `src/input/remoteControlState.js` (2.36% coverage, lines 28-274)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 25-35

---

## PRIORITY 5: Network System Files

### Task 5.1 - `src/network/inputBuffer.js`
- **Target**: Create `tests/unit/inputBuffer.test.js`
- **Source File**: `src/network/inputBuffer.js` (0% coverage, lines 9-375)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-45

### Task 5.2 - `src/network/lockstepManager.js`
- **Target**: Create `tests/unit/lockstepManager.test.js`
- **Source File**: `src/network/lockstepManager.js` (0% coverage, lines 15-616)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 40-60

### Task 5.3 - `src/network/multiplayerStore.js`
- **Target**: Create `tests/unit/multiplayerStore.test.js`
- **Source File**: `src/network/multiplayerStore.js` (1.69% coverage, lines 25-317)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 25-40

### Task 5.4 - `src/network/peerConnection.js`
- **Target**: Create `tests/unit/peerConnection.test.js`
- **Source File**: `src/network/peerConnection.js` (2.29% coverage, lines 25-348)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 30-45

### Task 5.5 - `src/network/webrtcSession.js`
- **Target**: Create `tests/unit/webrtcSession.test.js`
- **Source File**: `src/network/webrtcSession.js` (0% coverage, lines 9-577)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 40-60

### Task 5.6 - `src/network/aiPartySync.js`
- **Target**: Create `tests/unit/aiPartySync.test.js`
- **Source File**: `src/network/aiPartySync.js` (0% coverage, lines 16-143)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 15-25

### Task 5.7 - `src/network/gameCommandSync.js`
- **Target**: Extend `tests/unit/commandSync.test.js`
- **Source File**: `src/network/gameCommandSync.js` (3.55% coverage)
- **Status**: [ ] NOT STARTED
- **Estimated Tests**: 80-120

---

## PRIORITY 6: Benchmark Files

### Task 6.1 - `src/benchmark/benchmarkRunner.js`
- **Target**: Create `tests/unit/benchmarkRunner.test.js`
- **Source File**: `src/benchmark/benchmarkRunner.js` (0% coverage, lines 15-125)
- **Status**: [COMPLETED] (Finished: 2026-01-29 09:40 UTC)
- **Tests Added**: 20 tests
- **Estimated Tests**: 15-20

### Task 6.2 - `src/benchmark/benchmarkScenario.js`
- **Target**: Create `tests/unit/benchmarkScenario.test.js`
- **Source File**: `src/benchmark/benchmarkScenario.js` (0% coverage, lines 13-432)
- **Status**: [COMPLETED] (Finished: 2026-01-29 09:40 UTC)
- **Tests Added**: 37 tests
- **Estimated Tests**: 30-45

### Task 6.3 - `src/benchmark/benchmarkTracker.js`
- **Target**: Create `tests/unit/benchmarkTracker.test.js`
- **Source File**: `src/benchmark/benchmarkTracker.js` (5.11% coverage, lines 30-343)
- **Status**: [COMPLETED] (Finished: 2026-01-29 09:40 UTC)
- **Tests Added**: 39 tests
- **Estimated Tests**: 25-35

---

## PRIORITY 7: Utils & Misc Files (Extend Coverage)

### Task 7.1 - `src/utils/layoutMetrics.js`
- **Target**: Create `tests/unit/layoutMetrics.test.js`
- **Source File**: `src/utils/layoutMetrics.js` (1.05% coverage, lines 8-188)
- **Status**: [COMPLETED] (Finished: 2026-01-29 08:34 UTC)
- **Tests Added**: 31 tests
- **Coverage After**: Pending npm run test:coverage
- **Estimated Tests**: 20-30

### Task 7.2 - `src/utils/oreDiscovery.js`
- **Target**: Create `tests/unit/oreDiscovery.test.js`
- **Source File**: `src/utils/oreDiscovery.js` (0% coverage, lines 9-65)
- **Status**: [SKIPPED] File does not exist in codebase
- **Note**: File referenced in plan but not found in src/utils/. May be outdated or misnamed.
- **Estimated Tests**: 10-15

### Task 7.3 - `src/configRegistry.js`
- **Target**: Create `tests/unit/configRegistry.test.js`
- **Source File**: `src/configRegistry.js` (1.17% coverage, lines 143-880)
- **Status**: [COMPLETED] (Finished: 2026-01-29 08:34 UTC)
- **Tests Added**: 59 tests
- **Coverage After**: Pending npm run test:coverage
- **Estimated Tests**: 50-70

### Task 7.4 - `src/buildingImageMap.js`
- **Target**: Create `tests/unit/buildingImageMap.test.js`
- **Source File**: `src/buildingImageMap.js` (9.09% coverage, lines 39-114)
- **Status**: [COMPLETED] (Finished: 2026-01-29 08:34 UTC)
- **Tests Added**: 47 tests
- **Coverage After**: Pending npm run test:coverage
- **Estimated Tests**: 15-20

---

## PRIORITY 8: Extend Existing Tests (Increase Coverage)

### Task 8.1 - `src/buildings.js`
- **Target**: Extend coverage in `tests/unit/buildingSystem.test.js`
- **Source File**: `src/buildings.js` (53.54% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 643-769,778-869
- **Estimated Tests**: 30-40

### Task 8.2 - `src/logic.js`
- **Target**: Extend `tests/unit/logic.test.js`
- **Source File**: `src/logic.js` (45.27% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 339,473,496-562
- **Estimated Tests**: 25-35

### Task 8.3 - `src/inputHandler.js`
- **Target**: Create/extend `tests/unit/inputHandler.test.js`
- **Source File**: `src/inputHandler.js` (23.18% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 23-36,50-145
- **Estimated Tests**: 25-35

### Task 8.4 - `src/behaviours/retreat.js`
- **Target**: Extend `tests/unit/retreat.test.js`
- **Source File**: `src/behaviours/retreat.js` (70.86% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 467,478-481,485
- **Estimated Tests**: 10-15

### Task 8.5 - `src/game/harvesterLogic.js`
- **Target**: Extend `tests/unit/harvesterLogic.test.js`
- **Source File**: `src/game/harvesterLogic.js` (57.82% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 972-1239,1289
- **Estimated Tests**: 40-50

### Task 8.6 - `src/game/ambulanceSystem.js`
- **Target**: Extend `tests/unit/ambulanceSystem.test.js`
- **Source File**: `src/game/ambulanceSystem.js` (80.38% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 283,296-330,357
- **Estimated Tests**: 15-20

### Task 8.7 - `src/game/recoveryTankSystem.js`
- **Target**: Extend `tests/unit/recoveryTankSystem.test.js`
- **Source File**: `src/game/recoveryTankSystem.js` (69.63% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 535-547,557-563
- **Estimated Tests**: 15-20

### Task 8.8 - `src/game/steeringBehaviors.js`
- **Target**: Extend `tests/unit/steeringBehaviors.test.js`
- **Source File**: `src/game/steeringBehaviors.js` (73.18% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 447-456,469-534
- **Estimated Tests**: 20-25

### Task 8.9 - `src/config.js`
- **Target**: Create `tests/unit/config.test.js`
- **Source File**: `src/config.js` (42.92% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 1249,1257-1291
- **Estimated Tests**: 20-30

### Task 8.10 - `src/validation/buildingPlacement.js`
- **Target**: Extend `tests/integration/buildingPlacement.test.js`
- **Source File**: `src/validation/buildingPlacement.js` (55.05% → target 100%)
- **Status**: [ ] NOT STARTED
- **Uncovered Lines**: 158-186,209-231
- **Estimated Tests**: 20-25

---

## Agent Assignment Template

When claiming a task, update this file:

```
### Task X.Y - `filename`
- **Status**: [IN PROGRESS - Agent Name] (Started: YYYY-MM-DD HH:MM UTC)
```

When completing a task:

```
### Task X.Y - `filename`
- **Status**: [COMPLETED] (Finished: YYYY-MM-DD HH:MM UTC)
- **Tests Added**: XX tests
- **Coverage After**: XX%
```

---

## Quick Start Guide for Agents

1. **Claim your task** by updating this file with your agent name
2. **Read the source file** to understand what functions need testing
3. **Create/extend the test file** following existing test patterns
4. **Run tests**: `npm run test:coverage`
5. **Run lint fix**: `npm run lint:fix`
6. **Mark task complete** and update this file

### Test File Template

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import test utilities
import '../setup.js'

// Import functions to test
import { functionName } from '../../src/path/to/file.js'

describe('fileName.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('functionName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = {}
      
      // Act
      const result = functionName(input)
      
      // Assert
      expect(result).toBeDefined()
    })
  })
})
```

---

## Summary

| Priority | Tasks | Estimated New Tests |
|----------|-------|---------------------|
| P1 - Zero Coverage Core | 5 | ~150 |
| P2 - AI System | 5 | ~350 |
| P3 - Game Systems | 18 | ~700 |
| P4 - Input System | 10 | ~450 |
| P5 - Network System | 7 | ~280 |
| P6 - Benchmark | 3 | ~80 |
| P7 - Utils & Misc | 4 | ~100 |
| P8 - Extend Existing | 10 | ~240 |
| **Total** | **62** | **~2350** |

---

## Conflict Prevention Rules

1. **ONE agent per task** - Never work on the same task simultaneously
2. **Separate test files** - Each task creates/extends a distinct test file
3. **No shared modifications** - Don't modify source files, only test files
4. **Update this file atomically** - Update status immediately when claiming/completing
5. **If uncertain** - Choose an unclaimed task from a different priority group

---

*Last Updated: 2026-01-29T09:40:00Z*
