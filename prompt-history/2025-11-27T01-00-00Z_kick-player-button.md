2025-11-27T01:00:00Z
LLM: copilot (Claude Opus 4.5)

## Prompt

Replace the invite ready label when the player has joined already with empty string and the invite button with a kick button that causes the player to be replaced by AI again.

## Changes Made

### 1. Added `kickPlayer()` function to `src/network/webrtcSession.js`
- New export function `kickPlayer(partyId)` that disconnects a connected player from a party
- Disposes the WebRTC session, releases remote control source
- Calls `markPartyControlledByAi()` and `emitAiReactivation()` to return the party to AI control
- Shows host notification about the kick
- Stops game state sync if no active sessions remain
- Returns `true` if a player was kicked, `false` if no player was connected

### 2. Updated `src/ui/sidebarMultiplayer.js`
- Imported `kickPlayer` from webrtcSession.js
- Modified `createPartyRow()` to detect when a human player is connected (not AI and not the host)
- When a human player is connected:
  - Status text is set to empty string (instead of "Invite ready")
  - "Invite" button is replaced with a red-styled "Kick" button
- Added `handleKickClick()` function that:
  - Disables the button and shows "Kicking…" text
  - Calls `kickPlayer(partyId)` to disconnect the player
  - Shows error notification if kick fails
  - On success, the ownership change event automatically refreshes the sidebar

### 3. Added CSS styles for kick button in `style.css`
- `.multiplayer-kick-button` class with red-tinted border and text color
- Hover state with red background highlight

## How It Works

1. When a remote player joins a party, `markPartyControlledByHuman()` is called and `aiActive` becomes `false`
2. The sidebar refreshes (via ownership change event) and `createPartyRow()` detects `!partyState.aiActive`
3. Instead of showing "Invite ready" status and "Invite" button, it shows empty status and "Kick" button
4. Host clicks "Kick" → `kickPlayer()` disconnects the WebRTC session and triggers AI takeover
5. The ownership change event causes the sidebar to refresh again, now showing the "Invite" button

## Files Modified

- `src/network/webrtcSession.js` - Added `kickPlayer()` function
- `src/ui/sidebarMultiplayer.js` - Added kick button logic and handler
- `style.css` - Added kick button styling
