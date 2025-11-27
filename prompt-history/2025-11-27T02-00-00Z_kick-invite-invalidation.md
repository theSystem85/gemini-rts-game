2025-11-27T02:00:00Z
LLM: copilot (Claude Opus 4.5)

## Prompt

Make sure when a player gets kicked that the previous invite link gets invalidated, a new one on the host gets generated to invite another player and the kicked client sees a message that he was kicked from the session. His game continues but without any human players and he is the host now of that game. All other parties for the kicked client are then AI players.

## Changes Made

### 1. Added `invalidateInviteToken()` function to `src/network/multiplayerStore.js`
- New function that removes an invite token from local records and clears it from the party state
- Called when a player is kicked to ensure the old invite link no longer works

### 2. Updated `kickPlayer()` in `src/network/webrtcSession.js`
- Changed to async function to support waiting for invite regeneration
- Added imports for `invalidateInviteToken`, `generateInviteForParty`, and `getPartyState`
- Before disposing the WebRTC session, sends a `kicked` message to the client with:
  - `type: 'kicked'`
  - `reason: 'You were kicked from the session by the host.'`
  - `partyId` and `timestamp`
- Waits 100ms to ensure message is sent before disconnecting
- After kicking, invalidates the old invite token
- Generates a new invite token for the party
- Restarts the host invite monitoring with the new token

### 3. Added kick message handling in `src/ui/remoteInviteLanding.js`
- Added new imports: `getActiveRemoteConnection`, `showHostNotification`, `ensureMultiplayerState`, `generateRandomId`
- Added `handleKickedFromSession()` function that:
  - Stops the remote connection
  - Stops game state sync and resets client state
  - Hides the invite overlay (game continues)
  - Shows map settings again (since client is now host)
  - Generates new gameInstanceId and hostId
  - Sets up multiplayerSession as host (not remote)
  - Marks all other parties as AI-controlled
  - Shows notifications explaining the kick and new status
  - Removes the invite token from the URL to prevent re-join attempts

### 4. Updated `handleKickClick()` in `src/ui/sidebarMultiplayer.js`
- Changed to handle the async `kickPlayer()` function using `.then()/.catch()`

## How It Works

### Host Side (Kicking)
1. Host clicks "Kick" button on a connected player
2. Host sends `kicked` message via WebRTC data channel
3. Host waits 100ms for message to be delivered
4. Host disposes WebRTC session, marks party as AI
5. Host invalidates old invite token
6. Host generates new invite token
7. Host shows notification about new invite being ready

### Client Side (Being Kicked)
1. Client receives `kicked` message
2. Client stops remote connection and game sync
3. Client hides invite overlay (game continues running)
4. Client generates new game instance IDs (becomes separate game)
5. Client marks all other parties as AI
6. Client shows notifications about being kicked and becoming host
7. Client removes invite token from URL
8. Game continues with client as standalone host

## Files Modified

- `src/network/multiplayerStore.js` - Added `invalidateInviteToken()` function
- `src/network/webrtcSession.js` - Updated `kickPlayer()` to be async, send kick message, invalidate/regenerate tokens
- `src/ui/remoteInviteLanding.js` - Added `handleKickedFromSession()` to convert to standalone host
- `src/ui/sidebarMultiplayer.js` - Updated `handleKickClick()` for async kickPlayer
