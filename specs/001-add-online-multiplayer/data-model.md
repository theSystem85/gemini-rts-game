# Data Model: Online Multiplayer Takeover

## PartyState
- **Represents**: A color-coded party entry shown in the sidebar; tracks whether the party is human or AI controlled and what invite link is available.
- **Fields**:
  - `partyId` (string): Stable identifier matching `gameState.parties` for the party.
  - `color` (enum): Party color (red, blue, yellow, green) reused from the existing color palette.
  - `owner` (string): Human alias when connected, `AI` label otherwise.
  - `inviteToken` (string|null): Token tied to the current game instance and party; null while host regenerates.
  - `aiActive` (boolean): True if the AI is currently steering the party.
  - `lastConnectedAt` (timestamp|null): Useful for showing join notifications and debugging reconnects.
- **Validations**: `inviteToken` must match `gameInstanceId:partyId` pairing; `owner` cannot be empty when `aiActive` is false.
- **State transitions**: `aiActive` toggles false when a remote peer connects (after alias entry); toggles true again on disconnect; `owner` flips between alias and `AI` depending on connection and save reloads.

## InviteLink
- **Represents**: Per-party shareable URL components.
- **Fields**:
  - `gameInstanceId` (string): UUID (or deterministic hash) generated when a new match starts or when a save loads and a new host is elected.
  - `partyId` (string): Which party the link controls.
  - `token` (string): Signed/UUID portion that prevents tampering.
  - `createdAt` (timestamp): When the link was issued.
  - `expiresOnHostExit` (boolean): True when the host quits and the match ends; false while invites should stay valid.
- **Validations**: The combination `(gameInstanceId, partyId, token)` must resolve to the current host and party state before allowing a WebRTC handshake.

## WebRTCSession
- **Represents**: A pending or active WebRTC DataChannel handshake for a party takeover.
- **Fields**:
  - `hostId` (string): Identifier for the host browser/device.
  - `peerId` (string): Temporary ID given to the connecting browser after alias submission.
  - `alias` (string): Remote player's chosen name.
  - `connectionState` (enum): `pending`, `connected`, `failed`, `disconnected`.
  - `offer` / `answer` / `iceCandidates` (arrays): Blob of the SDP/candidates exchanged through the Express helper.
  - `lastHeartbeat` (timestamp): Tracks the last ping so host knows when to fail over to AI after dropout.
- **Validations**: `connectionState` cannot be `connected` without both offer and answer recorded; `iceCandidates` should be appended only while still pending.
- **State transitions**: `pending` -> `connected` when the handshake completes; `connected` -> `disconnected` when DataChannel closes; `disconnected` triggers AI takeover.
