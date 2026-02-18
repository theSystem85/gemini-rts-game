# Prompt History
- UTC: 2026-02-17T20-30-09Z
- LLM: GitHub Copilot (GPT-5.3-Codex)

## Prompt
- Add an extended multiplayer E2E that reuses the existing flow, makes each human party build 20 tanks via build menu, sends them with AGF into BLUE base, and only ends after BLUE is destroyed plus end-screen appears. Also add npm launch script for this full test.

## Actions
- Refactored shared multiplayer setup/join/build/economy checks into reusable `runMultiplayerScenario(browser, { fullAssault })` helper.
- Kept the existing baseline test by calling shared flow with `fullAssault: false`.
- Added extended test variant `extended full assault → 20 tanks each + AGF wipe blue + end screen` with larger timeout.
- Implemented helpers:
  - `buildTankStack(page, roleLabel, targetTankCount)`
  - `issueAgfAssault(page, roleLabel, targetPartyIds)`
  - `waitForPartyElimination(hostPage, partyId)`
  - `waitForGameEndScreen(hostPage)`
- Added grep-aware runner support (`PLAYWRIGHT_MULTIPLAYER_GREP`) in `scripts/runPlaywrightMultiplayer.js`.
- Added npm script `test:e2e:multiplayer:full` in `package.json`.
- Updated TODO/spec tracking entries.
