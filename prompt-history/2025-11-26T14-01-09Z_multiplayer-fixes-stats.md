# Multiplayer Attack, Bullet Interpolation & Network Stats

**UTC Timestamp:** 2025-11-26T14:01:09Z  
**LLM:** Claude Opus 4.5 (Preview) via GitHub Copilot

## Original Prompt Summary

User confirmed client units can now move after previous interpolation fixes and then requested three additional multiplayer improvements:

1. Client units not attacking host units after commanded to do so
2. Need bullet interpolation (like unit interpolation)
3. Add bytes received and sent to the performance widget

## Changes Made

### 1. Fixed UNIT_ATTACK Command Handler (`src/updateGame.js`)
- Host was setting `unit.attackTarget` but combat system uses `unit.target`
- Changed handler to set `unit.target = target` and `unit.forcedAttack = true`
- This allows client attack commands to properly propagate to host combat logic

### 2. Added Bullet Interpolation (`src/network/gameCommandSync.js`)
- Added `bulletInterpolationState` Map to track prev/target positions per bullet
- Added `updateBulletInterpolation()` function following same pattern as unit interpolation
- Modified bullet sync in `applyGameStateSnapshot()` to store interpolation state
- Called from `updateGame.js` alongside `updateUnitInterpolation()` on remote clients

### 3. Added Network Stats Tracking

#### `src/network/gameCommandSync.js`
- Added `networkStats` object export with:
  - `bytesSent` / `bytesReceived` - rolling counters for rate calculation
  - `sendRate` / `receiveRate` - calculated B/s rates
  - `totalSent` / `totalReceived` - cumulative totals
  - `lastUpdate` - timestamp for rate calculation

#### `src/network/remoteConnection.js` (Client)
- Added byte tracking on `send()`: `networkStats.bytesSent += payload.length`
- Added byte tracking on `message` event: `networkStats.bytesReceived += dataSize`

#### `src/network/webrtcSession.js` (Host)
- Added byte tracking on `sendHostStatus()` method
- Added byte tracking on data channel `message` event

### 4. Network Stats Display (`src/ui/fpsDisplay.js` & `index.html`)

#### HTML Changes (`index.html`)
Added new elements to FPS overlay container:
```html
<div id="networkStatsContainer" style="display: none;">
  <div style="border-top: 1px solid rgba(255,255,255,0.3); margin: 4px 0;"></div>
  <div id="networkSendRate">↑ 0 B/s</div>
  <div id="networkRecvRate">↓ 0 B/s</div>
  <div id="networkTotalSent">Sent: 0 KB</div>
  <div id="networkTotalRecv">Recv: 0 KB</div>
</div>
```

#### FPSDisplay Class Updates
- Added `networkStats` import from gameCommandSync
- Added tracking state: `lastNetworkUpdate`, `lastBytesSent`, `lastBytesReceived`
- Added element references for network stats DOM elements
- Added `updateNetworkStats(currentTime)` method that:
  - Only shows container when network traffic has occurred
  - Calculates send/receive rates based on delta bytes over elapsed time
  - Resets rolling counters after rate calculation
  - Formats bytes with `formatBytes()` helper (B/KB/MB)
- Added `formatBytes(bytes)` helper method

### 5. Bug Fixes
- Fixed unused imports in `remoteConnection.js` and `webrtcSession.js`
- Replaced `updateNetworkStats(...)` function calls with direct `networkStats` object property updates
- Prefixed unused `AI_FALLBACK_DELAY_MS` constant with underscore
- Prefixed unused `sendClientStateUpdate` function with underscore
- Fixed catch block without parameter usage

## Files Modified
- `src/updateGame.js` - Fixed attack handler, added bullet interpolation call
- `src/network/gameCommandSync.js` - Added networkStats, bulletInterpolationState, updateBulletInterpolation
- `src/network/remoteConnection.js` - Added network stats tracking
- `src/network/webrtcSession.js` - Added network stats tracking
- `src/ui/fpsDisplay.js` - Added network stats display
- `index.html` - Added network stats DOM elements
- `TODO.md` - Added T031 task
- `specs/multiplayer-network-stats.md` - New spec file

## Commit Message

```
fix(multiplayer): client attacks, bullet interpolation & network stats

- Fix UNIT_ATTACK handler to set unit.target instead of attackTarget
- Add bullet interpolation for smooth projectile rendering on clients
- Track WebRTC bytes sent/received on host and client data channels
- Display network stats (rates + totals) in FPS overlay when multiplayer active
- Fix unused imports and variables across network modules

Closes T031
```
