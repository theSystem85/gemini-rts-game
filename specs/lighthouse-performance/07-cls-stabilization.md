# Spec 07 — CLS Stabilization

## Goal
Reduce cumulative layout shift by reserving stable layout dimensions and preventing late UI movement.

## Why (from lighthouse report)
- CLS is **0.365** (target <= 0.1).
- `layout-shifts` reports 12 shifts.

## Scope
- Reserve fixed dimensions for images/icons/panels loaded at startup.
- Prevent sidebar/HUD/modal mounts from shifting main content unexpectedly.
- Audit dynamic content insertion points and replace with non-shifting placeholders.

## Implementation hints
- Use explicit `width`/`height` or aspect-ratio where applicable.
- Avoid adding/removing DOM above active content without reserved space.
- Validate both desktop and mobile layouts.

## Deliverables
- CSS/markup updates stabilizing startup layout.
- Shift-source inventory with before/after notes.

## Acceptance criteria
- CLS significantly reduced from 0.365 baseline.
- No visual jitter during startup.

## Validation
- `npm run lint:fix`
- Lighthouse compare for CLS and layout-shift audit.
