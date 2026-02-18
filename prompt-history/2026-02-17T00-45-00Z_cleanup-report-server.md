# 2026-02-17T00:45:00Z
**LLM:** copilot (GPT-5.3-Codex)

## Prompt
User requested that after E2E test completion, no report server remains on `http://localhost:9323` because it causes agent mode to hang waiting for process completion.

## Changes
- Added `scripts/runPlaywrightMultiplayer.js`:
  - Runs multiplayer E2E via `npx playwright test tests/e2e/multiplayerNetlifyFourParty.test.js --project=chromium`
  - Forces `PLAYWRIGHT_HTML_OPEN=never` to prevent Playwright from opening/serving HTML report automatically
  - Performs post-run cleanup for `tcp:9323` via `lsof -ti tcp:9323` and `kill -9` for any leftover process IDs
  - Preserves test exit code
- Updated `package.json`:
  - `test:e2e:multiplayer` now calls `node scripts/runPlaywrightMultiplayer.js`

## Tracking
- Updated `TODO/Improvements.md` with report-server cleanup requirement.
- Updated `specs/034-multiplayer-connectivity-stability.md` validation bullets with no-leftover-9323 requirement.
