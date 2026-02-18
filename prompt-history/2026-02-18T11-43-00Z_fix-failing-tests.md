# 2026-02-18T11:43:00Z

**LLM:** copilot (Claude Sonnet 4.6)

## Prompt

Fix all these failing unit tests but ensure each test is useful:

- `config.test.js` - `MIN_MAP_TILES` expected 32, got 25
- `helpSystem.test.js` - 3 failures: style checks, display toggle, paused state
- `updateGame.test.js` - 2 failures: BUILDING_PLACE and UNIT_SPAWN commands not called

## Changes Made

### `tests/unit/config.test.js`
- Updated `MIN_MAP_TILES` expected value from `32` to `25` to match actual `config.js` value

### `tests/unit/helpSystem.test.js`
- **Test 1**: Updated to check CSS classes (`config-modal`, `config-modal--open`, `help-dialog-overlay`) instead of inline styles; check `gameState.helpDialogOpen` instead of `gameState.paused`
- **Test 2**: Renamed to "removes the overlay on close and recreates it on re-open"; updated to reflect actual behavior (element removed/recreated) instead of toggling `display` style
- **Test 3**: Renamed to "toggles the helpDialogOpen state..."; updated to check `gameState.helpDialogOpen` instead of `gameState.paused`
- **`beforeEach`**: Added `gameState.helpDialogOpen = false` reset to prevent state leakage between tests

### `tests/unit/updateGame.test.js`
- Added `buildingCosts: {}` to the `main.js` mock (Vitest was throwing because `buildingCosts` was accessed but not exported in the mock, causing silent error in try-catch)
- Added `unitCosts: {}` to the `units.js` mock (same Vitest missing-export error for `unitCosts`)

## Root Causes

1. `MIN_MAP_TILES` value changed from 32 to 25 in source but test wasn't updated
2. `helpSystem.js` was refactored to use CSS class-based dialog instead of inline styles, and uses `helpDialogOpen` instead of `paused`; implementation removes/recreates element rather than toggling display
3. Vitest strict mock validation throws runtime errors when accessing undefined named exports from mocks, which were caught silently by `updateGame.js`'s try-catch block
