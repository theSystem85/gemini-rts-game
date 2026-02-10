# Spec 02 — Startup Code-Splitting

## Goal
Load only startup-critical code on first paint; lazy-load heavy gameplay modules after initial UI is interactive.

## Why (from lighthouse report)
- LCP: **109.9s**, TTI: **110.1s**.
- 233 scripts loaded during startup indicates over-eager module loading.

## Scope
- Identify startup-critical modules vs deferred modules.
- Convert heavy modules to dynamic imports where safe (missions, AI systems, advanced overlays/modals, editor-only logic).
- Add loading guards to avoid race conditions when deferred modules initialize.

## Implementation hints
- Start from largest scripts in report (`missions/mission_01.js`, AI and renderer-heavy modules).
- Prefer split by feature entrypoints and user actions.
- Keep first-input paths synchronous only when required for core gameplay bootstrap.

## Deliverables
- Refactored import boundaries with lazy-loading.
- Lightweight startup manifest documenting what loads immediately vs deferred.

## Acceptance criteria
- Reduced number of scripts in initial document critical path.
- Improved FCP/LCP/TTI in follow-up lighthouse run.
- No runtime errors due to missing deferred dependencies.

## Validation
- `npm run build`
- `npm run lint:fix`
- Lighthouse compare (focus: FCP, LCP, TTI).
