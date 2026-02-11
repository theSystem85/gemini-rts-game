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


## Implementation status
- [x] Kept `base.css`, `sidebar.css`, and `cursors.css` in the render-critical stylesheet chain.
- [x] Deferred non-critical `overlays.css`, `modals.css`, and `notificationHistory.css` using `preload` + `onload` stylesheet promotion.
- [x] Added `noscript` stylesheet fallbacks for deferred CSS files.
- [x] Added minimal inline guard styles for hidden-by-default overlay/modal/history containers to avoid flash-of-unstyled-content before deferred CSS applies.
- [x] Restored settings and cheat modal visibility by adding a critical inline `.config-modal--open` display rule while deferred CSS loads.

## Quick visual regression checklist
- [x] Initial load still shows the gameplay shell and sidebar with correct base/layout styling.
- [x] Hidden overlays/modals remain hidden on first paint (no flashing panel/modal/history UI).
- [x] Deferred styles still apply when corresponding UI components are opened during gameplay.
