# Spec 09 — Static Asset Caching and Invalidation Policy

## Goal
Improve repeat-load performance and reduce re-download cost for large JS/CSS/image assets.

## Why (from lighthouse report)
- Total byte weight is very high (**18,375 KiB**).
- Strong cache policy is required to avoid repeated heavy transfers.

## Scope
- Add/verify long-lived immutable caching for hashed static assets.
- Keep HTML short-lived to allow manifest updates.
- Ensure cache invalidation works correctly on deploy.
- Align service worker caching strategy with HTTP headers (if SW is active).

## Implementation hints
- Use `Cache-Control: public, max-age=31536000, immutable` on fingerprinted assets.
- Use no-cache/short TTL on HTML entry.
- Validate with network panel or response header checks.

## Deliverables
- Hosting/server config updates and cache policy documentation.

## Acceptance criteria
- Correct cache headers on static assets and HTML.
- No stale-asset breakages across deploy simulation.

## Validation
- `npm run build`
- `npm run lint:fix`
- Header verification commands + repeat lighthouse run.
