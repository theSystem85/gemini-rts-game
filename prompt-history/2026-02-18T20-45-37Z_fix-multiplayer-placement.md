UTC: 2026-02-18T20:45:37Z
LLM: copilot

## Prompt
now the building placement in this test does not work anymore automatically. Fix it: test:e2e:multiplayer:full but do not run the test yourself. Just try to find the issue and fix it. It must relate to your changes you just made.

## Notes
- Diagnosed regression in `src/ui/eventHandlers.js` introduced by dedup changes.
- Fixed map-grid mismatch in building placement flow by using a single grid reference for both validation and mutation.
- Did not run E2E test per request.
