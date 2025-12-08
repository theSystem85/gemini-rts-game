# 015 - Autosave and resume paused PWA sessions

## Requirements
- Maintain a dedicated `lastGame` checkpoint in localStorage (`rts_save_lastGame`) that is overwritten on each checkpoint.
- Save the current game automatically at least once every 60 seconds whenever a game is active, even if it is paused.
- When the player pauses, immediately write a `lastGame` save and mark the session for auto-resume so a suspended PWA can return to that spot.
- Save the session when the page is hidden or being unloaded to protect against iOS PWA eviction.
- On startup/resume, if the auto-resume flag is set and `lastGame` exists, load it automatically so a paused session returns without manual input, then clear the flag.
