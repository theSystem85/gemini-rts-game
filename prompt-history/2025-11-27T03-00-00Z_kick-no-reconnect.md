2025-11-27T03:00:00Z
LLM: copilot (Claude Opus 4.5)

## Prompt

When the client gets kicked out he sees the reconnect screen immediately. Ensure the client sees the "you got kicked out" modal and not reconnect screen.

## Problem

When a client is kicked, the `handleKickedFromSession()` function calls `connection.stop()` which closes the WebRTC data channel. This triggers `handleDataChannelClose()` which shows the reconnect overlay, overriding the "you got kicked" experience.

## Solution

Added a `wasKicked` flag inside `initRemoteInviteLanding()` that tracks whether the client was kicked. When the kick message is received, the flag is set to `true` before calling `handleKickedFromSession()`. The `handleDataChannelClose()` handler now checks this flag and returns early if the client was kicked, allowing the game to continue in standalone mode without showing the reconnect screen.

## Changes Made

### `src/ui/remoteInviteLanding.js`

1. Added `let wasKicked = false` flag at the start of `initRemoteInviteLanding()`

2. Updated `handleDataChannelClose()` to check the flag:
   ```javascript
   const handleDataChannelClose = () => {
     // Don't show reconnect screen if we were kicked - game continues standalone
     if (wasKicked) {
       return
     }
     // ... rest of reconnect handling
   }
   ```

3. Updated kick message handling to set the flag:
   ```javascript
   if (payload.type === 'kicked') {
     wasKicked = true
     handleKickedFromSession(payload, overlay)
     return
   }
   ```

## Result

When a client is kicked:
1. They receive the 'kicked' message
2. `wasKicked` flag is set to `true`
3. `handleKickedFromSession()` is called - shows kick notification, converts to standalone host
4. Connection is stopped, data channel closes
5. `handleDataChannelClose()` sees `wasKicked=true` and returns early
6. Player continues game in standalone mode without seeing reconnect screen
