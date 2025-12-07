# Feature Specification: Deterministic Lockstep Networking

**Feature Branch**: `015-deterministic-lockstep`
**Created**: 2025-12-04
**Status**: Proposed
**Input**: "Refactor multiplayer to use deterministic lockstep so peers only exchange user inputs and map state hashes while guaranteeing both host and client remain synchronized with seeded randomness."

---

## Overview

Implement deterministic lockstep networking to minimize bandwidth and ensure host/client simulations stay identical. The host remains authority for session admission, but runtime sync should rely on identical deterministic simulations driven by shared seeds and verified by periodic hash exchanges instead of full-state snapshots.

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

## Open Questions

- What tick rate balances responsiveness and determinism given existing render/update loops?
- Which systems require rollback support versus simple halt-and-resync on mismatch?
- How should late-joining spectators receive deterministic state (authoritative snapshot vs. deterministic replay)?
