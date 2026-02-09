# Fix: Mobile joystick TDZ (selectedUnits) crash

**UTC Timestamp:** 2026-02-08T20:49:46Z  
**LLM:** GitHub Copilot (Raptor mini (Preview))

## User Prompt
"2mobileJoysticks.js:103 Uncaught ReferenceError: Cannot access 'selectedUnits' before initialization"

## Summary
- Root cause: circular import / temporal dead zone. `src/ui/mobileJoysticks.js` directly imported `selectedUnits` from `src/inputHandler.js` but `main.js` imports `mobileJoysticks` before it defines `selectedUnits` (via `inputHandler` evaluation), leading to `selectedUnits` being accessed before initialization.
- Fix: Removed direct import and added a safe `getSelectedUnits()` accessor that calls `window.debugGetSelectedUnits()` when available and falls back to `[]` otherwise. Updated usages to call `getSelectedUnits()`.

## Files changed
- `src/ui/mobileJoysticks.js` — removed direct import, added `getSelectedUnits()`, and updated internal uses.
- `TODO/Bugs.md` — logged the fix.

## Notes
- This mirrors patterns used elsewhere (e.g., `utils.js`) to avoid circular import issues by using `window.debugGetSelectedUnits()` where necessary.

Commit message: Fix mobile joystick TDZ: use getSelectedUnits accessor instead of direct import of selectedUnits
