# Spec 05 — Unused JavaScript Elimination

## Goal
Reduce shipped but unused JS on initial load to improve parse/compile and transfer overhead.

## Why (from lighthouse report)
- `unused-javascript` estimated savings: **669 KiB**.
- Multiple large modules show ~16–19% startup-unused bytes.

## Scope
- Remove dead code and unreachable imports.
- Gate debug/dev-only logic from production bundles.
- Ensure optional features are conditionally imported only when needed.

## Implementation hints
- Audit top offenders from report: enemy/renderer/save/production/input modules.
- Replace static imports with dynamic imports for optional paths.
- Keep tree-shake-friendly exports (avoid side-effectful module tops where possible).

## Deliverables
- Cleanup PR reducing unused startup JS.
- Documented map of removed or deferred code paths.

## Acceptance criteria
- Lower `unused-javascript` estimated savings than baseline.
- No functional regressions in key gameplay flows.

## Validation
- `npm run build`
- `npm run lint:fix`
- Lighthouse `unused-javascript` compare.
