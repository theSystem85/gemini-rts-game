# Prompt History
- UTC: 2026-02-17T20-53-13Z
- LLM: GitHub Copilot (GPT-5.3-Codex)

## Prompt
- Do not run E2E automatically anymore. Fix remaining issues: (1) only green attacked blue while red/yellow did nothing, (2) ensure AGF attacks all BLUE buildings automatically and ignore BLUE units.

## Actions
- Stopped running E2E and applied code-only fixes + lint only.
- Reworked extended assault command issuance to host-authoritative per party (`player1`, `player2`, `player4`) so RED/YELLOW orders are applied by the simulation authority.
- Changed AGF target collection to BLUE structures only (`buildings` + `factories`, excluding units and concrete walls).
- Kept immediate assault behavior by issuing AGF once at full-assault start and after each new tank becomes ready.
- Updated test title and package script grep pattern to match the updated extended scenario name.
- Updated TODO/spec tracking entries.
