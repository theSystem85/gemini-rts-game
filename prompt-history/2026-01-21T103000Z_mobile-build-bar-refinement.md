2026-01-21T10:30:00Z
Gemini 3 Flash (Preview)

The user requested:
"the toggle button is too wide, reduce its width by 33% and ensure the buildings or units label is visible again written from top to bottom in a column. also ensure the build buttons get visible again"

Summary of changes:
- Reduced `#mobileCategoryToggle` width to 67% of `var(--mobile-action-size)`.
- Swapped toggle and production buttons positions (toggle to left).
- Changed toggle text orientation to vertical-upright for a single-column letter effect.
- Adjusted CSS hierarchy for `#production` to ensure buttons are visible and scrollable.
- Added `display: contents` to intermediate production wrappers in condensed mode.
