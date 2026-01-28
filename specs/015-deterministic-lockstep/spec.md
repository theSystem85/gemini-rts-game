# Feature Specification: Deterministic Lockstep Networking

**Feature Branch**: `015-deterministic-lockstep`
**Created**: 2025-12-04
**Status**: ⚠️ Follow-up Work Pending
**Input**: "Refactor multiplayer to use deterministic lockstep so peers only exchange user inputs and map state hashes while guaranteeing both host and client remain synchronized with seeded randomness."

---

## Overview

Implement deterministic lockstep networking to minimize bandwidth and ensure host/client simulations stay identical. The host remains authority for session admission, but runtime sync should rely on identical deterministic simulations driven by shared seeds and verified by periodic hash exchanges instead of full-state snapshots.

---

## Implementation Status

### Completed
- ✅ **Seedable PRNG Module** (`src/network/deterministicRandom.js`)
  - Mulberry32 algorithm for high-quality deterministic random numbers
  - Session seed initialization and per-tick synchronization
  - Drop-in replacements: `random()`, `randomInt()`, `randomFloat()`, `randomElement()`, `shuffle()`, `randomBool()`

- ✅ **Lockstep Manager** (`src/network/lockstepManager.js`)
  - 20 Hz tick rate (50ms per tick) with configurable parameters
  - Peer state tracking and tick synchronization
  - Input collection and confirmation across peers
  - State history for potential rollback (60-tick buffer)

- ✅ **State Hash System** (`src/network/stateHash.js`)
  - FNV-1a inspired hashing for game state verification
  - Quantized positions (0.01 pixel precision) to avoid float drift
  - Quantized angles (0.001 radian precision)
  - Hash reports for debugging desync issues

- ✅ **Input Buffer System** (`src/network/inputBuffer.js`)
  - 3-tick input delay to accommodate network latency
  - Duplicate detection and command queuing
  - Circular buffer cleanup for memory efficiency
  - Input types: UNIT_MOVE, UNIT_ATTACK, UNIT_STOP, BUILD_PLACE, PRODUCTION_START, GAME_PAUSE

- ✅ **Game Random Utilities** (`src/utils/gameRandom.js`)
  - Wrapper functions for easy integration into existing game code
  - Automatic fallback to Math.random when lockstep disabled

- ✅ **GameState Lockstep Properties** (`src/gameState.js`)
  - `lockstep.enabled`, `lockstep.currentTick`, `lockstep.sessionSeed`
  - Desync tracking, tick accumulator, peer states, input queues

- ✅ **Network Command Types** (`src/network/gameCommandSync.js`)
  - LOCKSTEP_INIT, LOCKSTEP_INPUT, LOCKSTEP_INPUT_ACK
  - LOCKSTEP_HASH, LOCKSTEP_HASH_MISMATCH, LOCKSTEP_RESYNC

- ✅ **Game Loop Integration** (`src/game/gameLoop.js`)
  - Fixed timestep tick processing when lockstep enabled
  - Time accumulator with max ticks per frame limit
  - Fallback to variable timestep when lockstep disabled

- ✅ **Desync Detection & Recovery**
  - Periodic hash exchange at configurable intervals
  - Hash comparison across all peers
  - Host-initiated resync with full state snapshot on desync

- ✅ **Math.random() Replacement**
  - All game-critical code converted to use `gameRandom()` from `src/utils/gameRandom.js`
  - Deterministic random for: AI behavior, combat, smoke particles, unit spawning, map generation, etc.

- ✅ **Multiplayer Integration** (`src/network/webrtcSession.js`)
  - Lockstep automatically initialized when first client connects
  - Lockstep disabled when all clients disconnect
  - Shared session seed propagated via LOCKSTEP_INIT message

- ✅ **UI Status Indicator** (`src/ui/fpsDisplay.js`, `index.html`)
  - Lockstep mode status shown in FPS overlay when enabled
  - Current tick counter display
  - Desync warning indicator with tick information
  - Host/Client role indicator
- ✅ **Unit Test Coverage**
  - Added command sync payload + state hash unit tests (`tests/unit/commandSync.test.js`).
  - Added input buffer unit coverage for lockstep command buffering (`tests/unit/inputBuffer.test.js`).

### Outstanding
- ❗ Ensure client-side explosion rendering remains animated when driven purely by lockstep inputs (currently explosions appear static compared to host).
- ❗ Building construction received via network must replay the full fade/raise animation instead of instantly appearing completed on clients.
- ❗ Smoke emissions tied to buildings should trigger only after the construction animation finishes to avoid smoke coming from invisible structures.

---

## Requirements

1. **Input-Only Synchronization**
   - Replace per-frame state snapshots with input command broadcasting; host validates and echoes command frames to all peers.
   - Define a fixed simulation tick rate and buffer inputs to accommodate latency, ensuring all peers step the same ticks.
2. **Seeded Determinism**
   - Introduce a shared session seed (map seed + RNG seed) propagated at connection time and stored in saves/rejoins.
   - Replace non-deterministic random calls (e.g., `Math.random`) with a seedable PRNG accessible across game systems.
   - Ensure time-dependent effects (timeouts, animations) advance based on tick counts rather than wall-clock timestamps.
3. **State Verification**
   - Periodically compute deterministic map/game-state hashes (per tick or at intervals) and exchange/compare hashes between peers.
   - Define mismatch handling (rewind/resimulate from last agreed tick, or request host re-sync snapshot when divergence is detected).
4. **Deterministic Serialization**
   - Normalize ordering for arrays/collections (units, bullets, wrecks, factories) before hashing/serialization.
   - Avoid floating-point drift by quantizing positions/velocities for networked simulation where feasible.
5. **Backward Compatibility & Migration**
   - Keep a transitional compatibility mode that can still send full snapshots for debugging or legacy clients.
   - Update documentation and UI to indicate lockstep mode status and any debug hash mismatch indicators.

---

## Open Questions (Resolved)

- **Tick rate**: 20 Hz (50ms per tick) balances responsiveness with network latency tolerance
- **Rollback vs Resync**: Using halt-and-resync approach - host sends full state snapshot on desync detection
- **Late-joining spectators**: Receive authoritative snapshot from host, then join lockstep simulation
