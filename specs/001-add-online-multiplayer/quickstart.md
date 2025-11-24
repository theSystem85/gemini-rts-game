# Quickstart: Online Multiplayer Takeover

1. **Start the minimal STUN/signalling helper**: `node server/stun.js` (this script uses Express to expose `/signalling/offer`, `/signalling/answer`, `/signalling/candidate`, and `/game-instance/:id/invite-regenerate` so peers can exchange WebRTC metadata).
2. **Run the game client** as usual via `npm run dev` so the host can load the map and render the sidebar invite rows.
3. **Host workflow**: Open the party list below the "Players:" input, click an invite button to copy the generated link, and keep the browser running to remain the authoritative source of truth.
4. **Remote workflow**: Open the invite URL in another browser, enter an alias, let the client POST the offer to `/signalling/offer`, and wait for the host to relay the answer and ICE candidates.
5. **Fallback & saves**: When a remote player disconnects, the host automatically resumes AI control; if a non-host loads a save, call `/game-instance/:id/invite-regenerate` to refresh tokens and let the new host take over.
6. **Testing**: Validate success criteria by checking host notifications, short join times, instant AI fallback, and host-only start/pause/cheat controls.
