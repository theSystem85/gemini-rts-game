# Multiplayer Sync Fixes

**UTC Timestamp:** 2025-01-22T14:30:00Z
**LLM:** GitHub Copilot (Claude Opus 4.5)

## Prompt Summary

Continuation of User Story 3 (T016-T018) multiplayer implementation. Previous tasks were completed but testing revealed 4 remaining issues:

1. Client buildings not syncing to host
2. Client camera at wrong location (sees host's base, not their own)
3. Client build options wrong (humanPlayer not set to their party)
4. Units built by host not visible to client

## Changes Made

### 1. Added partyId parsing from invite token (`src/network/invites.js`)
- Added `parsePartyIdFromToken(token)` function to extract partyId from invite token
- Token format: `${gameInstanceId}-${partyId}-${timestamp}`

### 2. Client initialization on connect (`src/ui/remoteInviteLanding.js`)
- Parse partyId from invite token when client connects
- Set `gameState.humanPlayer` to the client's partyId
- Added `centerCameraOnPartyBase()` function to scroll camera to client's construction yard
- Call `setClientPartyId()` and `resetClientState()` for proper lifecycle management

### 3. Game state sync improvements (`src/network/gameCommandSync.js`)
- Added client state tracking: `clientPartyId`, `clientInitialized`
- Added exports: `setClientPartyId()`, `getClientPartyId()`, `resetClientState()`
- Added factories to snapshot for proper base location lookup
- Updated `applyGameStateSnapshot()` to set humanPlayer on first snapshot

### 4. Imports added
- `parsePartyIdFromToken` from invites.js
- `TILE_SIZE`, `MAP_TILES_X`, `MAP_TILES_Y` from config.js
- `gameState` from gameState.js

## Technical Details

- Camera centering uses a 500ms delay to allow state sync before centering
- Factory lookup checks both `buildings` and `factories` arrays
- Console logging added for debugging client party assignment

## Files Modified

1. `src/network/invites.js` - Added parsePartyIdFromToken function
2. `src/network/gameCommandSync.js` - Added client state management and factories sync
3. `src/ui/remoteInviteLanding.js` - Added client initialization on connect
