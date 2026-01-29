# 2026-01-29T20:40:00Z
## LLM: GitHub Copilot (Claude Sonnet 4.5)

## Prompt
ensure that files that just export objects or constants are excluded from the unit test coverage report (for example mission_01.js)

## Changes Made

Updated the vitest configuration to exclude data-only files from unit test coverage reports.

### Modified Files

**vitest.config.js**
- Added exclusion patterns for data-only files in the coverage configuration:
  - `src/missions/mission_*.js` - Mission definition files that only export mission data objects
  - `src/data/**` - All data definition files (currently only `buildingData.js`)
- Added explanatory comment to clarify why these files are excluded

### Rationale

Files that only export constant objects or configuration data (like `mission_01.js` and `buildingData.js`) don't contain executable logic that needs to be tested. Including them in coverage reports:
- Creates artificially low coverage percentages
- Adds noise to coverage reports
- Makes it harder to identify actual untested logic

These data files should be excluded because:
1. They contain no testable logic (only data structures)
2. They cannot have meaningful unit tests written for them
3. Their correctness is validated through integration tests that use the data

### Files Excluded
- `src/missions/mission_01.js` - Mission data export
- `src/data/buildingData.js` - Building definitions export
