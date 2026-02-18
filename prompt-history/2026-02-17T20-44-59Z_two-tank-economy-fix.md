# Prompt History
- UTC: 2026-02-17T20-44-59Z
- LLM: GitHub Copilot (GPT-5.3-Codex)

## Prompt
- Simplify extended multiplayer test so tanks attack BLUE immediately as they are ready, reduce to 2 tanks per human party, and fix multiplayer economy bug where client money handling is incorrect while building.

## Actions
- Updated extended multiplayer E2E flow:
  - Reduced target stack to 2 tanks per human party.
  - Issued immediate AGF assault toward BLUE at full-assault start and after each newly produced tank.
  - End condition now checks BLUE elimination (units/buildings/factories).
- Fixed authoritative multiplayer economy:
  - Host now deducts remote party production cost for `BUILDING_PLACE` and `UNIT_SPAWN` commands.
  - Remote clients no longer locally deduct/refund money while production progresses/cancels; host snapshots remain authoritative.
  - Party money snapshot + factory serialization use authoritative `mainFactories` data source.
- Updated TODO/spec tracking accordingly.
