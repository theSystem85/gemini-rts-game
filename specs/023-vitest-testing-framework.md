# Vitest Testing Framework Specification

## Overview
Vitest is integrated for headless unit and integration testing without video, audio, or rendering.

## Configuration

### Vitest Config (`vitest.config.js`)
- **Environment**: jsdom (DOM simulation for browser APIs)
- **Globals**: true (describe, it, expect available without imports)
- **Setup Files**: `tests/setup.js`
- **Coverage**: v8 provider with HTML/text/JSON reporters

### Test Setup (`tests/setup.js`)
Mocks the following browser APIs:
- `window.Audio` - No-op audio
- `window.HTMLMediaElement` - No-op video/audio elements
- `document.createElement('canvas')` - 2D context with mock drawing methods
- `HTMLCanvasElement.prototype.getContext('webgl')` - Mock WebGL context
- `window.localStorage` - In-memory key-value store
- `window.matchMedia` - Mock media query responses
- `window.logger` - Console proxy for game logging

## Test Utilities (`tests/testUtils.js`)

### Exports
- `createTestMapGrid(width, height)` - Create clean 2D tile grid
- `resetGameState()` - Reset gameState to initial values
- `createTestFactory(x, y, owner, mapGrid)` - Create construction yard
- `createTestBuilding(type, x, y, owner, mapGrid)` - Create any building
- `TestGameContext` class - Full test context with game loop simulation
- `chebyshevDistance(x1, y1, x2, y2)` - Distance helper
- `getMaxBuildingGap()` - Returns MAX_BUILDING_GAP_TILES
- `getBuildingData(type)` - Access building definitions

### TestGameContext Methods
- `addFactory(x, y, owner)` - Add construction yard to context
- `addBuilding(type, x, y, owner)` - Add building to context
- `canPlaceBuilding(type, x, y, owner)` - Check placement validity
- `isNearBuilding(x, y, owner)` - Check proximity to buildings
- `runTicks(ticks, deltaMs, onTick)` - Simulate game loop ticks
- `cleanup()` - Reset test state

## Module Architecture (Circular Import Fix)

### Problem
Importing from `buildings.js` triggers full module chain including `main.js` and the benchmark runner, which requires DOM and rendering context.

### Solution
Extract pure data and validation functions into separate modules:

1. **`src/data/buildingData.js`**
   - Contains building definitions (type, dimensions, health, power, etc.)
   - Minimal dependencies: only config constants
   - Used by: buildingPlacement.js, buildings.js, testUtils.js

2. **`src/validation/buildingPlacement.js`**
   - Contains: `canPlaceBuilding()`, `isNearExistingBuilding()`, `isTileValid()`
   - Depends on: config.js, data/buildingData.js
   - Used by: buildings.js, testUtils.js

3. **`src/buildings.js`**
   - Re-exports from data and validation modules
   - Provides wrapper for canPlaceBuilding that injects gameState.mapEditMode
   - Backwards compatible - existing imports continue to work

## NPM Scripts
- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run with coverage report

## Test Structure

### Integration Tests
Located in `tests/integration/`

Example: `buildingPlacement.test.js`
- Tests building placement near construction yards
- Covers 0, 1, 2, 3 tile gaps (MAX_BUILDING_GAP_TILES = 3)
- Includes negative tests for invalid placements
- Simulates game loop ticks without rendering

### Unit Tests
Located in `tests/unit/`
- Test individual functions in isolation
- No game state required
- Helipad logic unit tests validate fuel/ammo replenishment and landing/refuel flows without rendering dependencies.
- Enemy AI building placement tests validate defensive placement direction, spacing rules, and input guardrails with mocked dependencies.
- Enemy AI coverage includes `enemySpawner.test.js` verifying spawn placement, harvester ore targeting, crew/gas initialization, and cheat-system integration.
- Added enemyUnitBehavior AI tests covering crew recovery, ambulance routing, harvester hunter reactions, base defense, and apache retreat logic.
- Enemy AI strategy tests cover repair prioritization, retreat decisions, group attack coordination, crew recovery, and logistics resupply workflows.
- Added AI unit coverage in `tests/unit/enemyAIPlayer.test.js` for economy recovery, building completion, and production spawn selection.

### Game System Tests
- `tests/unit/buildingSystem.test.js` now includes coverage for `src/game/buildingSystem.js`, focusing on sell/destruction flows, defensive turret firing, and Tesla coil timing effects.
- These tests mock audio, timing, and rendering dependencies to keep unit tests deterministic while asserting meaningful gameplay state changes.

#### Game State Manager Coverage
- Added `tests/unit/gameStateManager.test.js` with focused scenarios for scrolling inertia, ore spread rules, particle cleanup, destruction cleanup, and win/loss conditions.

## Best Practices

1. **Use TestGameContext for integration tests**
   - Provides isolated game state per test
   - Handles cleanup automatically

2. **Import from validation module for pure function tests**
   - Avoids triggering game initialization
   - Faster test startup

3. **Mock external dependencies in setup.js**
   - Audio, Canvas, localStorage already mocked
   - Add new mocks as needed

4. **Use realistic test data**
   - Match actual building dimensions
   - Use valid map coordinates

5. **Mock render/audio dependencies in loop tests**
   - Unit tests for `GameLoop` should mock rendering, audio, and lockstep helpers.
   - Assert behavior through game state changes and scheduled frame calls rather than DOM rendering.


## Recent Coverage Additions
- Expanded `tests/unit/bulletSystem.test.js` to exercise `updateBullets()` and `fireBullet()` with mocked side effects and real collision geometry inputs.

## Example Test

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestGameContext, getMaxBuildingGap, getBuildingData } from '../testUtils.js'

describe('Building Placement', () => {
  let ctx

  beforeEach(() => {
    ctx = new TestGameContext({ mapWidth: 50, mapHeight: 50 })
    ctx.addFactory(25, 25, 'player')
  })

  afterEach(() => {
    ctx.cleanup()
  })

  it('should allow building adjacent to construction yard', () => {
    const cyWidth = getBuildingData('constructionYard').width
    const result = ctx.canPlaceBuilding('powerPlant', 25 + cyWidth, 25)
    expect(result).toBe(true)
  })

  it('should reject building too far from construction yard', () => {
    const maxGap = getMaxBuildingGap()
    const cyWidth = getBuildingData('constructionYard').width
    const result = ctx.canPlaceBuilding('powerPlant', 25 + cyWidth + maxGap + 1, 25)
    expect(result).toBe(false)
  })
})
```
