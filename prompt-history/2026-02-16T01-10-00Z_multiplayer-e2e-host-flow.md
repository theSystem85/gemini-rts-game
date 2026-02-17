# Prompt History Entry
- UTC Timestamp: 2026-02-16T01:10:00Z
- LLM: copilot

## Prompt Summary
User reported issues in the multiplayer Netlify 4-party E2E and requested the test to enforce this exact runtime flow:
1. Host sets map to 25x25 and player count to 4.
2. Host minimizes tutorial and pauses the game.
3. Invite-link pages must never show tutorial.
4. Host opens invite for Red and Yellow, copy/pastes links into already-open browsers, and each remote submits alias (`RED`, `YELLOW`).
5. Blue remains local AI.
6. Host waits for both human remotes to connect, then resumes.
7. Controlled parties (Green/Red/Yellow) build base progression and produce 2 harvesters + first tank.
8. Tanks attack each other.

## Implementation Notes
- Reworked `tests/e2e/multiplayerNetlifyFourParty.test.js` to follow the requested choreography explicitly.
- Updated `TODO/Improvements.md` and `specs/034-multiplayer-connectivity-stability.md` to reflect the refined E2E requirements.
