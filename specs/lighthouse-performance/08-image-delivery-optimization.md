# Spec 08 — Image Delivery Optimization

## Goal
Reduce image payload and decoding cost for startup-visible assets.

## Why (from lighthouse report)
- `image-delivery-insight`: estimated savings **238 KiB**.
- Sidebar/building images are primary opportunities.

## Scope
- Re-encode oversized images to efficient formats/quality.
- Ensure startup images are served at displayed dimensions.
- Add responsive variants where practical.
- Keep visual quality acceptable for game UI.

## Implementation hints
- Prioritize top offenders in report (e.g., `construction_yard.png` and large sidebar assets).
- Prefer WebP/AVIF where compatibility allows.
- Avoid runtime resizing of much larger source images.

## Deliverables
- Optimized image assets + updated references.
- Asset size before/after table.

## Acceptance criteria
- Lower image-delivery estimated savings than baseline.
- No broken image paths or unacceptable quality loss.

## Validation
- `npm run lint:fix`
- Lighthouse image-delivery compare.
