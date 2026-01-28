# Additional Unit Tests

**UTC Timestamp:** 2025-01-29T17:37:00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

User requested to add more tests to increase coverage (continuation of previous test implementation session).

## Changes Made

Created 4 new test files:

1. **tests/unit/smokeUtils.test.js** (26 tests)
   - Tests for `removeSmokeParticle`, `enforceSmokeParticleCapacity`, `emitSmokeParticles`
   - Covers particle creation, recycling, capacity enforcement, and edge cases

2. **tests/unit/debugLogger.test.js** (19 tests)
   - Tests for the debug logger module
   - Covers enabled/disabled states based on URL params
   - Tests all logger methods (log, warn, info, debug), isEnabled, and exports

3. **tests/unit/logic.test.js** (42 tests)
   - Tests for `normalizeAngle`, `angleDiff`, `smoothRotateTowardsAngle`
   - Tests for `isAdjacentToFactory`, `isAdjacentToBuilding`
   - Tests for `findClosestOre`, `findAdjacentTile`, `hasClearShot`

4. **tests/unit/retreat.test.js** (33 tests)
   - Tests for retreat behavior system
   - Covers `isRetreating`, `cancelRetreat`, `cancelRetreatForUnits`
   - Tests `shouldExitRetreat`, `initiateRetreat`, `updateRetreatBehavior`

## Test Summary

- Added 120 new tests across 4 files
- Total tests now: 1128 (up from 1002)
- All tests passing
- Lint clean
