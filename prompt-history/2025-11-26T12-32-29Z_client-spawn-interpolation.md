# Client Unit Spawn and Smooth Movement Fix

**UTC Timestamp:** 2025-11-26T12:32:29Z  
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt Summary

User reported 3 issues:
1. When client builds a unit, it appears briefly then disappears
2. Unit movements are not smooth (jerky)
3. Request for diff-based sync or hash-based full sync

## Root Cause Analysis

### Issue 1: Client Unit Disappearing
- Client was spawning units locally in `productionQueue.js`
- Next snapshot from host didn't include that unit (host doesn't know about it)
- Snapshot application replaced the units array, removing the locally-spawned unit

### Issue 2: Jerky Movement
- Snapshots arrive every 500ms with new positions
- Units were jumping directly to new positions instead of smooth interpolation

## Solution

### 1. Client Unit Spawn → Host Request

Modified `productionQueue.js` to check if running as remote client:
- **Client**: Send `UNIT_SPAWN` command to host (don't spawn locally)
- **Host**: Spawn unit locally and it appears in next snapshot

```javascript
// In completeCurrentUnitProduction()
const isRemoteClient = !isHost() && gameState.multiplayerSession?.isRemote

if (isRemoteClient) {
  // Send spawn request to host
  broadcastUnitSpawn(unitType, spawnFactory.id, rallyPointTarget)
  playSound(randomSound, 1.0, 0, true)  // Local feedback
} else {
  // Host: spawn locally
  const newUnit = spawnUnit(...)
  units.push(newUnit)
}
```

### 2. Host Processes UNIT_SPAWN Command

Added handler in `updateGame.js`:
```javascript
} else if (cmd.commandType === COMMAND_TYPES.UNIT_SPAWN && cmd.payload) {
  const { unitType, factoryId, rallyPoint } = cmd.payload
  const partyId = cmd.sourcePartyId
  // Find factory and spawn unit for client
  const newUnit = spawnUnit(spawnFactory, unitType, ...)
  newUnit.owner = partyId
  mainUnits.push(newUnit)
}
```

### 3. Smooth Movement Interpolation

Added interpolation system in `gameCommandSync.js`:

```javascript
// Track interpolation state per unit
const unitInterpolationState = new Map()
const INTERPOLATION_DURATION_MS = 450  // Less than 500ms sync interval

// In applyGameStateSnapshot - for position changes:
if (positionChanged) {
  unitInterpolationState.set(snapshotUnit.id, {
    startX: existing.x, startY: existing.y,
    targetX: snapshotUnit.x, targetY: snapshotUnit.y,
    startTime: now, duration: INTERPOLATION_DURATION_MS
  })
  // Don't update position immediately - let interpolation handle it
}

// New function called each frame on client:
export function updateUnitInterpolation() {
  const now = performance.now()
  for (const [unitId, interp] of unitInterpolationState.entries()) {
    const progress = Math.min(1, elapsed / interp.duration)
    const eased = 1 - (1 - progress) * (1 - progress)  // easeOutQuad
    unit.x = interp.startX + (interp.targetX - interp.startX) * eased
    unit.y = interp.startY + (interp.targetY - interp.startY) * eased
  }
}
```

Called from `updateGame.js` for clients:
```javascript
if (isRemoteClient) {
  updateUnitInterpolation()
}
```

## Files Modified

1. **src/network/gameCommandSync.js**
   - Added `UNIT_SPAWN` command type
   - Added `GAME_STATE_DELTA` command type (infrastructure for future)
   - Added `unitInterpolationState` Map for tracking interpolation
   - Added `broadcastUnitSpawn()` function
   - Added `updateUnitInterpolation()` export
   - Added `isRemoteClient()` helper export
   - Modified `applyGameStateSnapshot()` to use interpolation

2. **src/updateGame.js**
   - Import `updateUnitInterpolation` and `spawnUnit`
   - Added `UNIT_SPAWN` command handling in host
   - Call `updateUnitInterpolation()` for remote clients

3. **src/productionQueue.js**
   - Import `broadcastUnitSpawn`, `isHost`
   - Modified `completeCurrentUnitProduction()` to send request to host on client

## Expected Results

- ✅ Client-produced units persist (spawned by host, appear in snapshot)
- ✅ Smooth unit movement via easeOutQuad interpolation
- ✅ Infrastructure in place for future delta/hash-based sync
