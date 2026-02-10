# 2025-01-30T12:00:00Z
## LLM: Copilot (Claude Opus 4.6)

## Prompt Summary
6-part improvement request for the LLM strategic AI system:

1. **Commentary skip & no-repeat**: Ensure the LLM AI does not need to comment on the game after every AI tick cycle when nothing interesting happened. Ensure the LLM when commenting does not repeat itself.
2. **Rich initial prompt with catalogs**: Ensure with the initial prompt the LLM gets more context—full unit/building stats catalog including cost, HP, speed, armor, ammo, damage, weapon type, fire range, spawn building, and role.
3. **Fog-of-war filtering**: Ensure the enemy AI only knows about what is visible on the map (considering shadow of war).
4. **Owner info in state updates**: Make sure the game state update for the LLM on each tick also contains the party information for each unit and building.
5. **LLM-locked units auto-attack + retreat**: Ensure the enemy units still attack every foreign unit in their range also when they are commanded by the LLM. Also add tactical retreat support in the bootstrap prompt.
6. **Notification history bubble**: Put an info bubble in the top right screen that toggles a list with all the previously shown notifications. Professional UI with bell icon, unread badge count, scrollable reverse-chronological list, clear and close buttons, responsive for mobile.

## Files Changed
- `src/ai/llmStrategicController.js` — Added unit/building catalogs, expanded bootstrap prompt, commentary skip logic, fog-of-war filtering, owner-aware summaries
- `src/ai/enemyUnitBehavior.js` — LLM-locked units now retaliate and auto-target enemies in range
- `src/ui/notifications.js` — Pushes all notifications into persistent history
- `src/ui/notificationHistory.js` — New: notification history panel with badge, toggle, clear, 100-entry limit
- `styles/notificationHistory.css` — New: professional dark-themed styles for notification history UI
- `index.html` — Added CSS link for notification history styles
- `src/main.js` — Wired `initNotificationHistory()` on DOMContentLoaded
- `specs/032-llm-strategic-ai.md` — Updated with new commentary, fog-of-war, catalog, owner, and retreat behaviors
- `TODO/Features.md` — Marked completed LLM improvements
