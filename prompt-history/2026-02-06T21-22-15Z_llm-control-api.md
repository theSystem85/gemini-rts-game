# 2026-02-06T21-22-15Z
LLM: codex

## Prompt
here is a prompt from chatGPT that explains what you need to do but chatGPT did not have access to the repo so there might be requirements that you find might not be accurate. In that case just come up with a better decision. Here is the prompt:

You are Codex 5.3 High operating inside this repo. Your task: design and implement a complete, versioned RTS “LLM Control API” schema that the browser game engine can (A) export as input for the LLM every strategic tick and (B) consume as output actions produced by the LLM, deterministically and safely.

High-level goals
- Provide a single source of truth for the protocol: TypeScript types + JSON Schema + runtime validators
- The engine runs mostly serverless in the client browser, so the protocol must be compact, deterministic, and resilient
- The engine must be able to export:
  1) a full “current state snapshot” (compatible with or derived from existing savegame state)
  2) a “delta / transition log” since last strategic tick, including combat transitions: who damaged/destroyed whom, where, when
- The engine must be able to consume LLM output as “commands” that are already directly executable by the engine (or by a thin adapter), including building placement, unit production, and controlling ground units (move/attack/hold/stop/guard/patrol/ability)
- Include explicit schemas for:
  - Input to LLM (GameTickInput)
  - Output from LLM (GameTickOutput)
- Add a protocol version and forward/backward compatibility story
- Include at least 2 example payload pairs (input + output)

Constraints / design requirements
- Determinism: no “freeform” decisions at execution time. Commands must be explicit (target ids, positions, build types, etc.)
- Robustness: engine must validate output; invalid actions are rejected with structured errors (no crashes)
- Safety: LLM output must not be able to execute arbitrary code. Only enumerated command types.
- Efficiency: input should support “verbosity levels” (minimal / normal / full) and allow optional compression-friendly structures
- IDs: use stable entity IDs for units/buildings/projectiles if you have them; otherwise introduce stable ids and map from existing internal ids
- Coordinates: define clearly (tile coords vs world coords). Include both if needed, but be explicit and consistent
- Transitions: since last strategic tick, include a time-ordered event list (or segmented by sim ticks) with:
  - unit_created / building_started / building_completed
  - unit_moved (optional aggregate)
  - attack_started (optional)
  - damage (attacker, target, amount, weapon, position)
  - destroyed (killer, victim, position, cause)
  - resource_collected / delivered (optional)
  - visibility events (enemy_seen / enemy_lost) if fog of war exists
- Orders: output commands can be (a) atomic immediate commands or (b) queued orders. Choose one and implement consistently, but support both if feasible.
- Engine integration: locate existing savegame state shape; base snapshot schema on it or create an adapter that produces the new schema without breaking existing saves.

Deliverables
1) A new folder/module, e.g. `src/ai-api/` (adjust to repo conventions), containing:
   - `protocol.ts` with TypeScript types (discriminated unions)
   - `protocol.schema.json` (JSON Schema for input + output)
   - `validate.ts` runtime validation (use existing libs in repo; if none, prefer `zod` if present; otherwise write a tiny validator or add minimal dependency with justification)
   - `examples/` containing example JSON payloads
   - `README.md` describing the protocol and usage
2) Integration points:
   - `exportGameTickInput(state, sinceTick, options) -> GameTickInput`
   - `applyGameTickOutput(state, output, nowTick) -> { accepted: AppliedAction[], rejected: RejectedAction[] }`
   - A small “combat transition collector” that hooks into existing combat / damage / destroy logic and records structured events
   - If the game already has a tick loop, store `lastStrategicTick` and export transitions since then
3) Tests:
   - unit tests for validation and for applying a small set of actions (build + move + attack)
   - snapshot test for example payload validation

Implementation steps (do not ask me questions unless you truly cannot proceed)
A) Repo recon
- Search for existing state/save/combat/build command shapes: find localStorage save/load code, serialization types, entity id strategy, coordinate system, build queues, combat resolution
- Identify where damage/destroy events are computed; add event emission/collection with minimal intrusion
- Identify how buildings are placed and units are produced; identify how unit commands are represented internally

B) Protocol design
- Create `GameTickInput` with:
  - `protocolVersion`
  - `matchId`, `playerId`, `tick`, `sinceTick`
  - `meta` (map size, tile size, coordinate system, fog rules, unit/build catalog version/hash)
  - `snapshot` containing:
     - resources, power, tech/unlocks, build queues
     - all friendly units + buildings (and known enemy if fog)
     - map info relevant to strategy (ore fields, obstacles) with optional “known map only”
  - `transitions` containing:
     - `events[]` with required combat events (damage/destroyed with attacker/victim ids and positions)
     - summary aggregates (losses, kills, resource delta) for fast reasoning
  - `constraints` (action limits per tick, build placement rules summary, max queued commands)
  - `verbosity` echo
- Create `GameTickOutput` with:
  - `protocolVersion`, `tick`, `intent` (optional), `confidence` (optional)
  - `actions[]` with strict discriminated union:
     - `build_place` (buildingType, position, facing?, rallyPoint?)
     - `build_queue` (factoryId, unitType, count, priority)
     - `unit_command` (unitIds, command: move/attack/stop/hold/guard/patrol, targetId/targetPos, queueMode)
     - `set_rally` (buildingId, rallyPoint)
     - `cancel` (queue item)
     - `ability` (unitId, abilityId, target)
  - `notes` optional (short, ignored by engine)
- Every action must have a unique `actionId` to support idempotency and debugging

C) JSON Schema + validators
- Generate/handwrite JSON Schema matching TS types
- Add runtime validation and a strict parser that returns structured errors

D) Engine adapter
- Implement exporter: uses existing state; adds transitions since sinceTick from the collector
- Implement applier: validates, then calls existing engine functions. Rejections include reason codes:
  - `INVALID_SCHEMA`, `UNKNOWN_ENTITY`, `OUT_OF_RANGE`, `NOT_ENOUGH_RESOURCES`, `TECH_LOCKED`, `PLACEMENT_BLOCKED`, `COOLDOWN`, `RATE_LIMIT`, etc.

E) Docs + examples
- Provide 2 realistic inputs and corresponding outputs:
  1) early game: build power plant + refinery + factory + queue harvesters; rally; move scout
  2) combat: transitions show damage and destroyed; output focuses fire and retreats damaged unit

Quality bar
- Keep payloads clean and stable; avoid leaking internal engine implementation details unnecessarily
- Provide good naming and clear comments
- Make minimal changes outside the new module + small hooks in combat/build systems
- Ensure everything compiles and tests pass

Now do the work:
1) Inspect repo for existing state/save/combat/build command shapes
2) Propose the protocol in `src/ai-api/README.md` and `protocol.ts`
3) Add schema, validators, exporter, applier, transition collector hooks
4) Add examples + tests
5) Provide a short summary in the PR description style: what changed, how to use, where to hook the LLM

IMPORTANT: If you discover fog-of-war, multiple factories, or multiple selection control already exists, incorporate them. If not, still design the schema to allow them later without breaking changes. Ensure the current game AI does not break when there is no LLM in the loop yet (it will be implemented later). Just build it so when it is ready it just can be plugged in using the specified input and output JSON.

Another language model started to solve this problem and produced a summary of its thinking process. You also have access to the state of the tools that were used by that language model. Use this to build on the work that has already been done and avoid duplicating work.
