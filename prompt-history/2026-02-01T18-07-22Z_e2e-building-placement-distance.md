# E2E Test - Building Placement Distance Fix

**Date**: 2026-02-01T18:07:22Z  
**LLM Model**: Claude Haiku 4.5  
**Agent**: GitHub Copilot

## Prompt Summary

Fixed E2E test building placement logic to ensure the power plant is placed 2 tiles away from the construction yard border.

## Issue

The `findPlacementPosition()` function was placing buildings too close to the construction yard, causing placement validation failures in the test.

## Solution

Enhanced the `findPlacementPosition()` helper function to:
1. Query the game state to find the initial factory/construction yard position
2. Calculate a position 2 tiles (64 pixels) away from the factory's edge in tile coordinates
3. Convert from tile coordinates to screen coordinates while accounting for scroll offset
4. Clamp the final position to stay within the visible canvas area
5. Fall back to bottom-right placement if the factory cannot be found

The function now:
- Retrieves factory position (x, y, width, height) from `window.gameState.buildings`
- Adds 2 tiles of distance (64 pixels) to calculate the building position
- Properly handles coordinate system conversion using `TILE_SIZE = 32`
- Accounts for camera scroll offset

## Files Changed

- `tests/e2e/basicGameFlow.test.js` - Updated `findPlacementPosition()` function (lines 164-213)

## Commands Run

- `npm run lint:fix` - Auto-fixed and verified linting compliance
