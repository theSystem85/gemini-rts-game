# Prompt History Entry

**UTC Timestamp:** 2026-02-01T09-55-00Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt

There is an issue in online multiplayer. When 2 parties are connected the game state from the host is not synced with the clients game state anymore. Also the map is not the same on the client. Ensure the client gets the same game state like the host (this already worked before at some point). Now the client is out of sync with the host. Fix the issue!

## Root Cause Analysis

The issue was introduced during the code splitting of `gameCommandSync.js` into separate modules (`stateSync.js`, `commandBroadcast.js`, `lockstepSync.js`).

In `stateSync.js`, the `hasActiveRemoteSession()` function was calling `getActiveHostMonitor()` **without a partyId argument**:

```javascript
function hasActiveRemoteSession() {
  const isRemote = Boolean(gameState.multiplayerSession?.isRemote)

  if (isHost()) {
    const hostMonitor = getActiveHostMonitor()  // BUG: Missing partyId!
    return hostMonitor ? hostMonitor.getConnectedPeerCount() > 0 : false
  }

  return isRemote
}
```

However, `getActiveHostMonitor(partyId)` in `webrtcSession.js` requires a partyId to look up the monitor from the `inviteMonitors` Map:

```javascript
export function getActiveHostMonitor(partyId) {
  return inviteMonitors.get(partyId) || null
}
```

When called without a partyId, `inviteMonitors.get(undefined)` returns `undefined`, causing `hasActiveRemoteSession()` to always return `false` for the host. This meant:

1. The host's periodic state sync interval was set up correctly
2. But `broadcastGameStateSnapshot()` was never called because `hasActiveRemoteSession()` returned `false`
3. Therefore, the client never received game state snapshots from the host
4. Both the game state AND the map were out of sync (map sync happens in the first snapshot)

## Fix Applied

Updated `hasActiveRemoteSession()` in `stateSync.js` to iterate over all party states and check if any party has connected peers (similar to how `broadcastToAllPeers()` works in `commandBroadcast.js`):

```javascript
function hasActiveRemoteSession() {
  const isRemote = Boolean(gameState.multiplayerSession?.isRemote)

  if (isHost()) {
    // Check if any party has connected peers
    if (!Array.isArray(gameState.partyStates)) {
      return false
    }
    for (const party of gameState.partyStates) {
      if (party.partyId === gameState.humanPlayer) {
        continue // Skip self
      }
      const monitor = getActiveHostMonitor(party.partyId)
      if (monitor && monitor.getConnectedPeerCount() > 0) {
        return true
      }
    }
    return false
  }

  return isRemote
}
```

## Files Changed

- `src/network/stateSync.js` - Fixed `hasActiveRemoteSession()` function to properly check for connected peers

## Summary

Fixed a regression in online multiplayer where the host was not syncing game state to clients. The bug was introduced during code splitting - the `hasActiveRemoteSession()` function was calling `getActiveHostMonitor()` without the required `partyId` argument, causing it to always return `false` for the host. This prevented all game state snapshots (including initial map sync) from being sent to clients.

**Note:** This fix contained a bug - used `monitor.getConnectedPeerCount()` which doesn't exist. See `2026-02-01T12-25-32Z_multiplayer-sync-fix-2.md` for the correction.
