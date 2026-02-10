# Spec 03 — Request Fan-Out Reduction via Bundling Strategy

## Goal
Reduce startup network request count and dependency depth to improve Speed Index and startup stability.

## Why (from lighthouse report)
- Diagnostics: **399 requests**, **233 scripts**, total payload **18,375 KiB**.
- Dependency overhead delays effective execution and paint.

## Scope
- Configure manual chunks or bundle strategy to reduce micro-module request fan-out.
- Ensure chunk boundaries align with usage patterns (core, gameplay, optional features).
- Keep chunk sizes balanced (avoid one giant monolith and avoid tiny-chunk explosion).

## Implementation hints
- Use bundler analysis output to identify excessive chunk granularity.
- Group frequently co-used modules together.
- Preserve long-term caching (stable vendor chunk names where possible).

## Deliverables
- Updated bundler chunking strategy config.
- Before/after request-count metrics summary.

## Acceptance criteria
- Initial script request count materially reduced.
- No regressions in cacheability or load failures.
- Lighthouse network dependency tree is simpler than baseline.

## Validation
- `npm run build`
- `npm run lint:fix`
- Compare request count from Lighthouse network-requests audit.
