# Gemini RTS Signal Server

This Express application relays WebRTC signaling messages between browsers and issues invite identifiers for specific parties in a Gemini RTS match. It is intentionally lightweight and keeps all state in memory.

## Running locally

```bash
cd server
npm install
npm run dev
```

By default the server listens on port `3001`. The front-end will attempt to reach `http://localhost:3001` (and the matching WebSocket endpoint) when the game is loaded from another development port such as Vite's default `5173`. In production the client assumes the signaling service is hosted on the same origin.

### Environment overrides

The client can be pointed at a different origin by defining either of the following when building or running the front-end:

- `VITE_SIGNAL_HTTP_URL` – base HTTP URL used for REST calls (e.g. `https://multiplayer.example.com`)
- `VITE_SIGNAL_WS_URL` – base WebSocket URL used for signaling (e.g. `wss://multiplayer.example.com`)

When these variables are not provided, the client falls back to sensible defaults based on the current window location.

## API overview

- `POST /api/invites` – create an invite for a `{ sessionId, partyId }` pair. Returns `{ inviteId }`.
- `GET /api/invites/:inviteId` – retrieve the invite metadata so the joining player knows which session and party to target.
- `GET /health` – simple readiness probe.
- `WS /signal` – relay channel for WebRTC offers, answers, and ICE candidates.

All state is ephemeral; restarting the process clears invites and connected sessions.
