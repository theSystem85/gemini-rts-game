# LLM Control API (RTS)

This module defines the **LLM Control API** used to export deterministic strategic state snapshots and consume explicit LLM actions. The protocol is versioned and backed by TypeScript types, JSON Schema, and runtime validators.

## Protocol versioning
- Current version: **`1.0`** (`getSupportedProtocolVersion()`)
- Forward/backward compatibility:
  - Unknown fields are ignored by the engine.
  - New action types **must** be optional and rejected safely by the applier with a `NOT_SUPPORTED` reason.
  - The engine rejects payloads with unsupported `protocolVersion`.

## Primary types
- `GameTickInput`: deterministic snapshot + transition log (events since last strategic tick).
- `GameTickOutput`: explicit action list for direct execution.

See:
- `protocol.ts` (TypeScript types)
- `protocol.schema.json` (JSON Schema)
- `validate.js` (runtime validators)

## Integration points
### Exporter
```js
import { exportGameTickInput } from '@/ai-api'

const payload = exportGameTickInput(gameState, lastStrategicTick, {
  verbosity: 'normal',
  matchId: gameState.gameInstanceId,
  playerId: gameState.humanPlayer
})
```

### Applier
```js
import { applyGameTickOutput } from '@/ai-api'

const result = applyGameTickOutput(gameState, llmOutput)
// result = { accepted: [...], rejected: [...] }
```

### Transition collector hooks
The collector records combat and production transitions. Hooks are already added in:
- Unit spawns (`spawnUnit`)
- Building placement (`placeBuilding`) and completion (building renderer)
- Damage in bullets, explosions, and mines; destruction in cleanup loops for units, buildings, and factories

## Determinism and safety
- All actions are explicit: IDs and coordinates are required.
- Output validation rejects invalid actions with structured reasons.
- No code execution: only enumerated action types are accepted.
- OpenAI clients call `/v1/responses` with a `json_schema` text format derived from `protocol.schema.json`, chaining `previous_response_id` so the bootstrap brief + schema stay in context without resending history.

## Verbosity levels
- `minimal`: essential resources and entities
- `normal`: default, includes queues and current orders
- `full`: adds static map summaries (ore/obstacles)

## Output action types
- `build_place`: place a building at an explicit tile position
- `build_queue`: spawn one or more units from an explicit or inferred factory
- `unit_command`: move/attack/stop/hold/guard
- `set_rally`: set rally points on production buildings
- `cancel` / `ability`: currently rejected with `NOT_SUPPORTED` (reserved for future)

## Examples
See `examples/` for two input/output pairs:
- `early-game-*.json`
- `combat-*.json`
