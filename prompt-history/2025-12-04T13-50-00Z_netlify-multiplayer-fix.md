# Netlify Multiplayer Signalling Fix

**UTC Timestamp:** 2025-12-04T13:50:00Z  
**LLM:** Claude (Copilot)

## Prompt Summary

User deployed multiplayer game to Netlify and received 404 errors when client tried to connect to host. Multiple issues were identified and fixed through iterative debugging.

## Issues Identified

### 1. Initial 404 Errors
The Netlify function wasn't receiving requests due to a conflict between:
- `export const config = { path: '/api/*' }` in the function
- The redirect in `netlify.toml` from `/api/*` to `/.netlify/functions/api/:splat`

**Fix:** Removed the `config.path` export and simplified the redirect.

### 2. Netlify Blobs `list({ prefix })` Not Working
The `store.list({ prefix })` API wasn't reliably returning keys even when they existed in the blob store.

**Fix:** Implemented an explicit index-based tracking system:
- When storing an offer, also store peerId in `index:{inviteToken}` blob
- When polling for pending sessions, read from the index instead of using prefix search

### 3. Host Polling Stopped After First 404
The async `_schedulePoll` function would stop polling if `_pollSessions` threw an error because the `setTimeout` for the next tick never got called.

**Fix:** Added try-catch wrapper around `await this._pollSessions()` in the tick function.

### 4. CDN Caching 404 Responses
Netlify's CDN was caching 404 responses, so even after the client posted an offer, the host kept receiving cached 404s. This was the main issue - logs showed only one function invocation despite multiple fetch requests from the browser.

**Fix:** Added cache-busting to all signalling GET requests:
- Added `?_t=${Date.now()}` query parameter
- Added `cache: 'no-store'` to fetch options
- Added `Cache-Control: no-store, no-cache` headers to responses

## Files Modified

### `netlify.toml`
- Simplified redirect from `/api/*` to `/.netlify/functions/api`
- Added `force = false` to SPA fallback

### `netlify/functions/api.js`
- Removed conflicting `export const config`
- Implemented index-based peer tracking instead of prefix listing
- Added no-cache headers to responses
- Removed debug logging after fix confirmed

### `src/network/signalling.js`
- Added cache-busting timestamps to `fetchPendingSessions()` and `fetchSessionStatus()`
- Added `cache: 'no-store'` to fetch options

### `src/network/webrtcSession.js`
- Added try-catch wrapper in `_schedulePoll` to ensure polling continues on errors
- Removed debug logging after fix confirmed

## Result

Multiplayer WebRTC signalling now works correctly on Netlify production. Host polling continues reliably, finds client offers, and establishes peer connections.
