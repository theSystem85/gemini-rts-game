# Spec 017 - Key Bindings Editor

## Goal
Add a Key Bindings Editor as a tab inside the sidebar Settings modal (Runtime Config dialog) so players can review and customize keyboard, mouse, and touch bindings. The editor should persist overrides, highlight custom mappings, and support import/export.

## Requirements
- The Settings modal gains tabs: "Runtime Config" (existing) and "Key Bindings".
- The Key Bindings tab lists bindings grouped by context (e.g., gameplay vs. map edit), and by device (keyboard, mouse, touch).
- Capturing a binding accepts simultaneous modifier combos, Tab, and gesture inputs (double-click/tap, two-finger tap).
- Non-default bindings are highlighted (soft yellow background) and can be reset individually or globally.
- User overrides persist in `localStorage` and can be exported/imported as JSON that includes app version and commit hash metadata.
- Bindings affect live input handling: keyboard and mouse controls respect customized bindings without requiring a reload.
- UI styling matches the existing Settings/Runtime Config theme.
