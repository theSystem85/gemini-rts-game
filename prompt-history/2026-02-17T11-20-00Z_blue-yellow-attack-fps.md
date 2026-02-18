# Prompt History Entry

- UTC Timestamp: 2026-02-17T11:20:00Z
- Processed by: copilot (GPT-5.3-Codex)

## User Request
The multiplayer E2E test mixed up YELLOW and BLUE (third party is BLUE, not YELLOW). Update the test so all human player units attack BLUE when BLUE is AI-controlled, fix the YELLOW/BLUE mapping, and improve very low FPS under Playwright (~8 FPS vs expected ~60/75).

## Implementation Summary
- Corrected party mapping in `tests/e2e/multiplayerNetlifyFourParty.test.js`:
  - Controlled humans: `player1` (Green), `player2` (Red), `player4` (Yellow)
  - AI party: `player3` (Blue)
  - Invite flow now invites `player2` and `player4`.
- Updated human/AI connection verification to assert `player4` is human and `player3` remains AI.
- Updated combat setup so Green/Red/Yellow tanks focus-fire Blue AI tank instead of cycling targets among themselves.
- Provisioning now includes Blue AI so a deterministic Blue tank target exists for combat setup.
- Added Chromium anti-throttling launch flags for headed multi-window runs:
  - `--disable-background-timer-throttling`
  - `--disable-backgrounding-occluded-windows`
  - `--disable-renderer-backgrounding`
- Updated tracking/spec docs:
  - `TODO/Improvements.md`
  - `specs/034-multiplayer-connectivity-stability.md`
