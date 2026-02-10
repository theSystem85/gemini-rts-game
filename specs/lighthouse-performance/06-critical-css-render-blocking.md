# Spec 06 — Critical CSS + Render-Blocking Reduction

## Goal
Improve first paint by minimizing CSS render-blocking time.

## Why (from lighthouse report)
- `render-blocking-insight`: estimated **700ms** savings.
- Several stylesheets are loaded render-blocking in startup path.

## Scope
- Inline or preload truly critical CSS for first paint shell.
- Defer non-critical styles (`modals`, optional overlays) without FOUC.
- Ensure style load order and cascade integrity are preserved.

## Implementation hints
- Keep only above-the-fold layout styles in critical path.
- Load non-critical CSS with `media`/`onload` strategy or equivalent.
- Validate visual parity on initial page state.

## Deliverables
- Updated stylesheet loading strategy.
- Quick visual regression checklist.

## Acceptance criteria
- Lower render-blocking savings estimate vs baseline.
- No layout/style regressions on initial load.

## Validation
- `npm run build`
- `npm run lint:fix`
- Lighthouse compare for render-blocking + FCP/SI.
