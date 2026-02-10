# Spec 01 — Production Minification + Compression

## Goal
Cut initial JS transfer size by shipping minified production assets and gzip/brotli compressed responses.

## Why (from lighthouse report)
- `unminified-javascript`: estimated savings **12,966 KiB**.
- Performance is heavily blocked by script transfer + parse/compile work.

## Scope
- Ensure production build emits minified JS/CSS.
- Ensure static serving enables `Content-Encoding` (br or gzip).
- Verify source maps are not shipped in runtime path unless explicitly gated.
- Keep cache-busting filenames intact.

## Implementation hints
- Check build config (`vite.config.*`, package scripts, static hosting config).
- Validate minifier options (esbuild/terser) are enabled for production mode.
- Add/verify compression middleware or static server compression settings.

## Deliverables
- Updated build/runtime config.
- Notes in this spec or linked doc on how to verify compression/minification.

## Acceptance criteria
- Production JS is minified (no large unminified module blobs).
- Lighthouse `unminified-javascript` audit no longer reports multi-MiB savings.
- No functional regressions in app startup.

## Validation
- `npm run build`
- `npm run lint:fix`
- Run lighthouse against production build artifact and compare `unminified-javascript`.
