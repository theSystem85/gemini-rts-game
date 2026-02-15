# Spec 034: Multiplayer Connectivity Stability & Responsive Pause Recovery

## Goals
- Improve multiplayer resiliency when a remote human client experiences packet loss, high jitter, or short disconnects.
- Pause simulation for all participants when a remote party becomes unresponsive.
- Show an unresponsiveness timer to host and all clients while reconnect is pending.
- Delay AI takeover to give reconnect a fair grace period.
- Keep compatibility with 2-4 player matches and mixed AI/human constellations.

## Implemented behavior
1. **Heartbeat monitoring**
   - Host sends periodic `heartbeat-ping` messages over data channels.
   - Clients answer with `heartbeat-pong` immediately.
   - Host marks a session unresponsive when no response is seen within timeout.

2. **Forced pause while reconnecting**
   - If any connected remote party is unresponsive, host forces `gamePaused = true`.
   - Pause state is propagated through regular host status payloads.
   - Pause is released automatically if all unresponsive parties recover and the game was not paused before forced pause.

3. **Unresponsive timer visibility**
   - Host-side party row displays `Reconnecting MM:SS` for affected party.
   - Client-side top banner shows `alias is reconnecting (MM:SS)`.

4. **Delayed AI takeover fallback**
   - AI takeover is delayed by a reconnect grace window (30s).
   - If reconnect fails after grace window, host returns the party to AI control and emits AI reactivation event.

5. **2-4 player support expectations**
   - Party state model preserves per-party responsiveness metadata.
   - Reconnect handling is party-local and does not assume fixed party count beyond configured 2-4 bounds.

## Non-goals
- No dev server/runtime orchestration changes.
- No direct network transport replacement (WebRTC remains transport).

## Validation strategy
- Unit tests for host pause + resume on heartbeat recovery.
- Existing multiplayer store/player count tests continue validating 2-4 party initialization behavior.
