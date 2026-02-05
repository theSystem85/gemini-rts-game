# Prompt: Fix Failing Unit Tests

**Timestamp**: 2025-02-05T00:00:00Z  
**LLM**: GitHub Copilot (Claude Haiku 4.5)

## Request
Fix all failing unit tests but ensure each test keeps being useful.

## Problem
Two unit tests in bulletSystem.test.js were failing:
- Test at line 1061
- Test at line 1172

Both failures were caused by a missing `getUnitCost` export in the mocked utils.js module. The error message indicated: "No 'getUnitCost' export is defined on the '../../src/utils.js' mock."

The issue occurred because `combatStats.js` imports and uses `getUnitCost` from utils.js, and it gets called during bullet damage calculations. Since the mock in bulletSystem.test.js didn't define this function, the tests failed.

## Solution
Added `getUnitCost` function to the utils.js mock in bulletSystem.test.js:
- Updated the mock definition to include `getUnitCost: vi.fn(() => 0)`
- This allows combatStats.js to successfully calculate target costs without errors

## Results
- ✅ All 3468 tests now pass
- ✅ No linting errors
- ✅ Each test remains useful and validated

## Files Modified
- `/Users/hella/Documents/projects/gemini-rts-game/tests/unit/bulletSystem.test.js`

## Changes Made
- Updated `vi.mock('../../src/utils.js', ...)` to include the `getUnitCost` function in the mock
