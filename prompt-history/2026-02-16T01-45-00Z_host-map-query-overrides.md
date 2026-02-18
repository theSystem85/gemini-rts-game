# Prompt History Entry
- UTC Timestamp: 2026-02-16T01:45:00Z
- LLM: copilot

## Prompt Summary
User reported multiplayer Netlify E2E still failing and requested:
- Host must reliably use 25x25 map, 4 players, seed 11.
- Add runtime map query-param loading for size/seed/players that dominates localStorage only for current session (non-persistent).
- Ensure invite links are copied correctly for RED/YELLOW remote joins.
- Use only 3 browser windows (host, red, yellow) because blue remains local AI.
- Do not run the E2E test from the agent.

## Work Completed
- Updated startup map settings logic in `src/game/gameOrchestrator.js` to parse and apply `size`, `width`, `height`, `players`, `seed` query params with temporary precedence over localStorage.
- Reduced minimum map size to support 25x25 by setting `MIN_MAP_TILES` to 25 in `src/config.js`.
- Updated `tests/e2e/multiplayerNetlifyFourParty.test.js`:
  - Host opens with `/?size=25&players=4&seed=11`.
  - Asserts map width/height/playerCount/seed on host.
  - Uses only 3 browser contexts/pages (host/red/yellow).
  - Keeps blue as host-local AI.
