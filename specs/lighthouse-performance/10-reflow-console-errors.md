# Spec 10 — Forced Reflow + Console Error Cleanup

## Goal
Reduce runtime instability and hidden performance penalties from forced synchronous layout and startup errors.

## Why (from lighthouse report)
- Failing audits: `errors-in-console`, `deprecations`, `forced-reflow-insight`.
- These can mask regressions and contribute to interactivity delays.

## Scope
- Identify and fix startup console errors/warnings in production path.
- Remove or mitigate forced reflow patterns (layout thrashing reads/writes).
- Replace deprecated APIs where possible.

## Implementation hints
- Batch layout reads before writes.
- Avoid style/layout queries inside frequent update loops.
- Add lightweight regression assertions for known console-clean startup.

## Deliverables
- Error-free startup console (or documented unavoidable third-party warnings).
- Reflow hotspots addressed with measurable reduction.

## Acceptance criteria
- Console error audit passes or is materially improved.
- Forced reflow insight reduced and no new deprecations introduced.

## Validation
- `npm run lint:fix`
- Lighthouse compare for console errors/deprecations/forced reflow.

## Implementation notes (2026-02)
- Service worker fetch caching now skips partial-content (`206`) and `Range` requests before calling `Cache.put`.
- This prevents startup/runtime console errors such as `Failed to execute 'put' on 'Cache': Partial response (status code 206) is unsupported`.
- Cache writes remain best-effort and are wrapped to avoid breaking live network responses when caching fails.
