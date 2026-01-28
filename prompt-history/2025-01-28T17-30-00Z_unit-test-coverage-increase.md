# Unit Test Coverage Increase

**UTC Timestamp:** 2025-01-28T17:30:00Z
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

Run the test coverage script and implement more tests to get the coverage up beginning from the first files listed in the report. Do as many reasonable unit tests as you can in one response without sacrificing the usefulness of each unit test.

## Implementation Summary

Created 6 new test files targeting modules with 0% coverage:

### New Test Files Created

1. **tests/unit/enemyUtils.test.js** (29 tests)
   - Tests for `areEnemies()`, `getEnemyPlayers()`, `isEnemyTo()`, `getClosestEnemyFactory()`, `isPartOfFactory()`
   - Covers player relationship detection and factory finding utilities

2. **tests/unit/guardBehavior.test.js** (12 tests)
   - Tests for `updateGuardBehavior()` from `src/behaviours/guard.js`
   - Covers guard mode activation, path calculation intervals, follow distance logic

3. **tests/unit/dangerZoneMap.test.js** (32 tests)
   - Tests for `computeBuildingDps()`, `generateDangerZoneMapForPlayer()`, `updateDangerZoneMaps()`
   - Covers DPS calculation, danger zone generation, turret range handling, power requirements

4. **tests/unit/seedUtils.test.js** (39 tests)
   - Tests for `generateRandomSeed()`, `hashSeedString()`, `sanitizeSeed()`
   - Covers seed generation, string hashing, seed sanitization with various input types

5. **tests/unit/helipadUtils.test.js** (23 tests)
   - Tests for `getHelipadLandingCenter()`, `getHelipadLandingTile()`, `getHelipadLandingTopLeft()`
   - Covers helipad landing position calculations

6. **tests/unit/inputUtils.test.js** (28 tests)
   - Tests for `isInputFieldFocused()`, `isForceAttackModifierActive()`, `isGuardModifierActive()`
   - Covers input field detection and modifier key tracking

### Coverage Improvements

| File | Before | After |
|------|--------|-------|
| src/ai/enemyUtils.js | 0% | 100% |
| src/behaviours/guard.js | 0% | 100% |
| src/game/dangerZoneMap.js | 0% | 100% |
| src/utils/seedUtils.js | 0% | 100% |
| src/utils/helipadUtils.js | 7.14% | 100% |
| src/utils/inputUtils.js | 9.09% | 95.45% |

### Test Count

- Before: 839 tests
- After: 1002 tests
- Added: 163 new tests

All tests pass and linting is clean.
