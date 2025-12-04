# Netlify Blobs Race Condition Fix

**UTC Timestamp:** 2025-12-04T11:00:00Z  
**LLM:** Claude Opus 4.5 (via GitHub Copilot)

---

## Problem

After converting to Netlify Functions v2 format, multiplayer signalling was failing because WebRTC answers posted by the host were being overwritten by concurrent ICE candidate writes. The logs showed:

```
[API] Answer stored, verify hasAnswer: false
```

The root cause was that offer, answer, and candidates were all stored in a single blob. When multiple requests came in concurrently (answer + candidates), they would:
1. Read the session
2. Modify it
3. Write it back

If a candidate read happened before the answer write completed, and then the candidate wrote after, it would overwrite the answer with `null`.

## Solution

Refactored the signalling API to use **separate blob keys** for each data type:
- `offer:{inviteToken}:{peerId}` - stores the offer and alias
- `answer:{inviteToken}:{peerId}` - stores the answer (independent!)
- `candidates:{inviteToken}:{peerId}` - stores the candidates array
- `meta:{inviteToken}:{peerId}` - stores metadata for listing sessions

This eliminates race conditions because each data type is stored independently - writing an answer can never overwrite candidates and vice versa.

## Additional Fixes

- Client (`remoteConnection.js`) now properly filters out its own ICE candidates (origin: 'peer') and only processes host candidates
- Client properly parses the nested candidate structure from the new API format
- Removed debug logging from server and client code after successful testing

## Files Modified

### `netlify/functions/api.js`
- Complete rewrite using separate blob keys
- Removed Express/serverless-http, using native Request/Response
- Strong consistency mode for Netlify Blobs

### `src/network/signalling.js`
- Simplified STUN host detection (always use relative URLs)
- Works with both `netlify dev` and production

### `src/network/remoteConnection.js`  
- Fixed candidate parsing for new API structure
- Added origin filtering to skip own candidates

### `src/network/webrtcSession.js`
- Cleaned up error handling in answerOffer

### `netlify.toml`
- Simplified config, removed Express-specific settings
