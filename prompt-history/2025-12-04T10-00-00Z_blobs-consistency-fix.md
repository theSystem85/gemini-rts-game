# Netlify Blobs Strong Consistency Fix

**UTC Timestamp:** 2025-12-04T10:00:00Z  
**LLM:** Claude (Copilot)

## Prompt Summary
User provided host console logs showing that the answer was being posted successfully (`[HostSession] Answer posted successfully`), but subsequent polls from the `/pending` endpoint were still returning `"answer":null`.

## Analysis
The root cause was identified as Netlify Blobs' eventual consistency model. When using `consistency: 'eventual'` (the default), writes may not be immediately visible to subsequent reads. This is problematic for real-time WebRTC signalling where the answer must be visible immediately after it's stored.

## Changes Made
1. Changed `getSessionStore()` to use `consistency: 'strong'` instead of `'eventual'`
2. Removed the `context.blobs()` approach in favor of always using `getStore()` with strong consistency
3. Added server-side logging to trace:
   - POST `/signalling/answer` - logs when answer is stored and verifies the write
   - GET `/signalling/pending` - logs what sessions are found and their answer status
   - GET `/signalling/session` - logs session lookup results

## Files Modified
- `netlify/functions/api.js` - Strong consistency + debug logging
