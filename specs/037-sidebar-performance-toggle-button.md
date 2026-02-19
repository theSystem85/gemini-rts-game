# 037 - Sidebar Performance Widget Toggle Button

## Context
- Date: 2026-02-18
- Prompt Source: add sidebar performance-toggle icon next to keyboard mappings info button
- LLM: GPT-5.2-Codex

## Requirements
1. Add a sidebar icon button to the right of the keyboard mappings/info (`ℹ️`) button.
2. Add tooltip text for discoverability (`Toggle performance widget`).
3. Button click should trigger the same behavior as existing performance toggle hotkey/action.
4. Keep existing help/info button behavior unchanged.

## Validation Notes
- Add/update unit test coverage for button click wiring to performance dialog toggle.
- Run `npm run lint:fix:changed` after implementation.
