# Multiplayer Network Stats Overlay

## Context
- Date: 2025-11-26
- Prompt Source: Continue iteration request ("Continue to iterate?")
- LLM: GPT-5.1-Codex (Preview)

## Requirements
1. **Data Collection**
   - Track bytes sent/received on both host (`webrtcSession.js`) and client (`remoteConnection.js`) WebRTC data channels.
   - Maintain cumulative totals and rolling-per-second rates (resettable counters + totals).

2. **Presentation**
   - Extend existing FPS/performance overlay (`fpsDisplay.js`) to show:
     - Upstream (send) rate in B/s and human-readable units.
     - Downstream (receive) rate in B/s.
     - Total bytes sent/received (KB/MB units) since session start.
   - Only reveal stats block when any network traffic has occurred; keep UI hidden otherwise.

3. **Rendering & UX**
   - Display stats within FPS overlay container (top-right) separated by a divider line.
   - Update values at most once per second to avoid DOM spam; reuse existing FPS throttling logic.

4. **Interpolation Integration**
   - Ensure bullet interpolation updates run alongside unit interpolation on remote clients for smooth visuals whenever network snapshots arrive.

## Open Tasks
- Wire stats tracking to every `send`/`message` handler on host/client data channels.
- Surface computed rates/totals via `networkStats` object exported from `gameCommandSync.js`.
- Invoke `updateBulletInterpolation()` with the same cadence as unit interpolation to keep projectile visuals smooth for clients.
