# Host Polling Defer

**UTC Timestamp:** 2025-12-04T12:00:00Z  
**LLM:** Claude Opus 4.5 (Copilot)

## Prompt

> ensure the host only starts polling the signaling server AFTER the user clicked some invite link

## Changes Made

Modified `src/ui/sidebarMultiplayer.js` to remove automatic polling start on sidebar initialization.

### Before
The `initSidebarMultiplayer()` function was iterating through all party states and starting polling for any party that already had an invite token:

```javascript
export function initSidebarMultiplayer() {
  partyListContainer = document.getElementById(PARTY_LIST_ID)
  refreshSidebarMultiplayer()
  setupHostControlWatcher()
  setupPartyOwnershipWatcher()
  setupAliasInput()
  listPartyStates().forEach((partyState) => {
    if (partyState.inviteToken) {
      watchHostInvite({ partyId: partyState.partyId, inviteToken: partyState.inviteToken })
    }
  })
}
```

### After
The polling is now only started when the user explicitly clicks the "Invite" button (via `handleInviteClick`):

```javascript
export function initSidebarMultiplayer() {
  partyListContainer = document.getElementById(PARTY_LIST_ID)
  refreshSidebarMultiplayer()
  setupHostControlWatcher()
  setupPartyOwnershipWatcher()
  setupAliasInput()
  // Note: Host polling is started only when user clicks "Invite" button (handleInviteClick)
  // This prevents unnecessary polling before a user actively shares an invite link
}
```

## Rationale

- The signaling server should not be polled until the user explicitly wants to share an invite
- Reduces unnecessary network traffic when the host is not using multiplayer features
- Polling is already correctly started in `handleInviteClick()` → `watchHostInvite()` → `HostInviteMonitor.start()`

## Files Changed

- `src/ui/sidebarMultiplayer.js` - Removed automatic polling loop from `initSidebarMultiplayer()`
- `TODO.md` - Added T044 entry documenting this change
