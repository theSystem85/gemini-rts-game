# Vitest Integration for Headless Testing

**UTC Timestamp:** 2026-01-28T11:01:15Z  
**LLM:** Copilot (Claude Opus 4.5)

## Original Prompt

Integrate vitest (in its latest version) so it can be used for unit testing and headless integration testing without video, audio and rendering.

As starting test specs write tests for building a power plant near a construction yard (3 spacings defined by the constant MAX_BUILDING_GAP_TILES): variations include 0, 1, 2 tiles of free space around. Also write negative tests where the power plants are placed further away and therefore should be blocked.

## Follow-up Request

I don't like that you copied buildingData instead of using src/buildings.js directly. I don't want redundant code. Find a better solution to solve the circular import issue!

## Implementation Summary

### Vitest Installation
- Installed vitest 4.0.18 with jsdom environment
- Configured in `vitest.config.js` with globals, coverage, and test setup

### Module Refactoring (Circular Import Fix)
To avoid circular imports when importing from `buildings.js` (which imports the full game module chain), validation logic was extracted into separate pure modules:

1. **`src/data/buildingData.js`** - Central building data definitions with minimal dependencies
2. **`src/validation/buildingPlacement.js`** - Pure validation functions (canPlaceBuilding, isNearExistingBuilding, isTileValid)
3. **`src/buildings.js`** - Re-exports from data and validation modules for backwards compatibility

### Test Structure
- `tests/setup.js` - Mocks for Audio, Canvas, WebGL, localStorage, etc.
- `tests/testUtils.js` - TestGameContext class, helpers for creating test maps and buildings
- `tests/integration/buildingPlacement.test.js` - 31 tests covering all building placement scenarios

### Test Coverage
1. **Configuration tests** - Verify MAX_BUILDING_GAP_TILES = 3
2. **Variation 1** - 1 tile free space (5 tests)
3. **Variation 2** - 2 tiles free space (5 tests)
4. **Variation 3** - 0 tiles free space / directly adjacent (5 tests)
5. **Negative tests** - Placement beyond MAX_GAP (6 tests)
6. **Edge cases** - Exactly at MAX_GAP and MAX_GAP+1 (4 tests)
7. **Integration tests** - Game loop execution (3 tests)

## Files Created/Modified

### New Files
- `vitest.config.js`
- `tests/setup.js`
- `tests/testUtils.js`
- `tests/integration/buildingPlacement.test.js`
- `src/data/buildingData.js`
- `src/validation/buildingPlacement.js`

### Modified Files
- `package.json` - Added test scripts
- `src/buildings.js` - Re-exports from data and validation modules
- `src/game/shadowOfWar.js` - Updated import path

## Commands
- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
