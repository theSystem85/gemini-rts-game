# 2025-01-29T10:00:00Z
## LLM: Copilot (Claude Opus 4.6)

## Prompt Summary
Two-part request:

### 1. LLM First-Tick Strategic Response
When the game starts and LLM AI is enabled in the settings, the LLM should respond with a strategic command response on the very first POST request, not only on the subsequent GET requests. Previously there was a ~60s delay before the first strategic actions.

### 2. LLM Notification Indicator
Notifications that come from the LLM (read aloud via TTS) should show a colored circle indicator on the left of the message in both the popup notification at the top of the screen and the notification history panel. The circle should be colored like the party the LLM controls and contain the robot icon (🤖).

## Changes Made

### `src/ai/llmStrategicController.js`
- Added "IMPORTANT: Respond to THIS message with your first set of strategic actions NOW..." to the end of `STRATEGIC_BOOTSTRAP_PROMPT` to instruct the LLM to issue commands immediately on the first POST
- Changed `instructionPrompt` logic to use `STRATEGIC_BOOTSTRAP_PROMPT` (instead of `STRATEGIC_FOLLOWUP_PROMPT`) on the first call when `!hasBootstrapped`
- Imported `PARTY_COLORS` from config
- Updated `showNotification` call for `parsed.notes` to pass `{ llmPlayerId: playerId, llmColor }` options

### `src/ui/notifications.js`
- Added `options` third parameter to `showNotification` with `llmPlayerId` and `llmColor` support
- When `llmPlayerId` is set, creates a colored circle indicator with 🤖 emoji and flex layout
- Passes LLM options through to `pushNotification` for history tracking

### `src/ui/notificationHistory.js`
- Updated `pushNotification` to accept and store `options` with `llmPlayerId` and `llmColor`
- Updated `renderList` to render `<span class="notif-history__llm-indicator">🤖</span>` with inline background-color for LLM notifications
- Added `notif-history__item--llm` CSS class to LLM notification items

### `styles/notificationHistory.css`
- Added `.notif-history__llm-indicator` styles (22px circle, centered 🤖 emoji)
- Added `.notif-history__item--llm` alignment styles
