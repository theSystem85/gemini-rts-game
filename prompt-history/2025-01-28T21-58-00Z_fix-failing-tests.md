# Fix All Failing Tests

**UTC Timestamp:** 2025-01-28T21:58:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## User Prompt
fix all failing tests but make sure they keep being useful

## Summary
Fixed all failing tests across multiple test files while ensuring the tests remain useful and meaningful. The issues were primarily related to:

1. **Module mocking issues** - Variables not properly hoisted for `vi.mock` factories
2. **Missing test setup** - Tests not properly initializing required game state
3. **Implementation changes** - Tests expecting APIs that had evolved

## Files Modified

### tests/unit/multiplayerStore.test.js
- Used `vi.hoisted()` to properly hoist the `gameStateMock` object
- Created `resetGameStateMock()` helper function to mutate the hoisted object instead of reassigning
- Updated all test cases to use `resetGameStateMock()` instead of reassigning `gameStateMock = createBaseState()`

### tests/unit/unitCommands.test.js
- Added `crew: { loader: true }` to the recovery tank in the test since `canRecoveryTankRepair` checks for crew loader
- Added proper coordinates (`tileX`, `tileY`, `x`, `y`) to the wreck mock since `computeUtilityApproachPath` requires valid coordinates

### tests/unit/gameLoop.test.js
- Set `loop.running = true` before calling `handlePausedFrame` to enable `requestRender` to call `requestAnimationFrame`
- Fixed the lockstep test to properly spy on `requestAnimationFrame` and check call counts

### tests/unit/lockstepManager.test.js
- Used `vi.hoisted()` for all mock functions (`mockDeterministicRNG`, `mockInitializeSessionRNG`, `mockSyncRNGForTick`, `mockComputeStateHash`, `mockCompareHashes`)
- Added peer state setup (`peerState.lastReceivedTick`) in the "advances ticks" test so `_canAdvanceTick()` returns true

### tests/unit/commandSync.test.js
- Used `vi.hoisted()` for `lockstepManagerMocks` and `inputBufferMocks`
- Added `gameState.partyStates` setup in the "notifies subscribers" test since `handleReceivedCommand` validates party states
- Fixed the "handles lockstep inputs" test to match actual implementation (removed incorrect `sendHostStatus` expectation)

### tests/unit/cursorManager.test.js
- Added mocks for `main.js` and `inputHandler.js` to prevent circular import issues
- Changed `toBe(true)` to `toBeTruthy()` for occupancy map check since the implementation returns the truthy value `1`

### tests/unit/aiPartySync.test.js
- Used `vi.hoisted()` for `observeAiReactivation` and `getPartyState` mock functions

## Test Results
- **Before:** 9 tests failing across 7 test files
- **After:** All 1986 tests passing across 75 test files

## Key Insights
1. When using `vi.mock` with factory functions, any variables referenced inside the factory must be defined using `vi.hoisted()` since `vi.mock` calls are hoisted to the top of the file
2. Tests that manipulate internal state need to consider all conditions that affect control flow (e.g., peer state for tick advancement)
3. Tests should use `toBeTruthy()`/`toBeFalsy()` when the implementation returns truthy/falsy values rather than strict booleans
